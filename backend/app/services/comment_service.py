"""댓글·답글 규칙 (API-014~017, 026, 027, DEC-005, DATA_MODEL v1.0 §7, REQ-024~029, REQ-035).

삭제 규칙 (DATA_MODEL §7.4):
| 대상 | 처리 |
|---|---|
| 답글 없는 댓글 | 완전 삭제 |
| 답글 | 완전 삭제. 부모가 soft delete 상태이고 남은 답글이 0개면 부모도 완전 삭제 |
| 답글 있는 댓글 | soft delete ("삭제된 댓글입니다", 닉네임·내용·비밀번호 해시를 비움) |
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.models import Comment, Post
from app.schemas.comment import (
    AdminCommentOut,
    AdminCommentPage,
    CommentCreate,
    CommentOut,
    CommentUpdate,
    ReplyOut,
)


def _comment_not_found() -> AppError:
    return AppError(404, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.")


def _already_deleted() -> AppError:
    return AppError(422, "COMMENT_ALREADY_DELETED", "삭제된 댓글입니다.")


def _invalid_password() -> AppError:
    return AppError(403, "INVALID_PASSWORD", "비밀번호가 일치하지 않습니다.")


def _ensure_post(db: Session, post_id: int) -> None:
    if db.get(Post, post_id) is None:
        raise AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.")


def _get_comment(db: Session, comment_id: int) -> Comment:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise _comment_not_found()
    return comment


def _reply_out(comment: Comment) -> ReplyOut:
    return ReplyOut(
        id=comment.id,
        nickname=None if comment.is_deleted else comment.nickname,
        content=None if comment.is_deleted else comment.content,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def _out(comment: Comment, replies: list[Comment] | None = None) -> CommentOut | ReplyOut:
    """최상위 댓글은 replies 포함, 답글은 replies 없이."""
    if comment.parent_comment_id is not None:
        return _reply_out(comment)
    return CommentOut(**_reply_out(comment).model_dump(), replies=[_reply_out(r) for r in replies or []])


# ---------------------------------------------------------------- 조회 (API-014)


def list_comments(db: Session, post_id: int) -> list[CommentOut | ReplyOut]:
    _ensure_post(db, post_id)
    rows = db.execute(
        select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at, Comment.id)
    ).scalars().all()
    replies: dict[int, list[Comment]] = {}
    top: list[Comment] = []
    for comment in rows:  # 작성순 (DEC-006)
        if comment.parent_comment_id is None:
            top.append(comment)
        else:
            replies.setdefault(comment.parent_comment_id, []).append(comment)
    return [_out(c, replies.get(c.id, [])) for c in top]


# ---------------------------------------------------------------- 작성 (API-015)


def create_comment(db: Session, post_id: int, data: CommentCreate, now: datetime) -> CommentOut | ReplyOut:
    _ensure_post(db, post_id)
    if data.parent_comment_id is not None:
        parent = _get_comment(db, data.parent_comment_id)
        if parent.post_id != post_id:
            raise AppError(422, "INVALID_PARENT_COMMENT", "답글을 달 댓글이 올바르지 않습니다.")
        if parent.parent_comment_id is not None:
            raise AppError(422, "REPLY_DEPTH_EXCEEDED", "답글에는 답글을 달 수 없습니다.")  # REQ-029
        if parent.is_deleted:
            raise _already_deleted()

    comment = Comment(
        post_id=post_id,
        parent_comment_id=data.parent_comment_id,
        nickname=data.nickname,
        password_hash=hash_password(data.password),  # 원문은 저장하지 않는다 (REQ-043)
        content=data.content,
        created_at=now,
        updated_at=now,
    )
    db.add(comment)
    db.commit()
    return _out(comment, [])


# ---------------------------------------------------------------- 수정 (API-016)


def update_comment(db: Session, comment_id: int, data: CommentUpdate, now: datetime) -> CommentOut | ReplyOut:
    comment = _get_comment(db, comment_id)
    if comment.is_deleted:
        raise _already_deleted()
    if not verify_password(comment.password_hash, data.password):
        raise _invalid_password()
    comment.content = data.content
    comment.updated_at = now
    db.commit()
    replies = db.execute(select(Comment).where(Comment.parent_comment_id == comment.id).order_by(Comment.created_at, Comment.id)).scalars().all()
    return _out(comment, list(replies))


# ---------------------------------------------------------------- 삭제 (API-017, API-027)


def _reply_count(db: Session, comment_id: int) -> int:
    return db.execute(select(func.count(Comment.id)).where(Comment.parent_comment_id == comment_id)).scalar_one()


def _remove(db: Session, comment: Comment, now: datetime) -> None:
    if comment.is_deleted:
        raise _already_deleted()

    if comment.parent_comment_id is not None:
        # 답글: 완전 삭제, 부모가 "삭제된 댓글" 상태이고 이제 답글이 없으면 부모 자리도 정리
        parent = db.get(Comment, comment.parent_comment_id)
        db.delete(comment)
        db.flush()
        if parent is not None and parent.is_deleted and _reply_count(db, parent.id) == 0:
            db.delete(parent)
    elif _reply_count(db, comment.id) == 0:
        db.delete(comment)
    else:
        # 답글이 있는 댓글: 자리만 남긴다 (DEC-005)
        comment.is_deleted = True
        comment.deleted_at = now
        comment.nickname = None
        comment.content = None
        comment.password_hash = None
    db.commit()


def delete_comment(db: Session, comment_id: int, password: str, now: datetime) -> None:
    comment = _get_comment(db, comment_id)
    if comment.is_deleted:
        raise _already_deleted()
    if not verify_password(comment.password_hash, password):
        raise _invalid_password()
    _remove(db, comment, now)


def admin_delete_comment(db: Session, comment_id: int, now: datetime) -> None:
    """관리자 삭제: 비밀번호 확인 없이, 같은 삭제 규칙 (REQ-035, API-027)."""
    _remove(db, _get_comment(db, comment_id), now)


# ---------------------------------------------------------------- 관리자 목록 (API-026)


def admin_list(db: Session, page: int, size: int) -> AdminCommentPage:
    reply = aliased(Comment)
    reply_count = select(func.count(reply.id)).where(reply.parent_comment_id == Comment.id).scalar_subquery()
    base = Comment.is_deleted.is_(False)  # 삭제된 댓글 자리는 관리 대상이 아니다
    rows = db.execute(
        select(Comment, Post.title, reply_count)
        .join(Post, Post.id == Comment.post_id)
        .where(base)
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    total = db.execute(select(func.count(Comment.id)).where(base)).scalar_one()
    items = [
        AdminCommentOut(
            id=c.id,
            post_id=c.post_id,
            post_title=title,
            parent_comment_id=c.parent_comment_id,
            nickname=c.nickname or "",
            content=c.content or "",
            reply_count=int(count),
            created_at=c.created_at,
        )
        for c, title, count in rows
    ]
    return AdminCommentPage(items=items, page=page, size=size, total=total)
