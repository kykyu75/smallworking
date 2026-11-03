"""카테고리 요청/응답 (API-001~005, DEC-006)."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import optional_trimmed, trimmed

CategoryName = trimmed(1, 30)
CategoryDescription = optional_trimmed(200)


class CategoryInput(BaseModel):
    """생성(API-002)과 수정(API-003)에 같이 쓴다. display_order는 서버가 정한다."""

    name: CategoryName
    description: CategoryDescription = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    display_order: int
    post_count: int


class CategoryList(BaseModel):
    items: list[CategoryOut]


class CategoryOrderInput(BaseModel):
    # 원하는 순서대로 전체 카테고리 ID (API-005)
    category_ids: list[int] = Field(min_length=1)
