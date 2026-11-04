"""database timezone utc

DEC-012: set the database default TimeZone to UTC.
Pooled connections (Neon PgBouncer, transaction mode) do not support session
settings, so the app cannot pass "-c timezone=UTC" there. A database-level
default applies to every new server connection, pooled or direct.
Requires the migrating role to own the database (local: smallworking, Neon: neondb_owner).

Revision ID: 8c1f2d3e4a5b
Revises: 672413b542a9
Create Date: 2026-11-04 15:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "8c1f2d3e4a5b"
down_revision: Union[str, Sequence[str], None] = "672413b542a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC'); END $$;"
    )


def downgrade() -> None:
    op.execute("DO $$ BEGIN EXECUTE format('ALTER DATABASE %I RESET timezone', current_database()); END $$;")
