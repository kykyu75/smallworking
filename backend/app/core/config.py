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


def env_file_path() -> Path:
    """읽을 설정 파일. SW_ENV_FILE이 있으면 그 파일**만** 읽는다 (DEC-012).

    운영 DB에 마이그레이션·관리자 생성을 할 때 `SW_ENV_FILE=.env.neon`처럼 지정한다.
    이때 개발용 backend/.env는 읽지 않으므로, 빠진 값이 개발 값으로 채워지는 사고를 막는다.
    """
    custom = os.environ.get("SW_ENV_FILE", "").strip()
    if not custom:
        return ENV_FILE
    path = Path(custom)
    return path if path.is_absolute() else BACKEND_DIR / path


def load_env_file(path: Path | None = None) -> None:
    """KEY=VALUE 형식의 .env 파일을 읽어 os.environ에 없는 값만 설정한다."""
    path = path or env_file_path()
    if os.environ.get("SW_ENV_FILE") and not path.is_file():
        raise RuntimeError(f"SW_ENV_FILE로 지정한 파일이 없습니다: {path}")
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


def normalize_database_url(url: str) -> str:
    """Neon·Vercel이 주는 `postgres://` / `postgresql://` 주소를 psycopg(v3) 드라이버 주소로 바꾼다 (DEC-012)."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


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
    blob_store_id: str
    blob_public_base_url: str
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
            database_url=normalize_database_url(database_url),
            storage_backend=os.environ.get("STORAGE_BACKEND", "local"),
            upload_root=upload_root,
            blob_read_write_token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""),
            blob_store_id=os.environ.get("BLOB_STORE_ID", "").strip(),  # Vercel이 store 연결 시 자동 추가 (DEC-012)
            blob_public_base_url=os.environ.get("BLOB_PUBLIC_BASE_URL", "").rstrip("/"),
            allowed_origins=_list(os.environ.get("ALLOWED_ORIGINS")),
            cron_secret=os.environ.get("CRON_SECRET", ""),
            cookie_secure=_bool(os.environ.get("COOKIE_SECURE"), default=True),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
