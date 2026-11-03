"""홈 화면 데이터 (API-021): 카테고리별 최신 3개, 전체 최신 5개, 인기 5개를 한 번에."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.post import HomeData
from app.services import home_service
from app.storage import StorageBackend, get_storage

router = APIRouter(tags=["home"])


@router.get("/api/home", response_model=HomeData)
def home(db: Session = Depends(get_db), storage: StorageBackend = Depends(get_storage)) -> HomeData:
    return home_service.home(db, storage)
