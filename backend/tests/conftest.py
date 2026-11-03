"""테스트 공통 설정 (TEST_CASES v1.0 §17, CLAUDE.md §11).

- 개발 DB가 아니라 TEST_DATABASE_URL의 테스트 전용 DB를 사용한다.
- 테스트마다 트랜잭션을 열고 끝나면 롤백한다 (DEC-008) → 테스트끼리 데이터가 섞이지 않는다.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import load_env_file

# app을 import하기 전에 DB 주소를 테스트 DB로 바꾼다
load_env_file()
_test_url = os.environ.get("TEST_DATABASE_URL")
if not _test_url:
    raise RuntimeError("TEST_DATABASE_URL이 없습니다. backend/.env를 확인하세요.")
os.environ["DATABASE_URL"] = _test_url
os.environ["COOKIE_SECURE"] = "false"
os.environ["CRON_SECRET"] = "test-cron-secret"  # 실제 .env 값 대신 테스트 전용 값
# 이미지는 테스트 전용 임시 폴더에만 저장한다 (개발용 backend/uploads를 건드리지 않음)
import tempfile  # noqa: E402

_TEST_UPLOAD_ROOT = tempfile.mkdtemp(prefix="smallworking-test-uploads-")
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOAD_ROOT"] = _TEST_UPLOAD_ROOT

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.clock import get_now  # noqa: E402
from app.core.config import BACKEND_DIR  # noqa: E402
from app.core.db import get_db, get_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.storage import get_storage  # noqa: E402
from app.storage.local import LocalStorage  # noqa: E402


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


class FakeClock:
    """테스트용 시계. clock.advance(hours=2)처럼 시간을 앞으로 돌린다 (실제로 기다리지 않음)."""

    def __init__(self) -> None:
        self.now = datetime(2026, 11, 3, 9, 0, tzinfo=timezone.utc)

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture(scope="session", autouse=True)
def _remove_test_upload_root() -> Iterator[None]:
    yield
    import shutil

    shutil.rmtree(_TEST_UPLOAD_ROOT, ignore_errors=True)


@pytest.fixture
def storage(tmp_path) -> LocalStorage:
    """테스트마다 새 저장 폴더."""
    return LocalStorage(tmp_path / "uploads")


@pytest.fixture
def app(db_session: Session, clock: FakeClock, storage: LocalStorage):
    application = create_app()
    application.dependency_overrides[get_db] = lambda: db_session
    application.dependency_overrides[get_now] = lambda: clock.now
    application.dependency_overrides[get_storage] = lambda: storage
    return application


# 같은 사이트에서 보낸 요청처럼 Origin을 붙인다 (Origin 검사, API_SPEC §2.3)
SAME_ORIGIN = "http://testserver"


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app, headers={"Origin": SAME_ORIGIN}) as test_client:
        yield test_client


ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "correct-horse-battery"


@pytest.fixture
def admin_user(db_session: Session):
    from app.cli import create_admin
    from app.models import AdminUser

    create_admin(db_session, ADMIN_USERNAME, ADMIN_PASSWORD)
    return db_session.query(AdminUser).filter_by(username=ADMIN_USERNAME).one()


@pytest.fixture
def admin_client(client: TestClient, admin_user) -> TestClient:
    """관리자로 로그인된 클라이언트."""
    response = client.post("/api/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    return client
