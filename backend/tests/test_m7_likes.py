"""M7: 게시글 좋아요 (API-018, API-022, DEC-004, TEST_CASES §9)."""

from __future__ import annotations

import threading

import pytest
from sqlalchemy import func, select

from app.core.db import get_sessionmaker
from app.models import Category, Post, PostLike
from app.services import like_service

DOC = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}]}
VISITOR_A = "11111111-1111-4111-8111-111111111111"
VISITOR_B = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def post(db_session) -> Post:
    category_id = db_session.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
    p = Post(category_id=category_id, title="좋아요 테스트", content=DOC, like_count=12)
    db_session.add(p)
    db_session.flush()
    return p


def like(client, post_id: int):
    return client.post(f"/api/posts/{post_id}/like")


def unlike(client, post_id: int):
    return client.delete(f"/api/posts/{post_id}/like")


def like_rows(db, post_id: int) -> int:
    return db.execute(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)).scalar_one()


# TC-LIKE-001, TC-LIKE-013: 처음 누르면 +1, 방문자 쿠키 발급
def test_tc_like_001_013_first_like_issues_cookie(client, post):
    response = like(client, post.id)
    assert response.status_code == 200
    assert response.json() == {"post_id": post.id, "like_count": 13, "liked": True}

    cookie = response.headers["set-cookie"].lower()
    assert "sw_visitor=" in cookie and "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    assert "max-age=31536000" in cookie  # 1년
    assert like_service.is_valid_visitor_key(client.cookies.get("sw_visitor"))


# TC-LIKE-003: 같은 방문자가 다시 좋아요 → 그대로 (오류 아님), 쿠키 재발급 없음
def test_tc_like_003_repeat_like_is_idempotent(client, post, db_session):
    like(client, post.id)
    again = like(client, post.id)
    assert again.status_code == 200
    assert again.json() == {"post_id": post.id, "like_count": 13, "liked": True}
    assert "set-cookie" not in again.headers
    assert like_rows(db_session, post.id) == 1


# TC-LIKE-007: 취소 → -1
def test_tc_like_007_unlike(client, post):
    like(client, post.id)
    response = unlike(client, post.id)
    assert response.status_code == 200
    assert response.json() == {"post_id": post.id, "like_count": 12, "liked": False}


# TC-LIKE-008: 누른 적 없거나 쿠키 없이 취소 → 변화 없음, 오류 아님
def test_tc_like_008_unlike_without_like_is_noop(client, post):
    assert unlike(client, post.id).json() == {"post_id": post.id, "like_count": 12, "liked": False}
    client.cookies.set("sw_visitor", VISITOR_A)
    assert unlike(client, post.id).json()["like_count"] == 12


# TC-LIKE-002: 다른 글은 영향 없음
def test_tc_like_002_counts_are_per_post(client, post, db_session):
    other = Post(category_id=post.category_id, title="다른 글", content=DOC, like_count=5)
    db_session.add(other)
    db_session.flush()
    like(client, post.id)
    assert client.get(f"/api/posts/{other.id}").json()["like_count"] == 5


# TC-LIKE-011: 다른 방문자는 따로 센다
def test_tc_like_011_different_visitors(client, post):
    client.cookies.set("sw_visitor", VISITOR_A)
    like(client, post.id)
    client.cookies.set("sw_visitor", VISITOR_B)
    assert like(client, post.id).json()["like_count"] == 14


# TC-LIKE-010: 상세의 liked는 이 브라우저 기준
def test_tc_like_010_detail_liked_flag(client, post):
    assert client.get(f"/api/posts/{post.id}").json()["liked"] is False
    like(client, post.id)
    assert client.get(f"/api/posts/{post.id}").json()["liked"] is True
    client.cookies.clear()  # 서버가 발급한 쿠키를 지우고 다른 방문자로 바꾼다 (같은 이름 쿠키가 둘 생기지 않게)
    client.cookies.set("sw_visitor", VISITOR_B)
    assert client.get(f"/api/posts/{post.id}").json()["liked"] is False


