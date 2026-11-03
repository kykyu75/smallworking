"""관리자 인증 요청/응답 (API-023~025)."""

from typing import Annotated

from pydantic import BaseModel, StringConstraints

Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
# 비밀번호는 앞뒤 공백도 비밀번호의 일부일 수 있으므로 자르지 않는다
Password = Annotated[str, StringConstraints(min_length=1, max_length=256)]


class LoginRequest(BaseModel):
    username: Username
    password: Password


class AdminMe(BaseModel):
    username: str
