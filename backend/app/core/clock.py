"""현재 시각 의존성.

시간 규칙(세션 2시간/7일, 로그인 잠금 10분 등)을 테스트에서 실제로 기다리지 않고
검증할 수 있도록, 현재 시각을 FastAPI 의존성으로 주입한다 (TEST_CASES §3, CLAUDE.md §11).
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_now() -> datetime:
    """FastAPI 의존성. 테스트에서는 dependency_overrides로 바꿔 끼운다."""
    return utc_now()
