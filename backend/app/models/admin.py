"""admin_user, admin_session 테이블 (DATA_MODEL v1.0 §9, §10, DEC-003)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column, updated_at_column


class AdminUser(Base):
    __tablename__ = "admin_user"

    id: Mapped[int] = pk_column()
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # Argon2
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    sessions: Mapped[list["AdminSession"]] = relationship(back_populates="admin_user", passive_deletes=True)

    __table_args__ = (
        UniqueConstraint("username"),
        CheckConstraint("failed_login_count >= 0", name="failed_count"),
    )


class AdminSession(Base):
    __tablename__ = "admin_session"

    id: Mapped[int] = pk_column()
    admin_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("admin_user.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 (원문 저장 안 함)
    created_at: Mapped[datetime] = created_at_column()
    last_active_at: Mapped[datetime] = created_at_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    admin_user: Mapped[AdminUser] = relationship(back_populates="sessions")

    __table_args__ = (
        UniqueConstraint("token_hash"),
        Index("ix_admin_session_expires", "expires_at"),
    )
