# SmallWorking API_SPEC

- Document: API_SPEC.md
- Version: 1.0
- Status: Approved (대화 결정 반영)
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.1 / TRD v1.1 / DATA_MODEL v1.0 / DECISIONS DEC-001~008
- 실행 환경: FastAPI on **Vercel Functions** (DEC-007) — 요청 본문 크기 제한(약 4.5MB)과 실행 시간 제한을 고려한다
- Previous: API_SPEC v0.1 (2026-09-15)

---

## 1. 목적

SmallWorking Frontend(React + TypeScript)와 Backend(FastAPI) 사이의 REST API 계약을 정의한다.

```text
React + TypeScript
        ↓ HTTP / JSON (+ 쿠키)
FastAPI Router → Service → Repository
        ↓
SQLAlchemy → PostgreSQL / File Storage
```

**구현과 이 문서가 다르면 이 문서를 먼저 수정한 뒤 코드를 수정한다.**

---

## 2. 기본 규칙

| 항목 | 규칙 |
|---|---|
| API 방식 | REST API |
| Protocol | 개발 HTTP / 운영 **HTTPS** |
| 데이터 형식 | JSON (이미지 업로드만 `multipart/form-data`) |
| 문자 인코딩 | UTF-8 |
| 기본 경로 | `/api` (관리자 전용: `/api/admin`) |
| ID | 숫자형 (`BIGINT`) |
| 날짜/시간 | ISO 8601, 타임존 포함 (예: `2026-09-15T10:00:00+09:00`) |
| 필드 이름 | `snake_case` |
| 성공 | 2xx / 클라이언트 오류 4xx / 서버 오류 5xx |
| 입력 문자열 | 앞뒤 공백을 제거한 뒤 검증한다 (DEC-006) |
| 응답의 민감 정보 | `password`, `password_hash`, `token_hash`, `visitor_key`는 **어떤 응답에도 포함하지 않는다** |

### 2.1 페이징 규칙 (DEC-006)

| 항목 | 규칙 |
|---|---|
| 방식 | 페이지 번호 방식 |
| 파라미터 | `page` (1부터, 기본 1), `size` (기본값은 API별로 지정, 최대 50) |
| 응답 | `{ "items": [...], "page": 1, "size": 12, "total": 25 }` |
| 범위 밖 페이지 | 오류가 아니라 빈 `items` 반환 |

### 2.2 쿠키

| 쿠키 | 용도 | 속성 | 발급 시점 |
|---|---|---|---|
| `sw_session` | 관리자 세션 토큰 (DEC-003) | `HttpOnly`, `Secure`(운영), `SameSite=Lax`, `Path=/` | 로그인 성공 시 |
| `sw_visitor` | 방문자 식별 UUID (DEC-004) | `HttpOnly`, `Secure`(운영), `SameSite=Lax`, `Path=/`, `Max-Age=1년` | 쿠키가 없는 상태에서 좋아요 요청 시 |

> 쿠키는 HttpOnly이므로 Frontend 코드는 쿠키 값을 직접 읽지 않는다. 요청 시 `credentials: 'include'`로 전송만 한다.

### 2.3 CSRF 방어

- 쿠키는 `SameSite=Lax`로 다른 사이트에서 보내는 POST/PUT/DELETE에 포함되지 않는다.
- 추가로 **상태를 바꾸는 요청(POST/PUT/PATCH/DELETE)은 `Origin` 헤더가 허용된 사이트 주소일 때만 처리**한다. 다르면 `403 FORBIDDEN_ORIGIN`.
- 허용 주소는 환경변수(`ALLOWED_ORIGINS`)로 관리한다.
- **[M2 구현 세부]** 다음도 허용한다: `Origin`의 host가 요청을 받은 사이트의 `Host`와 같을 때(같은 사이트). Vercel 미리보기 배포는 주소가 매번 달라 `ALLOWED_ORIGINS`에 미리 넣을 수 없기 때문이다.
- **[M2 구현 세부]** `Origin` 헤더가 **없는** 상태 변경 요청은 거부한다. 브라우저는 GET/HEAD가 아닌 요청에 항상 `Origin`을 붙인다. (Cron이 호출하는 API-028은 GET이라 해당 없음)

### 2.4 라우트 선언 순서

고정 경로가 변수 경로보다 **먼저** 선언되어야 한다 (FastAPI는 선언 순서대로 매칭).

```text
PUT  /api/categories/order        ← 먼저
PUT  /api/categories/{category_id}

GET  /api/posts/latest            ← 먼저
GET  /api/posts/popular           ← 먼저
GET  /api/posts/{post_id}
```

경로 변수는 정수로 선언한다. 정수가 아니면 `422 VALIDATION_ERROR` (TC-VAL-008).

---

## 3. API 목록

