"""Alembic 마이그레이션 환경 (DATA_MODEL v1.0 → Alembic → PostgreSQL).

- DB 주소: 환경변수 DATABASE_URL (로컬은 backend/.env, 운영은 배포 전에 Neon 주소로 실행)
- 대상 메타데이터: app.core.db.Base (모델은 app.models에서 import되어 등록된다)
"""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from app.core.config import get_settings
from app.core.db import Base
import app.models  # noqa: F401  모델 등록 (autogenerate 대상)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    return get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_database_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
