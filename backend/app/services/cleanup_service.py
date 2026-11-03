"""정리 작업 (API-028, DATA_MODEL v1.0 §15, DEC-002, DEC-007).

| 작업 | 대상 |
|---|---|
| 임시 이미지 | post_id IS NULL이고 생성 후 24시간 지난 post_image → DB + 파일 삭제 |
| 고아 파일 | 저장소에 있지만 post_image에 없는 파일 (생성 후 24시간 지난 것만) |
| 만료 세션 | admin_session 중 유효하지 않은 세션 (7일 경과 또는 2시간 비활동) |

- 같은 날 여러 번 실행돼도 문제없다 (멱등).
- Vercel 함수 실행 시간 제한을 넘지 않도록 한 번에 처리하는 개수를 제한하고, 남은 것은 다음 실행에서 처리한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, or_, select, union_all
from sqlalchemy.orm import Session

from app.models import AdminSession, PostImage
from app.services.auth_service import SESSION_IDLE_TIMEOUT
from app.storage import StorageBackend, StorageError

logger = logging.getLogger("smallworking")

TEMP_IMAGE_TTL = timedelta(hours=24)
ORPHAN_FILE_TTL = timedelta(hours=24)
MAX_PER_RUN = 500
IMAGE_PREFIX = "images/"


@dataclass(frozen=True)
class CleanupResult:
    deleted_temp_images: int
    deleted_orphan_files: int
    deleted_sessions: int


def cleanup_temp_images(db: Session, storage: StorageBackend, now: datetime, limit: int = MAX_PER_RUN) -> int:
    images = db.execute(
        select(PostImage)
        .where(PostImage.post_id.is_(None), PostImage.created_at < now - TEMP_IMAGE_TTL)
        .order_by(PostImage.created_at)
        .limit(limit)
    ).scalars().all()
    if not images:
        return 0
    keys = [k for image in images for k in (image.file_path, image.thumbnail_path)]
    for image in images:
        db.delete(image)
    db.commit()
    try:
        storage.delete(keys)  # 파일 삭제는 DB 커밋 후 (DEC-005). 실패해도 다음 고아 파일 정리가 지운다
    except StorageError:
        logger.exception("임시 이미지 파일 삭제 실패 (다음 실행에서 고아 파일로 정리)")
    return len(images)


def cleanup_orphan_files(db: Session, storage: StorageBackend, now: datetime, limit: int = MAX_PER_RUN) -> int:
    known = set(
        db.execute(union_all(select(PostImage.file_path), select(PostImage.thumbnail_path))).scalars()
    )
    cutoff = now - ORPHAN_FILE_TTL
    orphans: list[str] = []
    for stored in storage.list_files(IMAGE_PREFIX):
        # 업로드 중(파일은 저장됐지만 DB 커밋 전)인 파일을 지우지 않도록 24시간 지난 것만
        if stored.key not in known and stored.modified_at < cutoff:
            orphans.append(stored.key)
            if len(orphans) >= limit:
                break
    if orphans:
        storage.delete(orphans)
    return len(orphans)


def cleanup_sessions(db: Session, now: datetime) -> int:
    result = db.execute(
        delete(AdminSession).where(
            or_(AdminSession.expires_at <= now, AdminSession.last_active_at <= now - SESSION_IDLE_TIMEOUT)
        )
    )
    db.commit()
    return result.rowcount or 0


def run_cleanup(db: Session, storage: StorageBackend, now: datetime) -> CleanupResult:
    temp = cleanup_temp_images(db, storage, now)
    try:
        orphans = cleanup_orphan_files(db, storage, now)
    except StorageError:
        logger.exception("고아 파일 정리 실패 (다음 실행에서 다시 시도)")
        orphans = 0
    sessions = cleanup_sessions(db, now)
    result = CleanupResult(deleted_temp_images=temp, deleted_orphan_files=orphans, deleted_sessions=sessions)
    logger.info("cleanup: %s", result)
    return result