| ID | Method | Endpoint | 설명 | 권한 | 변경 |
|---|---|---|---|---|---|
| API-001 | GET | `/api/categories` | 카테고리 목록 | 공개 | |
| API-002 | POST | `/api/categories` | 카테고리 생성 | 관리자 | |
| API-003 | PUT | `/api/categories/{category_id}` | 카테고리 수정 | 관리자 | |
| API-004 | DELETE | `/api/categories/{category_id}` | 카테고리 삭제 | 관리자 | 409 확정 |
| API-005 | PUT | `/api/categories/order` | 카테고리 순서 변경 | 관리자 | |
| API-006 | GET | `/api/posts` | 게시글 목록 | 공개 | 페이징 확정 |
| API-007 | GET | `/api/posts/{post_id}` | 게시글 상세 | 공개 | `liked` 추가 |
| API-008 | POST | `/api/posts` | 게시글 작성 | 관리자 | 이미지 연결 |
| API-009 | PUT | `/api/posts/{post_id}` | 게시글 수정 | 관리자 | 이미지 연결 |
| API-010 | DELETE | `/api/posts/{post_id}` | 게시글 삭제 | 관리자 | CASCADE 확정 |
| API-011 | GET | `/api/posts/latest` | 전체 최신 게시글 | 공개 | |
| API-012 | GET | `/api/posts/popular` | 인기 게시글 | 공개 | 기간 확정 |
| API-013 | GET | `/api/categories/{category_id}/posts/latest` | 카테고리별 최신 게시글 | 공개 | |
| API-014 | GET | `/api/posts/{post_id}/comments` | 댓글 목록 | 공개 | `is_deleted` 추가 |
| API-015 | POST | `/api/posts/{post_id}/comments` | 댓글/답글 작성 | 공개 | |
| API-016 | PUT | `/api/comments/{comment_id}` | 댓글 수정 | 비밀번호 | |
| API-017 | POST | `/api/comments/{comment_id}/delete` | 댓글 삭제 | 비밀번호 | **경로 변경** |
| API-018 | POST | `/api/posts/{post_id}/like` | 게시글 좋아요 | 공개 | `liked` 추가 |
| API-019 | POST | `/api/images` | 이미지 업로드 | 관리자 | 응답 확정 |
| API-020 | DELETE | `/api/images/{image_id}` | 임시 이미지 삭제 | 관리자 | 범위 축소 |
| API-021 | GET | `/api/home` | 홈 화면 데이터 | 공개 | 구성 확정 |
| API-022 | DELETE | `/api/posts/{post_id}/like` | 좋아요 취소 | 공개 | **신규** (DEC-004) |
| API-023 | POST | `/api/admin/login` | 관리자 로그인 | 공개 | **신규** (DEC-003) |
| API-024 | POST | `/api/admin/logout` | 관리자 로그아웃 | 관리자 | **신규** (DEC-003) |
| API-025 | GET | `/api/admin/me` | 로그인 상태 확인 | 관리자 | **신규** (DEC-003) |
| API-026 | GET | `/api/admin/comments` | 관리자 댓글 목록 | 관리자 | **신규** (REQ-035) |
| API-027 | DELETE | `/api/admin/comments/{comment_id}` | 관리자 댓글 삭제 | 관리자 | **신규** (REQ-035) |
| API-028 | GET | `/api/cron/cleanup` | 정리 작업 실행 | Cron 전용 (`CRON_SECRET`) | **신규** (DEC-007) |

> **API-017 경로 변경 이유:** `DELETE` 요청의 본문(body)은 일부 프록시와 클라이언트에서 버려질 수 있다. 비밀번호를 본문으로 안전하게 보내기 위해 `POST .../delete`로 바꾼다.

---

## 4. 공통 데이터 구조

### 4.1 PostSummary (목록·홈에서 사용)

```json
{
  "id": 101,
  "category_id": 1,
  "category_name": "DIY",
  "title": "주방 타일 시공",
  "thumbnail_url": "/uploads/images/2026/11/a8f32c1e_thumb.jpg",
  "like_count": 12,
  "comment_count": 3,
  "created_at": "2026-09-15T10:00:00+09:00",
  "updated_at": "2026-09-15T10:00:00+09:00"
}
```

| 필드 | 설명 |
|---|---|
| `thumbnail_url` | 본문 첫 이미지(`display_order = 0`)의 썸네일. 이미지가 없으면 `null` (DEC-002) |
| `comment_count` | 삭제되지 않은 댓글 + 답글 수 |

### 4.2 Image

```json
{
  "id": 1001,
  "url": "/uploads/images/2026/11/a8f32c1e.jpg",
  "thumbnail_url": "/uploads/images/2026/11/a8f32c1e_thumb.jpg",
  "original_name": "kitchen.jpg",
  "mime_type": "image/jpeg",
  "file_size": 245812,
  "width": 1920,
  "height": 1440
}
```

- `url`, `thumbnail_url`은 서버의 `StorageBackend`가 저장소 키(`file_path`, `thumbnail_path`)로 만든다 (DEC-007).
  - 개발(LocalStorage): `/uploads/<키>` (위 예시)
  - 운영(BlobStorage): Vercel Blob 공개 주소 (예: `https://<store>.public.blob.vercel-storage.com/images/2026/11/a8f32c1e.jpg`)
- Frontend는 주소 형식을 가정하지 않고 받은 `url`을 그대로 사용한다.

### 4.3 Comment

