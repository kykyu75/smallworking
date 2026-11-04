# SmallWorking DECISIONS (결정 기록)

- 목적: 각 명세 문서의 TBD / OPEN 항목을 사용자와 대화로 확정한 내용을 기록한다.
- 원칙: 여기 기록된 결정은 해당 명세 문서(DATA_MODEL, API_SPEC, COMPONENT_SPEC, TEST_CASES 등)의 다음 버전에 반영한다.
- 형식: `DEC-xxx` / 결정 / 이유 / 해결되는 TBD / 반영할 문서

---

## DEC-001. 게시글 본문 저장 형식과 에디터

- 결정일: 2026-11-03
- **결정: TipTap 에디터를 채택하고, 본문은 TipTap JSON 형식으로 PostgreSQL `JSONB`에 저장한다.**

### 세부 내용

| 항목 | 결정 |
|---|---|
| 에디터 | TipTap |
| `post.content` 타입 | `JSONB` (TipTap document JSON) |
| 본문 내 이미지 | 이미지 노드의 `attrs.imageId`로 `post_image.id`를 참조 |
| 이미지 파일 정보 | `post_image` 테이블(경로, MIME, 크기 등)에서 관리 |
| 렌더링 | 허용된 노드/마크만 React 컴포넌트로 렌더링 (`dangerouslySetInnerHTML` 사용 안 함) |
| 서버 검증 | 저장 시 허용되지 않은 노드/마크/속성을 거부하거나 제거, `imageId`가 실제 존재하는 이미지인지 확인 |

### 이유

1. 본문 중간에 사진이 많이 들어가는 DIY 글에서 이미지와 DB가 정확하게 연결된다. 미사용 이미지 정리, 게시글 삭제 시 파일 정리, 대표 이미지 선정이 쉽다.
2. 허용한 요소만 렌더링하므로 XSS 방어가 단순하고 안전하다 (REQ-044).
3. 보이는 그대로 편집하는 에디터에서 이미지 삽입과 순서 변경이 쉽다 (REQ-018, REQ-019).

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| TBD-001 | TipTap 최종 채택 여부 | TRD §22 |
| OPEN-005 | 에디터 방식 | REQUIREMENTS §15 |
| — | content TEXT / JSONB | DATA_MODEL §5.3, API_SPEC §14 |
| — | 본문 sanitize 방식 (TC-SEC-004) | TEST_CASES §20 |

### 반영할 문서

- DATA_MODEL: §5.2 `content` → `JSONB`, §5.3 결정 내용 기록
- API_SPEC: API-007/008/009 `content` 구조 명시, 검증 규칙 추가
- COMPONENT_SPEC: COMP-032 PostContent, COMP-132 RichTextEditor 확정, `PostDetail.content` 타입 확정
- TEST_CASES: TC-SEC-004 기대 결과 확정
- TRD: §11 Rich Text Editor "후보" → "확정"

---

## DEC-002. 이미지 업로드 흐름과 제한

- 결정일: 2026-11-03
- **결정: 사진은 임시로 먼저 업로드하고, 게시글을 저장할 때 본문의 `imageId`를 기준으로 연결한다. 제한 값은 아래 추천안을 그대로 확정한다.**

### 업로드 흐름

```text
에디터에서 사진 삽입
   ↓  POST /api/images  (post_id = NULL, 임시 상태)
서버: 리사이징 + 썸네일 생성 + 파일 저장 + post_image 레코드 생성
   ↓  { id, url, ... } 응답
에디터: image 노드 { imageId } 삽입
   ↓
게시글 저장 (POST / PUT /api/posts)
   ↓
서버: content 안의 imageId 목록 추출
   ├─ 본문에 있는 이미지 → post_id 연결, display_order = 본문 등장 순서
   └─ 이 게시글에 연결돼 있었지만 본문에서 빠진 이미지 → 삭제 (DB + 파일)

정리 작업: post_id가 NULL이고 생성 후 24시간이 지난 이미지 → 삭제 (DB + 파일)
```

### 제한 값

> ⚠️ **DEC-007로 일부 변경됨:** 저장 위치(서버 파일 → Vercel Blob), 서버가 받는 파일 크기(최대 4MB, 브라우저가 먼저 축소), 정리 주기(하루 1회). 아래 표는 결정 당시 내용이다.

| 항목 | 결정 |
|---|---|
| 게시글당 최대 사진 | **20장** (초과 시 업로드/저장 거부) |
| 허용 형식 | **jpg, png, webp, gif** (확장자와 실제 파일 내용(MIME)을 모두 검사) |
| 장당 최대 용량 | **10MB** |
| 리사이징 | 긴 변이 1920px보다 크면 **1920px로 축소** |
| 썸네일 | 긴 변 **400px** 썸네일 파일 별도 생성. 카드 대표 이미지는 **본문 첫 사진** |
| 저장 경로 | `uploads/images/YYYY/MM/<무작위이름>.<ext>` (썸네일: `<무작위이름>_thumb.<ext>`) |
| 파일명 | 서버가 무작위 이름 생성. 원래 파일 이름은 `original_name`에만 저장 |
| 동영상 | 지원하지 않음 (REQ-021) |

### 이유

