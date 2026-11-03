"""FastAPI 앱 생성 (CLAUDE.md §6).

로컬 실행:  .venv\\Scripts\\python -m uvicorn app.main:app --reload  (backend 폴더에서)
Vercel:     api/index.py가 이 app을 불러온다 (M11)
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import admin_auth, categories, health, home, images, posts
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.headers import SecurityHeadersMiddleware
from app.core.origin import OriginCheckMiddleware
from app.storage.local import PUBLIC_PREFIX


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SmallWorking API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    register_error_handlers(app)
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.allowed_origins)
    app.add_middleware(SecurityHeadersMiddleware)

    app.include_router(health.router)
    app.include_router(admin_auth.router)
    app.include_router(categories.router)
    app.include_router(images.router)
    app.include_router(posts.router)
    app.include_router(home.router)

    # 개발 환경(LocalStorage)에서만 업로드 파일을 직접 제공한다. 운영은 Vercel Blob 주소에서 받는다 (DEC-007)
    if settings.storage_backend == "local":
        settings.upload_root.mkdir(parents=True, exist_ok=True)
        app.mount(PUBLIC_PREFIX, StaticFiles(directory=settings.upload_root), name="uploads")
    return app


app = create_app()