```json
{
  "id": 1,
  "nickname": "작업자",
  "content": "멋지네요.",
  "is_deleted": false,
  "created_at": "2026-09-15T11:00:00+09:00",
  "updated_at": "2026-09-15T11:00:00+09:00",
  "replies": []
}
```

- `is_deleted = true`이면 `nickname`, `content`는 `null`이다. 화면에는 "삭제된 댓글입니다"로 표시한다 (DEC-005).
- `replies`는 최상위 댓글에만 있다. 답글 객체에는 `replies`가 없다.

---

## 5. Category API

### API-001 카테고리 목록

```http
GET /api/categories
```

Response `200`:

```json
{
  "items": [
    { "id": 1, "name": "DIY", "description": "직접 만들어 본 것들", "display_order": 1, "post_count": 12 }
  ]
}
```

- 정렬: `display_order ASC`, 같으면 `id ASC`
- `post_count`: 관리자 화면에서 삭제 가능 여부 안내에 사용

### API-002 카테고리 생성 (관리자)

```http
POST /api/categories
```

Request:

```json
{ "name": "여행", "description": "여행 기록" }
```

| 필드 | 규칙 |
|---|---|
| `name` | 필수, 1~30자, 대소문자 무시 중복 불가 |
| `description` | 선택, 0~200자 |

- `display_order`는 서버가 **현재 최대값 + 1**로 지정한다 (맨 뒤에 추가).

Response `201`: Category 객체

오류: `401 UNAUTHORIZED`, `409 CATEGORY_NAME_DUPLICATED`, `422 VALIDATION_ERROR`

### API-003 카테고리 수정 (관리자)

```http
PUT /api/categories/{category_id}
```

Request: `{ "name": "Travel", "description": "여행 기록" }` (규칙은 API-002와 같음)

Response `200`: Category 객체

오류: `401`, `404 CATEGORY_NOT_FOUND`, `409 CATEGORY_NAME_DUPLICATED`, `422`

### API-004 카테고리 삭제 (관리자, DEC-005)

```http
DELETE /api/categories/{category_id}
```

| 상황 | 응답 |
|---|---|
| 게시글 0개 | `204 No Content` |
| 게시글 1개 이상 | `409 CATEGORY_NOT_EMPTY` — "게시글을 먼저 다른 카테고리로 옮기거나 삭제하세요." |
| 없는 카테고리 | `404 CATEGORY_NOT_FOUND` |

### API-005 카테고리 순서 변경 (관리자)

```http
PUT /api/categories/order
```

Request (원하는 순서대로 **전체** 카테고리 ID 목록):

```json
{ "category_ids": [3, 1, 2, 4] }
```

- 서버는 배열 순서대로 `display_order = 1, 2, 3, ...`을 한 트랜잭션으로 저장한다.
- 목록에 빠진 ID나 없는 ID가 있으면 `422 CATEGORY_ORDER_MISMATCH` (중간에 다른 곳에서 카테고리가 추가·삭제된 경우 대비).

Response `200`: API-001과 같은 형식

> v0.1의 `{id, display_order}` 배열 대신 ID 순서 배열로 단순화했다.

---

## 6. Post API

### API-006 게시글 목록

```http
GET /api/posts?category_id=1&page=1&size=12
```

| Query | 필수 | 기본 | 설명 |
|---|:-:|---|---|
| `category_id` | X | 전체 | 카테고리 필터 |
| `page` | X | 1 | 페이지 번호 |
| `size` | X | **12** | 공개 화면 12, 관리자 화면 20 (DEC-006) |

- 정렬: `created_at DESC` (REQ-023)
- 응답 `items`는 PostSummary. 본문과 이미지 목록은 포함하지 않는다.
- 없는 `category_id` → `404 CATEGORY_NOT_FOUND`

Response `200`:

```json
{ "items": [ /* PostSummary */ ], "page": 1, "size": 12, "total": 25 }
```

### API-007 게시글 상세

```http
GET /api/posts/{post_id}
```

Response `200`:

```json
{
  "id": 101,
  "category_id": 1,
  "category_name": "DIY",
  "title": "주방 타일 시공",
  "content": { "type": "doc", "content": [ /* TipTap 노드 */ ] },
  "images": [ /* Image, display_order 순 */ ],
  "like_count": 12,
  "liked": false,
  "comment_count": 3,
  "created_at": "2026-09-15T10:00:00+09:00",
  "updated_at": "2026-09-15T10:00:00+09:00"
}
```

| 필드 | 설명 |
|---|---|
| `content` | TipTap JSON. `image` 노드는 `attrs.imageId`만 가진다 (DEC-001) |
| `images` | 본문에 쓰인 이미지 목록. Frontend는 `imageId`로 이 목록에서 `url`을 찾아 표시한다 |
| `liked` | 요청한 브라우저(`sw_visitor` 쿠키)가 좋아요를 눌렀는지. 쿠키가 없으면 `false` (DEC-004) |

오류: `404 POST_NOT_FOUND`

### API-008 게시글 작성 (관리자)

```http
POST /api/posts
```

Request:

