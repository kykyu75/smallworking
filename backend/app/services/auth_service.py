"""관리자 인증 규칙 (DEC-003, DATA_MODEL v1.0 §9~§10, API-023~025).

| 규칙 | 값 |
|---|---|
| 로그인 잠금 | 5회 연속 실패 → 10분 |
| 세션 비활동 만료 | 마지막 활동 후 2시간 |
| 세션 최대 수명 | 로그인 후 7일 |
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import hash_token, new_session_token, verify_password
from app.models import AdminSession, AdminUser

MAX_FAILED_LOGINS = 5
LOCK_DURATION = timedelta(minutes=10)
SESSION_IDLE_TIMEOUT = timedelta(hours=2)
SESSION_MAX_AGE = timedelta(days=7)


@dataclass(frozen=True)
class LoginResult:
    admin: AdminUser
    token: str  # 쿠키로만 전달하는 원문 토큰
    expires_at: datetime


def _invalid_credentials() -> AppError:
    # 아이디와 비밀번호 중 어느 쪽이 틀렸는지 알려주지 않는다 (TC-ADM-002)
    return AppError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.")


def _account_locked(locked_until: datetime) -> AppError:
    return AppError(
        423,
        "ACCOUNT_LOCKED",
        "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        {"locked_until": locked_until.isoformat()},
    )


def login(db: Session, username: str, password: str, now: datetime) -> LoginResult:
    admin = db.execute(select(AdminUser).where(AdminUser.username == username)).scalar_one_or_none()
    if admin is None:
        verify_password(None, password)  # 응답 시간 차이로 아이디 존재 여부가 드러나지 않게
        raise _invalid_credentials()

    # 잠금 시간이 지났으면 실패 횟수를 초기화한다 (TC-ADM-013)
    if admin.locked_until is not None and admin.locked_until <= now:
        admin.locked_until = None
        admin.failed_login_count = 0

    if admin.locked_until is not None:
        raise _account_locked(admin.locked_until)

    if not verify_password(admin.password_hash, password):
        admin.failed_login_count += 1
        if admin.failed_login_count >= MAX_FAILED_LOGINS:
            admin.locked_until = now + LOCK_DURATION
        db.commit()
        raise _invalid_credentials()

    admin.failed_login_count = 0
    admin.locked_until = None
    admin.last_login_at = now

    token = new_session_token()
    expires_at = now + SESSION_MAX_AGE
    db.add(
        AdminSession(
            admin_user_id=admin.id,
            token_hash=hash_token(token),
            created_at=now,
            last_active_at=now,
            expires_at=expires_at,
        )
    )
    db.commit()
    return LoginResult(admin=admin, token=token, expires_at=expires_at)


def is_session_valid(session: AdminSession, now: datetime) -> bool:
    return now < session.expires_at and now < session.last_active_at + SESSION_IDLE_TIMEOUT


def authenticate(db: Session, token: str | None, now: datetime) -> AdminUser | None:
    """세션 토큰이 유효하면 관리자를 돌려주고 마지막 활동 시각을 갱신한다. 유효하지 않으면 None."""
    if not token:
        return None
    session = db.execute(
        select(AdminSession).where(AdminSession.token_hash == hash_token(token))
    ).scalar_one_or_none()
    if session is None:
        return None
    if not is_session_valid(session, now):
        db.delete(session)
        db.commit()
        return None
    session.last_active_at = now
    db.commit()
    return session.admin_user


def logout(db: Session, token: str | None) -> None:
    if not token:
        return
    session = db.execute(
        select(AdminSession).where(AdminSession.token_hash == hash_token(token))
    ).scalar_one_or_none()
    if session is not None:
        db.delete(session)
        db.commit()
