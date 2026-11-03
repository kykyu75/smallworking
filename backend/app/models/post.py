"""post 테이블 (DATA_MODEL v1.0 §5)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column, updated_at_column

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.comment import Comment
    from app.models.post_image import PostImage
    from app.models.post_like import PostLike


class Post(Base):
    __tablename__ = "post"

    id: Mapped[int] = pk_column()
    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("category.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)  # TipTap JSON (DEC-001)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    category: Mapped["Category"] = relationship(back_populates="posts")
    # 자식 삭제는 DB의 ON DELETE CASCADE에 맡긴다 (DEC-005)
    images: Mapped[list["PostImage"]] = relationship(
        back_populates="post", passive_deletes=True, order_by="PostImage.display_order"
    )
    comments: Mapped[list["Comment"]] = relationship(back_populates="post", passive_deletes=True)
    likes: Mapped[list["PostLike"]] = relationship(back_populates="post", passive_deletes=True)

    __table_args__ = (CheckConstraint("like_count >= 0", name="like_count"),)


# 조회 패턴별 인덱스 (DATA_MODEL §13)
Index("ix_post_category_created", Post.category_id, Post.created_at.desc())
Index("ix_post_created", Post.created_at.desc())
Index("ix_post_popular", Post.like_count.desc(), Post.created_at.desc())
