# SmallWorking DATA_MODEL

- Document: DATA_MODEL.md
- Version: 1.0
- Status: Approved (대화 결정 반영)
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.1 / TRD v1.1 / DECISIONS DEC-001~008
- Previous: DATA_MODEL v0.1 (2026-09-15)

---

## 1. 목적

이 문서는 SmallWorking에서 사용하는 PostgreSQL 데이터베이스 구조를 정의한다.

```text
DATA_MODEL.md
      ↓
SQLAlchemy Model   (backend/app/models)
      ↓
Alembic Migration
      ↓
PostgreSQL Table
```

이 문서는 실제 운영 DB 구조를 결정하는 기준 문서다. **코드의 모델과 이 문서가 다르면 이 문서를 먼저 수정한 뒤 코드를 수정한다.**

---

## 2. 데이터베이스 기본 원칙

| 항목 | 결정 | 근거 |
|---|---|---|
| DBMS | PostgreSQL | TRD |
| ORM | SQLAlchemy | TRD |
| Migration | **Alembic** (확정) | — |
| PK 타입 | `BIGINT` IDENTITY (자동 증가) | — |
| 시간 타입 | `TIMESTAMPTZ`, 서버에서 UTC로 저장 | — |
| 문자 인코딩 | UTF-8 | — |
| 이미지 원본 | 저장소(`StorageBackend`) — 개발: 로컬 폴더 / 운영: Vercel Blob. DB에는 메타데이터와 저장소 키만 | TRD §10, DEC-002, **DEC-007** |
| 운영 DB | Neon PostgreSQL (Vercel Marketplace) | DEC-007 |
| 게시글 본문 | TipTap JSON → `JSONB` | DEC-001 |
| 관리자 인증 | 서버 세션 (`admin_session`) | DEC-003 |
| 비밀번호 해시 | **Argon2** (관리자, 댓글 공통) | DEC-003 |
| 좋아요 중복 방지 | 쿠키 `visitor_key` + UNIQUE | DEC-004 |
| 삭제 정책 | 카테고리 RESTRICT / 게시글 CASCADE / 댓글 조건부 soft delete | DEC-005 |
| 입력 길이 | DEC-006 제한 값에 맞춰 컬럼 길이 지정 | DEC-006 |

### 2.1 명명 규칙

- 테이블명, 컬럼명: `snake_case`, 테이블명은 단수형 (`post`, `comment`)
- FK 컬럼: `<참조테이블>_id`
- 시간 컬럼: `created_at`, `updated_at` (모든 주요 테이블 공통)
- 제약조건 이름: `pk_<table>`, `fk_<table>_<column>`, `uq_<table>_<columns>`, `ck_<table>_<rule>`, `ix_<table>_<columns>`

---

## 3. 전체 테이블 구성

초기 버전은 **7개 테이블**을 사용한다. (v0.1의 5개 + 관리자 2개)

```text
Category
   │ 1
   └──< Post                         (ON DELETE RESTRICT)
          │ 1
          ├──< PostImage             (ON DELETE CASCADE, post_id NULL = 임시 이미지)
          ├──< Comment               (ON DELETE CASCADE)
          │       │ 1
          │       └──< Comment (Reply, 1단계)
          └──< PostLike              (ON DELETE CASCADE)

AdminUser
   │ 1
   └──< AdminSession                 (ON DELETE CASCADE)
```

| 테이블 | 역할 | 변경 (v0.1 대비) |
|---|---|---|
| `category` | 게시글 분류 | 컬럼 길이 조정 |
| `post` | 게시글 본문 및 기본 정보 | `content` JSONB 확정, `title` 길이 조정 |
| `post_image` | 게시글 이미지 메타데이터 | `post_id` NULL 허용, 썸네일·크기 컬럼 추가 |
| `comment` | 댓글 및 답글 | `is_deleted` 추가, soft delete 위해 일부 컬럼 NULL 허용 |
| `post_like` | 게시글 좋아요 기록 | `visitor_key` NOT NULL + UNIQUE 확정 |
| `admin_user` | 관리자 계정 | **신규** |
| `admin_session` | 관리자 로그인 세션 | **신규** |

