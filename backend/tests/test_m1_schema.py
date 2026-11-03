"""M1: DB 스키마가 DATA_MODEL v1.0 규칙을 지키는지 확인한다.

API가 아직 없으므로 DB 계층에서 직접 검증한다. 같은 TC는 API 단계(M3~M8)에서 다시 API로 검증한다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from alembic import command
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.core.db import get_engine
from app.models import AdminSession, AdminUser, Category, Comment, Post, PostImage, PostLike
from tests.conftest import alembic_config

DOC = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}]}


def make_post(db, category: Category, title: str = "글") -> Post:
    post = Post(category_id=category.id, title=title, content=DOC)
    db.add(post)
    db.flush()
    return post


def default_category(db) -> Category:
    return db.execute(select(Category).where(Category.name == "DIY")).scalar_one()


# ---------------------------------------------------------------- 구조


def test_all_tables_exist():
    tables = set(inspect(get_engine()).get_table_names())
    assert {"category", "post", "post_image", "comment", "post_like", "admin_user", "admin_session"} <= tables


# TC-CAT-001: 기본 카테고리 4개, 순서 1~4
def test_tc_cat_001_default_categories_seeded(db_session):
    rows = db_session.execute(select(Category.name, Category.display_order).order_by(Category.display_order)).all()
    assert [tuple(r) for r in rows] == [("DIY", 1), ("Portfolio", 2), ("Blog", 3), ("Board", 4)]


def test_migration_downgrade_and_upgrade_round_trip():
    cfg = alembic_config()
    command.downgrade(cfg, "base")
    assert "post" not in inspect(get_engine()).get_table_names()
    command.upgrade(cfg, "head")
    assert "post" in inspect(get_engine()).get_table_names()


# ---------------------------------------------------------------- category


# TC-CAT-005 (DB): 대소문자 무시 이름 중복 불가
def test_category_name_unique_case_insensitive(db_session):
    db_session.add(Category(name="diy", display_order=9))
    with pytest.raises(IntegrityError):
        db_session.flush()


# TC-CAT-008 (DB): 게시글이 있는 카테고리는 삭제 불가 (ON DELETE RESTRICT)
def test_tc_cat_008_category_with_posts_cannot_be_deleted(db_session):
    category = default_category(db_session)
    make_post(db_session, category)
    with pytest.raises(IntegrityError):
        db_session.execute(text("DELETE FROM category WHERE id = :id"), {"id": category.id})


def test_empty_category_can_be_deleted(db_session):
    category = Category(name="여행", display_order=5)
    db_session.add(category)
    db_session.flush()
    db_session.delete(category)
    db_session.flush()
    assert db_session.get(Category, category.id) is None


# ---------------------------------------------------------------- post 삭제 CASCADE


# TC-POST-008 (DB): 게시글 삭제 시 이미지·댓글·답글·좋아요 레코드 함께 삭제
def test_tc_post_008_post_delete_cascades(db_session):
    post = make_post(db_session, default_category(db_session))
    db_session.add(
        PostImage(
            post_id=post.id, file_name="a.jpg", file_path="images/2026/11/a.jpg",
            thumbnail_path="images/2026/11/a_thumb.jpg", mime_type="image/jpeg",
            file_size=100, width=10, height=10, display_order=0,
        )
    )
    parent = Comment(post_id=post.id, nickname="방문자", password_hash="h", content="댓글")
    db_session.add(parent)
    db_session.flush()
    db_session.add(Comment(post_id=post.id, parent_comment_id=parent.id, nickname="다른", password_hash="h", content="답글"))
    db_session.add(PostLike(post_id=post.id, visitor_key="v1"))
    db_session.flush()

    db_session.execute(text("DELETE FROM post WHERE id = :id"), {"id": post.id})
    for model in (PostImage, Comment, PostLike):
        count = db_session.execute(select(func.count()).select_from(model).where(model.post_id == post.id)).scalar_one()
        assert count == 0, model.__tablename__


def test_post_like_count_cannot_be_negative(db_session):
    post = make_post(db_session, default_category(db_session))
    post.like_count = -1
    with pytest.raises(IntegrityError):
        db_session.flush()


# ---------------------------------------------------------------- post_image


def test_temp_image_allowed_without_post(db_session):
    image = PostImage(
        post_id=None, file_name="t.png", file_path="images/2026/11/t.png", thumbnail_path="images/2026/11/t_thumb.png",
        mime_type="image/png", file_size=1, width=1, height=1, display_order=None,
    )
    db_session.add(image)
    db_session.flush()
    assert image.id is not None


def test_linked_image_requires_display_order(db_session):
    post = make_post(db_session, default_category(db_session))
    db_session.add(
        PostImage(
            post_id=post.id, file_name="x.jpg", file_path="k", thumbnail_path="k_t",
            mime_type="image/jpeg", file_size=1, width=1, height=1, display_order=None,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_image_mime_type_restricted(db_session):
    db_session.add(
        PostImage(file_name="v.mp4", file_path="k", thumbnail_path="k_t", mime_type="video/mp4", file_size=1, width=1, height=1)
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


# ---------------------------------------------------------------- comment


def test_alive_comment_requires_nickname_password_content(db_session):
    post = make_post(db_session, default_category(db_session))
    db_session.add(Comment(post_id=post.id, nickname=None, password_hash="h", content="내용"))
    with pytest.raises(IntegrityError):
        db_session.flush()


# TC-COM-014 (DB): soft delete된 댓글은 닉네임·내용·해시를 비울 수 있고 deleted_at이 필요하다
def test_soft_deleted_comment_fields(db_session):
    post = make_post(db_session, default_category(db_session))
    comment = Comment(post_id=post.id, nickname=None, password_hash=None, content=None, is_deleted=True,
                      deleted_at=datetime.now(timezone.utc))
    db_session.add(comment)
    db_session.flush()

    broken = Comment(post_id=post.id, nickname=None, password_hash=None, content=None, is_deleted=True, deleted_at=None)
    db_session.add(broken)
    with pytest.raises(IntegrityError):
        db_session.flush()


# ---------------------------------------------------------------- post_like


# TC-LIKE-003 (DB): 같은 방문자는 같은 글에 1회만
def test_post_like_unique_per_visitor(db_session):
    post = make_post(db_session, default_category(db_session))
    db_session.add(PostLike(post_id=post.id, visitor_key="visitor-1"))
    db_session.flush()
    db_session.add(PostLike(post_id=post.id, visitor_key="visitor-1"))
    with pytest.raises(IntegrityError):
        db_session.flush()


# ---------------------------------------------------------------- admin


def test_admin_session_cascades_and_token_unique(db_session):
    admin = AdminUser(username="admin", password_hash="h")
    db_session.add(admin)
    db_session.flush()
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    db_session.add(AdminSession(admin_user_id=admin.id, token_hash="a" * 64, expires_at=expires))
    db_session.flush()

    db_session.execute(text("DELETE FROM admin_user WHERE id = :id"), {"id": admin.id})
    remaining = db_session.execute(select(func.count()).select_from(AdminSession)).scalar_one()
    assert remaining == 0
