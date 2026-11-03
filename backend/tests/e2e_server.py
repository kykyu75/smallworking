"""E2E(Playwright)용 Backend 실행기 — 개발 DB·업로드 폴더를 건드리지 않는다 (CLAUDE.md §11).

1. DB 이름만 smallworking_e2e로 바꾼 주소를 쓴다 (계정·비밀번호는 backend/.env의 DATABASE_URL과 같음)
2. 실행할 때마다 E2E DB를 비우고 마이그레이션을 처음부터 적용, E2E 전용 관리자 생성
3. 업로드는 backend/.e2e-uploads (실행할 때마다 비움)
4. 127.0.0.1:8001에서 실행 (개발 서버 8000과 겹치지 않음)

실행: (backend 폴더에서) .venv\\Scripts\\python -m tests.e2e_server   — 보통은 Playwright가 자동으로 실행한다
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

BACKEND_DIR = Path(__file__).resolve().parents[1]
E2E_PORT = 8001
E2E_FRONTEND_ORIGIN = "http://localhost:5174"
E2E_ADMIN_USERNAME = "e2e-admin"
E2E_ADMIN_PASSWORD = "e2e-password-1234"
E2E_UPLOAD_ROOT = BACKEND_DIR / ".e2e-uploads"


def _e2e_database_url() -> str:
    from app.core.config import load_env_file

    load_env_file()
    base = os.environ.get("DATABASE_URL", "")
    if not base:
        raise RuntimeError("backend/.env에 DATABASE_URL이 없습니다.")
    parts = urlsplit(base)
    return urlunsplit(parts._replace(path="/smallworking_e2e"))


def prepare() -> None:
    os.environ.update(
        {
            "DATABASE_URL": _e2e_database_url(),
            "STORAGE_BACKEND": "local",
            "UPLOAD_ROOT": str(E2E_UPLOAD_ROOT),
            "COOKIE_SECURE": "false",
            "ALLOWED_ORIGINS": E2E_FRONTEND_ORIGIN,
            "CRON_SECRET": "e2e-cron-secret",
        }
    )
    shutil.rmtree(E2E_UPLOAD_ROOT, ignore_errors=True)

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

    from app.cli import create_admin
    from app.core.db import get_sessionmaker

    with get_sessionmaker()() as db:
        create_admin(db, E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD)


def main() -> None:
    prepare()
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=E2E_PORT, log_level="warning")


if __name__ == "__main__":
    main()