1. 글을 쓰는 중에 바로 사진을 넣을 수 있어 글쓰기 흐름이 자연스럽다.
2. DEC-001(`imageId` 참조)과 바로 맞물려, 연결·순서·미사용 이미지 정리를 서버가 정확하게 처리할 수 있다.
3. 리사이징과 썸네일로 사진 20장짜리 글도 빨리 뜨고 저장 공간을 아낄 수 있다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| OPEN-003 | 게시글 이미지 최대 개수 | REQUIREMENTS §15 |
| OPEN-004 | 이미지 저장 방식 | REQUIREMENTS §15 |
| TBD-004 | 이미지 최대 파일 크기 | TRD §22 |
| TBD-005 | 이미지 허용 확장자 | TRD §22 |
| TBD-006 | 리사이징 정책 | TRD §22 |
| TBD-007 | 썸네일 정책 | TRD §22 |
| — | 이미지 업로드 처리 방식 | API_SPEC §14 |
| F-003 | 임시 이미지와 `post_id NOT NULL` 충돌 | COMPONENT_SPEC §15 |
| F-004 | 이미지 경로 규칙 통일 | COMPONENT_SPEC §15 |
| F-006 | 목록 썸네일 필드 | COMPONENT_SPEC §15 |

### 반영할 문서

- DATA_MODEL: `post_image.post_id` → **NULL 허용**, `thumbnail_path`, `width`, `height` 컬럼 추가 검토, 삭제/정리 정책 추가
- API_SPEC: API-019 응답(`url`, `thumbnail_url`) 및 오류 코드(형식/용량/개수 초과), API-008/009 이미지 연결 규칙, PostSummary에 `thumbnail_url` 추가
- COMPONENT_SPEC: COMP-133 제한 값 확정, COMP-014 PostCard 썸네일 확정
- TEST_CASES: TC-IMG-007/008/009 기대 결과 확정, 임시 이미지 정리 테스트 추가
- TRD: §10 이미지 저장 경로와 처리 정책 확정

---

## DEC-003. 관리자 인증 방식

- 결정일: 2026-11-03
- **결정: 서버 세션과 HttpOnly 쿠키 방식으로 관리자를 인증한다. 관리자 계정은 1명이다.**

### 세부 내용

| 항목 | 결정 |
|---|---|
| 인증 방식 | 서버 세션 + HttpOnly 쿠키 (JWT 사용 안 함) |
| 관리자 계정 | `admin_user` 테이블, 운영자 1명 |
| 초기 계정 생성 | 환경변수(예: `ADMIN_USERNAME`, `ADMIN_PASSWORD`)로 최초 1회 생성. 코드에 계정 정보 하드코딩 금지 |
| 비밀번호 해시 | **Argon2** (댓글 비밀번호도 같은 방식, REQ-043) |
| 세션 저장소 | `admin_session` 테이블 (PostgreSQL) |
| 세션 만료 | 마지막 활동 후 **2시간** 비활동 시 만료, 로그인 후 최대 **7일** |
| 쿠키 속성 | `HttpOnly`, `Secure`(운영 HTTPS), `SameSite=Lax` |
| 로그인 시도 제한 | **5회** 연속 실패 시 **10분** 잠금 |
| 로그아웃 | 서버의 세션 레코드를 즉시 삭제 |
| 관리자 API 보호 | 모든 관리자 API는 유효한 세션이 없으면 `401` |

