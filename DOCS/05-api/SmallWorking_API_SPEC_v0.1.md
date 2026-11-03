# SmallWorking API_SPEC

- Version: 0.1 (Draft)
- Status: Review
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.0 / TRD v1.0 / DATA_MODEL v0.1

## 1. 목적

SmallWorking Frontend와 Backend 사이의 REST API 계약을 정의한다.

```text
React + TypeScript
        ↓ HTTP/JSON
FastAPI
        ↓
SQLAlchemy
        ↓
PostgreSQL
```

## 2. 기본 규칙

| 항목 | 규칙 |
|---|---|
| API 방식 | REST API |
| Protocol | HTTP/HTTPS |
| 데이터 형식 | JSON |
| 문자 인코딩 | UTF-8 |
| 기본 경로 | `/api` |
| ID | 숫자형 |
| 날짜/시간 | ISO 8601 |
| 성공 | HTTP 2xx |
| 클라이언트 오류 | HTTP 4xx |
| 서버 오류 | HTTP 5xx |

## 3. API 목록

| ID | Method | Endpoint | 설명 | 권한 |
|---|---|---|---|---|
| API-001 | GET | `/api/categories` | 카테고리 목록 | 공개 |
| API-002 | POST | `/api/categories` | 카테고리 생성 | 관리자 |
| API-003 | PUT | `/api/categories/{category_id}` | 카테고리 수정 | 관리자 |
| API-004 | DELETE | `/api/categories/{category_id}` | 카테고리 삭제 | 관리자 |
| API-005 | PUT | `/api/categories/order` | 카테고리 순서 변경 | 관리자 |
| API-006 | GET | `/api/posts` | 게시글 목록 | 공개 |
| API-007 | GET | `/api/posts/{post_id}` | 게시글 상세 | 공개 |
| API-008 | POST | `/api/posts` | 게시글 작성 | 관리자 |
| API-009 | PUT | `/api/posts/{post_id}` | 게시글 수정 | 관리자 |
| API-010 | DELETE | `/api/posts/{post_id}` | 게시글 삭제 | 관리자 |
| API-011 | GET | `/api/posts/latest` | 전체 최신 게시글 | 공개 |
| API-012 | GET | `/api/posts/popular` | 인기 게시글 | 공개 |
| API-013 | GET | `/api/categories/{category_id}/posts/latest` | 카테고리별 최신 게시글 | 공개 |
| API-014 | GET | `/api/posts/{post_id}/comments` | 댓글 목록 | 공개 |
| API-015 | POST | `/api/posts/{post_id}/comments` | 댓글/답글 작성 | 공개 |
| API-016 | PUT | `/api/comments/{comment_id}` | 댓글 수정 | 비밀번호 |
| API-017 | DELETE | `/api/comments/{comment_id}` | 댓글 삭제 | 비밀번호 |
| API-018 | POST | `/api/posts/{post_id}/like` | 게시글 좋아요 | 공개 |
| API-019 | POST | `/api/images` | 이미지 업로드 | 관리자 |
| API-020 | DELETE | `/api/images/{image_id}` | 이미지 삭제 | 관리자 |
| API-021 | GET | `/api/home` | 홈 화면 데이터 | 공개 |

## 4. Category API

### API-001 카테고리 목록

```http
GET /api/categories
```

Response:

```json
{
  "items": [
    {
      "id": 1,
      "name": "DIY",
      "description": "직접 만들어 본 것들",
      "display_order": 1
    }
  ]
}
```

정렬: `display_order ASC`

### API-002 카테고리 생성

```http
POST /api/categories
```

Request:

```json
{
  "name": "여행",
  "description": "여행 기록",
  "display_order": 5
}
```

Response: `201 Created`

### API-003 카테고리 수정

```http
PUT /api/categories/{category_id}
```

### API-004 카테고리 삭제

```http
DELETE /api/categories/{category_id}
```

게시글이 존재하는 카테고리의 삭제 정책은 TBD.

### API-005 카테고리 순서 변경

```http
PUT /api/categories/order
```

Request:

