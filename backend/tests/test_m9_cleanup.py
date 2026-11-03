"""M9: 정리 작업 (API-028, DATA_MODEL v1.0 §15, TEST_CASES TC-IMG-021, 027, 028)."""

from __future__ import annotations

import os
import time
from datetime import timedelta
from io import BytesIO

import pytest
from sqlalchemy import func, select

from app.models import AdminSession, Category, Post, PostImage
from app.services import cleanup_service
from tests.images import make_image

CRON = {"Authorization": "Bearer test-cron-secret"}


def upload(client) -> dict:
    response = client.post("/api/images", files={"file": ("a.jpg", BytesIO(make_image()), "image/jpeg")})
    assert response.status_code == 201
    return response.json()


def keys_of(db, image_id: int) -> list[str]:
    image = db.get(PostImage, image_id)
    return [image.file_path, image.thumbnail_path]


def age_file(storage, key: str, days: int = 3) -> None:
    """파일 수정 시각을 과거로 돌린다 (실제로 기다리지 않음)."""
    old = time.time() - days * 86400
    os.utime(storage.root / key, (old, old))


# ---------------------------------------------------------------- 인증 (TC-IMG-027)


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer wrong"}, {"Authorization": "test-cron-secret"}, {"Authorization": "Bearer "}],
)
def test_tc_img_027_requires_cron_secret(client, headers):
    response = client.get("/api/cron/cleanup", headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_tc_img_027_admin_session_is_not_enough(admin_client):
    assert admin_client.get("/api/cron/cleanup").status_code == 401


def test_empty_cron_secret_always_rejected(client, monkeypatch):
    from app.core import config

    settings = config.get_settings()
    monkeypatch.setattr(config, "get_settings", lambda: type(settings)(**{**settings.__dict__, "cron_secret": ""}))
    from app.api import cron

    monkeypatch.setattr(cron, "get_settings", config.get_settings)
    assert client.get("/api/cron/cleanup", headers={"Authorization": "Bearer "}).status_code == 401


# ---------------------------------------------------------------- 임시 이미지 (TC-IMG-021)


# TC-IMG-021: 24시간 지난 임시 이미지만 삭제, 글에 연결된 이미지는 그대로
def test_tc_img_021_old_temp_images_removed(admin_client, client, db_session, storage, clock):
    old, fresh, linked = upload(admin_client), upload(admin_client), upload(admin_client)
    category_id = db_session.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
    admin_client.post(
        "/api/posts",
        json={"category_id": category_id, "title": "연결", "content": {"type": "doc", "content": [{"type": "image", "attrs": {"imageId": linked["id"]}}]}},
    )
    # fresh는 23시간 뒤에 올린 것으로 만든다 (관리자 세션 만료를 피하려고 업로드 시각만 조정)
    db_session.get(PostImage, fresh["id"]).created_at = clock.now + timedelta(hours=23)
    db_session.flush()
    old_keys = keys_of(db_session, old["id"])

    clock.advance(hours=25)  # old·linked: 25시간, fresh: 2시간
    response = client.get("/api/cron/cleanup", headers=CRON)
    assert response.status_code == 200
    assert response.json()["deleted_temp_images"] == 1
    db_session.expire_all()
    assert db_session.get(PostImage, old["id"]) is None
    assert db_session.get(PostImage, fresh["id"]) is not None  # 24시간이 안 된 임시 이미지는 유지
    assert db_session.get(PostImage, linked["id"]) is not None  # 글에 연결된 이미지는 유지
    assert not any(storage.exists(k) for k in old_keys)


def test_temp_image_younger_than_24h_kept(admin_client, client, db_session, clock):
    image = upload(admin_client)
    clock.advance(hours=23, minutes=59)
    assert client.get("/api/cron/cleanup", headers=CRON).json()["deleted_temp_images"] == 0
    assert db_session.get(PostImage, image["id"]) is not None


# ---------------------------------------------------------------- 고아 파일


def test_orphan_files_removed_only_when_old(admin_client, client, db_session, storage):
    kept = upload(admin_client)  # DB에 있는 파일
    storage.save("images/2026/10/orphan.jpg", b"x", "image/jpeg")  # DB에 없는 파일 (오래됨)
    storage.save("images/2026/11/uploading.jpg", b"x", "image/jpeg")  # DB에 없지만 방금 생김 (업로드 중일 수 있음)
    age_file(storage, "images/2026/10/orphan.jpg")
    for key in keys_of(db_session, kept["id"]):
        age_file(storage, key)  # 오래됐어도 DB에 있으면 유지

    body = client.get("/api/cron/cleanup", headers=CRON).json()
    assert body["deleted_orphan_files"] == 1
    assert not storage.exists("images/2026/10/orphan.jpg")
    assert storage.exists("images/2026/11/uploading.jpg")
    assert all(storage.exists(k) for k in keys_of(db_session, kept["id"]))


def test_orphan_cleanup_respects_limit(db_session, storage, clock):
    for i in range(5):
        storage.save(f"images/2026/10/o{i}.jpg", b"x", "image/jpeg")
        age_file(storage, f"images/2026/10/o{i}.jpg")
    assert cleanup_service.cleanup_orphan_files(db_session, storage, clock.now, limit=3) == 3
    assert cleanup_service.cleanup_orphan_files(db_session, storage, clock.now, limit=3) == 2  # 남은 것은 다음 실행에서


# ---------------------------------------------------------------- 세션


def test_expired_sessions_removed(client, admin_user, db_session, clock):
    now = clock.now
    db_session.add_all(
        [
            AdminSession(admin_user_id=admin_user.id, token_hash="a" * 64, created_at=now, last_active_at=now, expires_at=now + timedelta(days=7)),
            AdminSession(admin_user_id=admin_user.id, token_hash="b" * 64, created_at=now - timedelta(days=8), last_active_at=now, expires_at=now - timedelta(days=1)),
            AdminSession(admin_user_id=admin_user.id, token_hash="c" * 64, created_at=now, last_active_at=now - timedelta(hours=3), expires_at=now + timedelta(days=5)),
        ]
    )
    db_session.flush()
    assert client.get("/api/cron/cleanup", headers=CRON).json()["deleted_sessions"] == 2
    remaining = db_session.execute(select(AdminSession.token_hash)).scalars().all()
    assert remaining == ["a" * 64]


# ---------------------------------------------------------------- 멱등 (TC-IMG-028)


def test_tc_img_028_idempotent(admin_client, client, clock):
    upload(admin_client)
    clock.advance(hours=25)
    first = client.get("/api/cron/cleanup", headers=CRON).json()
    second = client.get("/api/cron/cleanup", headers=CRON).json()
    assert first["deleted_temp_images"] == 1
    assert second == {"deleted_temp_images": 0, "deleted_orphan_files": 0, "deleted_sessions": 0}


def test_temp_image_limit_per_run(admin_client, db_session, storage, clock):
    for _ in range(3):
        upload(admin_client)
    clock.advance(hours=25)
    assert cleanup_service.cleanup_temp_images(db_session, storage, clock.now, limit=2) == 2
    assert cleanup_service.cleanup_temp_images(db_session, storage, clock.now, limit=2) == 1
    assert db_session.execute(select(func.count()).select_from(PostImage)).scalar_one() == 0


def test_posts_untouched(admin_client, client, db_session, clock):
    category_id = db_session.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
    db_session.add(Post(category_id=category_id, title="글", content={"type": "doc", "content": []}))
    db_session.flush()
    clock.advance(days=30)
    client.get("/api/cron/cleanup", headers=CRON)
    assert db_session.execute(select(func.count()).select_from(Post)).scalar_one() == 1


# ---------------------------------------------------------------- CLI


def test_cli_cleanup_command(monkeypatch, capsys):
    from app import cli

    calls = {}

    def fake_run(db, storage, now):
        calls["ran"] = True
        return cleanup_service.CleanupResult(1, 2, 3)

    monkeypatch.setattr("app.services.cleanup_service.run_cleanup", fake_run)
    assert cli.main(["cleanup"]) == 0
    assert calls == {"ran": True}
    assert "임시 이미지 1개, 고아 파일 2개, 만료 세션 3개" in capsys.readouterr().out


def test_blob_list_files(monkeypatch):
    from datetime import datetime, timezone

    import vercel.blob.sync as sdk

    from app.storage.blob import BlobStorage

    class Item:
        def __init__(self, pathname):
            self.pathname = pathname
            self.uploaded_at = datetime(2026, 11, 1, tzinfo=timezone.utc)

    monkeypatch.setattr(sdk, "query_blobs", lambda prefix=None, **kw: iter([Item(f"{prefix}a.jpg"), Item(f"{prefix}b.jpg")]))
    blob = BlobStorage(token="t", public_base_url="https://store.public.blob.vercel-storage.com")
    assert [f.key for f in blob.list_files("images/")] == ["images/a.jpg", "images/b.jpg"]
