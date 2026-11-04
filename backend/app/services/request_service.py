"""요청 게시판 규칙 (API-029~038, DEC-011, DATA_MODEL v1.0 §10-1, REQ-045~049).

| 규칙 | 값 |
|---|---|
| 상태 | answer 있음 → 답변 완료, 없음 → 접수 (저장하지 않음) |
| 비밀번호 잠금 | 같은 글에 5회 연속 실패 → 10분 (열람·수정·삭제 공통) |
| 수정 | 답변이 있으면 409 REQUEST_ANSWERED (삭제는 가능) |
| 비밀글 | 목록에서 제목 숨김, 상세는 비밀번호 확인 또는 운영자만 |
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.models import VisitorRequest
from app.schemas.visitor_request import (
    AdminRequestOut,
    AdminRequestPage,
    RequestCreate,
    RequestDetail,
    RequestPage,
    RequestSummary,
    RequestUpdate,
)

MAX_FAILED_PASSWORDS = 5
LOCK_DURATION = timedelta(minutes=10)

StatusFilter = Literal["open", "answered"]


def _not_found() -> AppError:
    return AppError(404, "REQUEST_NOT_FOUND", "요청 글을 찾을 수 없습니다.")


def _get(db: Session, request_id: int) -> VisitorRequest:
    item = db.get(VisitorRequest, request_id)
    if item is None:
        raise _not_found()
    return item


def _detail(item: VisitorRequest, unlocked: bool) -> RequestDetail:
    locked = item.is_secret and not unlocked
    return RequestDetail(
        id=item.id,
        kind=item.kind,  # type: ignore[arg-type]
        title=None if locked else item.title,
        content=None if locked else item.content,
        nickname=item.nickname,
        is_secret=item.is_secret,
        locked=locked,
        answer=None if locked else item.answer,
        answered_at=None if locked else item.answered_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _check_password(db: Session, item: VisitorRequest, password: str, now: datetime) -> None:
    """비밀번호 확인 + 5회 실패 잠금 (REQ-047). 실패하면 횟수를 커밋하고 예외를 던진다."""
    if item.locked_until is not None and item.locked_until <= now:
        item.locked_until = None
        item.failed_password_count = 0
    if item.locked_until is not None:
        raise AppError(
            423,
            "REQUEST_LOCKED",
            "비밀번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.",
            {"locked_until": item.locked_until.isoformat()},
        )
    if not verify_password(item.password_hash, password):
        item.failed_password_count += 1
        if item.failed_password_count >= MAX_FAILED_PASSWORDS:
            item.locked_until = now + LOCK_DURATION
        db.commit()
        raise AppError(403, "INVALID_PASSWORD", "비밀번호가 일치하지 않습니다.")
    item.failed_password_count = 0
    item.locked_until = None


# ---------------------------------------------------------------- 공개 (API-029~034)


def list_requests(db: Session, page: int, size: int) -> RequestPage:
    rows = db.execute(
        select(VisitorRequest)
        .order_by(VisitorRequest.created_at.desc(), VisitorRequest.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).scalars().all()
    total = db.execute(select(func.count(VisitorRequest.id))).scalar_one()
    items = [
        RequestSummary(
            id=r.id,
            kind=r.kind,  # type: ignore[arg-type]
            title=None if r.is_secret else r.title,
            nickname=r.nickname,
            is_secret=r.is_secret,
            answered=r.answer is not None,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return RequestPage(items=items, page=page, size=size, total=total)


def create_request(db: Session, data: RequestCreate, now: datetime) -> RequestDetail:
    item = VisitorRequest(
        kind=data.kind,
        title=data.title,
        content=data.content,
        nickname=data.nickname,
        password_hash=hash_password(data.password),  # 원문은 저장하지 않는다 (REQ-043)
        is_secret=data.is_secret,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.commit()
    return _detail(item, unlocked=True)  # 작성자에게는 바로 보여준다


def get_request(db: Session, request_id: int, is_admin: bool) -> RequestDetail:
    return _detail(_get(db, request_id), unlocked=is_admin)


def open_request(db: Session, request_id: int, password: str, now: datetime) -> RequestDetail:
    item = _get(db, request_id)
    _check_password(db, item, password, now)
    db.commit()
    return _detail(item, unlocked=True)


def update_request(db: Session, request_id: int, data: RequestUpdate, now: datetime) -> RequestDetail:
    item = _get(db, request_id)
    _check_password(db, item, data.password, now)
    if item.answer is not None:
        db.commit()  # 비밀번호 성공으로 초기화된 실패 횟수는 저장
        raise AppError(409, "REQUEST_ANSWERED", "답변이 달린 요청은 수정할 수 없습니다.")
    item.kind = data.kind
    item.title = data.title
    item.content = data.content
    item.is_secret = data.is_secret
    item.updated_at = now
    db.commit()
    return _detail(item, unlocked=True)


def delete_request(db: Session, request_id: int, password: str, now: datetime) -> None:
    item = _get(db, request_id)
    _check_password(db, item, password, now)
    db.delete(item)
    db.commit()


# ---------------------------------------------------------------- 관리자 (API-035~038)


def _keep_updated_at(item: VisitorRequest) -> None:
    """답변 저장·삭제는 작성자 수정 시각(updated_at)을 바꾸지 않는다.
    값을 그대로 다시 쓰도록 표시해 onupdate(now())가 끼어들지 않게 한다."""
    flag_modified(item, "updated_at")


def admin_list(db: Session, status: StatusFilter | None, page: int, size: int) -> AdminRequestPage:
    condition = []
    if status == "open":
        condition.append(VisitorRequest.answer.is_(None))
    elif status == "answered":
        condition.append(VisitorRequest.answer.is_not(None))
    rows = db.execute(
        select(VisitorRequest)
        .where(*condition)
        .order_by(VisitorRequest.created_at.desc(), VisitorRequest.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).scalars().all()
    total = db.execute(select(func.count(VisitorRequest.id)).where(*condition)).scalar_one()
    open_count = db.execute(
        select(func.count(VisitorRequest.id)).where(VisitorRequest.answer.is_(None))
    ).scalar_one()
    items = [
        AdminRequestOut(
            id=r.id,
            kind=r.kind,  # type: ignore[arg-type]
            title=r.title,
            content=r.content,
            nickname=r.nickname,
            is_secret=r.is_secret,
            answer=r.answer,
            answered_at=r.answered_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
    return AdminRequestPage(items=items, page=page, size=size, total=total, open_count=open_count)


def save_answer(db: Session, request_id: int, answer: str, now: datetime) -> RequestDetail:
    item = _get(db, request_id)
    item.answer = answer
    item.answered_at = now
    _keep_updated_at(item)
    db.commit()
    return _detail(item, unlocked=True)


def delete_answer(db: Session, request_id: int) -> RequestDetail:
    item = _get(db, request_id)
    item.answer = None
    item.answered_at = None
    _keep_updated_at(item)
    db.commit()
    return _detail(item, unlocked=True)


def admin_delete(db: Session, request_id: int) -> None:
    db.delete(_get(db, request_id))
    db.commit()
