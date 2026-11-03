"""비밀번호 해시와 세션 토큰 (DEC-003, REQ-043).

- 비밀번호: Argon2 (관리자·댓글 공통). 원문은 저장하지 않는다.
- 세션 토큰: 무작위 원문은 쿠키로만 전달하고, DB에는 SHA-256 해시만 저장한다.
"""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# 존재하지 않는 아이디로 로그인할 때도 비슷한 시간이 걸리도록 비교에 쓰는 더미 해시
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """해시와 비밀번호가 일치하면 True. 해시가 없으면 더미 해시로 비교해 시간 차이를 줄인다."""
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