```json
{
  "category_id": 1,
  "title": "주방 타일 시공",
  "content": { "type": "doc", "content": [ /* ... */ ] }
}
```

#### 검증 규칙

| 대상 | 규칙 | 오류 |
|---|---|---|
| `category_id` | 필수, 존재해야 함 | `422 VALIDATION_ERROR` / `404 CATEGORY_NOT_FOUND` |
| `title` | 필수, 1~200자 | `422 VALIDATION_ERROR` |
| `content` | 필수, TipTap `doc` 구조 | `422 INVALID_CONTENT` |
| 노드·마크·속성 | DATA_MODEL §5.4 허용 목록만 | `422 INVALID_CONTENT` |
| `link.href` | `http://`, `https://`, `mailto:`만 | `422 INVALID_CONTENT` |
| `image` 노드 수 | 최대 20개 | `422 IMAGE_LIMIT_EXCEEDED` |
| `imageId` | 존재해야 함, 다른 글에 연결되지 않아야 함, 본문 안에서 중복 불가 | `422 INVALID_IMAGE_REFERENCE` |

#### 이미지 연결 처리 (DEC-002)

```text
1. content에서 imageId를 등장 순서대로 추출
2. 해당 post_image의 post_id = 새 글, display_order = 0, 1, 2, ...
3. 게시글 저장과 이미지 연결은 한 트랜잭션
```

Response `201`: API-007과 같은 형식

### API-009 게시글 수정 (관리자)

```http
PUT /api/posts/{post_id}
```

Request: API-008과 같은 형식 (전체 교체)

- 검증 규칙은 API-008과 같다. `imageId`는 **이 글에 이미 연결된 이미지이거나 임시 이미지**여야 한다.
- 이미지 처리:
  - 본문에 있는 이미지 → 연결 + 순서 갱신
  - **이 글에 연결돼 있었지만 본문에서 빠진 이미지 → 삭제** (DB 커밋 후 파일 삭제)
- `updated_at` 갱신, `created_at` 유지 (REQ-016)

Response `200`: API-007과 같은 형식

오류: API-008 오류 + `404 POST_NOT_FOUND`

### API-010 게시글 삭제 (관리자, DEC-005)

```http
DELETE /api/posts/{post_id}
```

- 함께 삭제: `post_image`(+ 원본·썸네일 파일), `comment`(댓글·답글), `post_like`
- 파일은 DB 커밋에 성공한 뒤 삭제한다.

Response `204`

오류: `401`, `404 POST_NOT_FOUND`

### API-011 전체 최신 게시글

```http
GET /api/posts/latest?limit=5
```

- `limit` 기본 **5**, 최대 20 (DEC-006)
- 정렬: `created_at DESC`

Response `200`: `{ "items": [ /* PostSummary */ ] }`

### API-012 인기 게시글

```http
GET /api/posts/popular?limit=5
```

- `limit` 기본 **5**, 최대 20 (DEC-006)
- 기간: **전체 기간**
- 정렬: `like_count DESC`, 같으면 `created_at DESC`

Response `200`: `{ "items": [ /* PostSummary */ ] }`

### API-013 카테고리별 최신 게시글

```http
GET /api/categories/{category_id}/posts/latest?limit=3
```

- `limit` 기본 **3**, 최대 20 (DEC-006)

Response `200`:

```json
{ "category": { "id": 1, "name": "DIY" }, "items": [ /* PostSummary */ ] }
```

오류: `404 CATEGORY_NOT_FOUND`

---

## 7. Comment API

### API-014 댓글 목록

```http
GET /api/posts/{post_id}/comments
```

- 정렬: 댓글 `created_at ASC`, 답글도 `created_at ASC` (DEC-006)
- v1.0에서는 페이징 없이 전체 반환
- soft delete된 댓글은 `is_deleted: true`, `nickname`, `content`는 `null`

Response `200`:

```json
{
  "items": [
    {
      "id": 1, "nickname": null, "content": null, "is_deleted": true,
      "created_at": "...", "updated_at": "...",
      "replies": [
        { "id": 2, "nickname": "smallworking", "content": "감사합니다.", "is_deleted": false,
          "created_at": "...", "updated_at": "..." }
      ]
    }
  ]
}
```

오류: `404 POST_NOT_FOUND`

### API-015 댓글/답글 작성

```http
POST /api/posts/{post_id}/comments
```

Request:

```json
{
  "nickname": "홍길동",
  "password": "1234",
  "content": "좋은 글 잘 봤습니다.",
  "parent_comment_id": null
}
```

| 필드 | 규칙 |
|---|---|
| `nickname` | 필수, 2~20자 |
| `password` | 필수, 4~64자 → Argon2 해시로 저장 |
| `content` | 필수, 1~1,000자, 일반 텍스트 |
| `parent_comment_id` | 선택. 값이 있으면 답글 |

#### 답글 검증

| 상황 | 응답 |
|---|---|
| 부모 댓글이 없음 | `404 COMMENT_NOT_FOUND` |
| 부모가 답글임 (2단계 시도) | `422 REPLY_DEPTH_EXCEEDED` (REQ-029) |
| 부모가 다른 게시글의 댓글 | `422 INVALID_PARENT_COMMENT` |
| 부모가 삭제된 댓글 | `422 COMMENT_ALREADY_DELETED` |

