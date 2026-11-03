"""M6: 홈·최신·인기 글 (API-011, 012, 013, 021, DEC-006, TEST_CASES §10)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import Category, Post

BASE = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
DOC = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}]}


def cat(db, name: str) -> int:
    return db.execute(select(Category.id).where(Category.name == name)).scalar_one()


def add(db, category: str, title: str, minutes: int, likes: int = 0) -> Post:
    """minutes가 클수록 최근 글"""
    when = BASE + timedelta(minutes=minutes)
    post = Post(category_id=cat(db, category), title=title, content=DOC, like_count=likes, created_at=when, updated_at=when)
    db.add(post)
    db.flush()
    return post


def titles(items: list[dict]) -> list[str]:
    return [p["title"] for p in items]


# ---------------------------------------------------------------- API-011 / 012 / 013


# TC-HOME-003: 카테고리와 관계없이 최신순, 기본 5개
def test_tc_home_003_latest(client, db_session):
    for i in range(7):
        add(db_session, ["DIY", "Blog", "Board"][i % 3], f"글{i}", minutes=i)
    body = client.get("/api/posts/latest").json()
    assert titles(body["items"]) == ["글6", "글5", "글4", "글3", "글2"]
    assert titles(client.get("/api/posts/latest", params={"limit": 2}).json()["items"]) == ["글6", "글5"]


# TC-HOME-004, TC-HOME-009: 좋아요 순, 같으면 최신 글 먼저, 전체 기간, 기본 5개
def test_tc_home_004_009_popular(client, db_session):
    add(db_session, "DIY", "오래되고 인기", minutes=0, likes=30)
    add(db_session, "Blog", "동점-이전", minutes=10, likes=10)
    add(db_session, "Blog", "동점-최근", minutes=20, likes=10)
    add(db_session, "Board", "조금", minutes=30, likes=1)
    add(db_session, "DIY", "없음", minutes=40, likes=0)
    add(db_session, "DIY", "가장 최근 없음", minutes=50, likes=0)
    body = client.get("/api/posts/popular").json()
    assert titles(body["items"]) == ["오래되고 인기", "동점-최근", "동점-이전", "조금", "가장 최근 없음"]


def test_category_latest(client, db_session):
    for i in range(5):
        add(db_session, "DIY", f"DIY{i}", minutes=i)
    add(db_session, "Blog", "블로그", minutes=99)
    body = client.get(f"/api/categories/{cat(db_session, 'DIY')}/posts/latest").json()
    assert body["category"] == {"id": cat(db_session, "DIY"), "name": "DIY"}
    assert titles(body["items"]) == ["DIY4", "DIY3", "DIY2"]  # 기본 3개
    assert client.get("/api/categories/99999/posts/latest").json()["error"]["code"] == "CATEGORY_NOT_FOUND"


@pytest.mark.parametrize("path", ["/api/posts/latest", "/api/posts/popular", "/api/categories/1/posts/latest"])
@pytest.mark.parametrize("limit", [0, 21])
def test_limit_bounds(client, path, limit):
    assert client.get(path, params={"limit": limit}).status_code == 422


# API_SPEC §2.4: /latest, /popular가 /{post_id}로 잘못 매칭되지 않는다
def test_fixed_routes_not_shadowed(client):
    for path in ("/api/posts/latest", "/api/posts/popular"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert response.json() == {"items": []}


# ---------------------------------------------------------------- API-021 홈


# TC-HOME-001, 002, 006, 007, 010
def test_tc_home_001_002_home_structure(client, db_session):
    for i in range(5):
        add(db_session, "DIY", f"DIY{i}", minutes=i, likes=i)
    add(db_session, "Blog", "블로그 하나", minutes=100, likes=50)
    # Portfolio·Board: 글 없음

    body = client.get("/api/home").json()
    assert set(body) == {"categories", "latest_posts", "popular_posts"}

    sections = {c["name"]: c for c in body["categories"]}
    assert [c["name"] for c in body["categories"]] == ["DIY", "Portfolio", "Blog", "Board"]  # TC-HOME-006: 표시 순서
    assert titles(sections["DIY"]["latest_posts"]) == ["DIY4", "DIY3", "DIY2"]  # TC-HOME-002: 3개, 최신순
    assert titles(sections["Blog"]["latest_posts"]) == ["블로그 하나"]  # TC-HOME-010: 3개 미만이면 있는 만큼
    assert sections["Portfolio"]["latest_posts"] == []  # TC-HOME-007: 빈 카테고리도 포함
    assert sections["DIY"]["description"] == "직접 만들어 본 것들"

    assert titles(body["latest_posts"]) == ["블로그 하나", "DIY4", "DIY3", "DIY2", "DIY1"]
    assert titles(body["popular_posts"]) == ["블로그 하나", "DIY4", "DIY3", "DIY2", "DIY1"]


# TC-HOME-005: 새 카테고리가 홈에 자동으로
def test_tc_home_005_new_category_appears(admin_client):
    admin_client.post("/api/categories", json={"name": "여행"})
    names = [c["name"] for c in admin_client.get("/api/home").json()["categories"]]
    assert names[-1] == "여행"


# TC-HOME-006: 순서 변경 반영
def test_tc_home_006_order_change(admin_client, db_session):
    ids = [c["id"] for c in admin_client.get("/api/categories").json()["items"]]
    admin_client.put("/api/categories/order", json={"category_ids": list(reversed(ids))})
    names = [c["name"] for c in admin_client.get("/api/home").json()["categories"]]
    assert names == ["Board", "Blog", "Portfolio", "DIY"]


def test_home_summary_fields(client, db_session):
    add(db_session, "DIY", "글", minutes=0)
    item = client.get("/api/home").json()["latest_posts"][0]
    assert set(item) == {
        "id", "category_id", "category_name", "title", "thumbnail_url", "like_count", "comment_count", "created_at", "updated_at",
    }
    assert item["category_name"] == "DIY"


def test_home_query_count_does_not_grow_with_categories(client, db_session):
    """카테고리가 늘어도 홈 API의 DB 쿼리 수가 늘지 않는다 (카테고리별 최신 글을 한 번에 조회)."""
    from sqlalchemy import event

    from app.core.db import get_engine

    def count_queries() -> int:
        statements: list[str] = []
        listener = lambda *args: statements.append(args[2])  # noqa: E731
        event.listen(get_engine(), "before_cursor_execute", listener)
        try:
            client.get("/api/home")
        finally:
            event.remove(get_engine(), "before_cursor_execute", listener)
        return len(statements)

    count_queries()  # 첫 호출의 일회성 쿼리 제외
    before = count_queries()
    for i in range(6):
        db_session.add(Category(name=f"추가{i}", display_order=10 + i))
    db_session.flush()
    assert count_queries() == before
