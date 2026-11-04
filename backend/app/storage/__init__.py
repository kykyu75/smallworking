"""이미지 저장소 (DEC-007).

모든 파일 저장·삭제·주소 생성은 StorageBackend를 통해서만 한다 (CLAUDE.md §7.2).
- 개발: LocalStorage (UPLOAD_ROOT 폴더, /uploads/<키>로 제공)
- 운영: BlobStorage (Vercel Blob public store)
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.storage.base import StorageBackend, StorageError
from app.storage.blob import BlobStorage
from app.storage.local import LocalStorage

__all__ = ["BlobStorage", "LocalStorage", "StorageBackend", "StorageError", "get_storage"]


@lru_cache
def _build_storage() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalStorage(settings.upload_root)
    if settings.storage_backend == "blob":
        return BlobStorage(
            token=settings.blob_read_write_token,
            public_base_url=settings.blob_public_base_url,
            store_id=settings.blob_store_id,
        )
    raise RuntimeError(f"알 수 없는 STORAGE_BACKEND 값입니다: {settings.storage_backend!r} (local 또는 blob)")


def get_storage() -> StorageBackend:
    """FastAPI 의존성. 테스트에서는 dependency_overrides로 바꿔 끼운다."""
    return _build_storage()
