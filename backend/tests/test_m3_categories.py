"""M3: 카테고리 API (API-001~005, TEST_CASES §5)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Category, Post

DOC = {"type": "doc", "content": []}


def names(client) -> list[str]:
    return [c["name"] for c in client.get("/api/categories").json()["items"]]


def category_id(client, name: str) -> int:
    return next(c["id"] for c in client.get("/api/categories").json()["items"] if c["name"] == name)


def add_post(db, category_id: int) -> None:
    db.add(Post(category_id=category_id, title="글", content=DOC))
    db.flush()


# ---------------------------------------------------------------- 조회 (공개)


# TC-CAT-001
def test_tc_cat_001_default_categories(client):
    items = client.get("/api/categories").json()["items"]
    assert [(c["name"], c["display_order"]) for c in items] == [("DIY", 1), ("Portfolio", 2), ("Blog", 3), ("Board", 4)]


# TC-CAT-002: 순서대로, post_count 포함
def test_tc_cat_002_list_order_and_post_count(client, db_session):
    add_post(db_session, category_id(client, "Blog"))
    add_post(db_session, category_id(client, "Blog"))
    items = client.get("/api/categories").json()["items"]
    assert [c["display_order"] for c in items] == sorted(c["display_order"] for c in items)
    counts = {c["name"]: c["post_count"] for c in items}
    assert counts == {"DIY": 0, "Portfolio": 0, "Blog": 2, "Board": 0}
    assert set(items[0]) == {"id", "name", "description", "display_order", "post_count"}


# ---------------------------------------------------------------- 추가


# TC-CAT-003: 맨 뒤에 추가
def test_tc_cat_003_create_appends_to_end(admin_client):
    response = admin_client.post("/api/categories", json={"name": "여행", "description": "여행 기록"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "여행"
    assert body["display_order"] == 5
    assert body["post_count"] == 0
    assert names(admin_client)[-1] == "여행"


# TC-CAT-004, TC-VAL-004: 빈 이름 / 공백만
@pytest.mark.parametrize("name", ["", "   "])
def test_tc_cat_004_blank_name_rejected(admin_client, name):
    response = admin_client.post("/api/categories", json={"name": name})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert len(names(admin_client)) == 4


# TC-CAT-005: 대소문자 무시 중복
def test_tc_cat_005_duplicate_name_case_insensitive(admin_client):
    response = admin_client.post("/api/categories", json={"name": "diy"})
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CATEGORY_NAME_DUPLICATED"
    assert error["details"][0]["field"] == "name"


# TC-CAT-012: 30자 / 31자
def test_tc_cat_012_name_length_limit(admin_client):
    assert admin_client.post("/api/categories", json={"name": "가" * 30}).status_code == 201
    assert admin_client.post("/api/categories", json={"name": "나" * 31}).status_code == 422


def test_description_length_and_blank(admin_client):
    assert admin_client.post("/api/categories", json={"name": "A", "description": "x" * 201}).status_code == 422
    created = admin_client.post("/api/categories", json={"name": "B", "description": "   "}).json()
    assert created["description"] is None


# TC-VAL-005: 앞뒤 공백 제거
def test_name_is_trimmed(admin_client):
    assert admin_client.post("/api/categories", json={"name": "  여행  "}).json()["name"] == "여행"


# ---------------------------------------------------------------- 수정


# TC-CAT-006
def test_tc_cat_006_update(admin_client):
    created = admin_client.post("/api/categories", json={"name": "여행"}).json()
    response = admin_client.put(f"/api/categories/{created['id']}", json={"name": "Travel", "description": "기록"})
    assert response.status_code == 200
    assert response.json()["name"] == "Travel"
    assert response.json()["display_order"] == created["display_order"]
    assert "Travel" in names(admin_client)


def test_update_keeps_own_name_but_rejects_others(admin_client):
    diy = category_id(admin_client, "DIY")
    assert admin_client.put(f"/api/categories/{diy}", json={"name": "diy"}).status_code == 200  # 자기 이름 대소문자만 변경
    assert admin_client.put(f"/api/categories/{diy}", json={"name": "Blog"}).status_code == 409


def test_update_not_found(admin_client):
    response = admin_client.put("/api/categories/99999", json={"name": "없음"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


# ---------------------------------------------------------------- 삭제


# TC-CAT-007
def test_tc_cat_007_delete_empty_category(admin_client):
    created = admin_client.post("/api/categories", json={"name": "여행"}).json()
    assert admin_client.delete(f"/api/categories/{created['id']}").status_code == 204
    assert "여행" not in names(admin_client)


# TC-CAT-008: 게시글이 있으면 409, 아무것도 지워지지 않음
def test_tc_cat_008_delete_category_with_posts_rejected(admin_client, db_session):
    blog = category_id(admin_client, "Blog")
    add_post(db_session, blog)
    response = admin_client.delete(f"/api/categories/{blog}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CATEGORY_NOT_EMPTY"
    assert "Blog" in names(admin_client)
    assert db_session.execute(select(Post).where(Post.category_id == blog)).first() is not None


def test_delete_not_found(admin_client):
    assert admin_client.delete("/api/categories/99999").status_code == 404


# ---------------------------------------------------------------- 순서 변경


# TC-CAT-009
def test_tc_cat_009_reorder(admin_client):
    items = admin_client.get("/api/categories").json()["items"]
    ids = [c["id"] for c in items]
    new_order = [ids[2], ids[0], ids[1], ids[3]]
    response = admin_client.put("/api/categories/order", json={"category_ids": new_order})
    assert response.status_code == 200
    assert [c["id"] for c in response.json()["items"]] == new_order
    assert [c["display_order"] for c in response.json()["items"]] == [1, 2, 3, 4]
    assert [c["id"] for c in admin_client.get("/api/categories").json()["items"]] == new_order


# TC-CAT-013: 빠진 ID, 없는 ID, 중복 ID → 422, 순서 그대로
@pytest.mark.parametrize("make_ids", [
    lambda ids: ids[:3],
    lambda ids: ids[:3] + [99999],
    lambda ids: ids[:3] + [ids[0]],
])
def test_tc_cat_013_reorder_mismatch(admin_client, make_ids):
    before = [c["id"] for c in admin_client.get("/api/categories").json()["items"]]
    response = admin_client.put("/api/categories/order", json={"category_ids": make_ids(before)})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CATEGORY_ORDER_MISMATCH"
    assert [c["id"] for c in admin_client.get("/api/categories").json()["items"]] == before


# API_SPEC §2.4: /order가 /{category_id}로 잘못 매칭되지 않는다
def test_order_route_is_not_shadowed(admin_client):
    response = admin_client.put("/api/categories/order", json={"category_ids": []})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"  # 빈 목록 검증 오류 (category_id 'order' 파싱 오류 아님)
    assert response.json()["error"]["details"][0]["field"] == "category_ids"


# ---------------------------------------------------------------- 권한


# TC-ADM-004 (카테고리 관리자 API)
def test_tc_adm_004_category_admin_apis_require_login(client, db_session):
    diy = db_session.execute(select(Category.id).where(Category.name == "DIY")).scalar_one()
    calls = [
        ("post", "/api/categories", {"name": "X"}),
        ("put", f"/api/categories/{diy}", {"name": "X"}),
        ("delete", f"/api/categories/{diy}", None),
        ("put", "/api/categories/order", {"category_ids": [diy]}),
    ]
    for method, path, body in calls:
        kwargs = {"json": body} if body is not None else {}
        response = getattr(client, method)(path, **kwargs)
        assert response.status_code == 401, (method, path)
    assert names(client) == ["DIY", "Portfolio", "Blog", "Board"]
