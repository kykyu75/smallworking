"""공통 오류 응답 (API_SPEC v1.0 §12).

모든 오류는 다음 형식으로 응답한다.
    {"error": {"code": "...", "message": "...", "details": null | [...]}}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("smallworking")


class AppError(Exception):
    """서비스 코드에서 던지는 오류. code는 API_SPEC §12.2 오류 코드를 사용한다."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


# HTTP 상태별 기본 오류 코드·메시지 (라우터가 없는 경로 등 FastAPI 자체 오류용)
_DEFAULT_ERRORS: dict[int, tuple[str, str]] = {
    400: ("BAD_REQUEST", "잘못된 요청입니다."),
    401: ("UNAUTHORIZED", "로그인이 필요합니다."),
    403: ("FORBIDDEN", "권한이 없습니다."),
    404: ("NOT_FOUND", "요청한 대상을 찾을 수 없습니다."),
    405: ("METHOD_NOT_ALLOWED", "허용되지 않은 요청 방식입니다."),
    413: ("PAYLOAD_TOO_LARGE", "요청 크기가 너무 큽니다."),
}


def _field_name(loc: tuple[Any, ...] | list[Any]) -> str:
    # ("body", "title") → "title", ("path", "post_id") → "post_id"
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "header", "cookie")]
    return ".".join(parts) or ".".join(str(p) for p in loc)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": _field_name(err.get("loc", ())), "reason": err.get("msg", "")} for err in exc.errors()]
        return JSONResponse(
            status_code=422,
            content=error_body("VALIDATION_ERROR", "입력값을 확인해 주세요.", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, message = _DEFAULT_ERRORS.get(exc.status_code, ("HTTP_ERROR", "요청을 처리할 수 없습니다."))
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message), headers=exc.headers)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        # 내부 정보는 로그에만 남기고 응답에는 노출하지 않는다 (TC-VAL-007)
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "잠시 후 다시 시도해 주세요."))
