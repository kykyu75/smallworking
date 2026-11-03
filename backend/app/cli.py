"""관리 명령 (DEC-007: Vercel에는 서버 시작 시점이 없으므로 초기 작업은 명령으로 실행).

사용법 (backend 폴더에서):
    .venv\\Scripts\\python -m app.cli create-admin
    .venv\\Scripts\\python -m app.cli cleanup      # 정리 작업 (운영은 Vercel Cron → API-028)

운영(Neon)에 실행할 때는 DATABASE_URL을 운영 주소로 지정한 뒤 실행한다.
"""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import load_env_file
from app.core.db import get_sessionmaker
from app.core.security import hash_password
from app.models import AdminUser


def create_admin(db: Session, username: str, password: str) -> bool:
    """관리자가 한 명도 없을 때만 생성한다. 생성했으면 True, 이미 있으면 False (TC-ADM-019)."""
    existing = db.execute(select(func.count()).select_from(AdminUser)).scalar_one()
    if existing:
        return False
    db.add(AdminUser(username=username, password_hash=hash_password(password)))
    db.commit()
    return True


def _cmd_create_admin() -> int:
    load_env_file()
    username = os.environ.get("ADMIN_USERNAME", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not username or not password:
        print("ADMIN_USERNAME, ADMIN_PASSWORD 환경변수를 설정한 뒤 다시 실행하세요.", file=sys.stderr)
        return 2
    if len(username) > 50:
        print("ADMIN_USERNAME은 50자 이하여야 합니다.", file=sys.stderr)
        return 2
    if len(password) < 12:
        print("경고: 관리자 비밀번호는 12자 이상을 권장합니다.", file=sys.stderr)

    with get_sessionmaker()() as db:
        created = create_admin(db, username, password)
    print(f"관리자 '{username}'을(를) 만들었습니다." if created else "관리자가 이미 있어 아무것도 바꾸지 않았습니다.")
    return 0


def _cmd_cleanup() -> int:
    from app.core.clock import utc_now
    from app.services.cleanup_service import run_cleanup
    from app.storage import get_storage

    load_env_file()
    with get_sessionmaker()() as db:
        result = run_cleanup(db, get_storage(), utc_now())
    print(
        f"임시 이미지 {result.deleted_temp_images}개, 고아 파일 {result.deleted_orphan_files}개, "
        f"만료 세션 {result.deleted_sessions}개를 정리했습니다."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="SmallWorking 관리 명령")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("create-admin", help="환경변수 ADMIN_USERNAME/ADMIN_PASSWORD로 최초 관리자 생성")
    sub.add_parser("cleanup", help="24시간 지난 임시 이미지·고아 파일·만료 세션 정리")
    args = parser.parse_args(argv)

    if args.command == "create-admin":
        return _cmd_create_admin()
    if args.command == "cleanup":
        return _cmd_cleanup()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
