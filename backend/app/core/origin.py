"""상태 변경 요청의 Origin 검사 — CSRF 방어 (API_SPEC v1.0 §2.3, TC-SEC-010).

POST / PUT / PATCH / DELETE 요청은 Origin 헤더가 다음 중 하나일 때만 처리한다.
1. ALLOWED_ORIGINS 환경변수에 있는 주소
2. 요청을 받은 사이트 자신 (Origin의 host == 요청 Host) — Vercel 미리보기 배포 주소 대응

브라우저는 GET/HEAD가 아닌 요청에 항상 Origin을 붙이므로, Origin이 없는 상태 변경 요청은 거부한다.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import error_body

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _host_of(origin: str) -> str:
    return urlsplit(origin).netloc.lower()


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: tuple[str, ...]) -> None:
        self.app = app
        self.allowed = {o.rstrip("/").lower() for o in allowed_origins}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in STATE_CHANGING_METHODS:
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        origin = headers.get("origin", "").rstrip("/").lower()
        # Vercel은 공개 주소를 x-forwarded-host로도 전달한다 (DEC-012). 둘 중 하나와 같으면 같은 사이트다.
        # 브라우저 요청의 Origin은 페이지가 바꿀 수 없으므로 다른 사이트가 이 검사를 통과할 수 없다.
        hosts = {headers.get("host", "").lower(), headers.get("x-forwarded-host", "").split(",")[0].strip().lower()}
        hosts.discard("")

        if origin and (origin in self.allowed or _host_of(origin) in hosts):
            await self.app(scope, receive, send)
            return

        await _forbidden(send)


async def _forbidden(send: Send) -> None:
    import json

    body = json.dumps(error_body("FORBIDDEN_ORIGIN", "허용되지 않은 요청입니다."), ensure_ascii=False).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 403,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": body})
