"""테스트용 이미지를 메모리에서 만든다."""

from __future__ import annotations

from io import BytesIO

from PIL import Image


def make_image(fmt: str = "JPEG", size: tuple[int, int] = (800, 600), color=(200, 80, 40), exif: bytes | None = None) -> bytes:
    mode = "RGBA" if fmt in ("PNG", "WEBP") else "RGB"
    image = Image.new(mode, size, color if mode == "RGB" else (*color, 255))
    out = BytesIO()
    kwargs = {"exif": exif} if exif else {}
    image.save(out, fmt, **kwargs)
    return out.getvalue()


def make_animated_gif(size: tuple[int, int] = (120, 80), frames: int = 3) -> bytes:
    # 장면마다 색이 달라야 Pillow가 같은 장면으로 합치지 않는다
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)]
    images = [Image.new("RGB", size, colors[i % len(colors)]) for i in range(frames)]
    out = BytesIO()
    images[0].save(out, "GIF", save_all=True, append_images=images[1:], duration=100, loop=0)
    return out.getvalue()


def exif_with_orientation(orientation: int, gps: bool = False) -> bytes:
    exif = Image.Exif()
    exif[0x0112] = orientation  # Orientation
    if gps:
        exif[0x8825] = {1: "N", 2: (37.0, 33.0, 0.0)}  # GPSInfo (촬영 위치)
    return exif.tobytes()


def open_image(data: bytes) -> Image.Image:
    image = Image.open(BytesIO(data))
    image.load()
    return image