```json
{
  "items": [
    {"id": 3, "display_order": 1},
    {"id": 1, "display_order": 2},
    {"id": 2, "display_order": 3}
  ]
}
```

## 5. Post API

### API-006 게시글 목록

```http
GET /api/posts
```

Query:

```text
category_id
page
size
sort
```

예:

```http
GET /api/posts?category_id=1&page=1&size=10
```

목록에서는 본문 전체와 이미지를 기본적으로 반환하지 않는다.

### API-007 게시글 상세

```http
GET /api/posts/{post_id}
```

Response:

```json
{
  "id": 101,
  "category_id": 1,
  "category_name": "DIY",
  "title": "주방 타일 시공",
  "content": {},
  "images": [
    {
      "id": 1001,
      "file_path": "/uploads/posts/101/image001.jpg",
      "original_name": "kitchen.jpg"
    }
  ],
  "like_count": 12,
  "created_at": "2026-09-15T10:00:00+09:00",
  "updated_at": "2026-09-15T10:00:00+09:00"
}
```

### API-008 게시글 작성

```http
POST /api/posts
```

권한: 관리자

```json
{
  "category_id": 1,
  "title": "주방 타일 시공",
  "content": {}
}
```

이미지 처리 방식은 TBD.

### API-009 게시글 수정

```http
PUT /api/posts/{post_id}
```

### API-010 게시글 삭제

```http
DELETE /api/posts/{post_id}
```

권한: 관리자

연결된 이미지/댓글/좋아요의 삭제 정책은 DATA_MODEL과 연계한다.

### API-011 최신 게시글

```http
GET /api/posts/latest?limit=5
```

생성일 기준 최신순.

### API-012 인기 게시글

```http
GET /api/posts/popular?limit=5
```

기본 정렬:

```text
like_count DESC
```

인기 게시글 기간 기준은 TBD.

### API-013 카테고리별 최신 게시글

```http
GET /api/categories/{category_id}/posts/latest?limit=5
```

## 6. Comment API

### API-014 댓글 목록

```http
GET /api/posts/{post_id}/comments
```

Response 예:

```json
{
  "items": [
    {
      "id": 1,
      "nickname": "작업자",
      "content": "멋지네요.",
      "created_at": "2026-09-15T11:00:00+09:00",
      "replies": [
        {
          "id": 2,
          "nickname": "smallworking",
          "content": "감사합니다.",
          "created_at": "2026-09-15T11:10:00+09:00"
        }
      ]
    }
  ]
}
```

### API-015 댓글/답글 작성

```http
POST /api/posts/{post_id}/comments
```

일반 댓글:

```json
{
  "nickname": "홍길동",
  "password": "1234",
  "content": "좋은 글 잘 봤습니다."
}
```

답글:

```json
{
  "nickname": "홍길동",
  "password": "1234",
  "content": "저도 그렇게 생각합니다.",
  "parent_comment_id": 10
}
```

`parent_comment_id`가 다른 답글을 가리키는 경우 등록을 거부한다.

```text
댓글
└── 답글
    └── 답글  ← 금지
```

### API-016 댓글 수정

```http
PUT /api/comments/{comment_id}
```

Request:

```json
{
  "password": "1234",
  "content": "수정된 댓글입니다."
}
```

### API-017 댓글 삭제

```http
DELETE /api/comments/{comment_id}
```

Request:

```json
{
  "password": "1234"
}
```

댓글에 답글이 존재할 때의 삭제 정책은 TBD.

## 7. Like API

### API-018 게시글 좋아요

```http
POST /api/posts/{post_id}/like
```

Response:

```json
{
  "post_id": 101,
  "like_count": 13
}
```

중복 좋아요 방지 방식은 TBD.

## 8. Image API

이미지 원본은 PostgreSQL에 저장하지 않고 서버 파일 시스템에 저장한다.

### API-019 이미지 업로드

```http
POST /api/images
Content-Type: multipart/form-data
```

Request:

```text
file = image.jpg
```

Response:

```json
{
  "id": 1001,
  "file_name": "a8f32c.jpg",
  "file_path": "/uploads/posts/temp/a8f32c.jpg",
  "mime_type": "image/jpeg",
  "file_size": 245812
}
```

