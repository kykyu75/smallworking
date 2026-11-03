"""BlobStorage — 운영용 Vercel Blob 저장소 (DEC-007).

- Vercel Blob Python SDK(`vercel.blob.sync`)를 사용한다.
- 키를 그대로 pathname으로 쓰고(무작위 접미사 없음), 공개 주소는 BLOB_PUBLIC_BASE_URL + "/" + 키.
  BLOB_PUBLIC_BASE_URL은 Vercel Blob store의 공개 주소다 (예: https://<store>.public.blob.vercel-storage.com).
- SDK는 환경변수 BLOB_READ_WRITE_TOKEN으로 인증한다.
"""

from __future__ import annotations

import os
from urllib.parse import quote

from app.storage.base import StorageError

# 브라우저 캐시: 키가 무작위라 같은 주소의 내용이 바뀌지 않으므로 오래 캐시해도 된다 (1년)
CACHE_MAX_AGE = 60 * 60 * 24 * 365


class BlobStorage:
    def __init__(self, token: str, public_base_url: str) -> None:
        if not token:
            raise RuntimeError("STORAGE_BACKEND=blob에는 BLOB_READ_WRITE_TOKEN이 필요합니다.")
        if not public_base_url:
            raise RuntimeError("STORAGE_BACKEND=blob에는 BLOB_PUBLIC_BASE_URL이 필요합니다.")
        os.environ.setdefault("BLOB_READ_WRITE_TOKEN", token)
        self.public_base_url = public_base_url.rstrip("/")

    def save(self, key: str, data: bytes, content_type: str) -> None:
        from vercel.blob import BlobError
        from vercel.blob.sync import put_blob

        try:
            put_blob(
                key,
                data,
                access="public",
                content_type=content_type,
                content_length=len(data),
                add_random_suffix=False,
                allow_overwrite=False,
                cache_control_max_age=CACHE_MAX_AGE,
            )
        except BlobError as exc:
            raise StorageError(str(exc)) from exc

    def delete(self, keys: list[str]) -> None:
        if not keys:
            return
        from vercel.blob import BlobError, BlobNotFoundError
        from vercel.blob.sync import delete_blob

        try:
            delete_blob(list(keys))
        except BlobNotFoundError:
            return
        except BlobError as exc:
            raise StorageError(str(exc)) from exc

    def public_url(self, key: str) -> str:
        return f"{self.public_base_url}/{quote(key)}"
