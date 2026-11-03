"""LocalStorage — 개발·테스트용 로컬 폴더 저장소 (DEC-007)."""

from __future__ import annotations

from pathlib import Path

from app.storage.base import StorageError

PUBLIC_PREFIX = "/uploads"


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        # 키가 저장 폴더 밖을 가리키지 못하게 한다 (TC-IMG-023, TC-SEC-008)
        if not path.is_relative_to(self.root):
            raise StorageError(f"저장 폴더 밖의 경로입니다: {key}")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with path.open("xb") as f:  # 덮어쓰지 않음
                f.write(data)
        except FileExistsError as exc:
            raise StorageError(f"이미 있는 파일입니다: {key}") from exc
        except OSError as exc:
            raise StorageError(str(exc)) from exc

    def delete(self, keys: list[str]) -> None:
        for key in keys:
            try:
                self._path(key).unlink(missing_ok=True)
            except OSError as exc:
                raise StorageError(str(exc)) from exc

    def public_url(self, key: str) -> str:
        return f"{PUBLIC_PREFIX}/{key}"

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()
