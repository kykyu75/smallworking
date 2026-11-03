"""모델 공통 컬럼 (DATA_MODEL v1.0 §2)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, func
from sqlalchemy.orm import Mapped, mapped_column


def pk_column() -> Mapped[int]:
    # BIGINT IDENTITY (자동 증가)
    return mapped_column(BigInteger, Identity(), primary_key=True)


def created_at_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def updated_at_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