---

# 4. category

## 4.1 목적

DIY, Portfolio, Blog, Board와 같은 게시글 카테고리를 저장한다. 관리자가 추가·수정·삭제·순서 변경할 수 있다.

## 4.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| name | VARCHAR(30) | NO | — | 카테고리 이름 (1~30자) |
| description | VARCHAR(200) | YES | NULL | 카테고리 설명 (0~200자) |
| display_order | INTEGER | NO | — | 화면 표시 순서 |
| created_at | TIMESTAMPTZ | NO | `now()` | 생성 시각 |
| updated_at | TIMESTAMPTZ | NO | `now()` | 수정 시각 |

## 4.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_category` | `id` |
| `uq_category_name` | `name` 중복 불가 (대소문자 구분 없이: `UNIQUE (lower(name))` 인덱스) |
| `ck_category_display_order` | `display_order >= 0` |

- 순서 변경(API-005)은 한 트랜잭션에서 전체 순서를 다시 저장한다. `display_order` 자체에는 UNIQUE를 두지 않는다 (순서 교체 중 충돌 방지).

## 4.4 초기 데이터 (Seed, REQ-009)

Alembic 초기 마이그레이션에서 다음 4개를 생성한다.

| name | description | display_order |
|---|---|---:|
| DIY | 직접 만들어 본 것들 | 1 |
| Portfolio | 프로젝트와 작업물 | 2 |
| Blog | 일상, 생각, 경험의 기록 | 3 |
| Board | 자유로운 이야기 | 4 |

> 기본 카테고리도 일반 카테고리와 같은 규칙으로 수정·삭제할 수 있다 (고정 카테고리 아님, PRD §5).

---

# 5. post

## 5.1 목적

게시글을 저장한다. 게시글은 반드시 하나의 카테고리에 속한다 (REQ-015). 작성자는 항상 운영자이므로 작성자 컬럼을 두지 않는다.

## 5.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| category_id | BIGINT | NO | — | FK → `category.id` |
| title | VARCHAR(200) | NO | — | 제목 (1~200자) |
| content | JSONB | NO | — | TipTap 문서 JSON (DEC-001) |
| like_count | INTEGER | NO | `0` | 좋아요 수 (집계 캐시) |
| created_at | TIMESTAMPTZ | NO | `now()` | 작성 시각 |
| updated_at | TIMESTAMPTZ | NO | `now()` | 수정 시각 |

## 5.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_post` | `id` |
| `fk_post_category_id` | `category_id` → `category.id` **ON DELETE RESTRICT** (DEC-005) |
| `ck_post_like_count` | `like_count >= 0` |

## 5.4 content 구조 (DEC-001)

```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph",
      "content": [{ "type": "text", "text": "오늘은 타일 작업을 했다." }] },
    { "type": "image", "attrs": { "imageId": 15 } },
    { "type": "paragraph",
      "content": [{ "type": "text", "text": "생각보다 쉽지 않았다." }] }
  ]
}
```

### 허용 노드 / 마크 (서버 검증 기준)

