"""공통 입력 타입 (DEC-006: 앞뒤 공백 제거 후 길이 검증)."""

from typing import Annotated

from pydantic import BeforeValidator, StringConstraints


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def trimmed(min_length: int, max_length: int):
    """앞뒤 공백을 제거한 뒤 길이를 검사하는 문자열 타입."""
    return Annotated[str, BeforeValidator(_strip), StringConstraints(min_length=min_length, max_length=max_length)]


def optional_trimmed(max_length: int):
    """선택 입력. 공백만 있으면 None으로 저장한다."""
    # 길이 제한은 str 쪽에만 걸어야 None(공백 입력)이 통과한다
    bounded = Annotated[str, StringConstraints(max_length=max_length)]
    return Annotated[bounded | None, BeforeValidator(_blank_to_none)]
