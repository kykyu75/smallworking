"""게시글 규칙 (API-006~010, DEC-001, DEC-002, DEC-005).

저장(작성·수정) 시 이미지 처리:
1. 본문에서 imageId를 등장 순서대로 뽑는다
2. 각 이미지는 존재해야 하고, 임시 이미지이거나 이 글의 이미지여야 한다
3. 본문 이미지 → 이 글에 연결, display_order = 등장 순서
4. 이 글에 연결돼 있었지만 본문에서 빠진 이미지 → 삭제 (DB 커밋 후 파일 삭제)
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Category, Post
from app.repositories import post_repository as repo
from app.schemas.image import ImageOut
from app.schemas.post import PostDetail, PostInput, PostPage, PostSummary
from app.services.content_validation import validate_content
from app.storage import StorageBackend, StorageError

logger = logging.getLogger("smallworking")


def _post_not_found() -> AppError:
    return AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.")


def _category_not_found() -> AppError:
    return AppError(404, "CATEGORY_NOT_FOUND", "카테고리를 찾을 수 없습니다.")


def _invalid_image_reference() -> AppError:
    return AppError(422, "INVALID_IMAGE_REFERENCE", "본문의 이미지 정보가 올바르지 않습니다.")


def _summary(row: repo.SummaryRow, storage: StorageBackend) -> PostSummary:
    post = row.post
    return PostSummary(
        id=post.id,
        category_id=post.category_id,
        category_name=row.category_name,
        title=post.title,
        thumbnail_url=storage.public_url(row.thumbnail_path) if row.thumbnail_path else None,
        like_count=post.like_count,
        comment_count=row.comment_count,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


# ---------------------------------------------------------------- 조회


def list_posts(db: Session, storage: StorageBackend, category_id: int | None, page: int, size: int) -> PostPage:
    if category_id is not None and db.get(Category, category_id) is None:
        raise _category_not_found()
    rows, total = repo.list_page(db, category_id, page, size)
    return PostPage(items=[_summary(r, storage) for r in rows], page=page, size=size, total=total)


def get_post(db: Session, storage: StorageBackend, post_id: int, visitor_key: str | None) -> PostDetail:
    row = repo.get_summary(db, post_id)
    if row is None:
        raise _post_not_found()
    summary = _summary(row, storage)
    return PostDetail(
        **summary.model_dump(),
        content=row.post.content,
        images=[ImageOut.build(img, storage) for img in repo.images_of(db, post_id)],
        liked=repo.is_liked(db, post_id, visitor_key),
    )


# ---------------------------------------------------------------- 저장


def _validated(db: Session, data: PostInput) -> list[int]:
    if db.get(Category, data.category_id) is None:
        raise _category_not_found()
    summary = validate_content(data.content)
    if not summary.has_body:
        raise AppError(
            422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{"field": "content", "reason": "본문을 입력해 주세요."}]
        )
    return summary.image_ids


def _link_images(db: Session, post: Post, image_ids: list[int]) -> list[str]:
    """본문 이미지를 글에 연결하고, 빠진 이미지를 지운다. 지울 파일 키 목록을 돌려준다."""
    found = repo.images_by_ids(db, image_ids)
    for image_id in image_ids:
        image = found.get(image_id)
        if image is None or image.post_id not in (None, post.id):
            raise _invalid_image_reference()

    keep = set(image_ids)
    removed_keys: list[str] = []
    if post.id is not None:
        for old in repo.images_of(db, post.id):
            if old.id not in keep:
                removed_keys += [old.file_path, old.thumbnail_path]
                db.delete(old)

    for order, image_id in enumerate(image_ids):
        image = found[image_id]
        image.post_id = post.id
        image.display_order = order
    return removed_keys


def _delete_files(storage: StorageBackend, keys: list[str]) -> None:
    if not keys:
        return
    try:
        storage.delete(keys)
    except StorageError:
        # DB는 이미 반영됨. 남은 파일은 정리 작업(API-028)이 지운다
        logger.exception("게시글 이미지 파일 삭제 실패: %s", keys)


def create_post(db: Session, storage: StorageBackend, data: PostInput, now: datetime) -> PostDetail:
    image_ids = _validated(db, data)
    try:
        post = Post(category_id=data.category_id, title=data.title, content=data.content, created_at=now, updated_at=now)
        db.add(post)
        db.flush()  # post.id 확보 (같은 트랜잭션)
        _link_images(db, post, image_ids)
        db.commit()
    except Exception:
        db.rollback()  # 게시글 저장과 이미지 연결은 함께 성공하거나 함께 취소된다
        raise
    return get_post(db, storage, post.id, None)


def update_post(
    db: Session, storage: StorageBackend, post_id: int, data: PostInput, now: datetime, visitor_key: str | None = None
) -> PostDetail:
    post = db.get(Post, post_id)
    if post is None:
        raise _post_not_found()
    image_ids = _validated(db, data)
    try:
        post.category_id = data.category_id
        post.title = data.title
        post.content = data.content
        post.updated_at = now  # created_at은 유지 (REQ-016)
        removed_keys = _link_images(db, post, image_ids)
        db.commit()
    except Exception:
        db.rollback()
        raise
    _delete_files(storage, removed_keys)  # 파일 삭제는 DB 커밋 후 (DEC-005)
    return get_post(db, storage, post.id, visitor_key)


def delete_post(db: Session, storage: StorageBackend, post_id: int) -> None:
    post = db.get(Post, post_id)
    if post is None:
        raise _post_not_found()
    keys: list[str] = []
    for image in repo.images_of(db, post_id):
        keys += [image.file_path, image.thumbnail_path]
    # post_image, comment, post_like는 DB의 ON DELETE CASCADE로 함께 삭제 (DEC-005)
    db.delete(post)
    db.commit()
    _delete_files(storage, keys)
