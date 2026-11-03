"""게시글 좋아요 (API-018, API-022, DEC-004, REQ-030, REQ-032).

- 방문자 구분: 쿠키 sw_visitor (무작위 UUID). 로그인·회원가입 없음.
- 같은 방문자는 같은 글에 1회만 (post_like UNIQUE(post_id, visitor_key)).
- 좋아요·취소는 멱등: 이미 그 상태면 오류 없이 현재 상태를 돌려준다.
- 동시성: 기록을 실제로 넣거나 지웠을 때만 like_count를 DB 안에서 +1/-1 한다 (한 트랜잭션).
  → 같은 요청이 동시에 여러 번 와도 숫자와 기록 건수가 항상 같다 (TC-LIKE-004, TC-LIKE-012).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Post, PostLike


@dataclass(frozen=True)
class LikeResult:
    post_id: int
    like_count: int
    liked: bool


def _not_found() -> AppError:
    return AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.")


def new_visitor_key() -> str:
    return str(uuid.uuid4())


def is_valid_visitor_key(value: str | None) -> bool:
    """서버가 발급한 UUID 형식만 인정한다. 그 외 값(조작·손상된 쿠키)은 없는 것으로 본다."""
    if not value or len(value) > 64:
        return False
    try:
        return str(uuid.UUID(value)) == value.lower()
    except ValueError:
        return False


def _current_count(db: Session, post_id: int) -> int:
    count = db.execute(select(Post.like_count).where(Post.id == post_id)).scalar_one_or_none()
    if count is None:
        raise _not_found()
    return count


def like(db: Session, post_id: int, visitor_key: str) -> LikeResult:
    _current_count(db, post_id)  # 없는 글이면 404
    try:
        inserted = db.execute(
            insert(PostLike)
            .values(post_id=post_id, visitor_key=visitor_key)
            .on_conflict_do_nothing(constraint="uq_post_like_post_visitor")
            .returning(PostLike.id)
        ).first()
        if inserted is not None:
            count = db.execute(
                update(Post).where(Post.id == post_id).values(like_count=Post.like_count + 1).returning(Post.like_count)
            ).scalar_one()
        else:
            count = _current_count(db, post_id)
        db.commit()
    except IntegrityError as exc:  # 확인 직후 글이 삭제된 경우 (FK)
        db.rollback()
        raise _not_found() from exc
    return LikeResult(post_id=post_id, like_count=count, liked=True)


def unlike(db: Session, post_id: int, visitor_key: str | None) -> LikeResult:
    count = _current_count(db, post_id)
    if visitor_key:
        removed = db.execute(
            delete(PostLike)
            .where(PostLike.post_id == post_id, PostLike.visitor_key == visitor_key)
            .returning(PostLike.id)
        ).first()
        if removed is not None:
            count = db.execute(
                update(Post).where(Post.id == post_id).values(like_count=Post.like_count - 1).returning(Post.like_count)
            ).scalar_one()
    db.commit()
    return LikeResult(post_id=post_id, like_count=count, liked=False)
