"""M5: 게시글 API (API-006~010, DEC-001, DEC-002, DEC-005, TEST_CASES §6, §7)."""

from __future__ import annotations

from io import BytesIO

import pytest
from sqlalchemy import func, select

from app.models import Category, Comment, Post, PostImage, PostLike
from tests.images import make_image


def text_doc(*paragraphs: str) -> dict:
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": p}]} for p in paragraphs],
    }


def image_node(image_id: int, alt: str | None = None) -> dict:
    attrs: dict = {"imageId": image_id}
    if alt is not None:
        attrs["alt"] = alt
    return {"type": "image", "attrs": attrs}


def doc_with_images(*image_ids: int) -> dict:
    # 문단 → 이미지 → 문단 → 이미지 … (본문 중간 삽입, REQ-018)
    content: list = []
    for i, image_id in enumerate(image_ids):
        content.append({"type": "paragraph", "content": [{"type": "text", "text": f"문단 {i}"}]})
        content.append(image_node(image_id))
    content.append({"type": "paragraph", "content": [{"type": "text", "text": "끝"}]})
    return {"type": "doc", "content": content}


def category_id(db, name: str = "DIY") -> int:
    return db.execute(select(Category.id).where(Category.name == name)).scalar_one()


def upload(client) -> int:
    response = client.post("/api/images", files={"file": ("a.jpg", BytesIO(make_image()), "image/jpeg")})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def create(client, db, title: str = "주방 타일 시공", content: dict | None = None, category: str = "DIY"):
    return client.post(
        "/api/posts",
        json={"category_id": category_id(db, category), "title": title, "content": content or text_doc("본문")},
    )


# ---------------------------------------------------------------- 작성


# TC-POST-001
def test_tc_post_001_create(admin_client, db_session, clock):
    response = create(admin_client, db_session)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "주방 타일 시공"
    assert body["category_name"] == "DIY"
    assert body["content"] == text_doc("본문")
    assert body["created_at"] == body["updated_at"]
    assert body["created_at"].startswith("2026-11-03T09:00:00")
    assert body["like_count"] == 0 and body["comment_count"] == 0 and body["liked"] is False
    assert body["images"] == [] and body["thumbnail_url"] is None


# TC-POST-002, TC-VAL-004
@pytest.mark.parametrize("title", ["", "    "])
def test_tc_post_002_blank_title(admin_client, db_session, title):
    response = create(admin_client, db_session, title=title)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "title"
    assert db_session.execute(select(func.count()).select_from(Post)).scalar_one() == 0


# TC-POST-003
def test_tc_post_003_missing_category(admin_client):
    response = admin_client.post("/api/posts", json={"title": "제목", "content": text_doc("본문")})
    assert response.status_code == 422
    assert "category_id" in {d["field"] for d in response.json()["error"]["details"]}


# TC-POST-004
def test_tc_post_004_unknown_category(admin_client):
    response = admin_client.post("/api/posts", json={"category_id": 99999, "title": "제목", "content": text_doc("본문")})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


# TC-POST-019
def test_tc_post_019_title_length(admin_client, db_session):
    assert create(admin_client, db_session, title="가" * 200).status_code == 201
    assert create(admin_client, db_session, title="가" * 201).status_code == 422


def test_empty_body_rejected(admin_client, db_session):
    for content in ({"type": "doc", "content": []}, {"type": "doc", "content": [{"type": "paragraph"}]}, text_doc("   ")):
        response = create(admin_client, db_session, content=content)
        assert response.status_code == 422
        assert response.json()["error"]["details"][0]["field"] == "content"


# TC-ADM-004 (게시글 관리자 API)
def test_tc_adm_004_post_admin_apis_require_login(client, db_session):
    post = Post(category_id=category_id(db_session), title="글", content=text_doc("본문"))
    db_session.add(post)
    db_session.flush()
    body = {"category_id": post.category_id, "title": "X", "content": text_doc("x")}
    assert client.post("/api/posts", json=body).status_code == 401
    assert client.put(f"/api/posts/{post.id}", json=body).status_code == 401
    assert client.delete(f"/api/posts/{post.id}").status_code == 401
    assert client.get(f"/api/posts/{post.id}").status_code == 200  # 조회는 공개


# ---------------------------------------------------------------- 본문 검증 (DEC-001)


