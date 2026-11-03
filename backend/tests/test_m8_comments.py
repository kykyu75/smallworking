"""M8: 댓글·답글 (API-014~017, 026, 027, DEC-005, TEST_CASES §8, §11)."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import Category, Comment, Post

DOC = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}]}
PW = "1234"


@pytest.fixture
def post(db_session) -> Post:
    category_id = db_session.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
    p = Post(category_id=category_id, title="댓글 테스트", content=DOC)
    db_session.add(p)
    db_session.flush()
    return p


def write(client, post_id: int, content: str = "멋지네요.", nickname: str = "방문자", password: str = PW, parent: int | None = None):
    body = {"nickname": nickname, "password": password, "content": content}
    if parent is not None:
        body["parent_comment_id"] = parent
    return client.post(f"/api/posts/{post_id}/comments", json=body)


def comments(client, post_id: int) -> list[dict]:
    return client.get(f"/api/posts/{post_id}/comments").json()["items"]


def remove(client, comment_id: int, password: str = PW):
    return client.post(f"/api/comments/{comment_id}/delete", json={"password": password})


def count(db, model=Comment) -> int:
    return db.execute(select(func.count()).select_from(model)).scalar_one()


# ---------------------------------------------------------------- 작성·표시


# TC-COM-001
def test_tc_com_001_create(client, post):
    response = write(client, post.id)
    assert response.status_code == 201
    body = response.json()
    assert body["nickname"] == "방문자" and body["content"] == "멋지네요." and body["is_deleted"] is False
    assert body["replies"] == []
    assert body["created_at"].startswith("2026-11-03T09:00:00")
    assert [c["id"] for c in comments(client, post.id)] == [body["id"]]


# TC-COM-002, TC-VAL-004
@pytest.mark.parametrize("field", ["nickname", "password", "content"])
@pytest.mark.parametrize("value", ["", "   "])
def test_tc_com_002_required_fields(client, post, db_session, field, value):
    body = {"nickname": "방문자", "password": PW, "content": "내용", field: value}
    response = client.post(f"/api/posts/{post.id}/comments", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field
    assert count(db_session) == 0


# TC-COM-020: 경계값 (DEC-006)
@pytest.mark.parametrize(
    ("field", "ok", "bad"),
    [("nickname", ["가" * 2, "가" * 20], ["가", "가" * 21]), ("password", ["a" * 4, "a" * 64], ["a" * 3, "a" * 65]), ("content", ["가", "가" * 1000], ["가" * 1001])],
)
def test_tc_com_020_length_limits(client, post, field, ok, bad):
    base = {"nickname": "방문자", "password": PW, "content": "내용"}
    for value in ok:
        assert client.post(f"/api/posts/{post.id}/comments", json={**base, field: value}).status_code == 201, (field, len(value))
    for value in bad:
        assert client.post(f"/api/posts/{post.id}/comments", json={**base, field: value}).status_code == 422, (field, len(value))


# TC-VAL-005: 앞뒤 공백 제거
def test_trimmed(client, post):
    body = write(client, post.id, content="  내용  ", nickname="  홍길동  ").json()
    assert body["nickname"] == "홍길동" and body["content"] == "내용"


# TC-COM-003, TC-SEC-006: Argon2 해시
def test_tc_com_003_password_hashed(client, post, db_session):
    write(client, post.id, password="secret-pass")
    stored = db_session.execute(select(Comment.password_hash)).scalar_one()
    assert stored.startswith("$argon2") and "secret-pass" not in stored


# TC-COM-004, TC-SEC-011: 응답에 비밀번호 없음
def test_tc_com_004_no_password_in_responses(client, post):
    created = write(client, post.id)
    listed = client.get(f"/api/posts/{post.id}/comments")
    edited = client.put(f"/api/comments/{created.json()['id']}", json={"password": PW, "content": "수정"})
    for response in (created, listed, edited):
        assert "password" not in response.text


# TC-COM-005: 댓글·답글 모두 작성순
def test_tc_com_005_order(client, post, clock):
    first = write(client, post.id, content="첫 댓글").json()
    clock.advance(minutes=1)
    second = write(client, post.id, content="둘째 댓글").json()
    clock.advance(minutes=1)
    write(client, post.id, content="첫 댓글의 답글 1", parent=first["id"])
    clock.advance(minutes=1)
    write(client, post.id, content="첫 댓글의 답글 2", parent=first["id"])

    items = comments(client, post.id)
    assert [c["content"] for c in items] == ["첫 댓글", "둘째 댓글"]
    assert [r["content"] for r in items[0]["replies"]] == ["첫 댓글의 답글 1", "첫 댓글의 답글 2"]
    assert items[1]["id"] == second["id"] and items[1]["replies"] == []
    assert "replies" not in items[0]["replies"][0]  # 답글에는 replies 항목이 없다 (API_SPEC §4.3)


def test_comments_of_missing_post(client):
    assert client.get("/api/posts/99999/comments").json()["error"]["code"] == "POST_NOT_FOUND"
    assert write(client, 99999).json()["error"]["code"] == "POST_NOT_FOUND"


# TC-SEC-001~003: 스크립트는 일반 텍스트로 저장 (화면도 글자로만 출력 — Frontend 테스트)
def test_script_stored_as_plain_text(client, post):
    body = write(client, post.id, content="<script>alert(1)</script>", nickname="<b>x</b>").json()
    assert body["content"] == "<script>alert(1)</script>"


# ---------------------------------------------------------------- 답글


# TC-COM-006
def test_tc_com_006_reply(client, post):
    parent = write(client, post.id).json()
    reply = write(client, post.id, content="감사합니다.", nickname="smallworking", parent=parent["id"])
    assert reply.status_code == 201
    assert "replies" not in reply.json()
    assert [r["id"] for r in comments(client, post.id)[0]["replies"]] == [reply.json()["id"]]


# TC-COM-007: 답글의 답글 금지 (REQ-029)
def test_tc_com_007_reply_depth(client, post, db_session):
    parent = write(client, post.id).json()
    reply = write(client, post.id, parent=parent["id"]).json()
    response = write(client, post.id, parent=reply["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REPLY_DEPTH_EXCEEDED"
    assert count(db_session) == 2


# TC-COM-009: 다른 글의 댓글을 부모로 지정
def test_tc_com_009_parent_from_other_post(client, post, db_session):
    other = Post(category_id=post.category_id, title="다른 글", content=DOC)
    db_session.add(other)
    db_session.flush()
    parent = write(client, post.id).json()
    response = write(client, other.id, parent=parent["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_PARENT_COMMENT"


def test_reply_to_missing_parent(client, post):
    assert write(client, post.id, parent=99999).json()["error"]["code"] == "COMMENT_NOT_FOUND"


# TC-COM-015: 답글도 비밀번호로 수정·삭제
def test_tc_com_015_reply_edit_and_delete(client, post):
    parent = write(client, post.id).json()
    reply = write(client, post.id, parent=parent["id"], password="reply-pw").json()
    assert client.put(f"/api/comments/{reply['id']}", json={"password": "reply-pw", "content": "고침"}).status_code == 200
    assert remove(client, reply["id"], "reply-pw").status_code == 204
    assert comments(client, post.id)[0]["replies"] == []


# ---------------------------------------------------------------- 수정


# TC-COM-010
def test_tc_com_010_edit(client, post, clock):
    created = write(client, post.id).json()
    clock.advance(minutes=5)
    response = client.put(f"/api/comments/{created['id']}", json={"password": PW, "content": "수정된 댓글입니다."})
    assert response.status_code == 200
    body = response.json()
    assert body["content"] == "수정된 댓글입니다."
    assert body["created_at"] == created["created_at"]
    assert body["updated_at"].startswith("2026-11-03T09:05:00")


# TC-COM-011
def test_tc_com_011_edit_wrong_password(client, post):
    created = write(client, post.id).json()
    response = client.put(f"/api/comments/{created['id']}", json={"password": "wrong", "content": "해킹"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "INVALID_PASSWORD"
    assert comments(client, post.id)[0]["content"] == "멋지네요."


def test_edit_missing_comment(client):
    assert client.put("/api/comments/99999", json={"password": PW, "content": "x"}).status_code == 404


# ---------------------------------------------------------------- 삭제 규칙 (DEC-005)


# TC-COM-012
def test_tc_com_012_delete_without_replies_is_hard_delete(client, post, db_session):
    created = write(client, post.id).json()
    assert remove(client, created["id"]).status_code == 204
    assert comments(client, post.id) == []
    assert count(db_session) == 0


# TC-COM-013
def test_tc_com_013_delete_wrong_password(client, post):
    created = write(client, post.id).json()
    response = remove(client, created["id"], "wrong")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "INVALID_PASSWORD"
    assert len(comments(client, post.id)) == 1


# TC-COM-014: 답글 있는 댓글 → "삭제된 댓글", 답글 유지, 개인정보 비움
def test_tc_com_014_delete_with_replies_is_soft_delete(client, post, db_session):
    parent = write(client, post.id, nickname="원글쓴이").json()
    write(client, post.id, parent=parent["id"], nickname="답글1")
    write(client, post.id, parent=parent["id"], nickname="답글2")

    assert remove(client, parent["id"]).status_code == 204
    item = comments(client, post.id)[0]
    assert item["id"] == parent["id"] and item["is_deleted"] is True
    assert item["nickname"] is None and item["content"] is None
    assert [r["nickname"] for r in item["replies"]] == ["답글1", "답글2"]

    db_session.expire_all()
    row = db_session.get(Comment, parent["id"])
    assert row.password_hash is None and row.nickname is None and row.deleted_at is not None


# TC-COM-016: soft delete된 댓글의 마지막 답글을 지우면 부모 자리도 사라진다
def test_tc_com_016_last_reply_removes_deleted_parent(client, post, db_session):
    parent = write(client, post.id).json()
    reply = write(client, post.id, parent=parent["id"]).json()
    remove(client, parent["id"])
    assert remove(client, reply["id"]).status_code == 204
    assert comments(client, post.id) == []
    assert count(db_session) == 0


# TC-COM-017: 답글이 남아 있으면 부모 자리 유지
def test_tc_com_017_parent_kept_while_replies_remain(client, post):
    parent = write(client, post.id).json()
    reply1 = write(client, post.id, parent=parent["id"]).json()
    write(client, post.id, parent=parent["id"], nickname="남는 답글")
    remove(client, parent["id"])
    remove(client, reply1["id"])
    item = comments(client, post.id)[0]
    assert item["is_deleted"] is True
    assert [r["nickname"] for r in item["replies"]] == ["남는 답글"]


# TC-COM-018: 삭제된 댓글에는 답글 불가
def test_tc_com_018_no_reply_to_deleted(client, post):
    parent = write(client, post.id).json()
    write(client, post.id, parent=parent["id"])
    remove(client, parent["id"])
    response = write(client, post.id, parent=parent["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "COMMENT_ALREADY_DELETED"


# TC-COM-019: 삭제된 댓글은 수정·삭제 불가
def test_tc_com_019_deleted_comment_cannot_be_edited_or_deleted(client, post):
    parent = write(client, post.id).json()
    write(client, post.id, parent=parent["id"])
    remove(client, parent["id"])
    for response in (
        client.put(f"/api/comments/{parent['id']}", json={"password": PW, "content": "부활"}),
        remove(client, parent["id"]),
    ):
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "COMMENT_ALREADY_DELETED"


# 게시글 상세의 comment_count는 삭제되지 않은 댓글·답글 수
def test_post_comment_count(client, post):
    parent = write(client, post.id).json()
    write(client, post.id, parent=parent["id"])
    write(client, post.id)
    remove(client, parent["id"])  # soft delete → 2개 남음
    assert client.get(f"/api/posts/{post.id}").json()["comment_count"] == 2


# ---------------------------------------------------------------- 관리자 (API-026, 027, REQ-035)


# TC-ADM-009: 최신순, 게시글 제목·답글 수 포함, soft delete 제외
def test_tc_adm_009_admin_list(admin_client, post, clock):
    a = write(admin_client, post.id, content="A").json()
    clock.advance(minutes=1)
    write(admin_client, post.id, content="A의 답글", parent=a["id"])
    clock.advance(minutes=1)
    b = write(admin_client, post.id, content="B").json()
    clock.advance(minutes=1)
    write(admin_client, post.id, content="B의 답글", parent=b["id"])
    remove(admin_client, b["id"])  # B는 soft delete

    body = admin_client.get("/api/admin/comments").json()
    assert [c["content"] for c in body["items"]] == ["B의 답글", "A의 답글", "A"]
    assert body["total"] == 3 and body["size"] == 20
    first_a = body["items"][2]
    assert first_a["post_title"] == "댓글 테스트" and first_a["reply_count"] == 1 and first_a["parent_comment_id"] is None
    assert body["items"][0]["parent_comment_id"] == b["id"]
    assert "password" not in admin_client.get("/api/admin/comments").text


# TC-ADM-010: 비밀번호 없이 삭제
def test_tc_adm_010_admin_delete(admin_client, post):
    created = write(admin_client, post.id).json()
    assert admin_client.delete(f"/api/admin/comments/{created['id']}").status_code == 204
    assert comments(admin_client, post.id) == []


# TC-ADM-011: 관리자 삭제도 같은 규칙
def test_tc_adm_011_admin_delete_same_rules(admin_client, post):
    parent = write(admin_client, post.id).json()
    reply = write(admin_client, post.id, parent=parent["id"]).json()
    admin_client.delete(f"/api/admin/comments/{parent['id']}")
    assert comments(admin_client, post.id)[0]["is_deleted"] is True
    assert admin_client.delete(f"/api/admin/comments/{parent['id']}").json()["error"]["code"] == "COMMENT_ALREADY_DELETED"
    admin_client.delete(f"/api/admin/comments/{reply['id']}")
    assert comments(admin_client, post.id) == []
    assert admin_client.delete("/api/admin/comments/99999").status_code == 404


# TC-ADM-004 (관리자 댓글 API)
def test_tc_adm_004_admin_comment_apis_require_login(client, post):
    created = write(client, post.id).json()
    assert client.get("/api/admin/comments").status_code == 401
    assert client.delete(f"/api/admin/comments/{created['id']}").status_code == 401
    assert len(comments(client, post.id)) == 1


def test_admin_list_paging(admin_client, post, clock):
    for i in range(25):
        write(admin_client, post.id, content=f"댓글{i}")
        clock.advance(seconds=1)
    page2 = admin_client.get("/api/admin/comments", params={"page": 2}).json()
    assert len(page2["items"]) == 5 and page2["total"] == 25
