"""관리자 인증 API (API-023 login, API-024 logout, API-025 me)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import SESSION_COOKIE, require_admin
from app.models import AdminUser
from app.schemas.admin import AdminMe, LoginRequest
from app.services import auth_service

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=int(auth_service.SESSION_MAX_AGE.total_seconds()),
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE, path="/", httponly=True, secure=get_settings().cookie_secure, samesite="lax"
    )


@router.post("/login", response_model=AdminMe)
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> AdminMe:
    result = auth_service.login(db, body.username, body.password, now)
    _set_session_cookie(response, result.token)
    return AdminMe(username=result.admin.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    _: AdminUser = Depends(require_admin),
    sw_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.logout(db, sw_session)
    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_session_cookie(response)
    return response


@router.get("/me", response_model=AdminMe)
def me(admin: AdminUser = Depends(require_admin)) -> AdminMe:
    return AdminMe(username=admin.username)
