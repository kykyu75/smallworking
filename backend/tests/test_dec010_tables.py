"""DEC-010 본문 표 — 저장 검증 (TC-POST-024~026, TC-SEC-015)."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import Post
from tests.test_m5_posts import create


def cell(text: str, kind: str = "tableCell", align: str | None = None) -> dict:
    node: dict = {"type": kind, "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}
    if align:
        node["attrs"] = {"align": align}
    return node


def row(*cells: dict) -> dict:
    return {"type": "tableRow", "content": list(cells)}


TABLE_DOC = {
    "type": "doc",
    "content": [
        {
            "type": "table",
            "content": [
                row(cell("재료", "tableHeader"), cell("수량", "tableHeader", "right")),
                row(cell("원목", align="left"), cell("2", align="right")),
                row(
                    {"type": "tableCell", "content": [{"type": "paragraph"}]},  # 빈 칸
                    {
                        "type": "tableCell",
                        "content": [
                            {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "목록"}]}]}]},
                        ],
                    },
                ),
            ],
        }
    ],
}


# TC-POST-024
def test_tc_post_024_table_saved_as_is(admin_client, db_session):
    response = create(admin_client, db_session, content=TABLE_DOC)
    assert response.status_code == 201, response.text
    assert response.json()["content"] == TABLE_DOC


def doc_with(table: dict) -> dict:
    return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "본문"}]}, table]}


# TC-POST-025 구조 오류, TC-SEC-015 허용되지 않은 속성
@pytest.mark.parametrize(
    ("table", "reason"),
    [
        ({"type": "table", "content": [cell("a")]}, "'table' 안에 'tableCell'"),
        ({"type": "table", "content": [row({"type": "paragraph", "content": [{"type": "text", "text": "x"}]})]}, "'tableRow' 안에 'paragraph'"),
        (row(cell("a")), "'tableRow'는 'table' 안에만"),
        (cell("a"), "'tableCell'는 'tableRow' 안에만"),
        ({"type": "table"}, "빈 'table'"),
        ({"type": "table", "content": [{"type": "tableRow"}]}, "빈 'tableRow'"),
        (
            {"type": "table", "content": [row({"type": "tableCell", "content": [{"type": "table", "content": [row(cell("x"))]}]})]},
            "표 안에 표",
        ),
        ({"type": "table", "content": [row({**cell("a"), "attrs": {"colspan": 2}})]}, "허용되지 않은 속성 'colspan'"),
        ({"type": "table", "content": [row({**cell("a"), "attrs": {"rowspan": 2}})]}, "허용되지 않은 속성 'rowspan'"),
        ({"type": "table", "content": [row({**cell("a"), "attrs": {"style": "color:red"}})]}, "허용되지 않은 속성 'style'"),
        ({"type": "table", "content": [row({**cell("a"), "attrs": {"align": "justify"}})]}, "속성 'align' 값"),
        ({"type": "table", "attrs": {"class": "x"}, "content": [row(cell("a"))]}, "허용되지 않은 속성 'class'"),
    ],
)
def test_tc_post_025_sec_015_bad_tables_rejected(admin_client, db_session, table, reason):
    response = create(admin_client, db_session, content=doc_with(table))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_CONTENT"
    assert reason in error["details"][0]["reason"]
    assert db_session.execute(select(func.count()).select_from(Post)).scalar_one() == 0


# TC-POST-026 표만 있는 본문도 글자가 있으면 저장된다. 빈 칸만 있는 표는 빈 본문
def test_tc_post_026_table_text_counts_as_body(admin_client, db_session):
    only_table = {"type": "doc", "content": [{"type": "table", "content": [row(cell("내용"))]}]}
    assert create(admin_client, db_session, content=only_table).status_code == 201
    empty = {"type": "doc", "content": [{"type": "table", "content": [row({"type": "tableCell", "content": [{"type": "paragraph"}]})]}]}
    assert create(admin_client, db_session, content=empty).status_code == 422
