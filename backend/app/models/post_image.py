"""post_image 테이블 (DATA_MODEL v1.0 §6, DEC-002, DEC-007)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column

if TYPE_CHECKING:
    from app.models.post import Post

ALLOWED_IMAGE_MIME_TYPES = ("image/jpeg", "image/png", "image/webp", "image/gif")


class PostImage(Base):
    __tablename__ = "post_image"

    id: Mapped[int] = pk_column()
    # NULL = 아직 글에 연결되지 않은 임시 이미지
    post_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("post.id", ondelete="CASCADE"), nullable=True
    )
    file_name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(300), nullable=False)  # 저장소 키
    thumbnail_path: Mapped[str] = mapped_column(String(300), nullable=False)  # 썸네일 저장소 키
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    display_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = created_at_column()

    post: Mapped["Post | None"] = relationship(back_populates="images")

    __table_args__ = (
        CheckConstraint(
            "mime_type IN ('image/jpeg','image/png','image/webp','image/gif')", name="mime_type"
        ),
        CheckConstraint("file_size > 0", name="file_size"),
        CheckConstraint("post_id IS NULL OR display_order IS NOT NULL", name="order"),
        Index("ix_post_image_post_order", "post_id", "display_order"),
        Index("ix_post_image_orphan", "created_at", postgresql_where=text("post_id IS NULL")),
    )
