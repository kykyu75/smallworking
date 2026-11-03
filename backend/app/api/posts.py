"""게시글 API (API-006~012).

라우트 순서: /latest, /popular 같은 고정 경로는 /{post_id}보다 먼저 선언한다 (API_SPEC §2.4).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.db import get_db
from app.core.deps import require_admin
from app.schemas.post import PostDetail, PostInput, PostList, PostPage
from app.services import home_service, post_service
from app.storage import StorageBackend, get_storage

router = APIRouter(prefix="/api/posts", tags=["posts"])

VISITOR_COOKIE = "sw_visitor"


# API-006 (공개)
@router.get("", response_model=PostPage)
def list_posts(
    category_id: int | None = Query(default=None, gt=0),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> PostPage:
    return post_service.list_posts(db, storage, category_id, page, size)


# API-008 (관리자)
@router.post("", response_model=PostDetail, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_post(
    body: PostInput,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    now: datetime = Depends(get_now),
) -> PostDetail:
    return post_service.create_post(db, storage, body, now)


# API-011 (공개) — /{post_id}보다 먼저
@router.get("/latest", response_model=PostList)
def latest_posts(
    limit: int = Query(default=home_service.HOME_LATEST_POSTS, ge=1, le=20),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> PostList:
    return PostList(items=home_service.latest_posts(db, storage, limit))


# API-012 (공개) — /{post_id}보다 먼저
@router.get("/popular", response_model=PostList)
def popular_posts(
    limit: int = Query(default=home_service.HOME_POPULAR_POSTS, ge=1, le=20),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> PostList:
    return PostList(items=home_service.popular_posts(db, storage, limit))


# API-007 (공개)
@router.get("/{post_id}", response_model=PostDetail)
def get_post(
    post_id: int,
    sw_visitor: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> PostDetail:
    return post_service.get_post(db, storage, post_id, sw_visitor)


# API-009 (관리자)
@router.put("/{post_id}", response_model=PostDetail, dependencies=[Depends(require_admin)])
def update_post(
    post_id: int,
    body: PostInput,
    sw_visitor: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    now: datetime = Depends(get_now),
) -> PostDetail:
    return post_service.update_post(db, storage, post_id, body, now, sw_visitor)


# API-010 (관리자)
@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    post_service.delete_post(db, storage, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