Response `201`: Comment 객체

### API-016 댓글 수정

```http
PUT /api/comments/{comment_id}
```

Request:

```json
{ "password": "1234", "content": "수정된 댓글입니다." }
```

| 상황 | 응답 |
|---|---|
| 성공 | `200`, Comment 객체 (`updated_at` 갱신) |
| 비밀번호 불일치 | `403 INVALID_PASSWORD` |
| 삭제된 댓글 | `422 COMMENT_ALREADY_DELETED` |
| 없는 댓글 | `404 COMMENT_NOT_FOUND` |

### API-017 댓글 삭제 (경로 변경)

```http
POST /api/comments/{comment_id}/delete
```

Request:

```json
{ "password": "1234" }
```

삭제 규칙 (DEC-005, DATA_MODEL §7.4):

| 대상 | 처리 |
|---|---|
| 답글 없는 댓글 | 완전 삭제 |
| 답글 | 완전 삭제. 부모가 soft delete 상태이고 남은 답글이 0개면 부모도 완전 삭제 |
| 답글 있는 댓글 | soft delete ("삭제된 댓글입니다") |

| 상황 | 응답 |
|---|---|
| 성공 | `204` |
| 비밀번호 불일치 | `403 INVALID_PASSWORD` |
| 이미 삭제됨 | `422 COMMENT_ALREADY_DELETED` |
| 없는 댓글 | `404 COMMENT_NOT_FOUND` |

---

## 8. Like API (DEC-004)

### API-018 게시글 좋아요

```http
POST /api/posts/{post_id}/like
```

- `sw_visitor` 쿠키가 없으면 서버가 새 UUID를 발급해 `Set-Cookie`로 내려준다.
- 이미 좋아요를 누른 상태면 **오류 없이** 현재 상태를 돌려준다 (멱등).

Response `200`:

```json
{ "post_id": 101, "like_count": 13, "liked": true }
```

오류: `404 POST_NOT_FOUND`

### API-022 좋아요 취소 (신규)

```http
DELETE /api/posts/{post_id}/like
```

- 누른 적이 없거나 쿠키가 없으면 **오류 없이** 현재 상태를 돌려준다 (멱등).

Response `200`:

```json
{ "post_id": 101, "like_count": 12, "liked": false }
```

오류: `404 POST_NOT_FOUND`

> Frontend의 LikeButton은 `liked` 값에 따라 API-018 또는 API-022를 호출한다 (토글).

---

## 9. Image API (DEC-002)

### API-019 이미지 업로드 (관리자)

```http
POST /api/images
Content-Type: multipart/form-data

file = <이미지 파일>
```

#### 업로드 전 브라우저 처리 (DEC-007, COMP-133)

```text
사용자가 원본 선택 (최대 10MB)
   ↓  브라우저(Canvas API): 긴 변 1920px로 축소
   ↓  jpg → jpg / png·webp → webp (품질 0.85) / gif → 변환 안 함
   ↓  결과가 4MB 이하인지 확인
POST /api/images
```

> Vercel 함수는 요청 본문 크기 제한(약 4.5MB)이 있으므로 **서버가 받는 파일은 최대 4MB**로 한다.

#### 서버 검증 및 처리

| 단계 | 규칙 | 오류 |
|---|---|---|
| 용량 | **4MB 이하** (DEC-007) | `413 IMAGE_TOO_LARGE` |
| 형식 | jpg, png, webp, gif — **파일 내용으로 실제 형식 확인** (확장자만 믿지 않음) | `415 UNSUPPORTED_IMAGE_TYPE` |
| 손상 파일 | 이미지로 열 수 없음 | `422 INVALID_IMAGE` |
| 리사이징 | 긴 변이 1920px보다 크면 1920px로 축소 (브라우저 처리를 거치지 않은 요청 방어) | — |
| 썸네일 | 긴 변 400px 썸네일 생성 (Pillow) | — |
| 저장 | `StorageBackend`에 키 `images/YYYY/MM/<무작위이름>.<ext>`로 저장. 원래 파일명은 키에 사용하지 않음 | — |
| DB | `post_image` 생성, `post_id = NULL` (임시 이미지) | — |

> **[M4 구현 세부]**
> - 사진의 EXIF 회전 정보대로 바로 세운 뒤 **다시 저장하므로 EXIF(촬영 위치 GPS 등)가 제거**된다. 개인정보 보호 효과가 있다.
> - **GIF는 움직임을 지키기 위해 원본 그대로 저장**한다 (서버 축소 없음, 썸네일은 첫 장면). 4MB 제한은 그대로 적용된다.
> - 형식을 알 수 없는 파일(텍스트, 동영상, SVG, BMP 등)은 `415`, 형식은 맞지만 손상된 파일은 `422 INVALID_IMAGE`.

Response `201`: Image 객체 (§4.2)

