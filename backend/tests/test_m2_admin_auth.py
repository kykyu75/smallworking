"""M2: 관리자 인증 (API-023~025, DEC-003, TEST_CASES §11, §13)."""

from __future__ import annotations

from sqlalchemy import func, select

from app.cli import create_admin
from app.core.security import hash_token
from app.models import AdminSession, AdminUser
from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME


def login(client, password: str = ADMIN_PASSWORD, username: str = ADMIN_USERNAME):
    return client.post("/api/admin/login", json={"username": username, "password": password})


# ---------------------------------------------------------------- 로그인 / 로그아웃


# TC-ADM-001
def test_tc_adm_001_login_success_sets_session_cookie(client, admin_user):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": ADMIN_USERNAME}
    assert client.cookies.get("sw_session")
    assert client.get("/api/admin/me").json() == {"username": ADMIN_USERNAME}


# TC-ADM-002: 틀린 비밀번호와 없는 아이디는 같은 응답
def test_tc_adm_002_wrong_password_and_unknown_user_look_the_same(client, admin_user):
    wrong_password = login(client, password="nope")
    unknown_user = login(client, username="ghost")
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()
    assert wrong_password.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert "sw_session" not in client.cookies


def test_login_validation_error(client):
    response = client.post("/api/admin/login", json={"username": "   ", "password": ""})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# TC-ADM-004 (현재 존재하는 관리자 API): 세션이 없으면 401
def test_tc_adm_004_admin_api_requires_session(client):
    for method, path in [("get", "/api/admin/me"), ("post", "/api/admin/logout")]:
        response = getattr(client, method)(path)
        assert response.status_code == 401, path
        assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_forged_session_cookie_is_rejected(client, admin_user):
    client.cookies.set("sw_session", "not-a-real-token")
    assert client.get("/api/admin/me").status_code == 401


# TC-ADM-005: 로그아웃하면 세션 삭제, 같은 쿠키로는 401
def test_tc_adm_005_logout_invalidates_session(admin_client, db_session):
    token = admin_client.cookies.get("sw_session")
    response = admin_client.post("/api/admin/logout")
    assert response.status_code == 204
    assert db_session.execute(select(func.count()).select_from(AdminSession)).scalar_one() == 0

    admin_client.cookies.set("sw_session", token)  # 지워진 쿠키를 다시 넣어도
    assert admin_client.get("/api/admin/me").status_code == 401


# ---------------------------------------------------------------- 로그인 잠금


# TC-ADM-012: 5번째 실패 후 잠금, 이후에는 올바른 비밀번호도 423
def test_tc_adm_012_lock_after_five_failures(client, admin_user):
    for _ in range(4):
        assert login(client, password="wrong").status_code == 401
    fifth = login(client, password="wrong")
    assert fifth.status_code == 401

    locked = login(client)
    assert locked.status_code == 423
    body = locked.json()["error"]
    assert body["code"] == "ACCOUNT_LOCKED"
    assert body["details"]["locked_until"].startswith("2026-11-03T09:10:00")


# TC-ADM-013: 10분 뒤에는 로그인 가능, 실패 횟수 초기화
def test_tc_adm_013_lock_expires_after_ten_minutes(client, admin_user, clock, db_session):
    for _ in range(5):
        login(client, password="wrong")
    clock.advance(minutes=9, seconds=59)
    assert login(client).status_code == 423
    clock.advance(seconds=1)
    assert login(client).status_code == 200
    db_session.refresh(admin_user)
    assert admin_user.failed_login_count == 0
    assert admin_user.locked_until is None


# TC-ADM-014
def test_tc_adm_014_success_resets_failed_count(client, admin_user, db_session):
    for _ in range(3):
        login(client, password="wrong")
    assert login(client).status_code == 200
    db_session.refresh(admin_user)
    assert admin_user.failed_login_count == 0


# ---------------------------------------------------------------- 세션 만료


# TC-ADM-015: 마지막 활동 후 2시간 지나면 만료
def test_tc_adm_015_idle_timeout(admin_client, clock):
    clock.advance(hours=2, minutes=1)
    assert admin_client.get("/api/admin/me").status_code == 401


# TC-ADM-016: 활동하면 연장
def test_tc_adm_016_activity_extends_session(admin_client, clock):
    for _ in range(5):
        clock.advance(hours=1)
        assert admin_client.get("/api/admin/me").status_code == 200


# TC-ADM-017: 계속 활동해도 7일이 지나면 만료
def test_tc_adm_017_absolute_max_age(admin_client, clock):
    for _ in range(7 * 24 - 1):
        clock.advance(hours=1)
        assert admin_client.get("/api/admin/me").status_code == 200
    clock.advance(hours=1)
    assert admin_client.get("/api/admin/me").status_code == 401


# ---------------------------------------------------------------- 저장 방식


# TC-ADM-019: create-admin은 처음 한 번만 만든다
def test_tc_adm_019_create_admin_only_once(db_session):
    assert create_admin(db_session, "owner", "first-password-123") is True
    assert create_admin(db_session, "someone-else", "second-password-123") is False
    assert db_session.execute(select(func.count()).select_from(AdminUser)).scalar_one() == 1


# TC-ADM-020: 세션 쿠키 속성
def test_tc_adm_020_session_cookie_attributes(client, admin_user):
    response = login(client)
    cookie = response.headers["set-cookie"].lower()
    assert "sw_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "max-age=604800" in cookie  # 7일
    # 테스트는 COOKIE_SECURE=false. 운영(true)에서는 Secure가 붙는다 (TC-DEP-003)


# TC-ADM-021, TC-SEC-006: 토큰 원문과 비밀번호 원문은 DB에 없다
def test_tc_adm_021_tokens_and_passwords_are_hashed(admin_client, admin_user, db_session):
    token = admin_client.cookies.get("sw_session")
    stored = db_session.execute(select(AdminSession.token_hash)).scalar_one()
    assert stored == hash_token(token)
    assert token not in stored
    assert admin_user.password_hash.startswith("$argon2")
    assert ADMIN_PASSWORD not in admin_user.password_hash


# TC-SEC-011: 응답에 민감 정보 없음
def test_tc_sec_011_no_sensitive_fields_in_auth_responses(client, admin_user):
    for response in (login(client), client.get("/api/admin/me")):
        text = response.text
        for field in ("password", "password_hash", "token_hash", "token"):
            assert f'"{field}"' not in text


# ---------------------------------------------------------------- Origin 검사


# TC-SEC-010: 다른 사이트에서 보낸 상태 변경 요청은 403
def test_tc_sec_010_foreign_origin_is_rejected(admin_client):
    response = admin_client.post("/api/admin/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN_ORIGIN"
    assert admin_client.get("/api/admin/me").status_code == 200  # 로그아웃되지 않았다


def test_state_change_without_origin_is_rejected(app, admin_user):
    from fastapi.testclient import TestClient

    with TestClient(app) as no_origin_client:  # Origin 헤더 없음
        response = no_origin_client.post(
            "/api/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
    assert response.status_code == 403


def test_allowed_origins_env_is_accepted(app, admin_user):
    from fastapi.testclient import TestClient

    with TestClient(app, headers={"Origin": "http://localhost:5173"}) as dev_client:
        response = dev_client.post("/api/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert response.status_code == 200


def test_get_requests_are_not_origin_checked(app):
    from fastapi.testclient import TestClient

    with TestClient(app, headers={"Origin": "https://evil.example"}) as c:
        assert c.get("/api/health").status_code == 200
