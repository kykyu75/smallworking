"""이미지 응답 (API_SPEC v1.0 §4.2)."""

from pydantic import BaseModel

from app.models import PostImage
from app.storage import StorageBackend


class ImageOut(BaseModel):
    id: int
    url: str
    thumbnail_url: str
    original_name: str | None
    mime_type: str
    file_size: int
    width: int
    height: int

    @classmethod
    def build(cls, image: PostImage, storage: StorageBackend) -> "ImageOut":
        # 주소는 저장소가 키로 만든다. DB의 키를 그대로 노출하지 않는다.
        return cls(
            id=image.id,
            url=storage.public_url(image.file_path),
            thumbnail_url=storage.public_url(image.thumbnail_path),
            original_name=image.original_name,
            mime_type=image.mime_type,
            file_size=image.file_size,
            width=image.width,
            height=image.height,
        )