# TC-LIKE-004: 좋아요·취소를 섞어도 숫자 = 기록 건수 + 처음 값
def test_tc_like_004_count_matches_rows(client, post, db_session):
    for visitor in (VISITOR_A, VISITOR_B):
        client.cookies.set("sw_visitor", visitor)
        like(client, post.id)
        like(client, post.id)
    client.cookies.set("sw_visitor", VISITOR_A)
    unlike(client, post.id)
    unlike(client, post.id)
    db_session.expire_all()
    assert db_session.get(Post, post.id).like_count == 12 + like_rows(db_session, post.id) == 13


# TC-LIKE-005
def test_tc_like_005_missing_post(client):
    for response in (like(client, 99999), unlike(client, 99999)):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "POST_NOT_FOUND"


def test_invalid_visitor_cookie_is_replaced(client, post, db_session):
    client.cookies.set("sw_visitor", "x" * 500)  # 조작된 쿠키
    response = like(client, post.id)
    assert response.status_code == 200
    assert "sw_visitor=" in response.headers["set-cookie"]
    stored = db_session.execute(select(PostLike.visitor_key).where(PostLike.post_id == post.id)).scalar_one()
    assert like_service.is_valid_visitor_key(stored)


# TC-SEC-010: 다른 사이트에서 보낸 좋아요는 거부 (Origin 검사)
def test_foreign_origin_like_rejected(client, post):
    response = client.post(f"/api/posts/{post.id}/like", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


# TC-SEC-011: 응답에 visitor_key 없음
def test_like_response_has_no_visitor_key(client, post):
    assert "visitor_key" not in like(client, post.id).text


# ---------------------------------------------------------------- 동시성 (실제 커밋, 실제 병렬 연결)


@pytest.fixture
def committed_post():
    """병렬 연결끼리 보이도록 실제로 커밋한 글. 끝나면 지운다 (좋아요 기록은 CASCADE)."""
    session_factory = get_sessionmaker()
    with session_factory() as db:
        category_id = db.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
        post = Post(category_id=category_id, title="동시성", content=DOC)
        db.add(post)
        db.commit()
        post_id = post.id
    yield post_id
    with session_factory() as db:
        db.execute(Post.__table__.delete().where(Post.id == post_id))
        db.commit()


def run_parallel(n: int, action) -> list:
    barrier = threading.Barrier(n)
    results: list = []
    errors: list = []

    def worker(i: int) -> None:
        with get_sessionmaker()() as db:
            barrier.wait()  # 모두 같은 순간에 시작
            try:
                results.append(action(db, i))
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    return results


# TC-LIKE-012: 같은 방문자의 좋아요 10개가 동시에 와도 1만 증가
def test_tc_like_012_concurrent_same_visitor(committed_post):
    run_parallel(10, lambda db, i: like_service.like(db, committed_post, VISITOR_A))
    with get_sessionmaker()() as db:
        assert db.get(Post, committed_post).like_count == 1
        assert like_rows(db, committed_post) == 1


def test_concurrent_different_visitors_all_counted(committed_post):
    run_parallel(10, lambda db, i: like_service.like(db, committed_post, f"00000000-0000-4000-8000-{i:012d}"))
    with get_sessionmaker()() as db:
        assert db.get(Post, committed_post).like_count == 10 == like_rows(db, committed_post)


def test_concurrent_like_and_unlike_stay_consistent(committed_post):
    def toggle(db, i):
        visitor = f"00000000-0000-4000-8000-{i % 3:012d}"
        return like_service.like(db, committed_post, visitor) if i % 2 == 0 else like_service.unlike(db, committed_post, visitor)

    run_parallel(12, toggle)
    with get_sessionmaker()() as db:
        assert db.get(Post, committed_post).like_count == like_rows(db, committed_post)
