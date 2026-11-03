"""서버 이미지 처리 (API-019, DEC-002, DEC-007).

| 단계 | 규칙 |
|---|---|
| 크기 | 업로드 파일 최대 4MB (Vercel 요청 크기 제한 대응) |
| 형식 | 파일 **내용**으로 판별: JPEG, PNG, WEBP, GIF만 허용 (확장자·Content-Type은 믿지 않음) |
| 방향 | 사진의 EXIF 회전 정보대로 바로 세운다 |
| 메타데이터 | 다시 저장하면서 EXIF(촬영 위치 GPS 등)를 제거한다 |
| 축소 | 긴 변 1920px 초과 시 1920px로 (브라우저가 먼저 줄이지만 서버도 방어) |
| 썸네일 | 긴 변 400px |
| GIF | 움직임 유지를 위해 원본 바이트를 그대로 저장, 썸네일은 첫 장면 |
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MAX_SIDE = 1920
THUMB_SIDE = 400
JPEG_QUALITY = 85
WEBP_QUALITY = 85

# Pillow 형식 이름 → (확장자, MIME)
FORMATS: dict[str, tuple[str, str]] = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
    "GIF": ("gif", "image/gif"),
}


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    thumbnail: bytes
    ext: str
    mime_type: str
    width: int
    height: int


def too_large() -> AppError:
    return AppError(413, "IMAGE_TOO_LARGE", "이미지 파일이 너무 큽니다. (원본 10MB까지, 줄인 뒤 4MB 이하)")


def _unsupported() -> AppError:
    return AppError(415, "UNSUPPORTED_IMAGE_TYPE", "jpg, png, webp, gif 이미지만 올릴 수 있습니다.")


def _invalid() -> AppError:
    return AppError(422, "INVALID_IMAGE", "이미지 파일을 읽을 수 없습니다.")


def _encode(image: Image.Image, fmt: str) -> bytes:
    out = BytesIO()
    if fmt == "JPEG":
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    elif fmt == "PNG":
        image.save(out, "PNG", optimize=True)
    elif fmt == "WEBP":
        image.save(out, "WEBP", quality=WEBP_QUALITY, method=4)
    elif fmt == "GIF":
        image.save(out, "GIF")
    else:  # pragma: no cover - FORMATS로 이미 걸러짐
        raise _unsupported()
    return out.getvalue()


def _fit(image: Image.Image, side: int) -> Image.Image:
    copy = image.copy()
    if max(copy.size) > side:
        copy.thumbnail((side, side), Image.Resampling.LANCZOS)
    return copy


def process_image(data: bytes) -> ProcessedImage:
    if len(data) > MAX_UPLOAD_BYTES:
        raise too_large()
    if not data:
        raise _invalid()

    try:
        image = Image.open(BytesIO(data))
    except UnidentifiedImageError as exc:
        raise _unsupported() from exc
    except (OSError, Image.DecompressionBombError) as exc:
        raise _invalid() from exc

    fmt = image.format or ""
    if fmt not in FORMATS:
        raise _unsupported()
    ext, mime = FORMATS[fmt]

    try:
        image.load()
    except (OSError, SyntaxError, Image.DecompressionBombError) as exc:  # 손상·잘린 파일, 지나치게 큰 이미지
        raise _invalid() from exc

    if fmt == "GIF":
        # 움직이는 GIF를 지키기 위해 원본을 그대로 저장한다. 썸네일은 첫 장면.
        image.seek(0)
        first_frame = image.convert("RGBA")
        thumb = _encode(_fit(first_frame, THUMB_SIDE).convert("P", palette=Image.Palette.ADAPTIVE), "GIF")
        return ProcessedImage(data=data, thumbnail=thumb, ext=ext, mime_type=mime, width=image.width, height=image.height)

    upright = ImageOps.exif_transpose(image)  # EXIF 회전 반영 (메타데이터는 다시 저장할 때 빠진다)
    main = _fit(upright, MAX_SIDE)
    main_bytes = _encode(main, fmt)
    thumb_bytes = _encode(_fit(main, THUMB_SIDE), fmt)
    return ProcessedImage(
        data=main_bytes, thumbnail=thumb_bytes, ext=ext, mime_type=mime, width=main.width, height=main.height
    )
