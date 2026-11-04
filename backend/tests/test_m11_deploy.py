"""M11 배포 설정 (DEC-012, TC-DEP 자동 확인분)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import normalize_database_url
from app.core.db import engine_options, is_pooled_url

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@h/db?sslmode=require", "postgresql+psycopg://u:p@h/db?sslmode=require"),
        ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
    ],
)
def test_neon_url_is_normalized_for_psycopg(given, expected):
    assert normalize_database_url(given) == expected


def test_sw_env_file_is_read_alone(tmp_path, monkeypatch):
    # 운영용 파일만 읽고, 개발용 backend/.env의 값(ADMIN_PASSWORD 등)이 섞이지 않는다
    from app.core import config

    prod = tmp_path / ".env.neon"
    prod.write_text("DATABASE_URL=postgres://u:p@ep-x.neon.tech/neondb\nADMIN_USERNAME=owner\n", encoding="utf-8")
    for key in ("DATABASE_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SW_ENV_FILE", str(prod))
    assert config.env_file_path() == prod
    config.load_env_file()
    import os

    assert os.environ["ADMIN_USERNAME"] == "owner"
    assert "ADMIN_PASSWORD" not in os.environ  # 개발 .env에서 채워지지 않음
    assert config.Settings.from_env().database_url == "postgresql+psycopg://u:p@ep-x.neon.tech/neondb"

    monkeypatch.setenv("SW_ENV_FILE", str(tmp_path / "missing.env"))
    with pytest.raises(RuntimeError):
        config.load_env_file()


def test_pooled_url_skips_session_options():
    pooled = "postgresql+psycopg://u:p@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    direct = "postgresql+psycopg://u:p@ep-cool-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    assert is_pooled_url(pooled) and not is_pooled_url(direct)
    assert "connect_args" not in engine_options(pooled)  # 풀러는 시작 옵션·SET 미지원
    assert engine_options(direct)["connect_args"] == {"options": "-c timezone=UTC"}


def test_database_default_timezone_is_utc(db_session):
    # 마이그레이션 8c1f2d3e4a5b: DB 기본 시간대 UTC (풀러 연결에도 적용)
    setting = db_session.execute(
        text(
            "SELECT array_to_string(s.setconfig, ',') FROM pg_db_role_setting s "
            "JOIN pg_database d ON d.oid = s.setdatabase WHERE d.datname = current_database() AND s.setrole = 0"
        )
    ).scalar_one_or_none()
    assert setting is not None and "TimeZone=UTC" in setting


def test_forwarded_host_counts_as_same_site(app):
    # Vercel 뒤에서는 공개 주소가 x-forwarded-host로 온다 (DEC-012)
    with TestClient(app, headers={"Origin": "https://smallworking-git-x.vercel.app"}) as c:
        blocked = c.post("/api/requests", json={})
        assert blocked.status_code == 403
        passed = c.post("/api/requests", json={}, headers={"X-Forwarded-Host": "smallworking-git-x.vercel.app"})
        assert passed.status_code == 422  # Origin 검사는 통과, 입력 검증에서 걸림
    with TestClient(app, headers={"Origin": "https://evil.example"}) as evil:
        assert evil.post("/api/requests", json={}, headers={"X-Forwarded-Host": "smallworking.vercel.app"}).status_code == 403


def test_vercel_json_routes_api_to_backend_and_cron_is_daily():
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    services = config["services"]
    assert services["api"]["root"] == "backend/" and services["api"]["entrypoint"] == "app.main:app"
    assert services["web"]["root"] == "frontend/"
    assert config["rewrites"][0] == {"source": "/api/(.*)", "destination": {"service": "api"}}
    assert config["rewrites"][-1]["destination"] == {"service": "web"}
    # Hobby 플랜은 하루 1회만 허용 (분 시 * * *)
    [cron] = config["crons"]
    assert cron["path"] == "/api/cron/cleanup"
    minute, hour, *rest = cron["schedule"].split()
    assert minute.isdigit() and hour.isdigit() and rest == ["*", "*", "*"]


def test_production_requirements_are_pinned_and_lean():
    lines = [
        line.split("#")[0].strip()
        for line in (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").splitlines()
    ]
    packages = [line for line in lines if line]
    assert packages and all("==" in p for p in packages)
    assert not any(p.startswith(("pytest", "httpx", "uvicorn")) for p in packages)  # 개발 도구는 운영에 넣지 않는다
