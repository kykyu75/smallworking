"""visitor_request 테이블 — 요청 게시판 (DATA_MODEL v1.0 §10-1, DEC-011)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import created_at_column, pk_column, updated_at_column

REQUEST_KINDS = ("material", "diy", "etc")


class VisitorRequest(Base):
    __tablename__ = "visitor_request"

    id: Mapped[int] = pk_column()
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)
    nickname: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # Argon2
    is_secret: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # 운영자 답변. 있으면 "답변 완료" (상태는 따로 저장하지 않는다)
    answer: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 비밀번호 5회 실패 → 10분 잠금 (열람·수정·삭제 공통)
    failed_password_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    __table_args__ = (
        CheckConstraint("kind IN ('material', 'diy', 'etc')", name="kind"),
        CheckConstraint("(answer IS NULL) = (answered_at IS NULL)", name="answer"),
        CheckConstraint("failed_password_count >= 0", name="failed_count"),
    )


# 목록 최신순 (API-029, API-035)
Index("ix_visitor_request_created", VisitorRequest.created_at.desc())