> 게시글당 20장 제한은 업로드 시점이 아니라 **게시글 저장 시점**(API-008/009)에 검사한다. 에디터는 화면에서 개수를 미리 막는다 (COMP-133).
> 업로드 후 24시간 동안 어떤 글에도 연결되지 않으면 다음 정리 작업(API-028, 하루 1회)이 삭제한다.

### API-020 임시 이미지 삭제 (관리자)

```http
DELETE /api/images/{image_id}
```

- **임시 이미지(`post_id = NULL`)만** 삭제할 수 있다. 에디터에서 업로드를 취소할 때 사용한다.
- 글에 연결된 이미지는 본문에서 빼고 글을 저장하면 서버가 삭제한다 (API-009).

| 상황 | 응답 |
|---|---|
| 성공 | `204` |
| 글에 연결된 이미지 | `409 IMAGE_IN_USE` |
| 없는 이미지 | `404 IMAGE_NOT_FOUND` |

### 이미지 파일 제공 (DEC-007)

| 환경 | 제공 방식 |
|---|---|
| 개발 (LocalStorage) | FastAPI StaticFiles로 `GET /uploads/<키>` 제공. 응답 헤더: 저장된 MIME 타입, `X-Content-Type-Options: nosniff` |
| 운영 (BlobStorage) | **Vercel Blob 공개 주소에서 브라우저가 직접 받는다** (FastAPI를 거치지 않음). 업로드 시 `contentType`을 서버가 검사한 실제 형식으로 지정한다 |

> 운영에서 이미지가 FastAPI 함수를 거치지 않으므로 함수 실행 비용과 응답 크기 제한에 영향을 주지 않는다.

---

## 10. Home API

### API-021 홈 화면 데이터

```http
GET /api/home
```

Response `200`:

```json
{
  "categories": [
    {
      "id": 1,
      "name": "DIY",
      "description": "직접 만들어 본 것들",
      "latest_posts": [ /* PostSummary, 최대 3개 */ ]
    },
    {
      "id": 5,
      "name": "여행",
      "description": null,
      "latest_posts": []
    }
  ],
  "latest_posts": [ /* PostSummary, 최대 5개 */ ],
  "popular_posts": [ /* PostSummary, 최대 5개 */ ]
}
```

| 영역 | 개수 | 정렬 |
|---|---:|---|
| `categories` | 전체 | `display_order ASC` (REQ-008, 013) |
| `categories[].latest_posts` | 3 | `created_at DESC` |
| `latest_posts` | 5 | `created_at DESC` |
| `popular_posts` | 5 | `like_count DESC, created_at DESC` (전체 기간) |

- 글이 없는 카테고리도 `latest_posts: []`로 포함한다 (화면에서 "아직 글이 없습니다" 표시).
- 개수는 서버 설정값으로 두어 나중에 바꿀 수 있게 한다.

---

## 11. Admin API (DEC-003, REQ-035)

### API-023 관리자 로그인

```http
POST /api/admin/login
```

Request:

```json
{ "username": "admin", "password": "********" }
```

| 상황 | 응답 |
|---|---|
| 성공 | `200`, `Set-Cookie: sw_session=...`, `{ "username": "admin" }` |
| 아이디 또는 비밀번호 불일치 | `401 INVALID_CREDENTIALS` (어느 쪽이 틀렸는지 알려주지 않음) |
| 잠금 상태 (5회 실패 후 10분) | `423 ACCOUNT_LOCKED`, `{ "locked_until": "..." }` |

### API-024 관리자 로그아웃

```http
POST /api/admin/logout
```

- 서버 세션 삭제 + `sw_session` 쿠키 만료
- Response `204`

### API-025 로그인 상태 확인

```http
GET /api/admin/me
```

| 상황 | 응답 |
|---|---|
| 유효한 세션 | `200`, `{ "username": "admin" }` |
| 세션 없음·만료 | `401 UNAUTHORIZED` |

- COMP-100 RequireAdmin이 관리자 화면에 들어갈 때 호출한다.

### API-026 관리자 댓글 목록

```http
GET /api/admin/comments?page=1&size=20
```

- 정렬: `created_at DESC` (최신 댓글이 위)
- 댓글과 답글을 **평평한 목록**으로 반환한다. soft delete된 댓글은 제외한다.

Response `200`:

```json
{
  "items": [
    {
      "id": 15,
      "post_id": 101,
      "post_title": "주방 타일 시공",
      "parent_comment_id": null,
      "nickname": "홍길동",
      "content": "좋은 글 잘 봤습니다.",
      "reply_count": 2,
      "created_at": "..."
    }
  ],
  "page": 1, "size": 20, "total": 48
}
```

### API-027 관리자 댓글 삭제

```http
DELETE /api/admin/comments/{comment_id}
```

- 비밀번호 확인 없이 삭제한다. 삭제 규칙은 API-017과 같다 (DEC-005).
- Response `204`
- 오류: `404 COMMENT_NOT_FOUND`, `422 COMMENT_ALREADY_DELETED`

### API-028 정리 작업 (Cron 전용, DEC-007)

```http
GET /api/cron/cleanup
Authorization: Bearer <CRON_SECRET>
```

