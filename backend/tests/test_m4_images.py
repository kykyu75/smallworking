"""M4: 이미지 업로드 (API-019, API-020, DEC-002, DEC-007, TEST_CASES §7)."""

from __future__ import annotations

from io import BytesIO

import pytest
from sqlalchemy import func, select

from app.models import Category, Post, PostImage
from app.services.image_processing import MAX_UPLOAD_BYTES
from app.storage import StorageError
from app.storage.blob import BlobStorage
from tests.images import exif_with_orientation, make_animated_gif, make_image, open_image


def upload(client, data: bytes, filename: str = "photo.jpg", content_type: str = "image/jpeg"):
    return client.post("/api/images", files={"file": (filename, BytesIO(data), content_type)})


def stored(storage, url: str) -> bytes:
    key = url.removeprefix("/uploads/")
    return (storage.root / key).read_bytes()


# ---------------------------------------------------------------- 업로드 성공


# TC-IMG-001, TC-IMG-002: 저장소에 원본·썸네일, DB에는 키와 메타데이터만, post_id = NULL
def test_tc_img_001_upload_creates_files_and_temp_record(admin_client, storage, db_session):
    response = upload(admin_client, make_image("JPEG", (800, 600)), filename="kitchen.jpg")
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "url", "thumbnail_url", "original_name", "mime_type", "file_size", "width", "height"}
    assert body["mime_type"] == "image/jpeg"
    assert (body["width"], body["height"]) == (800, 600)
    assert body["original_name"] == "kitchen.jpg"
    assert body["url"].startswith("/uploads/images/2026/11/") and body["url"].endswith(".jpg")
    assert body["thumbnail_url"].endswith("_thumb.jpg")

    image = db_session.get(PostImage, body["id"])
    assert image.post_id is None and image.display_order is None
    assert image.file_path == body["url"].removeprefix("/uploads/")  # DB에는 키만
    assert not hasattr(image, "data")
    assert storage.exists(image.file_path) and storage.exists(image.thumbnail_path)
    assert image.file_size == len(stored(storage, body["url"]))


@pytest.mark.parametrize(
    ("fmt", "mime", "ext"),
    [("PNG", "image/png", "png"), ("WEBP", "image/webp", "webp"), ("GIF", "image/gif", "gif")],
)
def test_supported_formats(admin_client, fmt, mime, ext):
    response = upload(admin_client, make_image(fmt, (300, 200)), filename=f"a.{ext}", content_type=mime)
    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == mime
    assert response.json()["url"].endswith(f".{ext}")


# ---------------------------------------------------------------- 축소·썸네일


# TC-IMG-013: 서버도 1920px로 축소, 썸네일 400px
def test_tc_img_013_server_resizes_large_image(admin_client, storage):
    body = upload(admin_client, make_image("JPEG", (4000, 3000))).json()
    assert (body["width"], body["height"]) == (1920, 1440)
    assert open_image(stored(storage, body["url"])).size == (1920, 1440)
    assert max(open_image(stored(storage, body["thumbnail_url"])).size) == 400


# TC-IMG-014: 작은 이미지는 확대하지 않는다
def test_tc_img_014_small_image_not_enlarged(admin_client, storage):
    body = upload(admin_client, make_image("PNG", (800, 600)), "a.png", "image/png").json()
    assert (body["width"], body["height"]) == (800, 600)
    assert open_image(stored(storage, body["thumbnail_url"])).size == (400, 300)


def test_exif_orientation_applied_and_metadata_removed(admin_client, storage):
    # 6 = 시계 방향 90도 회전해서 봐야 하는 사진. GPS 정보 포함
    data = make_image("JPEG", (400, 200), exif=exif_with_orientation(6, gps=True))
    body = upload(admin_client, data).json()
    assert (body["width"], body["height"]) == (200, 400)  # 바로 세워짐
    saved = open_image(stored(storage, body["url"]))
    assert saved.getexif().get(0x8825) is None  # 촬영 위치(GPS) 제거
    assert saved.getexif().get(0x0112) in (None, 1)


