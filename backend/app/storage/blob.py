"""BlobStorage — 운영용 Vercel Blob 저장소 (DEC-007).

- Vercel Blob Python SDK(`vercel.blob.sync`)를 사용한다.
- 키를 그대로 pathname으로 쓰고(무작위 접미사 없음), 공개 주소는 BLOB_PUBLIC_BASE_URL + "/" + 키.
  BLOB_PUBLIC_BASE_URL은 Vercel Blob store의 공개 주소다 (예: https://<store>.public.blob.vercel-storage.com).
  비어 있으면 BLOB_STORE_ID로 만든다 (DEC-012).
- 인증 (SDK가 환경변수로 처리, DEC-012):
  - Vercel에 연결된 store: BLOB_STORE_ID + 요청마다 오는 OIDC 토큰 (x-vercel-oidc-token, main.py가 SDK에 전달)
  - 그 밖(로컬 등): BLOB_READ_WRITE_TOKEN
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import timezone
from urllib.parse import quote

from app.storage.base import StorageError, StoredFile

# 브라우저 캐시: 키가 무작위라 같은 주소의 내용이 바뀌지 않으므로 오래 캐시해도 된다 (1년)
CACHE_MAX_AGE = 60 * 60 * 24 * 365


def public_base_url_from_store_id(store_id: str) -> str:
    """store_AbC123 → https://abc123.public.blob.vercel-storage.com (공개 store 주소 형식)."""
    return f"https://{store_id.strip().removeprefix('store_').lower()}.public.blob.vercel-storage.com"


class BlobStorage:
    def __init__(self, token: str = "", public_base_url: str = "", store_id: str = "") -> None:
        if not token and not store_id:
            raise RuntimeError("STORAGE_BACKEND=blob에는 BLOB_STORE_ID(Vercel 연결) 또는 BLOB_READ_WRITE_TOKEN이 필요합니다.")
        if not public_base_url and store_id:
            public_base_url = public_base_url_from_store_id(store_id)
        if not public_base_url:
            raise RuntimeError("STORAGE_BACKEND=blob에는 BLOB_PUBLIC_BASE_URL(또는 BLOB_STORE_ID)이 필요합니다.")
        if token:
            os.environ.setdefault("BLOB_READ_WRITE_TOKEN", token)
        if store_id:
            os.environ.setdefault("BLOB_STORE_ID", store_id)
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

    def list_files(self, prefix: str) -> Iterator[StoredFile]:
        from vercel.blob import BlobError
        from vercel.blob.sync import query_blobs

        try:
            for blob in query_blobs(prefix=prefix):
                uploaded = blob.uploaded_at
                if uploaded.tzinfo is None:
                    uploaded = uploaded.replace(tzinfo=timezone.utc)
                yield StoredFile(key=blob.pathname, modified_at=uploaded)
        except BlobError as exc:
            raise StorageError(str(exc)) from exc
