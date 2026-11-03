"""정리 작업 API (API-028, DEC-007).

Vercel Cron Jobs가 하루 1회 호출한다. 요청 헤더 Authorization: Bearer <CRON_SECRET>
CRON_SECRET이 비어 있으면 항상 거부한다 (설정 실수로 누구나 실행하는 일을 막는다).
"""

from __future__ import annotations

import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.services import cleanup_service
from app.storage import StorageBackend, get_storage

router = APIRouter(tags=["cron"])


class CleanupOut(BaseModel):
    deleted_temp_images: int
    deleted_orphan_files: int
    deleted_sessions: int


def require_cron_secret(authorization: str | None = Header(default=None)) -> None:
    expected = get_settings().cron_secret
    given = authorization.removeprefix("Bearer ").strip() if authorization and authorization.startswith("Bearer ") else ""
    # 비교 시간이 값에 따라 달라지지 않게 compare_digest 사용
    if not expected or not given or not secrets.compare_digest(given.encode(), expected.encode()):
        raise AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.")


@router.get("/api/cron/cleanup", response_model=CleanupOut, dependencies=[Depends(require_cron_secret)])
def cleanup(
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    now: datetime = Depends(get_now),
) -> CleanupOut:
    result = cleanup_service.run_cleanup(db, storage, now)
    return CleanupOut(
        deleted_temp_images=result.deleted_temp_images,
        deleted_orphan_files=result.deleted_orphan_files,
        deleted_sessions=result.deleted_sessions,
    )
