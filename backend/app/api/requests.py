"""요청 게시판 API (API-029~034) + 관리자 요청 API (API-035~038), DEC-011."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.db import get_db
from app.core.deps import optional_admin, require_admin
from app.models import AdminUser
from app.schemas.visitor_request import (
    AdminRequestPage,
    AnswerInput,
    RequestCreate,
    RequestDetail,
    RequestPage,
    RequestPassword,
    RequestUpdate,
)
from app.services import request_service
from app.services.request_service import StatusFilter

router = APIRouter(tags=["requests"])


# API-029 (공개)
@router.get("/api/requests", response_model=RequestPage)
def list_requests(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
) -> RequestPage:
    return request_service.list_requests(db, page, size)


# API-030 (공개)
@router.post("/api/requests", response_model=RequestDetail, status_code=status.HTTP_201_CREATED)
def create_request(body: RequestCreate, db: Session = Depends(get_db), now: datetime = Depends(get_now)) -> RequestDetail:
    return request_service.create_request(db, body, now)


# API-031 (공개, 운영자는 비밀글도 전체)
@router.get("/api/requests/{request_id}", response_model=RequestDetail)
def get_request(
    request_id: int, db: Session = Depends(get_db), admin: AdminUser | None = Depends(optional_admin)
) -> RequestDetail:
    return request_service.get_request(db, request_id, is_admin=admin is not None)


# API-032 (비밀번호)
@router.post("/api/requests/{request_id}/open", response_model=RequestDetail)
def open_request(
    request_id: int, body: RequestPassword, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> RequestDetail:
    return request_service.open_request(db, request_id, body.password, now)


# API-033 (비밀번호)
@router.put("/api/requests/{request_id}", response_model=RequestDetail)
def update_request(
    request_id: int, body: RequestUpdate, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> RequestDetail:
    return request_service.update_request(db, request_id, body, now)


# API-034 (비밀번호) — DELETE 본문은 버려질 수 있어 POST .../delete (API-017과 같은 이유)
@router.post("/api/requests/{request_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_request(
    request_id: int, body: RequestPassword, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> Response:
    request_service.delete_request(db, request_id, body.password, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# API-035 (관리자)
@router.get("/api/admin/requests", response_model=AdminRequestPage, dependencies=[Depends(require_admin)])
def admin_list_requests(
    status_filter: StatusFilter | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> AdminRequestPage:
    return request_service.admin_list(db, status_filter, page, size)


# API-036 (관리자)
@router.put("/api/admin/requests/{request_id}/answer", response_model=RequestDetail, dependencies=[Depends(require_admin)])
def save_answer(
    request_id: int, body: AnswerInput, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> RequestDetail:
    return request_service.save_answer(db, request_id, body.answer, now)


# API-037 (관리자)
@router.delete(
    "/api/admin/requests/{request_id}/answer", response_model=RequestDetail, dependencies=[Depends(require_admin)]
)
def delete_answer(request_id: int, db: Session = Depends(get_db)) -> RequestDetail:
    return request_service.delete_answer(db, request_id)


# API-038 (관리자)
@router.delete(
    "/api/admin/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)]
)
def admin_delete_request(request_id: int, db: Session = Depends(get_db)) -> Response:
    request_service.admin_delete(db, request_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
