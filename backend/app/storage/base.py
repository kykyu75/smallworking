"""StorageBackend 인터페이스."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


class StorageError(Exception):
    """저장소 작업 실패 (네트워크, 권한 등)."""


@dataclass(frozen=True)
class StoredFile:
    key: str
    modified_at: datetime  # UTC


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> None:
        """key 위치에 파일을 저장한다. 같은 key가 있으면 실패해야 한다 (덮어쓰지 않음)."""

    def delete(self, keys: list[str]) -> None:
        """파일을 삭제한다. 이미 없는 파일은 무시한다."""

    def public_url(self, key: str) -> str:
        """브라우저가 이미지를 받을 주소."""

    def list_files(self, prefix: str) -> Iterator[StoredFile]:
        """prefix로 시작하는 저장 파일 목록 (정리 작업용, API-028)."""
