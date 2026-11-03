"""카테고리 규칙 (API-001~005, DEC-005, DEC-006, REQ-008~013)."""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Category
from app.repositories import category_repository as repo
from app.schemas.category import CategoryInput, CategoryOut


def _not_found() -> AppError:
    return AppError(404, "CATEGORY_NOT_FOUND", "카테고리를 찾을 수 없습니다.")


def _duplicated() -> AppError:
    return AppError(
        409,
        "CATEGORY_NAME_DUPLICATED",
        "이미 있는 카테고리 이름입니다.",
        [{"field": "name", "reason": "이미 있는 카테고리 이름입니다."}],
    )


def _out(category: Category, post_count: int) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        name=category.name,
        description=category.description,
        display_order=category.display_order,
        post_count=post_count,
    )


def list_categories(db: Session) -> list[CategoryOut]:
    return [_out(category, count) for category, count in repo.list_with_post_count(db)]


def _commit_or_duplicate(db: Session) -> None:
    # 동시에 같은 이름을 저장하는 경우는 DB UNIQUE 인덱스가 최종적으로 막는다
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicated() from exc


def create_category(db: Session, data: CategoryInput) -> CategoryOut:
    if repo.name_exists(db, data.name):
        raise _duplicated()
    # 새 카테고리는 맨 뒤에 추가 (API_SPEC API-002)
    category = Category(name=data.name, description=data.description, display_order=repo.max_display_order(db) + 1)
    db.add(category)
    _commit_or_duplicate(db)
    return _out(category, 0)


def update_category(db: Session, category_id: int, data: CategoryInput) -> CategoryOut:
    category = repo.get(db, category_id)
    if category is None:
        raise _not_found()
    if repo.name_exists(db, data.name, exclude_id=category_id):
        raise _duplicated()
    category.name = data.name
    category.description = data.description
    _commit_or_duplicate(db)
    return _out(category, repo.count_posts(db, category_id))


def delete_category(db: Session, category_id: int) -> None:
    category = repo.get(db, category_id)
    if category is None:
        raise _not_found()
    # 게시글이 있으면 삭제 거부 (DEC-005). DB도 ON DELETE RESTRICT로 막는다.
    if repo.count_posts(db, category_id) > 0:
        raise AppError(409, "CATEGORY_NOT_EMPTY", "게시글을 먼저 다른 카테고리로 옮기거나 삭제하세요.")
    db.delete(category)
    try:
        db.commit()
    except IntegrityError as exc:  # 확인 직후 다른 요청이 글을 추가한 경우
        db.rollback()
        raise AppError(409, "CATEGORY_NOT_EMPTY", "게시글을 먼저 다른 카테고리로 옮기거나 삭제하세요.") from exc


def reorder_categories(db: Session, category_ids: list[int]) -> list[CategoryOut]:
    existing = repo.all_ids(db)
    # 전체 카테고리를 빠짐없이, 중복 없이 보내야 한다 (API-005)
    if len(category_ids) != len(set(category_ids)) or set(category_ids) != set(existing):
        raise AppError(422, "CATEGORY_ORDER_MISMATCH", "카테고리 목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.")
    for position, category_id in enumerate(category_ids, start=1):
        db.execute(update(Category).where(Category.id == category_id).values(display_order=position))
    db.commit()
    db.expire_all()
    return list_categories(db)
