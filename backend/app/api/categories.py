"""카테고리 API (API-001~005).

라우트 선언 순서: 고정 경로(/order)를 변수 경로(/{category_id})보다 먼저 둔다 (API_SPEC §2.4).
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.schemas.category import CategoryInput, CategoryList, CategoryOrderInput, CategoryOut
from app.services import category_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


# API-001 (공개)
@router.get("", response_model=CategoryList)
def list_categories(db: Session = Depends(get_db)) -> CategoryList:
    return CategoryList(items=category_service.list_categories(db))


# API-002 (관리자)
@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_category(body: CategoryInput, db: Session = Depends(get_db)) -> CategoryOut:
    return category_service.create_category(db, body)


# API-005 (관리자) — /{category_id}보다 먼저 선언
@router.put("/order", response_model=CategoryList, dependencies=[Depends(require_admin)])
def reorder_categories(body: CategoryOrderInput, db: Session = Depends(get_db)) -> CategoryList:
    return CategoryList(items=category_service.reorder_categories(db, body.category_ids))


# API-003 (관리자)
@router.put("/{category_id}", response_model=CategoryOut, dependencies=[Depends(require_admin)])
def update_category(category_id: int, body: CategoryInput, db: Session = Depends(get_db)) -> CategoryOut:
    return category_service.update_category(db, category_id, body)


# API-004 (관리자)
@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_category(category_id: int, db: Session = Depends(get_db)) -> Response:
    category_service.delete_category(db, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
