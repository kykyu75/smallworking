"""테스트 공통 설정 (TEST_CASES v1.0 §17, CLAUDE.md §11).

- 개발 DB가 아니라 TEST_DATABASE_URL의 테스트 전용 DB를 사용한다.
- 테스트마다 트랜잭션을 열고 끝나면 롤백한다 (DEC-008) → 테스트끼리 데이터가 섞이지 않는다.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

from app.core.config import load_env_file

# app을 import하기 전에 DB 주소를 테스트 DB로 바꾼다
load_env_file()
_test_url = os.environ.get("TEST_DATABASE_URL")
if not _test_url:
    raise RuntimeError("TEST_DATABASE_URL이 없습니다. backend/.env를 확인하세요.")
os.environ["DATABASE_URL"] = _test_url
os.environ["COOKIE_SECURE"] = "false"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import BACKEND_DIR  # noqa: E402
from app.core.db import get_db, get_engine  # noqa: E402
from app.main import create_app  # noqa: E402


def alembic_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


@pytest.fixture(scope="session", autouse=True)
def migrated_test_database() -> Iterator[None]:
    """테스트 실행마다 테스트 DB를 비우고 마이그레이션을 처음부터 적용한다."""
    cfg = alembic_config()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture
def db_session() -> Iterator[Session]:
    connection = get_engine().connect()
    transaction = connection.begin()
    # 서비스 코드가 commit()을 호출해도 SAVEPOINT까지만 반영되고, 테스트 끝에 전부 롤백된다
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def app(db_session: Session):
    application = create_app()
    application.dependency_overrides[get_db] = lambda: db_session
    return application


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
