"""공통 의존성 (CLAUDE.md §7.2)."""

from __future__ import annotations

from datetime import datetime

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.db import get_db
from app.core.errors import AppError
from app.models import AdminUser
from app.services import auth_service

SESSION_COOKIE = "sw_session"


def require_admin(
    sw_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> AdminUser:
    """관리자 API 보호. 유효한 세션이 없으면 401 UNAUTHORIZED (REQ-042, TC-ADM-004)."""
    admin = auth_service.authenticate(db, sw_session, now)
    if admin is None:
        raise AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.")
    return admin


def optional_admin(
    sw_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> AdminUser | None:
    """공개 API에서 운영자 로그인 여부만 확인한다 (비밀글 열람, API-031). 로그인이 아니면 None."""
    return auth_service.authenticate(db, sw_session, now)
