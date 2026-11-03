# SmallWorking DATA_MODEL

- Document: DATA_MODEL.md
- Version: 0.1 (Draft)
- Status: Review
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.0 / TRD v1.0

---

## 1. 목적

이 문서는 SmallWorking에서 사용하는 데이터베이스 구조를 정의한다.

```text
DATA_MODEL.md
      ↓
SQLAlchemy Model
      ↓
Alembic Migration
      ↓
PostgreSQL Table
```

즉, 이 문서는 실제 운영 DB의 구조를 결정하는 설계 문서다.

---

## 2. 데이터베이스 기본 원칙

| 항목 | 결정 |
|---|---|
| DBMS | PostgreSQL |
| ORM | SQLAlchemy |
| Migration | Alembic 권장 |
| 이미지 원본 | 서버 파일 시스템 |
| 이미지 메타데이터 | PostgreSQL |
| 방문자 회원가입 | 없음 |
| 댓글 작성 | 닉네임 + 비밀번호 |
| 댓글 답글 | 1단계까지만 |
| 게시글 좋아요 | 지원 |
| 댓글 좋아요 | 지원하지 않음 |
| 동영상 업로드 | 지원하지 않음 |

---

## 3. 전체 테이블 구성

초기 버전에서는 다음 5개 핵심 테이블을 사용한다.

```text
Category
   │
   └──< Post
          │
          ├──< PostImage
          ├──< Comment
          │       │
          │       └──< Comment (Reply)
          └──< PostLike
```

| 테이블 | 역할 |
|---|---|
| category | 게시글 분류 관리 |
| post | 게시글 본문 및 기본 정보 |
| post_image | 게시글 이미지 메타데이터 |
| comment | 댓글 및 답글 |
| post_like | 게시글 좋아요 기록 |

> 관리자 계정 테이블은 관리자 인증 방식이 아직 확정되지 않았으므로 이번 버전에서는 제외한다.

---

# 4. Category 테이블

## 4.1 목적

DIY, Portfolio, Blog, Board와 같은 게시글 카테고리를 저장한다.

카테고리는 관리자가 추가, 수정, 삭제, 순서 변경할 수 있다.

## 4.2 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---:|---|
| id | BIGINT | NO | 카테고리 PK |
| name | VARCHAR(100) | NO | 카테고리 이름 |
| description | VARCHAR(500) | YES | 카테고리 설명 |
| display_order | INTEGER | NO | 화면 표시 순서 |
| created_at | TIMESTAMPTZ | NO | 생성 시각 |
| updated_at | TIMESTAMPTZ | NO | 수정 시각 |

## 4.3 제약조건

- `id`는 Primary Key
- `name`은 NOT NULL
- `name`은 중복되지 않도록 관리
- `display_order`는 0 이상의 값을 사용

---

# 5. Post 테이블

## 5.1 목적

SmallWorking의 실제 게시글을 저장한다.

게시글은 하나의 Category에 속한다.

## 5.2 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---:|---|
| id | BIGINT | NO | 게시글 PK |
| category_id | BIGINT | NO | Category FK |
| title | VARCHAR(300) | NO | 게시글 제목 |
| content | JSONB 또는 TEXT | NO | 게시글 본문 |
| like_count | INTEGER | NO | 좋아요 수 |
| created_at | TIMESTAMPTZ | NO | 작성 시각 |
| updated_at | TIMESTAMPTZ | NO | 수정 시각 |

## 5.3 content 타입 결정 필요

게시글에는 글 중간에 이미지가 들어갈 수 있으므로 본문과 이미지 위치를 함께 표현할 방법이 필요하다.

현재 두 가지 방식을 검토한다.

### 방법 A - TEXT

HTML 형태의 본문을 저장한다.

```html
<p>오늘은 타일 작업을 했다.</p>
<img src="/uploads/..." />
<p>생각보다 쉽지 않았다.</p>
```

장점:
- 구조가 단순함
- HTML 렌더링이 쉬움

단점:
- HTML 보안 처리 필요
- 이미지와 게시글 데이터의 연결 관계가 약함

### 방법 B - JSONB