- **Vercel Cron Jobs가 하루 1회 호출**한다 (`vercel.json`의 `crons` 설정).
- `Authorization` 헤더가 환경변수 `CRON_SECRET`과 일치하지 않으면 `401 UNAUTHORIZED`. 관리자 세션으로는 호출할 수 없다.
- 실행 내용 (DATA_MODEL §15):
  1. 24시간 지난 임시 이미지 삭제 (DB + 저장소)
  2. 저장소에만 있고 DB에 없는 파일 삭제 (생성 후 24시간 지난 것만)
  3. 만료된 관리자 세션 삭제
- 같은 날 여러 번 호출되어도 문제가 없어야 한다 (멱등).
- 실행 시간 제한을 넘지 않도록 한 번에 처리하는 개수를 제한하고, 남은 것은 다음 실행에서 처리한다.

Response `200`:

```json
{ "deleted_temp_images": 3, "deleted_orphan_files": 0, "deleted_sessions": 2 }
```

> 개발 환경에서는 같은 기능을 관리 명령(예: `python -m app.cli cleanup`)으로 실행한다.

---

## 12. 공통 오류 응답

모든 오류는 같은 형식을 사용한다.

```json
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "게시글을 찾을 수 없습니다.",
    "details": null
  }
}
```

- `details`: 입력값 검증 오류일 때 필드별 정보 (예: `[{ "field": "title", "reason": "1~200자" }]`)
- `message`는 사용자에게 바로 보여줄 수 있는 한국어 문장이다 (REQ-041).
- FastAPI 기본 `422` 응답도 이 형식으로 변환한다.

### 12.1 HTTP Status

| Status | 의미 |
|---:|---|
| 200 | 정상 처리 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 (본문 없음) |
| 401 | 인증 필요 / 로그인 실패 |
| 403 | 권한 없음 (댓글 비밀번호 불일치, 허용되지 않은 Origin) |
| 404 | 대상 없음 |
| 409 | 데이터 충돌 |
| 413 | 파일 용량 초과 |
| 415 | 지원하지 않는 파일 형식 |
| 422 | 입력값 검증 실패 |
| 423 | 계정 잠금 |
| 500 | 서버 오류 (내부 정보는 응답에 노출하지 않음) |

### 12.2 오류 코드 목록

| 코드 | Status | 메시지 (예) |
|---|---:|---|
| `VALIDATION_ERROR` | 422 | 입력값을 확인해 주세요. |
| `UNAUTHORIZED` | 401 | 로그인이 필요합니다. |
| `INVALID_CREDENTIALS` | 401 | 아이디 또는 비밀번호가 올바르지 않습니다. |
| `ACCOUNT_LOCKED` | 423 | 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요. |
| `FORBIDDEN_ORIGIN` | 403 | 허용되지 않은 요청입니다. |
| `CATEGORY_NOT_FOUND` | 404 | 카테고리를 찾을 수 없습니다. |
| `CATEGORY_NAME_DUPLICATED` | 409 | 이미 있는 카테고리 이름입니다. |
| `CATEGORY_NOT_EMPTY` | 409 | 게시글을 먼저 다른 카테고리로 옮기거나 삭제하세요. |
| `CATEGORY_ORDER_MISMATCH` | 422 | 카테고리 목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요. |
| `POST_NOT_FOUND` | 404 | 게시글을 찾을 수 없습니다. |
| `INVALID_CONTENT` | 422 | 본문 형식이 올바르지 않습니다. |
| `IMAGE_LIMIT_EXCEEDED` | 422 | 이미지는 게시글당 20장까지 넣을 수 있습니다. |
| `INVALID_IMAGE_REFERENCE` | 422 | 본문의 이미지 정보가 올바르지 않습니다. |
| `IMAGE_NOT_FOUND` | 404 | 이미지를 찾을 수 없습니다. |
| `IMAGE_IN_USE` | 409 | 게시글에 사용 중인 이미지입니다. |
| `IMAGE_TOO_LARGE` | 413 | 이미지 파일이 너무 큽니다. (원본 10MB까지, 줄인 뒤 4MB 이하) |
| `UNSUPPORTED_IMAGE_TYPE` | 415 | jpg, png, webp, gif 이미지만 올릴 수 있습니다. |
| `INVALID_IMAGE` | 422 | 이미지 파일을 읽을 수 없습니다. |
| `COMMENT_NOT_FOUND` | 404 | 댓글을 찾을 수 없습니다. |
| `INVALID_PASSWORD` | 403 | 비밀번호가 일치하지 않습니다. |
| `REPLY_DEPTH_EXCEEDED` | 422 | 답글에는 답글을 달 수 없습니다. |
| `INVALID_PARENT_COMMENT` | 422 | 답글을 달 댓글이 올바르지 않습니다. |
| `COMMENT_ALREADY_DELETED` | 422 | 삭제된 댓글입니다. |
| `INTERNAL_ERROR` | 500 | 잠시 후 다시 시도해 주세요. |

---

## 13. 권한