### API-020 이미지 삭제

```http
DELETE /api/images/{image_id}
```

DB 메타데이터와 실제 파일의 처리 정책을 함께 적용한다.

## 9. Home API

### API-021 홈 화면 데이터

```http
GET /api/home
```

Response 예:

```json
{
  "categories": [
    {
      "id": 1,
      "name": "DIY",
      "latest_posts": []
    },
    {
      "id": 2,
      "name": "Portfolio",
      "latest_posts": []
    }
  ],
  "latest_posts": [],
  "popular_posts": []
}
```

Home API의 정확한 구성과 카테고리별 게시글 수는 TBD.

## 10. 공통 오류 응답

```json
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "게시글을 찾을 수 없습니다."
  }
}
```

| Status | 의미 |
|---:|---|
| 200 | 정상 처리 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 대상 없음 |
| 409 | 데이터 충돌 |
| 422 | 입력값 검증 실패 |
| 500 | 서버 오류 |

## 11. 권한

| 기능 | Visitor | Admin |
|---|:---:|:---:|
| 카테고리 조회 | O | O |
| 카테고리 생성/수정/삭제 | X | O |
| 게시글 조회 | O | O |
| 게시글 작성/수정/삭제 | X | O |
| 댓글 조회/작성 | O | O |
| 댓글 수정/삭제 | 비밀번호 | O |
| 게시글 좋아요 | O | O |
| 이미지 업로드/삭제 | X | O |

관리자 인증 방식은 TBD.

## 12. API와 DB 관계

| API 기능 | 주요 테이블 |
|---|---|
| 카테고리 | Category |
| 게시글 | Post |
| 게시글 이미지 | PostImage |
| 댓글/답글 | Comment |
| 좋아요 | PostLike |
| Home | Category + Post + PostLike |
| 게시글 상세 | Post + PostImage + Comment + PostLike |

```text
React
  ↓
FastAPI
  ↓
Service
  ↓
SQLAlchemy
  ↓
PostgreSQL
```

## 13. 설계 원칙

1. Frontend는 PostgreSQL에 직접 접근하지 않는다.
2. 모든 DB 접근은 Backend를 통해 처리한다.
3. 댓글 비밀번호는 평문으로 저장하지 않는다.
4. Frontend 검증과 별개로 Backend에서도 입력값을 검증한다.
5. API 응답 구조는 일관성을 유지한다.
6. 이미지 원본은 DB가 아닌 서버 파일 시스템에 저장한다.

## 14. TBD 사항

| 항목 | 상태 |
|---|---|
| 관리자 인증 방식 | TBD |
| JWT 사용 여부 | TBD |
| 이미지 업로드 처리 방식 | TBD |
| 게시글 본문 TEXT/JSONB | DATA_MODEL과 연계 |
| 이미지 최대 개수 | TBD |
| 좋아요 중복 방지 | TBD |
| 인기 게시글 기간 | TBD |
| 페이지네이션 상세 규칙 | TBD |
| 댓글 정렬 | TBD |
| 카테고리 삭제 정책 | TBD |
| 댓글 삭제 정책 | TBD |
| Home API 구성 | TBD |

## 15. Traceability

```text
REQ-005
카테고리별 최신 게시글
        ↓
API-013
GET /api/categories/{category_id}/posts/latest
        ↓
Post + Category
```

```text
REQ-028
댓글 답글
        ↓
API-015
POST /api/posts/{post_id}/comments
        ↓
Comment.parent_comment_id
```

```text
REQ-030
게시글 좋아요
        ↓
API-018
POST /api/posts/{post_id}/like
        ↓
PostLike + Post.like_count
```

## 16. 다음 단계

```text
PRD
 ↓
REQUIREMENTS
 ↓
TRD
 ↓
DATA_MODEL
 ↓
API_SPEC       ← 현재
 ↓
COMPONENT_SPEC
 ↓
TEST_CASES
 ↓
Claude.md
 ↓
구현
```

## 17. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-09-15 | 초기 REST API 설계 초안 |
