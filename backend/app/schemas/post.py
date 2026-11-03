"""게시글 요청/응답 (API-006~010, API_SPEC v1.0 §4.1, §6)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import trimmed
from app.schemas.image import ImageOut

PostTitle = trimmed(1, 200)


class PostInput(BaseModel):
    category_id: int = Field(gt=0)
    title: PostTitle
    content: dict[str, Any]  # TipTap JSON — 구조 검증은 content_validation에서


class PostSummary(BaseModel):
    id: int
    category_id: int
    category_name: str
    title: str
    thumbnail_url: str | None
    like_count: int
    comment_count: int
    created_at: datetime
    updated_at: datetime


class PostDetail(PostSummary):
    content: dict[str, Any]
    images: list[ImageOut]
    liked: bool


class PostPage(BaseModel):
    items: list[PostSummary]
    page: int
    size: int
    total: int
