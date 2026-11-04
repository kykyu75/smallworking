"""게시글 본문(TipTap JSON) 검증 (DEC-001, DATA_MODEL v1.0 §5.4, REQ-044).

허용 목록에 없는 노드·마크·속성이 하나라도 있으면 저장을 거부한다 (422 INVALID_CONTENT).
화면(PostContent)도 같은 허용 목록으로만 그리므로, 둘이 함께 XSS를 막는다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.errors import AppError

MAX_IMAGES = 20
MAX_DEPTH = 40
MAX_ALT_LENGTH = 300
MAX_LANGUAGE_LENGTH = 30
SAFE_LINK_PREFIXES = ("http://", "https://", "mailto:")

# 노드별 허용 속성. 값: 속성 이름 → 검사 함수 (None 값은 "없음"과 같게 본다)


def _heading_level(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value in (2, 3)


def _image_id(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _short_text(limit: int):
    return lambda value: isinstance(value, str) and len(value) <= limit


def _list_start(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 100000


def _cell_align(value: Any) -> bool:
    return value in ("left", "center", "right")


def _safe_href(value: Any) -> bool:
    return isinstance(value, str) and len(value) <= 2000 and value.strip().lower().startswith(SAFE_LINK_PREFIXES)


NODE_ATTRS: dict[str, dict[str, Any]] = {
    "doc": {},
    "paragraph": {},
    "text": {},
    "heading": {"level": _heading_level},
    "bulletList": {},
    "orderedList": {"start": _list_start},
    "listItem": {},
    "blockquote": {},
    "codeBlock": {"language": _short_text(MAX_LANGUAGE_LENGTH)},
    "horizontalRule": {},
    "hardBreak": {},
    "image": {"imageId": _image_id, "alt": _short_text(MAX_ALT_LENGTH)},
    # DEC-010 표: 칸 합치기(colspan/rowspan)·너비·색은 허용하지 않는다. 정렬만 허용.
    "table": {},
    "tableRow": {},
    "tableHeader": {"align": _cell_align},
    "tableCell": {"align": _cell_align},
}
REQUIRED_ATTRS = {"heading": ("level",), "image": ("imageId",)}

# DEC-010 표 구조: 부모 → 허용되는 자식
TABLE_CHILDREN = {"table": {"tableRow"}, "tableRow": {"tableHeader", "tableCell"}}
# 자식 → 반드시 있어야 하는 부모
TABLE_PARENT = {"tableRow": "table", "tableHeader": "tableRow", "tableCell": "tableRow"}

MARK_ATTRS: dict[str, dict[str, Any]] = {
    "bold": {},
    "italic": {},
    "strike": {},
    "code": {},
    "link": {"href": _safe_href},
}
REQUIRED_MARK_ATTRS = {"link": ("href",)}


@dataclass(frozen=True)
class ContentSummary:
    image_ids: list[int]  # 본문 등장 순서
    has_body: bool  # 글자나 이미지가 하나라도 있는가


def invalid_content(reason: str) -> AppError:
    return AppError(422, "INVALID_CONTENT", "본문 형식이 올바르지 않습니다.", [{"field": "content", "reason": reason}])


def _check_attrs(kind: str, name: str, attrs: Any, allowed: dict[str, Any], required: tuple[str, ...]) -> None:
    if attrs is None:
        attrs = {}
    if not isinstance(attrs, dict):
        raise invalid_content(f"{kind} '{name}'의 attrs 형식")
    for key, value in attrs.items():
        if key not in allowed:
            raise invalid_content(f"{kind} '{name}'에 허용되지 않은 속성 '{key}'")
        if value is None and key not in required:
            continue
        if not allowed[key](value):
            raise invalid_content(f"{kind} '{name}'의 속성 '{key}' 값")
    for key in required:
        if attrs.get(key) is None:
            raise invalid_content(f"{kind} '{name}'에 필수 속성 '{key}' 없음")


def validate_content(content: Any) -> ContentSummary:
    if not isinstance(content, dict) or content.get("type") != "doc":
        raise invalid_content("최상위 노드는 doc이어야 합니다")

    image_ids: list[int] = []
    has_text = False

    def walk(node: Any, depth: int, parent: str | None, in_table: bool) -> None:
        nonlocal has_text
        if depth > MAX_DEPTH:
            raise invalid_content("본문이 너무 깊게 중첩되어 있습니다")
        if not isinstance(node, dict):
            raise invalid_content("노드 형식")
        node_type = node.get("type")
        if node_type not in NODE_ATTRS:
            raise invalid_content(f"허용되지 않은 노드 '{node_type}'")
        if depth > 0 and node_type == "doc":
            raise invalid_content("doc 안에 doc")
        # DEC-010 표 구조 검사
        if parent in TABLE_CHILDREN and node_type not in TABLE_CHILDREN[parent]:
            raise invalid_content(f"'{parent}' 안에 '{node_type}'")
        if node_type in TABLE_PARENT and parent != TABLE_PARENT[node_type]:
            raise invalid_content(f"'{node_type}'는 '{TABLE_PARENT[node_type]}' 안에만 있을 수 있습니다")
        if node_type == "table" and in_table:
            raise invalid_content("표 안에 표")

        extra = set(node) - {"type", "attrs", "content", "marks", "text"}
        if extra:
            raise invalid_content(f"노드 '{node_type}'의 알 수 없는 항목 {sorted(extra)}")

        _check_attrs("노드", node_type, node.get("attrs"), NODE_ATTRS[node_type], REQUIRED_ATTRS.get(node_type, ()))

        if node_type == "text":
            text = node.get("text")
            if not isinstance(text, str) or text == "":
                raise invalid_content("text 노드에는 내용이 있어야 합니다")
            if text.strip():
                has_text = True
            if "content" in node:
                raise invalid_content("text 노드에는 content가 없어야 합니다")
            marks = node.get("marks") or []
            if not isinstance(marks, list):
                raise invalid_content("marks 형식")
            for mark in marks:
                if not isinstance(mark, dict) or mark.get("type") not in MARK_ATTRS:
                    raise invalid_content(f"허용되지 않은 마크 '{mark.get('type') if isinstance(mark, dict) else mark}'")
                if set(mark) - {"type", "attrs"}:
                    raise invalid_content("마크의 알 수 없는 항목")
                _check_attrs("마크", mark["type"], mark.get("attrs"), MARK_ATTRS[mark["type"]], REQUIRED_MARK_ATTRS.get(mark["type"], ()))
            return

        if "text" in node or node.get("marks"):
            raise invalid_content(f"노드 '{node_type}'에는 text·marks가 없어야 합니다")

        if node_type == "image":
            image_ids.append(node["attrs"]["imageId"])

        children = node.get("content")
        if node_type in TABLE_CHILDREN and not children:
            raise invalid_content(f"빈 '{node_type}'")
        if children is None:
            return
        if not isinstance(children, list):
            raise invalid_content("content 형식")
        for child in children:
            walk(child, depth + 1, node_type, in_table or node_type == "table")

    walk(content, 0, None, False)

    if len(image_ids) > MAX_IMAGES:
        raise AppError(422, "IMAGE_LIMIT_EXCEEDED", "이미지는 게시글당 20장까지 넣을 수 있습니다.")
    if len(set(image_ids)) != len(image_ids):
        raise AppError(422, "INVALID_IMAGE_REFERENCE", "본문의 이미지 정보가 올바르지 않습니다.")
    return ContentSummary(image_ids=image_ids, has_body=has_text or bool(image_ids))
