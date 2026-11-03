"""comment 테이블 — 댓글과 답글 (DATA_MODEL v1.0 §7, DEC-005)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column, updated_at_column

if TYPE_CHECKING:
    from app.models.post import Post


class Comment(Base):
    __tablename__ = "comment"

    id: Mapped[int] = pk_column()
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("post.id", ondelete="CASCADE"), nullable=False)
    # NULL = 일반 댓글, 값 = 답글 (깊이 1단계 제한은 애플리케이션에서 검증)
    parent_comment_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("comment.id", ondelete="CASCADE"), nullable=True
    )
    # soft delete 시에만 NULL (ck_comment_alive_fields)
    nickname: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    post: Mapped["Post"] = relationship(back_populates="comments")
    parent: Mapped["Comment | None"] = relationship(back_populates="replies", remote_side="Comment.id")
    replies: Mapped[list["Comment"]] = relationship(
        back_populates="parent", passive_deletes=True, order_by="Comment.created_at"
    )

    __table_args__ = (
        CheckConstraint("parent_comment_id IS NULL OR parent_comment_id <> id", name="not_self_parent"),
        CheckConstraint(
            "is_deleted = true OR "
            "(nickname IS NOT NULL AND password_hash IS NOT NULL AND content IS NOT NULL)",
            name="alive_fields",
        ),
        CheckConstraint(
            "(is_deleted = false AND deleted_at IS NULL) OR (is_deleted = true AND deleted_at IS NOT NULL)",
            name="deleted_at",
        ),
        Index("ix_comment_post_created", "post_id", "created_at"),
        Index("ix_comment_parent", "parent_comment_id"),
    )


# 관리자 댓글 목록 최신순 (API-026)
Index("ix_comment_created", Comment.created_at.desc())
