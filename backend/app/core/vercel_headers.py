"""요청 헤더를 Vercel SDK에 전달 (DEC-012).

Vercel Blob SDK는 Vercel이 요청마다 붙여 주는 OIDC 토큰(x-vercel-oidc-token)을
`vercel.headers.get_headers()`로 읽어 인증한다. 이 미들웨어가 요청 헤더를 그 자리에 넣는다.
(동기 엔드포인트는 스레드에서 실행되지만 contextvars가 함께 복사되므로 그대로 보인다.)
로컬에서는 이 헤더가 없으므로 SDK가 BLOB_READ_WRITE_TOKEN으로 넘어간다.
"""

from __future__ import annotations

from starlette.types import ASGIApp, Receive, Scope, Send


class VercelHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        from vercel.headers import set_headers

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        set_headers(headers)
        try:
            await self.app(scope, receive, send)
        finally:
            set_headers(None)