ALLOWED_DOC = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "제목"}]},
        {
            "type": "paragraph",
            "content": [
                {"type": "text", "text": "굵게", "marks": [{"type": "bold"}]},
                {"type": "text", "text": "기울임", "marks": [{"type": "italic"}, {"type": "strike"}]},
                {"type": "hardBreak"},
                {"type": "text", "text": "링크", "marks": [{"type": "link", "attrs": {"href": "https://example.com"}}]},
                {"type": "text", "text": "코드", "marks": [{"type": "code"}]},
            ],
        },
        {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "항목"}]}]}]},
        {"type": "orderedList", "attrs": {"start": 1}, "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "1"}]}]}]},
        {"type": "blockquote", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "인용"}]}]},
        {"type": "codeBlock", "attrs": {"language": None}, "content": [{"type": "text", "text": "print(1)"}]},
        {"type": "horizontalRule"},
    ],
}


def test_all_allowed_nodes_and_marks_accepted(admin_client, db_session):
    response = create(admin_client, db_session, content=ALLOWED_DOC)
    assert response.status_code == 201, response.text
    assert response.json()["content"] == ALLOWED_DOC


# TC-POST-017, TC-POST-018, TC-SEC-004
@pytest.mark.parametrize(
    ("bad_node", "reason"),
    [
        ({"type": "iframe", "attrs": {"src": "https://evil"}}, "허용되지 않은 노드"),
        ({"type": "image", "attrs": {"imageId": 1, "src": "javascript:alert(1)"}}, "허용되지 않은 속성 'src'"),
        ({"type": "image", "attrs": {"imageId": 1, "onerror": "alert(1)"}}, "허용되지 않은 속성 'onerror'"),
        ({"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]}]}, "속성 'href' 값"),
        ({"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "link", "attrs": {"href": "https://ok", "onclick": "x"}}]}]}, "허용되지 않은 속성 'onclick'"),
        ({"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "underline"}]}]}, "허용되지 않은 마크"),
        ({"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "h1"}]}, "속성 'level' 값"),
        ({"type": "paragraph", "attrs": {"style": "color:red"}, "content": [{"type": "text", "text": "x"}]}, "허용되지 않은 속성 'style'"),
        ({"type": "paragraph", "html": "<script>"}, "알 수 없는 항목"),
        ({"type": "image"}, "필수 속성 'imageId'"),
    ],
)
def test_tc_post_017_018_disallowed_content_rejected(admin_client, db_session, bad_node, reason):
    content = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}, bad_node]}
    response = create(admin_client, db_session, content=content)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_CONTENT"
    assert reason in error["details"][0]["reason"]
    assert db_session.execute(select(func.count()).select_from(Post)).scalar_one() == 0


def test_text_with_script_is_just_text(admin_client, db_session):
    # 텍스트 노드의 문자열은 그대로 저장된다. 화면은 React가 문자로만 출력한다 (TC-SEC-005 화면 쪽은 Frontend 테스트)
    content = text_doc("<script>alert(1)</script>")
    assert create(admin_client, db_session, content=content).json()["content"] == content


def test_root_must_be_doc(admin_client, db_session):
    response = create(admin_client, db_session, content={"type": "paragraph"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_CONTENT"


# ---------------------------------------------------------------- 이미지 연결 (DEC-002)


# TC-IMG-003, TC-IMG-004: 본문 순서대로 연결, display_order 0,1,2
def test_tc_img_004_images_linked_in_body_order(admin_client, db_session):
    a, b, c = upload(admin_client), upload(admin_client), upload(admin_client)
    response = create(admin_client, db_session, content=doc_with_images(c, a, b))
    assert response.status_code == 201, response.text
    body = response.json()
    assert [img["id"] for img in body["images"]] == [c, a, b]
    rows = {img.id: img for img in db_session.execute(select(PostImage)).scalars()}
    assert {i: (rows[i].post_id, rows[i].display_order) for i in (c, a, b)} == {
        c: (body["id"], 0), a: (body["id"], 1), b: (body["id"], 2),
    }
    # TC-IMG-022: 대표 이미지 = 본문 첫 이미지 썸네일
    assert body["thumbnail_url"] == next(img["thumbnail_url"] for img in body["images"] if img["id"] == c)


# TC-IMG-005: 순서 변경
def test_tc_img_005_reorder_images(admin_client, db_session):
    a, b, c = upload(admin_client), upload(admin_client), upload(admin_client)
    post = create(admin_client, db_session, content=doc_with_images(a, b, c)).json()
    response = admin_client.put(
        f"/api/posts/{post['id']}",
        json={"category_id": post["category_id"], "title": post["title"], "content": doc_with_images(c, a, b)},
    )
    assert response.status_code == 200
    assert [img["id"] for img in response.json()["images"]] == [c, a, b]


# TC-IMG-006, TC-IMG-007
def test_tc_img_006_007_twenty_images_ok_twenty_one_rejected(admin_client, db_session):
    ids = [upload(admin_client) for _ in range(21)]
    over = create(admin_client, db_session, content=doc_with_images(*ids))
    assert over.status_code == 422
    assert over.json()["error"]["code"] == "IMAGE_LIMIT_EXCEEDED"
    ok = create(admin_client, db_session, content=doc_with_images(*ids[:20]))
    assert ok.status_code == 201
    assert len(ok.json()["images"]) == 20


# TC-IMG-015: 본문에서 빠진 이미지는 레코드와 파일 삭제
def test_tc_img_015_removed_image_deleted(admin_client, db_session, storage):
    a, b, c = upload(admin_client), upload(admin_client), upload(admin_client)
    post = create(admin_client, db_session, content=doc_with_images(a, b, c)).json()
    b_keys = (db_session.get(PostImage, b).file_path, db_session.get(PostImage, b).thumbnail_path)

    response = admin_client.put(
        f"/api/posts/{post['id']}",
        json={"category_id": post["category_id"], "title": post["title"], "content": doc_with_images(a, c)},
    )
    assert response.status_code == 200
    assert [img["id"] for img in response.json()["images"]] == [a, c]
    db_session.expire_all()
    assert db_session.get(PostImage, b) is None
    assert not any(storage.exists(k) for k in b_keys)
    assert storage.exists(db_session.get(PostImage, a).file_path)


# TC-IMG-016: 다른 글의 이미지는 참조할 수 없다
def test_tc_img_016_other_posts_image_rejected(admin_client, db_session):
    a = upload(admin_client)
    create(admin_client, db_session, title="글 1", content=doc_with_images(a))
    response = create(admin_client, db_session, title="글 2", content=doc_with_images(a))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE_REFERENCE"


# TC-IMG-017
def test_tc_img_017_unknown_image_rejected(admin_client, db_session):
    response = create(admin_client, db_session, content=doc_with_images(99999))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE_REFERENCE"
    assert db_session.execute(select(func.count()).select_from(Post)).scalar_one() == 0


# TC-IMG-018
def test_tc_img_018_duplicate_image_rejected(admin_client, db_session):
    a = upload(admin_client)
    response = create(admin_client, db_session, content=doc_with_images(a, a))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE_REFERENCE"


def test_failed_update_changes_nothing(admin_client, db_session):
    a = upload(admin_client)
    post = create(admin_client, db_session, content=doc_with_images(a)).json()
    response = admin_client.put(
        f"/api/posts/{post['id']}",
        json={"category_id": post["category_id"], "title": "바뀐 제목", "content": doc_with_images(a, 99999)},
    )
    assert response.status_code == 422
    after = admin_client.get(f"/api/posts/{post['id']}").json()
    assert after["title"] == post["title"]
    assert [img["id"] for img in after["images"]] == [a]


# ---------------------------------------------------------------- 수정 / 삭제


# TC-POST-005, TC-POST-006
def test_tc_post_005_006_update_keeps_created_at(admin_client, db_session, clock):
    post = create(admin_client, db_session).json()
    clock.advance(minutes=90)  # 세션 비활동 만료(2시간) 전
    response = admin_client.put(
        f"/api/posts/{post['id']}",
        json={"category_id": category_id(db_session, "Blog"), "title": "주방 타일 시공 후기", "content": text_doc("수정")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "주방 타일 시공 후기"
    assert body["category_name"] == "Blog"
    assert body["created_at"] == post["created_at"]
    assert body["updated_at"].startswith("2026-11-03T10:30:00")

    blog_items = admin_client.get("/api/posts", params={"category_id": category_id(db_session, "Blog")}).json()["items"]
    diy_items = admin_client.get("/api/posts", params={"category_id": category_id(db_session, "DIY")}).json()["items"]
    assert [p["id"] for p in blog_items] == [post["id"]] and diy_items == []


def test_update_not_found(admin_client, db_session):
    response = admin_client.put(
        "/api/posts/99999", json={"category_id": category_id(db_session), "title": "x", "content": text_doc("x")}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "POST_NOT_FOUND"


# TC-POST-007, TC-POST-008: 이미지(파일 포함)·댓글·좋아요 함께 삭제
def test_tc_post_007_008_delete_cascades_with_files(admin_client, db_session, storage):
    a, b = upload(admin_client), upload(admin_client)
    post = create(admin_client, db_session, content=doc_with_images(a, b)).json()
    keys = [k for i in (a, b) for k in (db_session.get(PostImage, i).file_path, db_session.get(PostImage, i).thumbnail_path)]
    parent = Comment(post_id=post["id"], nickname="방문자", password_hash="h", content="댓글")
    db_session.add(parent)
    db_session.flush()
    db_session.add(Comment(post_id=post["id"], parent_comment_id=parent.id, nickname="다른", password_hash="h", content="답글"))
    db_session.add(PostLike(post_id=post["id"], visitor_key="v1"))
    db_session.flush()

    assert admin_client.delete(f"/api/posts/{post['id']}").status_code == 204
    assert admin_client.get(f"/api/posts/{post['id']}").status_code == 404
    db_session.expire_all()
    for model in (PostImage, Comment, PostLike):
        assert db_session.execute(select(func.count()).select_from(model)).scalar_one() == 0, model.__tablename__
    assert not any(storage.exists(k) for k in keys)


def test_delete_not_found(admin_client):
    assert admin_client.delete("/api/posts/99999").status_code == 404


# ---------------------------------------------------------------- 목록 / 상세


# TC-POST-011, TC-POST-012
def test_tc_post_011_012_list_newest_first_without_body(admin_client, db_session, clock):
    for title in ("첫 글", "둘째 글", "셋째 글"):
        create(admin_client, db_session, title=title)
        clock.advance(minutes=1)
    body = admin_client.get("/api/posts", params={"category_id": category_id(db_session)}).json()
    assert [p["title"] for p in body["items"]] == ["셋째 글", "둘째 글", "첫 글"]
    assert body["total"] == 3 and body["page"] == 1 and body["size"] == 12
    assert set(body["items"][0]) == {
        "id", "category_id", "category_name", "title", "thumbnail_url", "like_count", "comment_count", "created_at", "updated_at",
    }


# TC-POST-013, TC-POST-015
def test_tc_post_013_015_pagination(admin_client, db_session, clock):
    for i in range(25):
        create(admin_client, db_session, title=f"글 {i:02d}")
        clock.advance(minutes=1)
    page3 = admin_client.get("/api/posts", params={"page": 3}).json()
    assert len(page3["items"]) == 1 and page3["total"] == 25 and page3["size"] == 12
    assert page3["items"][0]["title"] == "글 00"
    assert admin_client.get("/api/posts", params={"page": 99}).json()["items"] == []
    assert len(admin_client.get("/api/posts", params={"size": 20}).json()["items"]) == 20


# TC-VAL-010
@pytest.mark.parametrize("params", [{"size": 0}, {"size": 51}, {"page": 0}, {"category_id": 0}])
def test_tc_val_010_invalid_paging(client, params):
    assert client.get("/api/posts", params=params).status_code == 422


def test_list_unknown_category(client):
    assert client.get("/api/posts", params={"category_id": 99999}).json()["error"]["code"] == "CATEGORY_NOT_FOUND"


def test_comment_count_excludes_deleted(admin_client, db_session):
    post = create(admin_client, db_session).json()
    db_session.add(Comment(post_id=post["id"], nickname="a", password_hash="h", content="c"))
    db_session.add(Comment(post_id=post["id"], is_deleted=True, deleted_at=func.now()))
    db_session.flush()
    assert admin_client.get(f"/api/posts/{post['id']}").json()["comment_count"] == 1


# TC-POST-014, TC-VAL-008
def test_tc_post_014_detail_not_found(client):
    response = client.get("/api/posts/99999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "POST_NOT_FOUND"
    assert client.get("/api/posts/abc").status_code == 422


# TC-LIKE-010 (기반): 상세의 liked는 sw_visitor 쿠키 기준
def test_detail_liked_reflects_visitor_cookie(admin_client, db_session):
    post = create(admin_client, db_session).json()
    db_session.add(PostLike(post_id=post["id"], visitor_key="visitor-a"))
    db_session.flush()
    admin_client.cookies.set("sw_visitor", "visitor-a")
    assert admin_client.get(f"/api/posts/{post['id']}").json()["liked"] is True
    admin_client.cookies.set("sw_visitor", "visitor-b")
    assert admin_client.get(f"/api/posts/{post['id']}").json()["liked"] is False


# TC-SEC-011
def test_no_sensitive_fields_in_post_responses(admin_client, db_session):
    post = create(admin_client, db_session).json()
    for text in (admin_client.get(f"/api/posts/{post['id']}").text, admin_client.get("/api/posts").text):
        for field in ("password", "password_hash", "visitor_key", "file_path", "thumbnail_path"):
            assert f'"{field}"' not in text
