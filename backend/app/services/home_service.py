"""홈·최신·인기 글 (API-011, 012, 013, 021, DEC-006, REQ-004~008).

표시 개수는 여기 설정값으로 둔다 (나중에 바꾸기 쉽게, API_SPEC API-021).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Category
from app.repositories import post_repository as repo
from app.schemas.post import CategoryLatest, CategoryRef, HomeCategory, HomeData, PostSummary
from app.services.post_service import summary_out
from app.storage import StorageBackend

HOME_CATEGORY_POSTS = 3
HOME_LATEST_POSTS = 5
HOME_POPULAR_POSTS = 5


def latest_posts(db: Session, storage: StorageBackend, limit: int) -> list[PostSummary]:
    return [summary_out(r, storage) for r in repo.latest(db, limit)]


def popular_posts(db: Session, storage: StorageBackend, limit: int) -> list[PostSummary]:
    return [summary_out(r, storage) for r in repo.popular(db, limit)]


def category_latest(db: Session, storage: StorageBackend, category_id: int, limit: int) -> CategoryLatest:
    category = db.get(Category, category_id)
    if category is None:
        raise AppError(404, "CATEGORY_NOT_FOUND", "카테고리를 찾을 수 없습니다.")
    rows = repo.latest(db, limit, category_id=category_id)
    return CategoryLatest(category=CategoryRef(id=category.id, name=category.name), items=[summary_out(r, storage) for r in rows])


def home(db: Session, storage: StorageBackend) -> HomeData:
    categories = db.execute(select(Category).order_by(Category.display_order, Category.id)).scalars().all()
    per_category = repo.latest_per_category(db, HOME_CATEGORY_POSTS)
    return HomeData(
        # 글이 없는 카테고리도 빈 목록으로 포함한다 (화면에서 "아직 글이 없습니다")
        categories=[
            HomeCategory(
                id=c.id,
                name=c.name,
                description=c.description,
                latest_posts=[summary_out(r, storage) for r in per_category.get(c.id, [])],
            )
            for c in categories
        ],
        latest_posts=latest_posts(db, storage, HOME_LATEST_POSTS),
        popular_posts=popular_posts(db, storage, HOME_POPULAR_POSTS),
    )