| 기능 | Visitor | Admin |
|---|:-:|:-:|
| 카테고리·게시글·댓글 조회, 홈 | O | O |
| 카테고리 생성/수정/삭제/순서 | X | O |
| 게시글 작성/수정/삭제 | X | O |
| 이미지 업로드/임시 이미지 삭제 | X | O |
| 댓글 작성 | O | O |
| 댓글 수정/삭제 (API-016/017) | 비밀번호 | 비밀번호 |
| 관리자 댓글 목록/삭제 (API-026/027) | X | O |
| 게시글 좋아요/취소 | O | O |

- **관리자 API는 유효한 `sw_session`이 없으면 항상 `401 UNAUTHORIZED`** (REQ-042). 공통 의존성(dependency) 하나로 처리한다.
- 관리자가 공개 댓글 화면에서 댓글을 지울 때도 비밀번호가 필요하다. 비밀번호 없는 삭제는 관리자 댓글 화면(API-027)에서만 한다.

---

## 14. API와 DB 관계

| API | 주요 테이블 |
|---|---|
| API-001~005 | `category` (+ `post` 건수) |
| API-006, 011~013 | `post`, `category`, `post_image`(썸네일), `comment`(건수) |
| API-007 | `post`, `post_image`, `post_like`(liked) |
| API-008~010 | `post`, `post_image`, `comment`, `post_like` |
| API-014~017 | `comment` |
| API-018, 022 | `post_like`, `post.like_count` |
| API-019, 020 | `post_image` + 파일 시스템 |
| API-021 | `category`, `post`, `post_image`, `comment` |
| API-023~025 | `admin_user`, `admin_session` |
| API-026, 027 | `comment`, `post` |

---

## 15. 설계 원칙

1. Frontend는 DB와 파일 시스템에 직접 접근하지 않는다.
2. 모든 입력값은 Backend(Pydantic 스키마)에서 다시 검증한다.
3. 비밀번호는 Argon2 해시로만 저장하고, 어떤 응답에도 해시나 원문을 넣지 않는다.
4. 본문은 허용된 TipTap 노드만 저장하고, 화면은 허용된 노드만 렌더링한다 (XSS 방어).
5. 같은 요청을 반복해도 결과가 같아야 하는 동작(좋아요/취소)은 멱등하게 만든다.
6. 파일 삭제는 DB 커밋 이후에 한다.
7. 오류 응답은 항상 §12 형식을 따른다.

---

## 16. TBD 사항

| 항목 | 상태 |
|---|---|
| 관리자 인증 / JWT 여부 | ✅ DEC-003 (세션) |
| 이미지 업로드 처리 / 최대 개수 | ✅ DEC-002 |
| 게시글 본문 형식 | ✅ DEC-001 (JSONB) |
| 좋아요 중복 방지 | ✅ DEC-004 |
| 인기 게시글 기간 / 페이지네이션 / 댓글 정렬 / Home 구성 | ✅ DEC-006 |
| 카테고리 / 댓글 삭제 정책 | ✅ DEC-005 |
| 이미지 정적 파일 제공 방식 (운영) | ✅ DEC-007 (Vercel Blob 공개 주소) |
| 정리 작업 실행 방식 | ✅ DEC-007 (Vercel Cron → API-028) |
| API 요청 횟수 제한 (댓글 도배 방지 등) | v1.0 범위 외, 운영 후 필요 시 검토 |

---

## 17. Traceability

| REQ | API |
|---|---|
| REQ-004~008 | API-021 (API-011~013) |
| REQ-009~013 | API-001~005 |
| REQ-014~017 | API-008~010 |
| REQ-018~020 | API-019, 020, 008, 009 |
| REQ-022 | API-007 |
| REQ-023 | API-006 |
| REQ-024~029 | API-014~017 |
| REQ-030, 032 | API-018, 022 |
| REQ-033 | API-006, 010 |
| REQ-035 | API-026, 027 |
| REQ-038, 039 | 각 API 검증 규칙, §12 |
| REQ-040, 041 | §12 오류 응답 |
| REQ-042 | API-023~025, §13 |
| REQ-043 | API-015~017, 023 |
| REQ-044 | API-008, 009 (INVALID_CONTENT) |

---

## 18. 다음 단계

```text
DATA_MODEL v1.0     ✅
API_SPEC v1.0       ← 현재 (완료)
COMPONENT_SPEC v1.0 ← 다음
TEST_CASES v1.0
TRD / REQUIREMENTS v1.1
Claude.md
구현
```

---

## 19. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-09-15 | 초기 REST API 설계 초안 |
| 1.0 | 2026-11-03 | DEC-001~006 반영: 인증 API(023~025), 좋아요 취소(022), 관리자 댓글 API(026, 027) 신규, API-017 경로 변경, API-005 요청 형식 단순화, API-020 임시 이미지 전용, 공통 구조·페이징·쿠키·CSRF·라우트 순서 규칙, 오류 코드 목록 확정 |
| 1.0 (개정) | 2026-11-03 | DEC-007 반영: Vercel Functions 실행 환경, 업로드 크기 4MB + 브라우저 사전 축소, 이미지 주소는 StorageBackend가 생성(운영: Vercel Blob), 정리 작업 API-028 신규 |