TipTap과 같은 에디터의 문서 구조를 JSON으로 저장한다.

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "오늘은 타일 작업을 했다."
        }
      ]
    },
    {
      "type": "image",
      "attrs": {
        "imageId": 15
      }
    }
  ]
}
```

장점:
- 글과 이미지의 위치를 명확하게 표현 가능
- 에디터 구조와 잘 맞음
- 이미지 ID와 DB 연결이 쉬움

단점:
- 에디터 선택에 따라 구조가 달라질 수 있음

### 현재 결정

`content`의 최종 저장 형식은 **COMPONENT_SPEC에서 에디터를 확정한 후 결정한다.**

DATA_MODEL v0.1에서는 `JSONB 또는 TEXT`로 열어 둔다.

---

# 6. PostImage 테이블

## 6.1 목적

게시글에 사용된 이미지의 메타데이터를 저장한다.

중요한 원칙:

```text
이미지 파일
   ↓
서버 파일 시스템

이미지 정보
   ↓
PostgreSQL
```

이미지 자체를 PostgreSQL에 저장하지 않는다.

## 6.2 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---:|---|
| id | BIGINT | NO | 이미지 PK |
| post_id | BIGINT | NO | 게시글 FK |
| file_name | VARCHAR(255) | NO | 저장된 파일명 |
| file_path | VARCHAR(1000) | NO | 서버 파일 경로 |
| original_name | VARCHAR(255) | YES | 원본 파일명 |
| mime_type | VARCHAR(100) | NO | 이미지 MIME 타입 |
| file_size | BIGINT | NO | 파일 크기(Byte) |
| display_order | INTEGER | NO | 이미지 관리 순서 |
| created_at | TIMESTAMPTZ | NO | 업로드 시각 |

## 6.3 관계

```text
Post 1 ───── N PostImage
```

하나의 게시글은 여러 이미지를 가질 수 있다.

초기 요구사항에서는 게시글당 약 20개의 이미지를 목표로 한다. 정확한 최대 개수는 추후 확정한다.

---

# 7. Comment 테이블

## 7.1 목적

방문자가 작성하는 댓글과 답글을 저장한다.

방문자는 회원가입하지 않으며 다음 정보를 사용한다.

```text
닉네임
비밀번호
댓글 내용
```

비밀번호는 평문으로 저장하지 않고 해시값으로 저장한다.

## 7.2 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---:|---|
| id | BIGINT | NO | 댓글 PK |
| post_id | BIGINT | NO | 게시글 FK |
| parent_comment_id | BIGINT | YES | 부모 댓글 FK |
| nickname | VARCHAR(50) | NO | 작성자 닉네임 |
| password_hash | VARCHAR(255) | NO | 비밀번호 해시 |
| content | TEXT | NO | 댓글 내용 |
| created_at | TIMESTAMPTZ | NO | 작성 시각 |
| updated_at | TIMESTAMPTZ | NO | 수정 시각 |

## 7.3 댓글과 답글 관계

`parent_comment_id`가 핵심이다.

일반 댓글:

```text
id = 10
parent_comment_id = NULL
```

답글:

```text
id = 11
parent_comment_id = 10
```

따라서:

```text
댓글 10
 ├── 답글 11
 └── 답글 12
```

와 같이 표현할 수 있다.

## 7.4 답글 깊이 제한

SmallWorking은 답글을 1단계까지만 허용한다.

허용:

```text
댓글
└── 답글
```

허용하지 않음:

```text
댓글
└── 답글
    └── 답글
```

이 제한은 우선 애플리케이션에서 검증한다.

---

# 8. PostLike 테이블

## 8.1 목적

게시글 좋아요 기록을 저장한다.

좋아요 수만 `Post.like_count`에 저장할 수도 있지만, 향후 중복 좋아요 방지 등을 고려하면 좋아요 기록을 별도 테이블로 관리하는 것이 확장성이 좋다.

## 8.2 컬럼 초안

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---:|---|
| id | BIGINT | NO | 좋아요 PK |
| post_id | BIGINT | NO | 게시글 FK |
| visitor_key | VARCHAR(255) | TBD | 방문자 식별값 |
| created_at | TIMESTAMPTZ | NO | 좋아요 시각 |

## 8.3 아직 결정하지 않은 사항

방문자는 로그인하지 않기 때문에 중복 좋아요 방지를 위해 방문자를 식별할 방법이 필요하다.

후보:

| 방식 | 특징 |
|---|---|
| IP | 구현이 단순하지만 여러 사용자가 같은 IP를 사용할 수 있음 |
| Cookie | 브라우저 기준 식별 가능 |
| Session | 세션 기반 식별 |
| 조합 | IP + Cookie 등 여러 정보를 조합 |

**중복 좋아요 방지 정책은 아직 확정하지 않는다.**

---

# 9. 테이블 관계

```text
┌──────────────┐
│   Category   │
│──────────────│
│ id PK        │
│ name         │
│ display_order│
└──────┬───────┘
       │ 1
       │
       │ N
