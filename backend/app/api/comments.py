"""댓글 API (API-014~017) + 관리자 댓글 API (API-026, API-027)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.db import get_db
from app.core.deps import require_admin
from app.schemas.comment import (
    AdminCommentPage,
    CommentCreate,
    CommentDelete,
    CommentList,
    CommentOut,
    CommentUpdate,
    ReplyOut,
)
from app.services import comment_service

router = APIRouter(tags=["comments"])


# API-014 (공개)
@router.get("/api/posts/{post_id}/comments", response_model=CommentList)
def list_comments(post_id: int, db: Session = Depends(get_db)) -> CommentList:
    return CommentList(items=comment_service.list_comments(db, post_id))


# API-015 (공개)
@router.post("/api/posts/{post_id}/comments", response_model=CommentOut | ReplyOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int, body: CommentCreate, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> CommentOut | ReplyOut:
    return comment_service.create_comment(db, post_id, body, now)


# API-016 (비밀번호)
@router.put("/api/comments/{comment_id}", response_model=CommentOut | ReplyOut)
def update_comment(
    comment_id: int, body: CommentUpdate, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> CommentOut | ReplyOut:
    return comment_service.update_comment(db, comment_id, body, now)


# API-017 (비밀번호) — DELETE 본문은 버려질 수 있어 POST .../delete (API_SPEC §3)
@router.post("/api/comments/{comment_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int, body: CommentDelete, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> Response:
    comment_service.delete_comment(db, comment_id, body.password, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# API-026 (관리자)
@router.get("/api/admin/comments", response_model=AdminCommentPage, dependencies=[Depends(require_admin)])
def admin_list_comments(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> AdminCommentPage:
    return comment_service.admin_list(db, page, size)


# API-027 (관리자)
@router.delete(
    "/api/admin/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)]
)
def admin_delete_comment(comment_id: int, db: Session = Depends(get_db), now: datetime = Depends(get_now)) -> Response:
    comment_service.admin_delete_comment(db, comment_id, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
