"""요청 게시판 요청/응답 (API-029~038, API_SPEC v1.0 §11-1, DEC-011)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.comment import CommentPassword, Nickname
from app.schemas.common import trimmed

RequestKind = Literal["material", "diy", "etc"]
RequestTitle = trimmed(1, 100)
RequestText = trimmed(1, 2000)


class RequestCreate(BaseModel):
    kind: RequestKind
    title: RequestTitle
    content: RequestText
    nickname: Nickname
    password: CommentPassword
    is_secret: bool = False


class RequestUpdate(BaseModel):
    password: CommentPassword
    kind: RequestKind
    title: RequestTitle
    content: RequestText
    is_secret: bool = False


class RequestPassword(BaseModel):
    password: CommentPassword


class AnswerInput(BaseModel):
    answer: RequestText


class RequestSummary(BaseModel):
    """목록 항목 — 비밀글이면 title은 null"""

    id: int
    kind: RequestKind
    title: str | None
    nickname: str
    is_secret: bool
    answered: bool
    created_at: datetime


class RequestPage(BaseModel):
    items: list[RequestSummary]
    page: int
    size: int
    total: int


class RequestDetail(BaseModel):
    """locked=true(비밀글, 비밀번호 확인 전)이면 title·content·answer·answered_at은 null"""

    id: int
    kind: RequestKind
    title: str | None
    content: str | None
    nickname: str
    is_secret: bool
    locked: bool
    answer: str | None
    answered_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminRequestOut(BaseModel):
    id: int
    kind: RequestKind
    title: str
    content: str
    nickname: str
    is_secret: bool
    answer: str | None
    answered_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminRequestPage(BaseModel):
    items: list[AdminRequestOut]
    page: int
    size: int
    total: int
    open_count: int  # 필터와 관계없이 답변하지 않은 요청 수
