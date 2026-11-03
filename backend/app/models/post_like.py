"""post_like 테이블 (DATA_MODEL v1.0 §8, DEC-004)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column

if TYPE_CHECKING:
    from app.models.post import Post


class PostLike(Base):
    __tablename__ = "post_like"

    id: Mapped[int] = pk_column()
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("post.id", ondelete="CASCADE"), nullable=False)
    visitor_key: Mapped[str] = mapped_column(String(64), nullable=False)  # 쿠키 sw_visitor UUID
    created_at: Mapped[datetime] = created_at_column()

    post: Mapped["Post"] = relationship(back_populates="likes")

    __table_args__ = (
        # 같은 방문자는 같은 글에 1회만 (중복 방지 + 내 좋아요 확인 인덱스 겸용)
        UniqueConstraint("post_id", "visitor_key", name="uq_post_like_post_visitor"),
    )
