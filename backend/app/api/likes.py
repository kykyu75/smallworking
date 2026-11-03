"""좋아요 API (API-018 좋아요, API-022 좋아요 취소).

쿠키 sw_visitor: HttpOnly, SameSite=Lax, Secure(운영), 유효기간 1년 (API_SPEC §2.2).
좋아요 요청에 쿠키가 없거나 형식이 잘못됐으면 새로 발급한다.
"""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.services import like_service

router = APIRouter(prefix="/api/posts", tags=["likes"])

VISITOR_COOKIE = "sw_visitor"
VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365


class LikeOut(BaseModel):
    post_id: int
    like_count: int
    liked: bool


def _out(result: like_service.LikeResult) -> LikeOut:
    return LikeOut(post_id=result.post_id, like_count=result.like_count, liked=result.liked)


# API-018
@router.post("/{post_id}/like", response_model=LikeOut)
def like_post(
    post_id: int,
    response: Response,
    sw_visitor: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> LikeOut:
    visitor_key = sw_visitor if like_service.is_valid_visitor_key(sw_visitor) else None
    if visitor_key is None:
        visitor_key = like_service.new_visitor_key()
        response.set_cookie(
            key=VISITOR_COOKIE,
            value=visitor_key,
            max_age=VISITOR_COOKIE_MAX_AGE,
            httponly=True,
            secure=get_settings().cookie_secure,
            samesite="lax",
            path="/",
        )
    return _out(like_service.like(db, post_id, visitor_key))


# API-022
@router.delete("/{post_id}/like", response_model=LikeOut)
def unlike_post(
    post_id: int,
    sw_visitor: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> LikeOut:
    visitor_key = sw_visitor if like_service.is_valid_visitor_key(sw_visitor) else None
    return _out(like_service.unlike(db, post_id, visitor_key))
