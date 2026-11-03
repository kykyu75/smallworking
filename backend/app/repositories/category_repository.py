"""카테고리 DB 조회 (CLAUDE.md §6 repositories)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Post


def list_with_post_count(db: Session) -> list[tuple[Category, int]]:
    post_count = (
        select(Post.category_id, func.count(Post.id).label("cnt")).group_by(Post.category_id).subquery()
    )
    rows = db.execute(
        select(Category, func.coalesce(post_count.c.cnt, 0))
        .outerjoin(post_count, post_count.c.category_id == Category.id)
        .order_by(Category.display_order, Category.id)
    ).all()
    return [(category, int(count)) for category, count in rows]


def get(db: Session, category_id: int) -> Category | None:
    return db.get(Category, category_id)


def count_posts(db: Session, category_id: int) -> int:
    return db.execute(select(func.count(Post.id)).where(Post.category_id == category_id)).scalar_one()


def name_exists(db: Session, name: str, exclude_id: int | None = None) -> bool:
    query = select(Category.id).where(func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Category.id != exclude_id)
    return db.execute(query.limit(1)).first() is not None


def max_display_order(db: Session) -> int:
    return db.execute(select(func.coalesce(func.max(Category.display_order), 0))).scalar_one()


def all_ids(db: Session) -> list[int]:
    return list(db.execute(select(Category.id)).scalars())
