"""이미지 업로드·임시 이미지 삭제 (API-019, API-020, DATA_MODEL v1.0 §6)."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import PostImage
from app.services.image_processing import process_image
from app.storage import StorageBackend, StorageError

logger = logging.getLogger("smallworking")

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def clean_original_name(filename: str | None) -> str | None:
    """원래 파일 이름은 표시·참고용으로만 저장한다. 경로 부분은 버린다 (TC-IMG-023)."""
    if not filename:
        return None
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    name = _CONTROL_CHARS.sub("", name).strip()
    return name[:255] or None


def upload_image(
    db: Session, storage: StorageBackend, data: bytes, filename: str | None, now: datetime
) -> PostImage:
    processed = process_image(data)

    # 서버가 만든 무작위 이름만 경로에 쓴다. 원래 파일 이름은 경로에 사용하지 않는다.
    stem = uuid.uuid4().hex
    folder = f"images/{now:%Y}/{now:%m}"
    key = f"{folder}/{stem}.{processed.ext}"
    thumb_key = f"{folder}/{stem}_thumb.{processed.ext}"

    saved: list[str] = []
    try:
        storage.save(key, processed.data, processed.mime_type)
        saved.append(key)
        storage.save(thumb_key, processed.thumbnail, processed.mime_type)
        saved.append(thumb_key)

        image = PostImage(
            post_id=None,  # 임시 이미지: 게시글을 저장할 때 연결된다 (DEC-002)
            file_name=f"{stem}.{processed.ext}",
            file_path=key,
            thumbnail_path=thumb_key,
            original_name=clean_original_name(filename),
            mime_type=processed.mime_type,
            file_size=len(processed.data),
            width=processed.width,
            height=processed.height,
            display_order=None,
            created_at=now,
        )
        db.add(image)
        db.commit()
        return image
    except StorageError as exc:
        _cleanup(storage, saved)
        logger.exception("이미지 저장 실패")
        raise AppError(500, "INTERNAL_ERROR", "이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc
    except Exception:
        db.rollback()
        _cleanup(storage, saved)
        raise


def _cleanup(storage: StorageBackend, keys: list[str]) -> None:
    if not keys:
        return
    try:
        storage.delete(keys)
    except StorageError:
        logger.exception("업로드 실패 후 파일 정리 실패: %s (정리 작업이 처리)", keys)


def delete_temp_image(db: Session, storage: StorageBackend, image_id: int) -> None:
    image = db.get(PostImage, image_id)
    if image is None:
        raise AppError(404, "IMAGE_NOT_FOUND", "이미지를 찾을 수 없습니다.")
    if image.post_id is not None:
        # 글에 쓰인 이미지는 본문에서 빼고 저장하면 서버가 지운다 (API-009)
        raise AppError(409, "IMAGE_IN_USE", "게시글에 사용 중인 이미지입니다.")
    keys = [image.file_path, image.thumbnail_path]
    db.delete(image)
    db.commit()
    # 파일 삭제는 DB 커밋 후 (DEC-005)
    _cleanup(storage, keys)
