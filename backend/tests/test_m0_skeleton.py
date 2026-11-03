"""M0 뼈대 확인: 테스트 DB 연결, 공통 오류 형식 (API_SPEC v1.0 §12)."""

from fastapi import Query
from sqlalchemy import text


def test_health_connects_to_test_database(client, db_session):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
    # 개발 DB가 아니라 테스트 DB에 붙어 있어야 한다
    assert db_session.execute(text("SELECT current_database()")).scalar_one() == "smallworking_test"


# TC-VAL-006: 없는 경로도 공통 오류 형식
def test_unknown_route_uses_common_error_format(client):
    response = client.get("/api/no-such-endpoint")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": "요청한 대상을 찾을 수 없습니다.", "details": None}
    }


# TC-VAL-006, TC-VAL-008: FastAPI 기본 422도 공통 형식으로 변환
def test_validation_error_uses_common_error_format(app, client):
    @app.get("/api/_test/items/{item_id}")
    def _item(item_id: int, size: int = Query(10, ge=1, le=50)) -> dict[str, int]:
        return {"item_id": item_id, "size": size}

    response = client.get("/api/_test/items/abc?size=0")
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert body["message"] == "입력값을 확인해 주세요."
    fields = {d["field"] for d in body["details"]}
    assert fields == {"item_id", "size"}


# TC-VAL-007: 예상하지 못한 오류는 내부 정보 없이 500
def test_unexpected_error_hides_internal_details(app):
    from fastapi.testclient import TestClient

    @app.get("/api/_test/boom")
    def _boom() -> None:
        raise RuntimeError("secret internal detail")

    with TestClient(app, raise_server_exceptions=False) as c:
        response = c.get("/api/_test/boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secret" not in response.text
