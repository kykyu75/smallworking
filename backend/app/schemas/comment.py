"""댓글 요청/응답 (API-014~017, API-026, API_SPEC v1.0 §4.3, DEC-006)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import trimmed

Nickname = trimmed(2, 20)
CommentPassword = trimmed(4, 64)
CommentContent = trimmed(1, 1000)


class CommentCreate(BaseModel):
    nickname: Nickname
    password: CommentPassword
    content: CommentContent
    parent_comment_id: int | None = None


class CommentUpdate(BaseModel):
    password: CommentPassword
    content: CommentContent


class CommentDelete(BaseModel):
    password: CommentPassword


class ReplyOut(BaseModel):
    """답글 (replies 항목 없음, API_SPEC §4.3)"""

    id: int
    nickname: str | None  # 삭제된 댓글이면 null
    content: str | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CommentOut(ReplyOut):
    """최상위 댓글"""

    replies: list[ReplyOut]


class CommentList(BaseModel):
    items: list[CommentOut]


class AdminCommentOut(BaseModel):
    id: int
    post_id: int
    post_title: str
    parent_comment_id: int | None
    nickname: str
    content: str
    reply_count: int
    created_at: datetime


class AdminCommentPage(BaseModel):
    items: list[AdminCommentOut]
    page: int
    size: int
    total: int
