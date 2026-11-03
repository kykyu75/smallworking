"""이미지 API (API-019 업로드, API-020 임시 이미지 삭제)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.clock import get_now
from app.core.db import get_db
from app.core.deps import require_admin
from app.schemas.image import ImageOut
from app.services import image_service
from app.services.image_processing import MAX_UPLOAD_BYTES, too_large
from app.storage import StorageBackend, get_storage

router = APIRouter(prefix="/api/images", tags=["images"], dependencies=[Depends(require_admin)])


# API-019
@router.post("", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    now: datetime = Depends(get_now),
) -> ImageOut:
    # 제한보다 1바이트만 더 읽어서 초과 여부를 판단한다 (큰 파일을 통째로 읽지 않음)
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise too_large()
    image = image_service.upload_image(db, storage, data, file.filename, now)
    return ImageOut.build(image, storage)


# API-020
@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_temp_image(
    image_id: int,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    image_service.delete_temp_image(db, storage, image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