┌──────▼───────┐
│     Post     │
│──────────────│
│ id PK        │
│ category_id FK
│ title        │
│ content      │
│ like_count   │
└─┬────┬────┬──┘
  │    │    │
  │    │    └──────────────┐
  │    │                   │
  │    │ N                 │ N
  │    ▼                   ▼
  │ PostImage           PostLike
  │
  │ N
  ▼
Comment
  │
  │ self reference
  └───────────────┐
                  │
                  ▼
               Comment
               (Reply)
```

---

# 10. Foreign Key 관계

| 부모 테이블 | 자식 테이블 | 관계 | 의미 |
|---|---|---|---|
| Category | Post | 1:N | 하나의 카테고리에 여러 게시글 |
| Post | PostImage | 1:N | 하나의 게시글에 여러 이미지 |
| Post | Comment | 1:N | 하나의 게시글에 여러 댓글 |
| Comment | Comment | 1:N | 하나의 댓글에 여러 답글 |
| Post | PostLike | 1:N | 하나의 게시글에 여러 좋아요 |

---

# 11. 삭제 정책

아래 정책은 구현 전에 확정해야 한다.

## Category 삭제

카테고리에 게시글이 존재하는 경우:

- 삭제 허용 여부
- 게시글을 다른 카테고리로 이동할지
- 게시글까지 함께 삭제할지

현재 **미정(TBD)**.

## Post 삭제

게시글 삭제 시 연결된:

- PostImage
- Comment
- PostLike

를 어떻게 처리할지 결정해야 한다.

초기 제안:

```text
Post 삭제
  ↓
PostImage 삭제
Comment 삭제
PostLike 삭제
```

실제 DB의 `ON DELETE CASCADE` 적용 여부는 구현 단계에서 확정한다.

---

# 12. 인덱스 설계 초안

| 테이블 | 컬럼 | 목적 |
|---|---|---|
| post | category_id | 카테고리별 게시글 조회 |
| post | created_at | 최신 게시글 조회 |
| post | like_count | 인기 게시글 조회 |
| post_image | post_id | 게시글 이미지 조회 |
| comment | post_id | 게시글 댓글 조회 |
| comment | parent_comment_id | 답글 조회 |
| post_like | post_id | 게시글 좋아요 조회 |

실제 인덱스와 복합 인덱스는 API_SPEC에서 실제 조회 패턴을 확인한 후 확정한다.

---

# 13. 현재 확정 / 미정 사항

## 확정

- PostgreSQL 사용
- SQLAlchemy 사용
- 이미지 파일은 서버 파일 시스템에 저장
- 이미지 메타데이터는 PostgreSQL에 저장
- 카테고리는 관리자가 동적으로 관리
- 게시글은 카테고리에 소속
- 댓글은 닉네임 + 비밀번호
- 댓글 비밀번호는 해시 저장
- 답글은 1단계까지만
- 게시글 좋아요 지원
- 댓글 좋아요는 제외
- 방문자 회원가입 없음

## 미정

- 관리자 인증 및 관리자 테이블
- 게시글 본문 저장 형식(TEXT/JSONB)
- 정확한 게시글 이미지 최대 개수
- 카테고리 삭제 정책
- 중복 좋아요 방지 방식
- 댓글 삭제 시 답글 처리 방식
- 게시글 삭제 시 실제 CASCADE 정책
- 댓글 정렬 방식
- 페이지네이션
- 인기 게시글의 기간 기준
- Home에서 카테고리별 표시 게시글 수

---

# 14. 다음 단계

DATA_MODEL 확정 후 다음 순서로 진행한다.

```text
DATA_MODEL
     ↓
API_SPEC
     ↓
COMPONENT_SPEC
     ↓
TEST_CASES
     ↓
Claude.md
     ↓
Claude Code 구현
```

API_SPEC에서는 이 데이터 모델을 사용하는 실제 REST API를 정의한다.

예:

```text
GET    /api/categories
POST   /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}
```

```text
GET    /api/posts
GET    /api/posts/{id}
POST   /api/posts
PUT    /api/posts/{id}
DELETE /api/posts/{id}
```

---

## 15. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-09-15 | 초기 DB 모델 초안 작성 |
