"""DEC-011 요청 게시판 (API-029~038, TC-REQ-001~019)."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.models import VisitorRequest

PASSWORD = "pass1234"
SENSITIVE = ("password", "password_hash", "failed_password_count", "locked_until")


def body(**overrides) -> dict:
    data = {
        "kind": "diy",
        "title": "선반 도면 부탁드려요",
        "content": "지난번 원목 선반 도면을\n공유해 주실 수 있나요?",
        "nickname": "목수지망생",
        "password": PASSWORD,
        "is_secret": False,
    }
    data.update(overrides)
    return data


@pytest.fixture
def anon(app) -> Iterator[TestClient]:
    """로그인하지 않은 다른 방문자 (admin_client와 쿠키를 나누지 않는다)."""
    with TestClient(app, headers={"Origin": "http://testserver"}) as other:
        yield other


def create(client, **overrides) -> dict:
    response = client.post("/api/requests", json=body(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def assert_no_sensitive(data) -> None:
    text = str(data)
    for key in SENSITIVE:
        assert f"'{key}'" not in text


# ---------------------------------------------------------------- 작성·검증


# TC-REQ-001
def test_tc_req_001_create(client, db_session, clock):
    data = create(client, is_secret=True)
    assert data["title"] == "선반 도면 부탁드려요"
    assert data["content"].endswith("있나요?")
    assert data["locked"] is False  # 작성자에게는 바로 보여준다
    assert data["answer"] is None and data["answered_at"] is None
    assert data["created_at"].startswith("2026-11-03T09:00:00")
    assert_no_sensitive(data)
    stored = db_session.get(VisitorRequest, data["id"])
    assert stored.password_hash.startswith("$argon2") and PASSWORD not in stored.password_hash


# TC-REQ-002
@pytest.mark.parametrize(
    "overrides",
    [
        {"kind": "abc"},
        {"title": ""},
        {"title": "   "},
        {"title": "가" * 101},
        {"content": "가" * 2001},
        {"nickname": "가"},
        {"password": "123"},
    ],
)
def test_tc_req_002_validation(client, db_session, overrides):
    response = client.post("/api/requests", json=body(**overrides))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_session.execute(select(func.count(VisitorRequest.id))).scalar_one() == 0


def test_boundary_lengths_ok(client):
    create(client, title="가" * 100, content="가" * 2000, nickname="가" * 20)


# ---------------------------------------------------------------- 목록·상세


# TC-REQ-003
def test_tc_req_003_list_newest_first_secret_hidden(client, clock):
    for i in range(15):
        create(client, title=f"요청 {i}", is_secret=(i == 14))
        clock.advance(minutes=1)
    first = client.get("/api/requests").json()
    assert first["size"] == 12 and first["total"] == 15 and len(first["items"]) == 12
    assert first["items"][0]["title"] is None and first["items"][0]["is_secret"] is True  # 가장 최신 = 비밀글
    assert first["items"][1]["title"] == "요청 13"
    assert "content" not in first["items"][0]
    second = client.get("/api/requests", params={"page": 2}).json()
    assert [i["title"] for i in second["items"]] == ["요청 2", "요청 1", "요청 0"]
    assert_no_sensitive(first)


# TC-REQ-004, TC-REQ-005
def test_tc_req_004_005_detail_public_and_secret(client, anon):
    public = create(client)
    secret = create(client, is_secret=True)
    got = anon.get(f"/api/requests/{public['id']}").json()
    assert got["locked"] is False and got["content"] == public["content"]
    hidden = anon.get(f"/api/requests/{secret['id']}").json()
    assert hidden["locked"] is True
    assert hidden["title"] is None and hidden["content"] is None and hidden["answer"] is None
    assert hidden["nickname"] == "목수지망생"
    assert anon.get("/api/requests/99999").json()["error"]["code"] == "REQUEST_NOT_FOUND"


# TC-REQ-006, TC-REQ-008
def test_tc_req_006_008_open_secret_with_password(anon):
    secret = create(anon, is_secret=True)
    wrong = anon.post(f"/api/requests/{secret['id']}/open", json={"password": "wrong-pass"})
    assert wrong.status_code == 403 and wrong.json()["error"]["code"] == "INVALID_PASSWORD"
    assert "content" not in str(wrong.json())
    opened = anon.post(f"/api/requests/{secret['id']}/open", json={"password": PASSWORD})
    assert opened.status_code == 200
    assert opened.json()["locked"] is False and opened.json()["title"] == "선반 도면 부탁드려요"


# TC-REQ-007
def test_tc_req_007_admin_sees_secret(admin_client, anon):
    secret = create(anon, is_secret=True)
    data = admin_client.get(f"/api/requests/{secret['id']}").json()
    assert data["locked"] is False and data["content"] == secret["content"]


# TC-REQ-009, TC-REQ-010
def test_tc_req_009_010_lock_after_five_failures(anon, clock, db_session):
    secret = create(anon, is_secret=True)
    url = f"/api/requests/{secret['id']}"
    for _ in range(5):
        assert anon.post(f"{url}/open", json={"password": "wrong-pass"}).status_code == 403
    locked = anon.post(f"{url}/open", json={"password": PASSWORD})
    assert locked.status_code == 423
    assert locked.json()["error"]["code"] == "REQUEST_LOCKED"
    assert "locked_until" in locked.json()["error"]["details"]
    # 수정·삭제도 같은 잠금
    assert anon.put(url, json={k: v for k, v in body().items() if k != "nickname"}).status_code == 423
    assert anon.post(f"{url}/delete", json={"password": PASSWORD}).status_code == 423

    clock.advance(minutes=9, seconds=59)
    assert anon.post(f"{url}/open", json={"password": PASSWORD}).status_code == 423
    clock.advance(seconds=1)
    assert anon.post(f"{url}/open", json={"password": PASSWORD}).status_code == 200
    stored = db_session.get(VisitorRequest, secret["id"])
    db_session.refresh(stored)
    assert stored.failed_password_count == 0 and stored.locked_until is None


def test_success_resets_failed_count(anon, db_session):
    item = create(anon)
    url = f"/api/requests/{item['id']}"
    for _ in range(4):
        anon.post(f"{url}/open", json={"password": "wrong-pass"})
    assert anon.post(f"{url}/open", json={"password": PASSWORD}).status_code == 200
    anon.post(f"{url}/open", json={"password": "wrong-pass"})  # 다시 1회째 → 잠기지 않음
    assert anon.post(f"{url}/open", json={"password": PASSWORD}).status_code == 200


# ---------------------------------------------------------------- 수정·삭제


def update_body(**overrides) -> dict:
    data = {k: v for k, v in body().items() if k != "nickname"}
    data.update(overrides)
    return data


# TC-REQ-011
def test_tc_req_011_update(anon, clock):
    item = create(anon)
    clock.advance(minutes=5)
    response = anon.put(f"/api/requests/{item['id']}", json=update_body(kind="material", title="자료 요청으로 변경", is_secret=True))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["kind"] == "material" and data["title"] == "자료 요청으로 변경" and data["is_secret"] is True
    assert data["updated_at"].startswith("2026-11-03T09:05:00")
    assert data["created_at"].startswith("2026-11-03T09:00:00")
    assert anon.put(f"/api/requests/{item['id']}", json=update_body(password="wrong-pass")).status_code == 403


# TC-REQ-012, TC-REQ-014, TC-REQ-015
def test_tc_req_012_014_015_answer_flow(admin_client, anon, clock):
    item = create(anon)
    clock.advance(minutes=10)
    saved = admin_client.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "  다음 주에 올릴게요.  "})
    assert saved.status_code == 200, saved.text
    assert saved.json()["answer"] == "다음 주에 올릴게요."
    assert saved.json()["answered_at"].startswith("2026-11-03T09:10:00")
    assert saved.json()["updated_at"] == item["updated_at"]  # 작성자 수정 시각은 그대로

    listed = anon.get("/api/requests").json()["items"][0]
    assert listed["answered"] is True

    blocked = anon.put(f"/api/requests/{item['id']}", json=update_body(title="바꿔볼까"))
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "REQUEST_ANSWERED"
    assert anon.get(f"/api/requests/{item['id']}").json()["title"] == item["title"]

    clock.advance(minutes=5)
    again = admin_client.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "수정한 답변"}).json()
    assert again["answer"] == "수정한 답변" and again["answered_at"].startswith("2026-11-03T09:15:00")

    removed = admin_client.delete(f"/api/admin/requests/{item['id']}/answer")
    assert removed.status_code == 200 and removed.json()["answer"] is None and removed.json()["answered_at"] is None
    assert anon.get("/api/requests").json()["items"][0]["answered"] is False
    assert anon.put(f"/api/requests/{item['id']}", json=update_body(title="이제 수정 가능")).status_code == 200

    assert admin_client.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "  "}).status_code == 422


# TC-REQ-013
def test_tc_req_013_delete_by_writer(admin_client, anon, db_session):
    item = create(anon)
    admin_client.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "답변"})
    assert anon.post(f"/api/requests/{item['id']}/delete", json={"password": "wrong-pass"}).status_code == 403
    assert anon.post(f"/api/requests/{item['id']}/delete", json={"password": PASSWORD}).status_code == 204
    assert anon.get(f"/api/requests/{item['id']}").status_code == 404
    assert db_session.execute(select(func.count(VisitorRequest.id))).scalar_one() == 0


# ---------------------------------------------------------------- 관리자


# TC-REQ-016
def test_tc_req_016_admin_list_and_filter(admin_client, anon, clock):
    a = create(anon, title="접수1", is_secret=True)
    clock.advance(minutes=1)
    create(anon, title="접수2")
    clock.advance(minutes=1)
    c = create(anon, title="완료")
    admin_client.put(f"/api/admin/requests/{c['id']}/answer", json={"answer": "완료했습니다"})

    everything = admin_client.get("/api/admin/requests").json()
    assert [i["title"] for i in everything["items"]] == ["완료", "접수2", "접수1"]
    assert everything["total"] == 3 and everything["open_count"] == 2
    secret = next(i for i in everything["items"] if i["id"] == a["id"])
    assert secret["is_secret"] is True and secret["content"] == a["content"]  # 비밀글 내용 포함
    assert_no_sensitive(everything)

    open_only = admin_client.get("/api/admin/requests", params={"status": "open"}).json()
    assert [i["title"] for i in open_only["items"]] == ["접수2", "접수1"] and open_only["open_count"] == 2
    answered = admin_client.get("/api/admin/requests", params={"status": "answered"}).json()
    assert [i["title"] for i in answered["items"]] == ["완료"] and answered["total"] == 1
    assert admin_client.get("/api/admin/requests", params={"status": "done"}).status_code == 422


# TC-REQ-017
def test_tc_req_017_admin_delete(admin_client, anon):
    item = create(anon)
    assert admin_client.delete(f"/api/admin/requests/{item['id']}").status_code == 204
    assert anon.get(f"/api/requests/{item['id']}").status_code == 404
    assert admin_client.delete(f"/api/admin/requests/{item['id']}").status_code == 404
    assert admin_client.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "x"}).status_code == 404


# TC-REQ-018
def test_tc_req_018_admin_apis_require_login(anon, db_session):
    item = create(anon)
    assert anon.get("/api/admin/requests").status_code == 401
    assert anon.put(f"/api/admin/requests/{item['id']}/answer", json={"answer": "x"}).status_code == 401
    assert anon.delete(f"/api/admin/requests/{item['id']}/answer").status_code == 401
    assert anon.delete(f"/api/admin/requests/{item['id']}").status_code == 401
    stored = db_session.get(VisitorRequest, item["id"])
    assert stored is not None and stored.answer is None


# TC-REQ-019
def test_tc_req_019_script_is_text_and_no_sensitive_fields(anon):
    item = create(anon, title="<script>alert(1)</script>", content="<img src=x onerror=alert(1)>")
    assert item["title"] == "<script>alert(1)</script>"  # 글자 그대로 저장, 화면은 React가 글자로 출력
    for data in (item, anon.get(f"/api/requests/{item['id']}").json(), anon.get("/api/requests").json()):
        assert_no_sensitive(data)


def test_origin_check_applies(app):
    with TestClient(app, headers={"Origin": "https://evil.example"}) as evil:
        assert evil.post("/api/requests", json=body()).status_code == 403
