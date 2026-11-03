"""게시글 DB 조회 (CLAUDE.md §6 repositories)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.models import Category, Comment, Post, PostImage, PostLike


@dataclass(frozen=True)
class SummaryRow:
    post: Post
    category_name: str
    thumbnail_path: str | None
    comment_count: int


def _summary_select() -> Select:
    # 대표 이미지 = 본문 첫 이미지 (display_order = 0, DEC-002)
    thumbnail = (
        select(PostImage.thumbnail_path)
        .where(and_(PostImage.post_id == Post.id, PostImage.display_order == 0))
        .limit(1)
        .scalar_subquery()
    )
    comment_count = (
        select(func.count(Comment.id))
        .where(and_(Comment.post_id == Post.id, Comment.is_deleted.is_(False)))
        .scalar_subquery()
    )
    return select(Post, Category.name, thumbnail, comment_count).join(Category, Category.id == Post.category_id)


def _rows(result: Sequence) -> list[SummaryRow]:
    return [SummaryRow(post, name, thumb, int(count)) for post, name, thumb, count in result]


def list_page(db: Session, category_id: int | None, page: int, size: int) -> tuple[list[SummaryRow], int]:
    query = _summary_select()
    count_query = select(func.count(Post.id))
    if category_id is not None:
        query = query.where(Post.category_id == category_id)
        count_query = count_query.where(Post.category_id == category_id)
    query = query.order_by(Post.created_at.desc(), Post.id.desc()).offset((page - 1) * size).limit(size)
    return _rows(db.execute(query).all()), db.execute(count_query).scalar_one()


def get_summary(db: Session, post_id: int) -> SummaryRow | None:
    rows = _rows(db.execute(_summary_select().where(Post.id == post_id)).all())
    return rows[0] if rows else None


def images_of(db: Session, post_id: int) -> list[PostImage]:
    return list(
        db.execute(select(PostImage).where(PostImage.post_id == post_id).order_by(PostImage.display_order)).scalars()
    )


def images_by_ids(db: Session, ids: list[int]) -> dict[int, PostImage]:
    if not ids:
        return {}
    return {img.id: img for img in db.execute(select(PostImage).where(PostImage.id.in_(ids))).scalars()}


def is_liked(db: Session, post_id: int, visitor_key: str | None) -> bool:
    if not visitor_key:
        return False
    found = db.execute(
        select(PostLike.id).where(PostLike.post_id == post_id, PostLike.visitor_key == visitor_key).limit(1)
    ).first()
    return found is not None