def test_animated_gif_kept_as_is(admin_client, storage):
    data = make_animated_gif()
    body = upload(admin_client, data, "anim.gif", "image/gif").json()
    assert stored(storage, body["url"]) == data  # 움직임 유지 (원본 그대로)
    assert getattr(open_image(stored(storage, body["url"])), "n_frames", 1) == 3


# ---------------------------------------------------------------- 거부


# TC-IMG-009: 지원하지 않는 형식
@pytest.mark.parametrize(
    ("data", "filename", "content_type"),
    [
        (b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 100, "video.mp4", "video/mp4"),
        (b"MZ\x90\x00" + b"\x00" * 100, "app.exe", "application/octet-stream"),
        (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "x.svg", "image/svg+xml"),
        (make_image("BMP", (10, 10)), "a.bmp", "image/bmp"),
    ],
)
def test_tc_img_009_unsupported_types_rejected(admin_client, storage, db_session, data, filename, content_type):
    response = upload(admin_client, data, filename, content_type)
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_IMAGE_TYPE"
    assert db_session.execute(select(func.count()).select_from(PostImage)).scalar_one() == 0
    assert not storage.root.exists() or not any(storage.root.rglob("*.*"))


# TC-IMG-011: 내용은 텍스트인데 이름만 .jpg
def test_tc_img_011_disguised_extension_rejected(admin_client, db_session):
    response = upload(admin_client, b"this is not an image", "photo.jpg", "image/jpeg")
    assert response.status_code == 415
    assert db_session.execute(select(func.count()).select_from(PostImage)).scalar_one() == 0


