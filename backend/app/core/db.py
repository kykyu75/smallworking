"""DB 연결과 세션 (TRD §9, DATA_MODEL v1.0 §2)."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine, make_url
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


def is_pooled_url(url: str) -> bool:
    """Neon 연결 풀러(PgBouncer, 트랜잭션 모드) 주소인가 — 호스트 이름에 `-pooler`가 들어 있다."""
    host = make_url(url).host or ""
    return "-pooler" in host


def engine_options(url: str) -> dict:
    # 서버리스(Vercel) 환경: 연결을 오래 붙잡지 않도록 pool_pre_ping으로 끊긴 연결을 걸러낸다
    options: dict = {"pool_pre_ping": True}
    if is_pooled_url(url):
        # 풀러는 세션 설정(SET, 시작 옵션)을 지원하지 않는다. Neon 서버 기본 시간대가 UTC다 (DEC-012)
        options["pool_size"] = 2
        options["max_overflow"] = 3
    else:
        # timezone=UTC: DB 서버 설정(로컬 Windows는 Asia/Seoul)과 관계없이 항상 UTC로 주고받는다
        options["connect_args"] = {"options": "-c timezone=UTC"}
    return options


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    return create_engine(url, **engine_options(url))


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
