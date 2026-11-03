"""category 테이블 (DATA_MODEL v1.0 §4)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import created_at_column, pk_column, updated_at_column

if TYPE_CHECKING:
    from app.models.post import Post


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = pk_column()
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    # 게시글이 있으면 삭제 불가 (ON DELETE RESTRICT, DEC-005) → ORM이 자식을 건드리지 않도록 passive_deletes
    posts: Mapped[list["Post"]] = relationship(back_populates="category", passive_deletes="all")

    __table_args__ = (CheckConstraint("display_order >= 0", name="display_order"),)


# 대소문자 무시 이름 중복 방지 (DATA_MODEL §4.3, §13)
Index("uq_category_name_lower", func.lower(Category.name), unique=True)
