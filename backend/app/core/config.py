"""환경변수 설정 (TRD v1.1 §17, CLAUDE.md §10).

- 운영(Vercel): 프로젝트 설정의 환경변수를 그대로 사용한다.
- 로컬: backend/.env 파일이 있으면 읽어서, 아직 설정되지 않은 변수만 채운다.
  (별도 라이브러리 없이 KEY=VALUE 형식만 지원 — DEC-008)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


def load_env_file(path: Path = ENV_FILE) -> None:
    """KEY=VALUE 형식의 .env 파일을 읽어 os.environ에 없는 값만 설정한다."""
    if not path.is_file():
        return
    # utf-8-sig: Windows PowerShell이 만든 BOM이 있어도 읽을 수 있게 한다
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _list(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(item.strip() for item in value.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    database_url: str
    storage_backend: str
    upload_root: Path
    blob_read_write_token: str
    allowed_origins: tuple[str, ...]
    cron_secret: str
    cookie_secure: bool

    @classmethod
    def from_env(cls) -> "Settings":
        load_env_file()
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            raise RuntimeError("DATABASE_URL 환경변수가 설정되지 않았습니다. backend/.env.example을 참고하세요.")

        upload_root = Path(os.environ.get("UPLOAD_ROOT", "./uploads"))
        if not upload_root.is_absolute():
            upload_root = BACKEND_DIR / upload_root

        return cls(
            database_url=database_url,
            storage_backend=os.environ.get("STORAGE_BACKEND", "local"),
            upload_root=upload_root,
            blob_read_write_token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""),
            allowed_origins=_list(os.environ.get("ALLOWED_ORIGINS")),
            cron_secret=os.environ.get("CRON_SECRET", ""),
            cookie_secure=_bool(os.environ.get("COOKIE_SECURE"), default=True),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
