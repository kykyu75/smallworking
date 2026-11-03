"""DB 연결과 세션 (TRD §9, DATA_MODEL v1.0 §2)."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

# 제약조건 이름 규칙: DATA_MODEL v1.0 §2.1
NAMING_CONVENTION = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


@lru_cache
def get_engine() -> Engine:
    # 서버리스(Vercel) 환경: 연결을 오래 붙잡지 않도록 pool_pre_ping으로 끊긴 연결을 걸러낸다
    # timezone=UTC: DB 서버 설정(로컬 Windows는 Asia/Seoul, Neon은 UTC)과 관계없이 항상 UTC로 주고받는다
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        connect_args={"options": "-c timezone=UTC"},
    )


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI 의존성: 요청마다 세션 하나."""
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()