def test_truncated_image_is_invalid(admin_client):
    data = make_image("PNG", (200, 200))
    response = upload(admin_client, data[: len(data) // 2], "half.png", "image/png")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


# TC-IMG-010 (API): 4MB 초과
def test_tc_img_010_over_4mb_rejected(admin_client, db_session):
    response = upload(admin_client, b"\xff" * (MAX_UPLOAD_BYTES + 1))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "IMAGE_TOO_LARGE"
    assert db_session.execute(select(func.count()).select_from(PostImage)).scalar_one() == 0


def test_missing_file_field(admin_client):
    response = admin_client.post("/api/images", data={"other": "x"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# TC-IMG-012: 로그인하지 않으면 401
def test_tc_img_012_upload_requires_admin(client, db_session):
    response = upload(client, make_image())
    assert response.status_code == 401
    assert db_session.execute(select(func.count()).select_from(PostImage)).scalar_one() == 0


# ---------------------------------------------------------------- 파일 이름


# TC-IMG-023, TC-SEC-008: 서버가 만든 무작위 이름, 원래 이름은 original_name에만
@pytest.mark.parametrize("filename", ["../../x.jpg", "..\\..\\evil.jpg", "내 사진.jpg", "/etc/passwd.jpg"])
def test_tc_img_023_filename_is_never_used_as_path(admin_client, storage, filename):
    body = upload(admin_client, make_image(), filename=filename).json()
    key = body["url"].removeprefix("/uploads/")
    assert key.startswith("images/2026/11/") and ".." not in key and " " not in key
    assert (storage.root / key).resolve().is_relative_to(storage.root)
    expected = filename.replace("\\", "/").rsplit("/", 1)[-1]
    assert body["original_name"] == expected


def test_local_storage_rejects_paths_outside_root(storage):
    with pytest.raises(StorageError):
        storage.save("../outside.jpg", b"x", "image/jpeg")


# ---------------------------------------------------------------- 임시 이미지 삭제 (API-020)


# TC-IMG-019
def test_tc_img_019_delete_temp_image(admin_client, storage, db_session):
    body = upload(admin_client, make_image()).json()
    image = db_session.get(PostImage, body["id"])
    keys = [image.file_path, image.thumbnail_path]

    assert admin_client.delete(f"/api/images/{body['id']}").status_code == 204
    assert db_session.get(PostImage, body["id"]) is None
    assert not any(storage.exists(k) for k in keys)


# TC-IMG-020: 글에 연결된 이미지는 409
def test_tc_img_020_image_in_use_cannot_be_deleted(admin_client, storage, db_session):
    body = upload(admin_client, make_image()).json()
    category = db_session.execute(select(Category).where(Category.name == "DIY")).scalar_one()
    post = Post(category_id=category.id, title="글", content={"type": "doc", "content": []})
    db_session.add(post)
    db_session.flush()
    image = db_session.get(PostImage, body["id"])
    image.post_id, image.display_order = post.id, 0
    db_session.flush()

    response = admin_client.delete(f"/api/images/{body['id']}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IMAGE_IN_USE"
    assert storage.exists(image.file_path)


def test_delete_image_not_found_and_requires_admin(admin_client, client):
    assert admin_client.delete("/api/images/99999").status_code == 404
    admin_client.post("/api/admin/logout")
    assert client.delete("/api/images/99999").status_code == 401


# ---------------------------------------------------------------- 실패 시 정리


def test_db_failure_removes_saved_files(admin_client, storage, db_session, monkeypatch):
    def broken_commit():
        raise RuntimeError("DB 장애")

    monkeypatch.setattr(db_session, "commit", broken_commit)
    from fastapi.testclient import TestClient

    with TestClient(admin_client.app, raise_server_exceptions=False, headers={"Origin": "http://testserver"}) as c:
        c.cookies.update(admin_client.cookies)
        response = upload(c, make_image())
    assert response.status_code == 500
    assert not storage.root.exists() or not any(p.is_file() for p in storage.root.rglob("*"))


# ---------------------------------------------------------------- 정적 파일 제공 / 보안 헤더


# TC-SEC-007: 업로드 파일은 저장된 형식으로만, nosniff
def test_tc_sec_007_uploaded_files_served_with_nosniff(tmp_path, monkeypatch):
    # /uploads 마운트는 설정의 UPLOAD_ROOT를 쓰므로 그 폴더로 앱을 만든다
    from fastapi.testclient import TestClient

    from app.core.config import get_settings
    from app.main import create_app

    root = get_settings().upload_root
    (root / "images").mkdir(parents=True, exist_ok=True)
    target = root / "images" / "served.jpg"
    target.write_bytes(make_image())
    try:
        with TestClient(create_app()) as c:
            response = c.get("/uploads/images/served.jpg")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.headers["x-content-type-options"] == "nosniff"
    finally:
        target.unlink(missing_ok=True)


def test_api_responses_have_nosniff(client):
    assert client.get("/api/health").headers["x-content-type-options"] == "nosniff"


# ---------------------------------------------------------------- BlobStorage (SDK 호출만 확인, 실제 업로드는 TC-DEP-002)


def test_blob_storage_calls_sdk(monkeypatch):
    import vercel.blob.sync as sdk

    calls = {}
    monkeypatch.setattr(sdk, "put_blob", lambda pathname, body, **kw: calls.setdefault("put", (pathname, body, kw)))
    monkeypatch.setattr(sdk, "delete_blob", lambda keys, **kw: calls.setdefault("delete", keys))

    blob = BlobStorage(token="vercel_blob_rw_test_token", public_base_url="https://store.public.blob.vercel-storage.com/")
    blob.save("images/2026/11/a.jpg", b"data", "image/jpeg")
    pathname, body, kwargs = calls["put"]
    assert pathname == "images/2026/11/a.jpg" and body == b"data"
    assert kwargs["access"] == "public"
    assert kwargs["add_random_suffix"] is False and kwargs["allow_overwrite"] is False
    assert kwargs["content_type"] == "image/jpeg"

    blob.delete(["images/2026/11/a.jpg"])
    assert calls["delete"] == ["images/2026/11/a.jpg"]
    assert blob.public_url("images/2026/11/a.jpg") == "https://store.public.blob.vercel-storage.com/images/2026/11/a.jpg"


def test_blob_storage_requires_settings():
    with pytest.raises(RuntimeError):
        BlobStorage(token="", public_base_url="https://x")
    with pytest.raises(RuntimeError):
        BlobStorage(token="t", public_base_url="")