| 구분 | 허용 |
|---|---|
| 노드 | `doc`, `paragraph`, `text`, `heading`(level 2~3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `horizontalRule`, `hardBreak`, `image` |
| 마크 | `bold`, `italic`, `strike`, `code`, `link` |
| `image.attrs` | `imageId`(필수, 정수)와 `alt`(선택)만 허용. **`src`는 저장하지 않는다** (표시할 때 `post_image`에서 경로를 찾음) |
| `link.attrs` | `href`만 허용, `http://`, `https://`, `mailto:`로 시작하는 경우만 허용 |

- **[M5 구현 세부] 노드 속성 추가 허용** (TipTap이 기본으로 만드는 값, 보안 영향 없음):
  `heading.level`(2·3만), `orderedList.start`(1 이상 정수), `codeBlock.language`(30자 이하 문자열 또는 null). 값이 `null`인 선택 속성은 "없음"으로 본다.
- **[M5 구현 세부] 빈 본문 거부:** 공백이 아닌 글자나 이미지가 하나도 없으면 `422 VALIDATION_ERROR`(field `content`, REQ-038).
- 허용되지 않은 노드·마크·속성이 있으면 저장을 거부한다 (`422`).
- `image` 노드 수는 최대 **20개** (DEC-002).
- 같은 `imageId`가 본문에 두 번 나오면 거부한다.

> 정확한 허용 목록은 COMPONENT_SPEC의 에디터 툴바 구성과 일치해야 한다.

---

# 6. post_image

## 6.1 목적

게시글 이미지의 메타데이터를 저장한다. **이미지 파일 자체는 DB에 저장하지 않는다** (TRD §10).

```text
이미지 파일 (리사이즈본 + 썸네일)        →  StorageBackend (개발: 로컬 폴더 / 운영: Vercel Blob)
이미지 정보 (저장소 키, 크기, 순서, 소속 글) →  PostgreSQL
```

## 6.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK, 본문 `imageId`가 참조 |
| post_id | BIGINT | **YES** | NULL | FK → `post.id`. **NULL이면 아직 글에 연결되지 않은 임시 이미지** |
| file_name | VARCHAR(100) | NO | — | 서버가 생성한 무작위 파일명 (예: `a8f32c1e....jpg`) |
| file_path | VARCHAR(300) | NO | — | **저장소 키** (예: `images/2026/11/a8f32c1e.jpg`). 로컬이면 `UPLOAD_ROOT` 기준 상대 경로, Blob이면 pathname |
| thumbnail_path | VARCHAR(300) | NO | — | 썸네일 저장소 키 (예: `images/2026/11/a8f32c1e_thumb.jpg`) |
| original_name | VARCHAR(255) | YES | NULL | 업로드한 원래 파일 이름 (표시·참고용) |
| mime_type | VARCHAR(50) | NO | — | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| file_size | BIGINT | NO | — | 저장된 파일 크기 (Byte, 리사이즈 후, 최대 4MB — DEC-007) |
| width | INTEGER | NO | — | 저장된 이미지 가로 픽셀 |
| height | INTEGER | NO | — | 저장된 이미지 세로 픽셀 |
| display_order | INTEGER | YES | NULL | 본문에 등장하는 순서 (0부터). 임시 이미지는 NULL |
| created_at | TIMESTAMPTZ | NO | `now()` | 업로드 시각 |

## 6.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_post_image` | `id` |
| `fk_post_image_post_id` | `post_id` → `post.id` **ON DELETE CASCADE** (DEC-005) |
| `ck_post_image_mime_type` | `mime_type IN ('image/jpeg','image/png','image/webp','image/gif')` |
| `ck_post_image_file_size` | `file_size > 0` |
| `ck_post_image_order` | `post_id IS NULL OR display_order IS NOT NULL` (글에 연결된 이미지는 순서 필수) |

## 6.4 이미지 생명주기 (DEC-002)

```text
① 업로드 (API-019)
   post_id = NULL, display_order = NULL   ← 임시 이미지
        ↓
② 게시글 저장 (API-008 / API-009)
   content에서 imageId 목록 추출 (등장 순서대로)
   ├─ 본문에 있는 이미지 → post_id = 해당 글, display_order = 등장 순서
   ├─ 다른 글에 이미 연결된 imageId → 저장 거부 (422)
   ├─ 존재하지 않는 imageId → 저장 거부 (422)
   └─ 이 글에 연결돼 있었지만 본문에서 빠진 이미지 → 삭제 (DB + 파일)
        ↓
③ 정리 작업 (Vercel Cron, 하루 1회 — DEC-007)
   post_id IS NULL AND created_at < now() - 24시간 → 삭제 (DB + 파일)
```

- **대표 이미지(썸네일)**: `display_order = 0`인 이미지 = 본문 첫 이미지 (DEC-002). 별도 컬럼을 두지 않는다.
- 저장소 키 규칙: `images/YYYY/MM/<무작위이름>.<ext>` (DEC-007)
  - 개발(LocalStorage): `<UPLOAD_ROOT>/` + 키 위치에 파일 저장
  - 운영(BlobStorage): Vercel Blob public store에 같은 키(pathname)로 저장
- DB에는 **저장소 키만** 저장한다. 공개 주소(URL)는 `StorageBackend`가 키로 만든다. 저장소를 바꿔도 DB 값은 그대로다.

---

# 7. comment

## 7.1 목적

방문자가 작성하는 댓글과 답글을 저장한다. 방문자는 회원가입하지 않으며 닉네임 + 비밀번호를 사용한다 (REQ-024).

## 7.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| post_id | BIGINT | NO | — | FK → `post.id` |
| parent_comment_id | BIGINT | YES | NULL | FK → `comment.id`. NULL이면 일반 댓글, 값이 있으면 답글 |
| nickname | VARCHAR(20) | **YES** | — | 작성자 닉네임 (2~20자). soft delete 시 NULL |
| password_hash | VARCHAR(255) | **YES** | — | Argon2 해시. soft delete 시 NULL |
| content | VARCHAR(1000) | **YES** | — | 댓글 내용 (1~1,000자, 일반 텍스트). soft delete 시 NULL |
| is_deleted | BOOLEAN | NO | `false` | soft delete 여부 (DEC-005) |
| created_at | TIMESTAMPTZ | NO | `now()` | 작성 시각 |
| updated_at | TIMESTAMPTZ | NO | `now()` | 수정 시각 |
| deleted_at | TIMESTAMPTZ | YES | NULL | soft delete 시각 |

> `nickname`, `password_hash`, `content`의 NULL 허용은 **soft delete된 댓글만을 위한 것**이다. 정상 댓글은 반드시 값이 있어야 한다 (아래 CHECK 제약).

## 7.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_comment` | `id` |
| `fk_comment_post_id` | `post_id` → `post.id` **ON DELETE CASCADE** |
| `fk_comment_parent_comment_id` | `parent_comment_id` → `comment.id` **ON DELETE CASCADE** |
| `ck_comment_not_self_parent` | `parent_comment_id IS NULL OR parent_comment_id <> id` |
| `ck_comment_alive_fields` | `is_deleted = true OR (nickname IS NOT NULL AND password_hash IS NOT NULL AND content IS NOT NULL)` |
| `ck_comment_deleted_at` | `(is_deleted = false AND deleted_at IS NULL) OR (is_deleted = true AND deleted_at IS NOT NULL)` |

### 애플리케이션 검증 (DB 제약으로 표현하기 어려운 규칙)

| 규칙 | 내용 | REQ |
|---|---|---|
| 답글 깊이 1단계 | 부모 댓글의 `parent_comment_id`가 NULL이어야 함 (답글에는 답글 불가) | REQ-029 |
| 같은 게시글 | 부모 댓글의 `post_id` = 새 답글의 `post_id` | REQ-029 |
| 삭제된 댓글 | `is_deleted = true`인 댓글은 수정 불가, 새 답글 불가 | DEC-005 |
| 비밀번호 | 원문은 저장하지 않고 Argon2 해시만 저장 | REQ-043 |

## 7.4 댓글 삭제 규칙 (DEC-005)

```text
댓글 삭제 요청 (방문자: 비밀번호 확인 / 관리자: 확인 없음)
   │
   ├─ 답글인가?                       → 완전 삭제 (DELETE)
   │     └─ 부모가 is_deleted=true이고 남은 답글이 0개 → 부모도 완전 삭제
   │
   └─ 일반 댓글인가?
         ├─ 답글 0개                  → 완전 삭제 (DELETE)
         └─ 답글 1개 이상             → soft delete
                                         is_deleted = true
                                         deleted_at = now()
                                         nickname, password_hash, content = NULL
```

화면에는 soft delete된 댓글이 **"삭제된 댓글입니다"**로 표시되고 답글은 유지된다.

---

# 8. post_like

## 8.1 목적

게시글 좋아요 기록을 저장한다. `post.like_count`는 이 테이블의 건수를 캐시한 값이다.

## 8.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| post_id | BIGINT | NO | — | FK → `post.id` |
| visitor_key | VARCHAR(64) | NO | — | 쿠키 `sw_visitor`의 UUID 값 (DEC-004) |
| created_at | TIMESTAMPTZ | NO | `now()` | 좋아요 시각 |

## 8.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_post_like` | `id` |
| `fk_post_like_post_id` | `post_id` → `post.id` **ON DELETE CASCADE** |
| `uq_post_like_post_visitor` | `(post_id, visitor_key)` **UNIQUE** — 같은 방문자는 같은 글에 1회만 |

## 8.4 like_count 갱신 규칙 (DEC-004)

| 동작 | 처리 (하나의 트랜잭션) |
|---|---|
| 좋아요 | `INSERT ... ON CONFLICT (post_id, visitor_key) DO NOTHING` → 실제로 추가됐을 때만 `like_count + 1` |
| 좋아요 취소 | `DELETE ... WHERE post_id = ? AND visitor_key = ?` → 실제로 삭제됐을 때만 `like_count - 1` |

- 같은 요청을 여러 번 보내도 결과가 같다 (멱등).
- `like_count`와 `post_like` 건수는 항상 일치해야 한다 (TC-LIKE-004).

---

# 9. admin_user (신규, DEC-003)

## 9.1 목적

관리자(운영자) 계정을 저장한다. v1.0에서는 **1명**만 사용한다.

## 9.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| username | VARCHAR(50) | NO | — | 로그인 ID |
| password_hash | VARCHAR(255) | NO | — | Argon2 해시 |
| failed_login_count | INTEGER | NO | `0` | 연속 로그인 실패 횟수 |
| locked_until | TIMESTAMPTZ | YES | NULL | 잠금 해제 시각 (5회 실패 시 now + 10분) |
| last_login_at | TIMESTAMPTZ | YES | NULL | 마지막 로그인 시각 |
| created_at | TIMESTAMPTZ | NO | `now()` | 생성 시각 |
| updated_at | TIMESTAMPTZ | NO | `now()` | 수정 시각 |

## 9.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_admin_user` | `id` |
| `uq_admin_user_username` | `username` 중복 불가 |
| `ck_admin_user_failed_count` | `failed_login_count >= 0` |

## 9.4 계정 생성과 로그인 규칙

- **초기 계정**: **관리 명령**(예: `python -m app.cli create-admin`)으로 1회 생성한다. 명령은 `admin_user`가 비어 있을 때만 환경변수 `ADMIN_USERNAME`, `ADMIN_PASSWORD`로 계정을 만들고, 이미 있으면 아무것도 하지 않는다. Vercel 함수에는 "서버 시작" 시점이 없으므로 자동 생성하지 않는다 (DEC-007). 코드에 계정 정보를 하드코딩하지 않는다.
- 로그인 성공 → `failed_login_count = 0`, `locked_until = NULL`, `last_login_at = now()`
- 로그인 실패 → `failed_login_count + 1`. 5회에 도달하면 `locked_until = now() + 10분`
- `locked_until > now()`이면 비밀번호가 맞아도 로그인 거부

---

# 10. admin_session (신규, DEC-003)

## 10.1 목적

관리자 로그인 세션을 저장한다. 브라우저에는 세션 토큰만 HttpOnly 쿠키로 전달한다.

## 10.2 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|:-:|---|---|
| id | BIGINT IDENTITY | NO | 자동 | PK |
| admin_user_id | BIGINT | NO | — | FK → `admin_user.id` |
| token_hash | VARCHAR(64) | NO | — | 세션 토큰의 SHA-256 해시 (토큰 원문은 저장하지 않음) |
| created_at | TIMESTAMPTZ | NO | `now()` | 로그인 시각 |
| last_active_at | TIMESTAMPTZ | NO | `now()` | 마지막 활동 시각 |
| expires_at | TIMESTAMPTZ | NO | — | 절대 만료 시각 (created_at + 7일) |

## 10.3 제약조건

| 이름 | 내용 |
|---|---|
| `pk_admin_session` | `id` |
| `fk_admin_session_admin_user_id` | `admin_user_id` → `admin_user.id` **ON DELETE CASCADE** |
| `uq_admin_session_token_hash` | `token_hash` 중복 불가 |

## 10.4 세션 유효성 규칙

세션은 다음을 **모두** 만족할 때만 유효하다.

```text
now() < expires_at                         (최대 7일)
AND
now() < last_active_at + 2시간              (2시간 비활동 시 만료)
```

- 유효한 요청이 오면 `last_active_at`을 갱신한다.
- 로그아웃 → 해당 세션 레코드 즉시 삭제
- 만료된 세션은 정리 작업에서 삭제한다.

---

# 11. 테이블 관계 (ERD)

```text
┌───────────────┐
│   category    │
│───────────────│
│ id PK         │
│ name UQ       │
│ display_order │
└───────┬───────┘
        │ 1
        │  ON DELETE RESTRICT
        │ N
┌───────▼────────────┐
│       post         │
│────────────────────│
│ id PK              │
│ category_id FK     │
│ title              │
│ content JSONB      │
│ like_count         │
└──┬────────┬─────┬──┘
   │ 1      │ 1   │ 1
   │CASCADE │     │ CASCADE
   │ N      │     │ N
┌──▼─────────────┐ │ ┌───────────────────────┐
│  post_image    │ │ │      post_like        │
│────────────────│ │ │───────────────────────│
│ id PK          │ │ │ id PK                 │
│ post_id FK NULL│ │ │ post_id FK            │
│ file_path      │ │ │ visitor_key           │
│ thumbnail_path │ │ │ UQ(post_id,visitor_key)│
│ display_order  │ │ └───────────────────────┘
└────────────────┘ │ CASCADE
                   │ N
           ┌───────▼─────────────┐
           │      comment        │
           │─────────────────────│
           │ id PK               │
           │ post_id FK          │
           │ parent_comment_id FK├──┐ self (1단계)
           │ is_deleted          │  │ CASCADE
           └─────────────────────┘◄─┘

┌───────────────┐ 1      N ┌──────────────────┐
│  admin_user   ├─────────►│  admin_session   │
│───────────────│ CASCADE  │──────────────────│
│ id PK         │          │ id PK            │
│ username UQ   │          │ admin_user_id FK │
│ password_hash │          │ token_hash UQ    │
└───────────────┘          │ expires_at       │
                           └──────────────────┘
```

---

# 12. Foreign Key 및 삭제 정책 (DEC-005)

| 부모 | 자식 | FK 컬럼 | ON DELETE | 의미 |
|---|---|---|---|---|
| category | post | `post.category_id` | **RESTRICT** | 게시글이 있는 카테고리는 삭제 불가 (`409 CATEGORY_NOT_EMPTY`) |
| post | post_image | `post_image.post_id` | **CASCADE** | 게시글 삭제 시 이미지 레코드 삭제 (+ 파일 삭제는 애플리케이션) |
| post | comment | `comment.post_id` | **CASCADE** | 게시글 삭제 시 댓글·답글 삭제 |
| post | post_like | `post_like.post_id` | **CASCADE** | 게시글 삭제 시 좋아요 기록 삭제 |
| comment | comment | `comment.parent_comment_id` | **CASCADE** | 부모 댓글 완전 삭제 시 답글 삭제 (규칙상 답글이 없을 때만 발생) |
| admin_user | admin_session | `admin_session.admin_user_id` | **CASCADE** | 관리자 삭제 시 세션 삭제 |

### 파일 삭제 처리 순서

```text
1. 삭제할 post_image의 file_path, thumbnail_path 목록 조회
2. DB 삭제 트랜잭션 커밋
3. 커밋 성공 후 실제 파일 삭제
   └─ 실패 시 로그 기록 → 정리 작업이 남은 파일 처리
```

> DB 롤백 후 파일만 지워지는 상황을 막기 위해 **파일 삭제는 항상 커밋 이후**에 한다.

---

# 13. 인덱스

| 이름 | 테이블 | 컬럼 | 목적 | 사용 API |
|---|---|---|---|---|
| `ix_post_category_created` | post | `(category_id, created_at DESC)` | 카테고리별 최신 글, 카테고리 목록 | API-006, 013, 021 |
| `ix_post_created` | post | `(created_at DESC)` | 전체 최신 글 | API-011, 021 |
| `ix_post_popular` | post | `(like_count DESC, created_at DESC)` | 인기 글 (DEC-006 정렬) | API-012, 021 |
| `ix_post_image_post_order` | post_image | `(post_id, display_order)` | 게시글 이미지 순서 조회 | API-007 |
| `ix_post_image_orphan` | post_image | `(created_at) WHERE post_id IS NULL` | 임시 이미지 정리 | 정리 작업 |
| `ix_comment_post_created` | comment | `(post_id, created_at)` | 게시글 댓글 작성순 조회 | API-014 |
| `ix_comment_parent` | comment | `(parent_comment_id)` | 답글 조회, 답글 수 확인 | API-014, 017 |
| `ix_comment_created` | comment | `(created_at DESC)` | 관리자 댓글 목록 (최신순) | 관리자 댓글 API |
| `uq_post_like_post_visitor` | post_like | `(post_id, visitor_key)` | 중복 방지 + 내 좋아요 확인 | API-007, 018 |
| `uq_category_name_lower` | category | `lower(name)` | 이름 중복 방지 | API-002, 003 |
| `ix_admin_session_expires` | admin_session | `(expires_at)` | 만료 세션 정리 | 정리 작업 |

> FK 컬럼 중 위 복합 인덱스로 커버되지 않는 것은 없다 (`post_like.post_id`는 UNIQUE 인덱스의 선두 컬럼).

---

# 14. 입력 길이 및 검증 요약 (DEC-006)

| 대상 | 컬럼 | 최소 | 최대 | 비고 |
|---|---|---:|---:|---|
| category | name | 1 | 30 | 앞뒤 공백 제거 후 판단, 대소문자 무시 중복 불가 |
| category | description | 0 | 200 | |
| post | title | 1 | 200 | 앞뒤 공백 제거 후 판단 |
| post | content (image 노드) | 0 | 20 | DEC-002 |
| comment | nickname | 2 | 20 | |
| comment | password (원문) | 4 | 64 | 원문은 저장하지 않음 |
| comment | content | 1 | 1,000 | 일반 텍스트 |
| post_image | 파일 | — | 10MB | jpg / png / webp / gif |
| admin_user | username | 1 | 50 | |

> DB 컬럼 길이는 최대값과 일치시키고, 최소값과 공백 처리는 애플리케이션(Pydantic 스키마)에서 검증한다.

---

# 15. 정리 작업 (주기 실행)

| 작업 | 대상 | 주기 |
|---|---|---|
| 임시 이미지 정리 | `post_image.post_id IS NULL AND created_at < now() - 24h` → DB + 파일 삭제 | 하루 1회 |
| 고아 파일 정리 | 저장소에 있지만 `post_image`에 없는 파일 (생성 후 24시간 지난 것만) | 하루 1회 |
| 만료 세션 정리 | `admin_session` 중 유효하지 않은 세션 | 하루 1회 |

> **실행 방식 (DEC-007):** Vercel Cron Jobs가 하루 1회 `/api/cron/cleanup`(API-028)을 호출해 세 작업을 순서대로 실행한다. 개발 환경에서는 같은 기능을 관리 명령(예: `python -m app.cli cleanup`)으로 실행한다.
> 임시 이미지는 최대 약 48시간까지 남을 수 있다 (24시간 기준 + 하루 1회 실행). 기능에는 영향이 없다.

---

# 16. 확정 / 미정 사항

## 확정

- 7개 테이블 구조와 컬럼, 제약조건, FK 삭제 정책
- 본문 `JSONB` + 허용 노드 목록 (DEC-001)
- 임시 이미지 (`post_id` NULL) 생명주기, 경로 규칙, 썸네일 (DEC-002)
- 관리자 계정·세션 테이블, Argon2 (DEC-003)
- `post_like` UNIQUE, `like_count` 트랜잭션 갱신 (DEC-004)
- 카테고리 RESTRICT, 게시글 CASCADE, 댓글 조건부 soft delete (DEC-005)
- 컬럼 길이와 인덱스 (DEC-006)
- 기본 카테고리 Seed 4개 (REQ-009)
- Alembic 사용

## 미정 (구현·운영 단계)

| 항목 | 결정 시점 |
|---|---|
| PostgreSQL 버전 (TBD-008) | 개발 환경 구성 시 |
| 백업 정책 (TBD-011) | 운영 단계 (Neon 백업 기능 검토) |
| 검색 기능용 인덱스 (OPEN-007) | v1.0 범위 외 |

---

# 17. 요구사항 추적성

| REQ | 내용 | 테이블 / 규칙 |
|---|---|---|
| REQ-009 | 기본 카테고리 | §4.4 Seed |
| REQ-010~013 | 카테고리 관리 | `category`, §4.3 |
| REQ-012 | 카테고리 삭제 | §12 RESTRICT |
| REQ-014~016 | 게시글 등록·수정 | `post` |
| REQ-017 | 게시글 삭제 | §12 CASCADE + 파일 삭제 |
| REQ-018~020 | 본문 이미지, 순서, 개수 | `post.content`, `post_image`, §6.4 |
| REQ-024~028 | 댓글, 답글 | `comment` |
| REQ-029 | 답글 1단계 | §7.3 애플리케이션 검증 |
| REQ-030, 032 | 좋아요, 중복 방지 | `post_like`, §8.4 |
| REQ-035 | 관리자 댓글 관리 | §7.4, `ix_comment_created` |
| REQ-039 | 입력값 검증 | §14 |
| REQ-042 | 관리자 보호 | `admin_user`, `admin_session` |
| REQ-043 | 비밀번호 보호 | Argon2 해시 (`comment`, `admin_user`) |
| REQ-044 | XSS 방지 | §5.4 허용 노드 검증 |

---

# 18. 다음 단계

```text
DATA_MODEL v1.0   ← 현재 (완료)
     ↓
API_SPEC v1.0     ← 다음
     ↓
COMPONENT_SPEC v1.0
     ↓
TEST_CASES v1.0
     ↓
TRD / REQUIREMENTS v1.1
     ↓
Claude.md
     ↓
구현
```

---

## 19. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-09-15 | 초기 DB 모델 초안 작성 |
| 1.0 | 2026-11-03 | DEC-001~006 반영: `content` JSONB 확정, `post_image` 임시 이미지·썸네일, `comment` soft delete, `post_like` UNIQUE, `admin_user`·`admin_session` 신규, FK 삭제 정책, 컬럼 길이, 인덱스, Seed, 정리 작업 |
| 1.0 (개정) | 2026-11-03 | DEC-007 반영: 이미지 경로를 저장소 키로 변경(로컬/Vercel Blob 공통), 운영 DB Neon, 초기 관리자는 관리 명령으로 생성, 정리 작업을 Vercel Cron 하루 1회로 변경 |
