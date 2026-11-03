"""FastAPI 앱 생성 (CLAUDE.md §6).

로컬 실행:  .venv\\Scripts\\python -m uvicorn app.main:app --reload  (backend 폴더에서)
Vercel:     api/index.py가 이 app을 불러온다 (M11)
"""

from fastapi import FastAPI

from app.api import health
from app.core.errors import register_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(
        title="SmallWorking API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    register_error_handlers(app)
    app.include_router(health.router)
    return app


app = create_app()