### 추가 API

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/admin/login` | 로그인 (username, password) → 세션 쿠키 발급 |
| POST | `/api/admin/logout` | 로그아웃 → 세션 삭제 |
| GET | `/api/admin/me` | 현재 로그인 상태 확인 (RequireAdmin에서 사용) |

### 이유

1. 운영자 1명인 개인 사이트에는 세션 방식이 가장 단순하고, 로그아웃하면 즉시 무효화된다.
2. HttpOnly 쿠키는 자바스크립트로 읽을 수 없어 XSS로 인증 정보를 탈취하기 어렵다.
3. JWT는 토큰 갱신·폐기·보관 설계가 추가로 필요해 현재 규모에 비해 과하다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| OPEN-010 | 관리자 인증 방식 | REQUIREMENTS §15 |
| TBD-002 | 관리자 인증 방식 | TRD §22 |
| TBD-003 | JWT 또는 Session 방식 | TRD §22 |
| — | 관리자 인증 및 관리자 테이블 | DATA_MODEL §13 |
| — | 관리자 인증 방식 / JWT 사용 여부 | API_SPEC §14 |
| — | 댓글 비밀번호 해시 알고리즘 | TRD §13 |
| F-001 | 관리자 인증 API 추가 | COMPONENT_SPEC §15 |

### 반영할 문서

- DATA_MODEL: `admin_user`, `admin_session` 테이블 추가 (로그인 실패 횟수, 잠금 해제 시각 컬럼 포함), 비밀번호 해시는 Argon2로 명시
- API_SPEC: 인증 API 3개 추가, 관리자 API 공통 `401` 규칙, 로그인 잠금 오류 코드 추가
- COMPONENT_SPEC: COMP-100 RequireAdmin(`/api/admin/me`), COMP-103 AdminLoginPage 연결 API 확정
- TEST_CASES: TC-ADM-001~005 기대 결과 확정, 로그인 잠금·세션 만료 테스트 추가
- TRD: §12 인증 및 권한 확정

---

## DEC-004. 중복 좋아요 방지

- 결정일: 2026-11-03
- **결정: 브라우저 쿠키 `visitor_key`로 방문자를 구분하고, 게시글 하나에 방문자 하나당 좋아요를 1회만 허용한다. 다시 누르면 좋아요가 취소된다(토글).**

### 세부 내용

| 항목 | 결정 |
|---|---|
| 방문자 식별 | 쿠키 `sw_visitor` (무작위 UUID), `HttpOnly`, 유효기간 **1년**, 첫 방문 또는 첫 좋아요 시 서버가 발급 |
| 중복 방지 | `post_like (post_id, visitor_key)` **UNIQUE** 제약 |
| 다시 누르기 | **좋아요 취소** (토글) |
| 좋아요 수 | 좋아요/취소 시 `post.like_count`를 **같은 트랜잭션**에서 증감 → `post_like` 건수와 항상 일치 |
| 내가 눌렀는지 | 게시글 상세 응답에 `liked: boolean` 포함 |
| IP | 사용하지 않음 |

### API

| Method | Endpoint | 설명 | 응답 |
|---|---|---|---|
| POST | `/api/posts/{post_id}/like` | 좋아요 (이미 눌렀다면 상태 유지, 오류 아님) | `{ post_id, like_count, liked: true }` |
| DELETE | `/api/posts/{post_id}/like` | 좋아요 취소 (누른 적 없으면 상태 유지) | `{ post_id, like_count, liked: false }` |

> 같은 요청을 여러 번 보내도 결과가 같다(멱등). 빠르게 연속 클릭해도 숫자가 틀어지지 않는다.

### 이유

1. 같은 IP를 쓰는 여러 사람이 섞이지 않고 브라우저 단위로 정확하게 구분된다.
2. 개인 홈페이지에서는 실수나 장난으로 여러 번 누르는 것만 막으면 충분하다. 쿠키를 일부러 지우는 조작은 v1.0에서 대응하지 않는다.
3. 기록 테이블과 집계 숫자를 함께 갱신하므로 인기글 순위가 정확하다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| OPEN-009 | 중복 좋아요 방지 방식 | REQUIREMENTS §15 |
| REQ-032 | 중복 좋아요 정책 | REQUIREMENTS §8 |
| — | `post_like.visitor_key` NULL 여부 | DATA_MODEL §8 |
| — | 좋아요 중복 방지 | API_SPEC §14 |
| F-007 | 좋아요 상태(`liked`) 조회 | COMPONENT_SPEC §15 |

### 반영할 문서

- DATA_MODEL: `post_like.visitor_key` → `VARCHAR(64) NOT NULL`, UNIQUE 제약, `like_count` 갱신 규칙
- API_SPEC: API-018 응답에 `liked` 추가, 좋아요 취소 API 추가, API-007 응답에 `liked` 추가, 쿠키 발급 규칙
- COMPONENT_SPEC: COMP-033 LikeButton 토글 동작 확정
- TEST_CASES: TC-LIKE-003 기대 결과 확정, 취소 테스트와 멱등성 테스트 추가
- REQUIREMENTS: REQ-032 정책 확정 내용 반영 (v1.1)

---

## DEC-005. 삭제 정책

- 결정일: 2026-11-03
- **결정: 게시글이 있는 카테고리는 삭제를 거부한다. 게시글을 삭제하면 연결 데이터와 사진 파일까지 함께 삭제한다. 답글이 달린 댓글은 "삭제된 댓글입니다"로 표시하고 자리를 남긴다.**

### ① 카테고리 삭제

| 상황 | 처리 |
|---|---|
| 게시글 0개 | 삭제 (`204`) |
| 게시글 1개 이상 | **삭제 거부** (`409`, `CATEGORY_NOT_EMPTY`, "게시글을 먼저 다른 카테고리로 옮기거나 삭제하세요") |

- DB: `post.category_id` FK → `ON DELETE RESTRICT`
- 게시글 이동은 기존 게시글 수정(API-009)에서 카테고리를 변경하는 방식으로 처리한다 (별도 기능 없음)

### ② 게시글 삭제

```text
게시글 삭제 (확인 창 후)
  ├─ post_image  → DB 레코드 삭제 + 실제 파일(원본, 썸네일) 삭제
  ├─ comment     → 댓글과 답글 모두 삭제
  └─ post_like   → 삭제
