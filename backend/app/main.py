"""FastAPI 앱 생성 (CLAUDE.md §6).

로컬 실행:  .venv\\Scripts\\python -m uvicorn app.main:app --reload  (backend 폴더에서)
Vercel:     api/index.py가 이 app을 불러온다 (M11)
"""

from fastapi import FastAPI

from app.api import admin_auth, health
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.origin import OriginCheckMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="SmallWorking API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    register_error_handlers(app)
    app.add_middleware(OriginCheckMiddleware, allowed_origins=get_settings().allowed_origins)

    app.include_router(health.router)
    app.include_router(admin_auth.router)
    return app


app = create_app()