```

- DB: `post_image`, `comment`, `post_like`의 `post_id` FK → `ON DELETE CASCADE`
- 파일 삭제는 DB 커밋에 성공한 뒤 수행한다. 파일 삭제에 실패하면 로그를 남기고, 남은 파일은 정리 작업 대상으로 둔다

### ③ 댓글 삭제

| 상황 | 처리 |
|---|---|
| 답글 없는 댓글 | 완전 삭제 |
| 답글 | 완전 삭제 |
| **답글이 있는 댓글** | **soft delete**: `is_deleted = true`, 내용·닉네임·비밀번호 해시 비움, 화면에는 "삭제된 댓글입니다" 표시, 답글은 유지 |
| soft delete된 댓글의 마지막 답글 삭제 | 남은 부모 댓글 자리도 함께 완전 삭제 |
| 관리자 삭제 (REQ-035) | 위와 같은 규칙 적용 (비밀번호 확인 없음) |

- soft delete된 댓글은 수정할 수 없고, 새 답글도 달 수 없다
- DB: `comment.parent_comment_id` FK → 부모가 완전 삭제될 때만 답글도 함께 삭제 (`ON DELETE CASCADE`, 위 규칙상 실제로는 답글이 없을 때만 완전 삭제됨)

### 이유

1. 실수로 카테고리를 지워 글 수십 개가 사라지는 사고를 원천적으로 막는다.
2. 글이 없으면 사진·댓글·좋아요는 의미가 없으며, 사진 파일이 서버에 쓰레기로 남지 않는다.
3. 다른 방문자가 쓴 답글이 본인 의사와 관계없이 사라지지 않고 대화 흐름이 유지된다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| OPEN-008 | 카테고리 삭제 시 기존 게시물 처리 | REQUIREMENTS §15 |
| REQ-012 | 카테고리 삭제 처리 방식 | REQUIREMENTS §4 |
| REQ-017 | 게시물 삭제 시 연결 데이터 처리 | REQUIREMENTS §5 |
| — | 카테고리 삭제 정책 / 게시글 CASCADE / 댓글 삭제 시 답글 처리 | DATA_MODEL §11, §13 |
| — | 카테고리 삭제 정책 / 댓글 삭제 정책 | API_SPEC §14 |

### 반영할 문서

- DATA_MODEL: FK `ON DELETE` 정책 명시, `comment.is_deleted` 컬럼 추가 (soft delete 시 `nickname`, `content`, `password_hash` NULL 허용 필요)
- API_SPEC: API-004 `409 CATEGORY_NOT_EMPTY`, API-010 연결 데이터 삭제 명시, API-014 응답에 `is_deleted`, API-017 삭제 규칙
- COMPONENT_SPEC: COMP-036 삭제된 댓글 표시, 카테고리 삭제 실패 안내
- TEST_CASES: TC-CAT-008, TC-POST-008, TC-COM-014 기대 결과 확정, 마지막 답글 삭제 테스트 추가

---

## DEC-006. 화면 표시 규칙

- 결정일: 2026-11-03
- **결정: 아래 추천안을 그대로 확정한다.**

### ① 홈 화면

| 항목 | 결정 |
|---|---|
| 카테고리별 최신 글 수 | **3개** (등록일 최신순) |
| 전체 최신 글 수 | **5개** (등록일 최신순) |
| 인기 글 수 | **5개** |
| 인기 글 기간 | **전체 기간**. 정렬: `like_count DESC`, 같으면 `created_at DESC` |
| 글 없는 카테고리 | 섹션 표시 + "아직 글이 없습니다" 안내 |

### ② 목록과 댓글

| 항목 | 결정 |
|---|---|
| 카테고리 게시글 목록 | 페이지 번호 방식, **12개/페이지**, 등록일 최신순 |
| 관리자 목록 (게시글, 댓글) | 페이지 번호 방식, **20개/페이지** |
| 페이징 파라미터 | `page`(1부터 시작), `size`. 응답: `items`, `page`, `size`, `total` |
| 페이지 주소 | `/category/:id?page=2` (주소에 페이지 번호 유지) |
| 댓글 정렬 | **작성순** (`created_at ASC`), 답글도 작성순 |
| 댓글 페이징 | v1.0에서는 **전체 표시** |

### ③ 입력 길이 제한 (Backend와 Frontend 모두 검증, 앞뒤 공백 제거 후 판단)

| 항목 | 결정 |
|---|---|
| 게시글 제목 | 1~200자 |
| 카테고리 이름 | 1~30자, 중복 불가 |
| 카테고리 설명 | 0~200자 |
| 댓글 닉네임 | 2~20자 |
| 댓글 비밀번호 | 4~64자 |
| 댓글 내용 | 1~1,000자 |

### ④ 반응형 기준

| 구분 | 폭 |
|---|---|
| Mobile | ~767px |
| Tablet | 768px ~ 1023px |
| Desktop | 1024px ~ |

### 이유

1. 카테고리가 늘어나도 홈이 너무 길어지지 않으면서 새 글과 인기 글을 한눈에 볼 수 있다.
2. 초기에는 글과 좋아요가 적으므로 인기 글은 전체 기간이 적합하며, 나중에 바꾸기 쉽다.
3. 12개는 1/2/3열 카드 배치에서 모두 줄이 맞고, 페이지 번호 방식은 주소 공유와 뒤로 가기가 편하다.
4. 작성순 댓글은 대화가 시간 순서대로 읽힌다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| OPEN-001 | 인기 게시물 표시 개수 | REQUIREMENTS §15 |
| OPEN-002 | 인기 게시물 집계 기간 | REQUIREMENTS §15 |
| OPEN-006 | 게시물 목록 페이징 방식 | REQUIREMENTS §15 |
| OPEN-011 | 댓글 정렬 기준 | REQUIREMENTS §15 |
| OPEN-012 | 홈 카테고리별 표시 게시물 수 | REQUIREMENTS §15 |
| REQ-039 | 길이 제한과 허용 문자 | REQUIREMENTS §11 |
| — | 페이지네이션 / 댓글 정렬 / 인기글 기간 / Home API 구성 | API_SPEC §14, DATA_MODEL §13 |
| — | 반응형 브레이크포인트 | COMPONENT_SPEC §12 |

### 반영할 문서

- DATA_MODEL: 컬럼 길이를 제한 값에 맞게 조정 (예: `category.name` VARCHAR(30), `post.title` VARCHAR(200), `comment.nickname` VARCHAR(20)), 인기글·최신글 인덱스 확정
- API_SPEC: API-006 페이징 규칙, API-011/012/013/021 기본 개수, API-014 정렬, 모든 입력 검증 규칙과 `422` 오류
- COMPONENT_SPEC: §6.4, §7, §8.4, §12 미확정 → 확정
- TEST_CASES: TC-HOME-002/004, TC-POST-013, TC-COM-005, TC-VAL-002/003/005, TC-RES 폭 값 확정

---

## DEC-007. 배포 구조: Vercel 단일 배포 + 이미지 Vercel Blob 저장

- 결정일: 2026-11-03
- **결정: Frontend, Backend(FastAPI), DB, 이미지를 모두 Vercel 기준으로 배포한다. 이미지 저장소는 "서버 파일 시스템"에서 "Vercel Blob"으로 변경한다.**
- 변경 대상: TRD §10 "서버 파일 시스템 저장", DEC-002의 저장 경로·업로드 크기·정리 주기

### 배포 구조

```text
Vercel (하나의 프로젝트, 하나의 도메인)
├── React 정적 파일            → /
├── FastAPI (Vercel Functions) → /api/*
├── PostgreSQL                 → Neon (Vercel Marketplace 연동)
├── 이미지                     → Vercel Blob (public store)
└── 정리 작업                  → Vercel Cron Jobs → /api/cron/cleanup
```

### 세부 내용

| 항목 | 결정 |
|---|---|
| 저장소 추상화 | `StorageBackend` 인터페이스. 개발: `LocalStorage`(로컬 폴더), 운영: `BlobStorage`(Vercel Blob). 환경변수 `STORAGE_BACKEND`로 선택 |
| DB의 이미지 경로 | 저장소 키(예: `images/2026/11/a8f32c1e.jpg`)만 저장. 공개 주소는 저장소가 키로 만든다 |
| 업로드 크기 | 사용자는 **원본 10MB까지** 선택 가능. **브라우저가 긴 변 1920px로 줄인 뒤** 업로드한다. 서버가 받는 파일은 **최대 4MB** (Vercel 함수 요청 크기 제한 약 4.5MB 대응) |
| 브라우저 변환 | jpg → jpg, png·webp → webp (품질 0.85). **gif는 변환하지 않고** 4MB 이하만 허용 (움직이는 gif 유지) |
| 서버 처리 | 실제 형식 검사, 1920px 초과 시 다시 축소(방어), 400px 썸네일 생성(Pillow), Blob 저장 |
| 정리 작업 | Vercel Cron Jobs **하루 1회** → `/api/cron/cleanup` 호출 (`CRON_SECRET` 인증). 임시 이미지 기준은 24시간 그대로 |
| 관리자 초기 계정 | 서버 시작 시 자동 생성하지 않고 **관리 명령으로 1회 실행** (예: `python -m app.cli create-admin`) |
| DB 마이그레이션 | 함수 실행 중이 아니라 **배포 전에 별도 실행** (`alembic upgrade head`) |
| PostgreSQL | 운영: Neon. 개발: 로컬 PostgreSQL 또는 Neon 개발 브랜치. 버전은 개발 환경 구성 시 Neon 기본 버전에 맞춘다 |
| 도메인 / 쿠키 | Frontend와 API가 같은 도메인 → `SameSite=Lax` 쿠키와 Origin 검사(DEC-003) 그대로 사용 |
| 로컬 개발 | Vite 개발 서버가 `/api`를 로컬 FastAPI로 프록시 → 운영과 같은 "같은 도메인" 구조 |
| 배포 방식 | GitHub 저장소 연동, `main` 브랜치에 push하면 자동 배포. 다른 브랜치는 미리보기 배포 |
| Vercel 플랜 | Hobby(무료)로 시작. 개인 비상업 사이트 기준이며, 제한(Cron 빈도 등)에 걸리면 Pro 검토 |

### 이유

1. 서버리스 함수에는 오래 유지되는 디스크가 없어 서버 파일 시스템 저장이 불가능하다.
2. 한 곳(Vercel)에서 화면·API·DB·이미지를 관리할 수 있고, 같은 도메인이라 쿠키 인증이 단순하다.
3. 저장소를 추상화하면 개발(로컬)과 운영(Blob)을 코드 변경 없이 바꿀 수 있다.
4. 브라우저에서 먼저 줄이면 업로드가 빠르고 Vercel 요청 크기 제한에 걸리지 않는다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| TBD-009 | 실제 배포 서버 | TRD §22 → Vercel |
| TBD-010 | Reverse Proxy | TRD §22 → 불필요 (Vercel이 처리) |
| TBD-012 | 정리 작업 실행 방식 | TRD §22 → Vercel Cron Jobs |

### 반영할 문서

- TRD: §2 기술 스택, §10 이미지 저장, §15 디렉터리, §17 환경, §18 배포, §22 TBD
- DATA_MODEL: §6 경로 의미(저장소 키), §9.4 초기 계정, §15 정리 작업
- API_SPEC: API-019 크기 제한(4MB), 이미지 제공 방식, 정리 작업 API(API-028) 추가
- COMPONENT_SPEC: COMP-133 브라우저 축소
- TEST_CASES: TC-IMG-010/013/021, TC-ADM-019 수정, 정리 작업 인증 테스트 추가

---

## DEC-008. 개발 도구

- 결정일: 2026-11-03
- **결정: 아래 도구를 사용한다. 목록에 없는 라이브러리는 사용자 확인 없이 추가하지 않는다 (Claude.md 원칙).**

| 영역 | 도구 |
|---|---|
| Frontend | React + TypeScript + Vite |
| 라우팅 | React Router |
| 스타일링 | **Tailwind CSS** (Vite 플러그인) |
| 에디터 | TipTap (`@tiptap/react` + 필요한 공식 확장) |
| 서버 데이터 캐시 | 사용 안 함 (`src/hooks`의 커스텀 훅 + `apiClient`) |
| 브라우저 이미지 축소 | 브라우저 기본 Canvas API (라이브러리 없음) |
| Backend | Python 3.12 + FastAPI |
| ORM / Migration | SQLAlchemy 2.x + Alembic |
| DB 드라이버 | psycopg (v3) |
| 검증 | Pydantic v2 (FastAPI 기본) |
| 비밀번호 해시 | argon2-cffi |
| 이미지 처리 | Pillow |
| 이미지 저장 (운영) | Vercel Blob Python SDK (`vercel`) |
| Backend 테스트 | pytest + FastAPI TestClient (httpx) |
| Frontend 테스트 | Vitest + React Testing Library |
| E2E 테스트 | Playwright |
| 테스트 DB 초기화 | 테스트마다 트랜잭션 롤백 |
| 배포 | Vercel (GitHub 연동) |
| 로컬 실행 서버 | uvicorn (FastAPI 실행용) — M0 추가 |
| Frontend 코드 검사 | oxlint (Vite 공식 템플릿 포함) — M0 추가 |
| 테스트용 가상 브라우저 | jsdom (Vitest 화면 테스트용) — M0 추가 |
| 파일 업로드 처리 | python-multipart (FastAPI 파일 업로드에 필요, Vercel Blob SDK의 의존성으로도 설치됨) — M4 추가 |
| Markdown 붙여넣기 변환 | `@tiptap/markdown` (TipTap 공식 확장, 내부에서 `marked` 사용) — DEC-009로 추가 |
| 본문 표 | `@tiptap/extension-table` (TipTap 공식 확장) — DEC-010으로 추가 |

> 스타일링은 처음 추천안(CSS Modules) 대신 **사용자 요청으로 Tailwind CSS**로 정했다.
> uvicorn, oxlint, jsdom은 M0 뼈대 작업 중 필요해져 **사용자 확인 후 추가**했다 (2026-11-03). 셋 다 개발 도구이며 화면·기능에 영향이 없다.

### 해결되는 TBD

| ID | 항목 | 출처 |
|---|---|---|
| TBD-013 | Frontend 라우팅·스타일링·데이터 캐시 라이브러리, 테스트 도구 | TRD §22 |
| — | 라우팅 / 스타일링 / 캐시 라이브러리 | COMPONENT_SPEC §13, §16 |
| — | 테스트 도구, DB 초기화 방식 | TEST_CASES §3, §20 |

---

## DEC-009. 에디터 붙여넣기: Markdown 원문·HTML 소스를 서식으로 변환

- 결정일: 2026-11-04
- 계기: 운영자가 Markdown 원문(`## 제목`, `**굵게**`, `- 목록`)이나 HTML 소스(`<h2>…</h2>`)를 붙여 넣으면 글자가 그대로 들어가 서식이 살지 않았다.
- **결정: 붙여 넣은 일반 텍스트가 Markdown 또는 HTML 소스처럼 보이면, 기존 허용 서식(DATA_MODEL §5.4)으로 바꿔 넣는다.**

| 항목 | 내용 |
|---|---|
| 대상 | Markdown 원문, HTML 소스 코드 (사용자 선택). 파일 불러오기 버튼은 만들지 않는다 |
| 판단 | 클립보드 HTML에 서식 태그(h1~6, ul, ol, strong, a, pre 등)가 있으면 **기존 방식**(TipTap 기본 붙여넣기). 없거나 span·div뿐이면(VS Code·메모장) 텍스트를 검사해 HTML 소스 → Markdown → 일반 글 순으로 판단 |
| 코드블록 안 | 변환하지 않고 글자 그대로 |
| Markdown 변환 | `@tiptap/markdown` (TipTap 공식 확장). 한 줄 바꿈은 줄바꿈(hardBreak)으로 유지 |
| HTML 소스 변환 | 라이브러리 없이 브라우저 DOMParser + 에디터 스키마. 화면에 붙지 않는 문서라 스크립트·이미지가 실행·로딩되지 않는다 |
| 제목 단계 | `#`/h1 → h2, `####`~`######`/h4~h6 → h3 (허용 단계가 2·3뿐) |
| 표 | ~~허용 서식이 아니므로 한 행을 "칸 \| 칸" 형태의 문단으로 바꿔 글자만 살린다~~ → **DEC-010으로 변경: 표로 붙여 넣는다** |
| 이미지 | 버린다. 본문 이미지는 업로드 버튼으로만 넣는다 (DEC-002). Markdown의 대체 글(alt)은 글자로 남는다 |
| 위험한 요소 | `javascript:` 링크, 이벤트 속성, `<script>`는 남지 않는다 — 결과는 항상 `normalizeDoc`(허용 노드·마크·안전 링크)을 거친다 |
| 서버·렌더러 | **변경 없음.** 허용 목록·검증(content_validation.py)·PostContent 렌더러 그대로 |

- 범위 밖 (필요하면 별도 결정): 표·밑줄·글자색 지원(허용 목록 확장), .md/.html 파일 불러오기 — 표는 DEC-010에서 지원
- 관련: COMPONENT_SPEC COMP-132, TEST_CASES TC-POST-020~023, TC-SEC-014

---

## DEC-010. 본문 표 지원

- 결정일: 2026-11-04
- 계기: DEC-009 적용 후 운영자가 표를 붙여 넣어 보니 표가 글자로만 들어갔다. DIY 재료 목록, 포트폴리오 사양 정리 등에 표가 필요하다.
- **결정: 본문에 표를 허용한다. 붙여넣기(Markdown·HTML 소스·웹페이지 복사)와 에디터 버튼 모두 지원한다.**

| 항목 | 내용 |
|---|---|
| 라이브러리 | `@tiptap/extension-table` (TipTap 공식 표 확장, TipTap과 같은 버전) — DEC-008 목록에 추가 |
| 허용 노드 | `table`, `tableRow`, `tableHeader`(제목 칸), `tableCell` (DATA_MODEL §5.4) |
| 칸 속성 | `align`(left/center/right)만. Markdown `:---:` 정렬을 살린다 |
| 하지 않는 것 | 칸 합치기(colspan/rowspan), 열 너비 조절, 칸 색·스타일, 표 안의 표 |
| 서버 검증 | 노드·속성 허용 목록 + 구조 검사(표→행→칸, 빈 표·빈 행, 표 안의 표 거부) |
| 에디터 | [표 넣기] 3×3(첫 행 제목 칸). 표 안에서만 행·열 추가/삭제, 표 삭제 버튼. 칸 안에 표를 넣을 수 없게 스키마에서 막는다 |
| 붙여넣기 | 합쳐진 칸은 풀고 짧은 행은 끝에 빈 칸을 채워 열 수를 맞춘다. 표 안의 표는 칸 글자를 문단으로 푼다 |
| 표시 | `<table>`을 가로 스크롤 상자로 감싼다. **360px에서도 페이지는 넘치지 않고 표 안에서만 가로로 밀어 본다** (REQ-036). 칸 최소 폭 6rem |
| DB | 구조 변경 없음 (`post.content` JSONB). 마이그레이션 불필요 |

- 관련: DATA_MODEL §5.4, COMPONENT_SPEC §8.3·COMP-132·135, TEST_CASES TC-POST-024~029, TC-SEC-015, TC-RES-012

---

## DEC-011. 요청 게시판 (방문자 → 운영자)

- 결정일: 2026-11-04 (사용자: "이대로 진행해줘" — 아래 추천안 12개 모두 확정)
- 계기: 방문자가 자료 요청·DIY 요청 등 운영자에게 남기고 싶은 글을 쓸 공간이 없다. 사용자 선택: **공개 게시판 + 비밀글 선택**.
- 범위 메모: PRD §14 제외 항목 "개인 메시지"(1:1 대화)와는 다르다 — 게시판 형태이고 실시간 대화·알림이 없다. PRD §9-1, REQ-045~049로 추가했다.
- 반영 문서: PRD §9-1·§10.4, REQUIREMENTS REQ-045~049, DATA_MODEL §10-1 `visitor_request`, API_SPEC API-029~038, COMPONENT_SPEC PAGE-005~007·108, TEST_CASES TC-REQ-001~020

### 확정 항목

| # | 항목 | 추천안 | 이유 |
|---|---|---|---|
| 1 | 이름·위치 | 메뉴 맨 끝에 **"요청하기"**, 주소 `/requests` | 카테고리와 구분되는 고정 메뉴 |
| 2 | 작성 항목 | 종류(**자료 요청 / DIY 요청 / 기타**), 제목(1~100자), 내용(1~2000자, 일반 텍스트), 닉네임(2~20자), 비밀번호(4~64자), 비밀글 체크 | 댓글 규칙(DEC-006)과 같게 (비밀번호 길이는 댓글과 같은 4~64자로 맞춤). 사진 첨부는 하지 않음 (필요하면 나중에) |
| 3 | 연락처 | **받지 않음** — 답변은 게시판에 단다 | 개인정보를 받지 않으면 안내 문구·보관 책임이 없다 |
| 4 | 목록 | 최신순, 한 페이지 12개. 종류·제목·닉네임·작성일·상태(**접수 / 답변 완료**) 표시 | 홈 목록과 같은 페이지 방식 |
| 5 | 비밀글 목록 표시 | 제목 대신 **"🔒 비밀글입니다"**, 닉네임·날짜·상태만 보임 | 제목에도 개인 내용이 들어갈 수 있다 |
| 6 | 비밀글 열람 | 작성자는 **비밀번호 입력 후**, 운영자는 로그인 상태면 바로 | — |
| 7 | 비밀번호 틀림 방지 | 같은 글에 **5번 틀리면 10분 잠금** (관리자 로그인과 같은 규칙) | 비밀글은 내용 보호가 목적이므로 반복 추측을 막는다 |
| 8 | 운영자 답변 | 글마다 답변 1개 (작성·수정·삭제). **답변을 저장하면 자동으로 "답변 완료"** | 단순하게. 방문자의 추가 질문은 새 글로 |
| 9 | 작성자 수정·삭제 | 비밀번호로. **답변이 달린 뒤에는 수정 불가**, 삭제는 가능 | 답변과 질문 내용이 어긋나지 않게 |
| 10 | 관리자 화면 | 관리자 메뉴 **"요청"**: 전체 목록(비밀글 내용 포함), 상태 필터(접수/완료), 답변 쓰기, 삭제. 대시보드에 **"새 요청 N건"** | — |
| 11 | 삭제 방식 | 완전 삭제 (답글이 없으므로 soft delete 불필요) | — |
| 12 | 알림 | **없음** (메일·푸시 없음, 관리자 화면에서 확인) | 메일 발송은 외부 서비스·비용이 필요 |

### 구현 세부 (설계 중 정함)

- 상태는 따로 저장하지 않고 **답변이 있으면 "답변 완료", 없으면 "접수"**로 계산한다. 답변을 지우면 다시 "접수".
- 비밀번호 5회 실패 잠금은 **그 글의 비밀번호가 필요한 모든 동작**(열람·수정·삭제)에 함께 적용한다. 잠긴 동안은 맞는 비밀번호도 거부한다 (423).
- 작성 직후에는 비밀번호를 다시 묻지 않고 작성한 글 화면을 보여준다 (작성 응답에 내용이 포함됨).

### 예상 작업

- DB: `visitor_request` 테이블 1개 + 마이그레이션
- API 약 10개 (공개 6, 관리자 4), 화면 3개 (목록·작성, 상세, 관리자 요청 관리)
- 문서: PRD·REQUIREMENTS·DATA_MODEL·API_SPEC·COMPONENT_SPEC·TEST_CASES 갱신
- 규모: 댓글 기능(M8)과 비슷

---

## DEC-012. Vercel 배포 구성 (M11)

- 결정일: 2026-11-04 (사용자: Services 방식 선택)
- 계기: DEC-007·TRD는 `vercel.json` + `api/index.py` 방식을 적었지만 "정확한 구성은 구현 단계에서 Vercel 공식 문서로 확정"하기로 했다. 2026-11 현재 Vercel 문서는 프론트+Python 백엔드를 한 프로젝트에 둘 때 **Services**를 권하고, `api/` 폴더 방식은 "기존 프로젝트 지원"으로만 안내한다.

| 항목 | 결정 |
|---|---|
| 실행 구조 | **Vercel Services** (Beta, 모든 플랜). `web` = `frontend/`(Vite), `api` = `backend/`(FastAPI, 진입점 `app.main:app`). `api/index.py`는 만들지 않는다 |
| 라우팅 | `/api/(.*)` → `api`, 나머지 → `web`. 백엔드는 원래 경로(`/api/...`) 그대로 받는다. `web`은 파일이 없는 주소를 `index.html`로 (SPA) |
| Cron | `/api/cron/cleanup`, `0 18 * * *` (UTC 18시 = 한국 03시, Hobby는 ±59분 오차) |
| Python | 3.12 (`backend/.python-version`), 운영 패키지 버전 고정 (`backend/requirements.txt`), 개발 도구(uvicorn·pytest·httpx)는 `requirements-dev.txt`로 |
| DB 연결 | 앱은 Neon **풀러 주소**(`DATABASE_URL`)를 쓴다. 풀러는 세션 설정을 지원하지 않으므로 `-c timezone=UTC`를 보내지 않고, 대신 **DB 기본 시간대를 UTC로** 설정한다 (마이그레이션 `8c1f2d3e4a5b`). 직접 연결(로컬 등)에는 지금처럼 시작 옵션을 보낸다 |
| 주소 형식 | Neon이 주는 `postgres://`·`postgresql://` 주소를 앱이 psycopg 형식으로 바꿔 쓴다 |
| 마이그레이션·관리자 생성 | Neon **직접 연결 주소**(`DATABASE_URL_UNPOOLED`)로 로컬에서 `alembic upgrade head`, `create-admin` 실행 (배포 가이드 절차) |
| Origin 검사 | Vercel이 공개 주소를 `x-forwarded-host`로 전달하므로 `Host`와 함께 같은 사이트로 인정한다 (브라우저 Origin은 페이지가 바꿀 수 없어 안전) |
| 미리보기 DB | Neon 연동의 **미리보기 브랜치**(배포마다 운영 DB 복사본) 사용 — 미리보기 확인이 운영 데이터를 바꾸지 않게 |
| 지역 | 함수와 DB를 같은 지역에 둔다: Neon Singapore `aws-ap-southeast-1` + Vercel 함수 `sin1` (`vercel.json`의 `regions`, Hobby는 1개 지역) |
| 병합 정책 | Vercel 연결 후 `main` 병합 = 운영 배포이므로 **배포가 함께 일어나는 병합은 매번 사용자 확인** (M10까지의 "테스트 통과 시 자동 병합"은 종료) |

- 확인되지 않은 점 (미리보기 배포에서 확인, TC-DEP): Services + Cron 조합, Vite 서비스의 SPA 주소 처리, 풀러 연결의 시간대. 안 되면 사용자에게 알리고 `api/` 폴더 방식으로 바꾼다.
- 관련: TRD v1.1 §15·§17·§18 (개정), CLAUDE.md §6·§10·§14, `DOCS/08-deploy/SmallWorking_DEPLOY_GUIDE.md`

---

## 진행 현황

| 순서 | 항목 | 상태 |
|---|---|---|
| 1 | 본문 저장 형식과 에디터 | ✅ DEC-001 |
| 2 | 이미지 업로드 흐름과 제한 | ✅ DEC-002 |
| 3 | 관리자 인증 방식 | ✅ DEC-003 |
| 4 | 중복 좋아요 방지 | ✅ DEC-004 |
| 5 | 삭제 정책 | ✅ DEC-005 |
| 6 | 화면 표시 규칙 | ✅ DEC-006 |
| 7 | 배포 구조 (Vercel) / 이미지 저장소 | ✅ DEC-007 |
| 8 | 개발 도구 | ✅ DEC-008 |
| 9 | 에디터 붙여넣기 서식 변환 (구현 중 요청) | ✅ DEC-009 |
| 10 | 본문 표 지원 (구현 중 요청) | ✅ DEC-010 |
| 11 | 요청 게시판 (구현 중 요청) | ✅ DEC-011 |
| 12 | Vercel 배포 구성 (M11) | ✅ DEC-012 |

### 아직 남은 미확정 항목 (구현 단계 이후)

| ID | 항목 | 결정 시점 |
|---|---|---|
| OPEN-007 | 검색 기능 포함 여부 | 향후 요구사항 (v1.0 제외) |
| TBD-008 | PostgreSQL 버전 | 개발 환경 구성 시 (Neon 기본 버전 기준) |
| TBD-011 | 백업 정책 | 운영 단계 (Neon 백업 기능 검토) |

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-11-03 | 문서 생성, DEC-001 기록 |
| 2026-11-03 | DEC-002 기록 |
| 2026-11-03 | DEC-003 기록 |
| 2026-11-03 | DEC-004 기록 |
| 2026-11-03 | DEC-005 기록 |
| 2026-11-03 | DEC-006 기록, 설계 단계 TBD 결정 완료 |
| 2026-11-03 | DEC-007(Vercel 배포, Vercel Blob), DEC-008(개발 도구, Tailwind) 기록 |
| 2026-11-04 | DEC-009(붙여넣기 Markdown·HTML 소스 변환) 기록, DEC-008에 `@tiptap/markdown` 추가 |
| 2026-11-04 | DEC-010(본문 표) 기록, DEC-008에 `@tiptap/extension-table` 추가, DEC-009 표 처리 변경 |
| 2026-11-04 | DEC-011(요청 게시판) 초안 → 확정 |
| 2026-11-04 | DEC-012(Vercel Services 배포 구성, Neon 연결 방식, 병합 정책) 기록 |
