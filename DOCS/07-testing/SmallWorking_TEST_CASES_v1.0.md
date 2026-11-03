# SmallWorking TEST_CASES

- Document: TEST_CASES.md
- Version: 1.0
- Status: Approved (대화 결정 반영)
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.1 / TRD v1.1 / DATA_MODEL v1.0 / API_SPEC v1.0 / COMPONENT_SPEC v1.0 / DECISIONS DEC-001~008
- Previous: TEST_CASES v0.1 (2026-11-03)

---

# 1. 테스트 목적

이 문서는 SmallWorking이 REQUIREMENTS에서 정의한 기능을 **제대로 구현했는지 확인하는 방법**을 정의한다.

```text
REQ-xxx  (무엇을 해야 하는가)
   ↓
API-xxx / COMP-xxx  (어떻게 구현하는가)
   ↓
TC-xxx  (제대로 만들어졌는가)   ← 현재 문서
```

각 테스트 케이스는 Requirement ID와 연결된다. Claude Code는 기능을 구현하거나 수정할 때 **관련 테스트를 먼저 확인**하고, 구현 후 해당 테스트를 통과시켜야 한다.

---

# 2. 테스트 범위

| 구분 | 포함 | 비고 |
|---|---|---|
| Category | O | 조회, 추가, 수정, 삭제, 순서 변경 |
| Post | O | 목록, 상세, 작성, 수정, 삭제, 본문 검증 |
| Image | O | 업로드, 본문 연결, 순서, 개수·용량·형식, 리사이징, 썸네일, 정리 |
| Comment / Reply | O | 작성, 수정, 삭제, 답글 1단계, soft delete |
| Like | O | 좋아요, 취소, 중복 방지, 멱등성 |
| Home | O | 카테고리별 최신글, 최신글, 인기글 |
| Admin | O | 로그인, 잠금, 세션, 관리 기능, 관리자 댓글 관리 |
| Validation / Error | O | 길이 제한, 공백, 오류 형식 |
| Security | O | XSS, 비밀번호 해시, 쿠키, CSRF(Origin), 파일 업로드 |
| Responsive | O | Mobile / Tablet / Desktop |
| 정리 작업 | O | 임시 이미지, 만료 세션 |
| 성능 / 부하 | X | v1.0 범위 외 |
| 범위 제외 기능 | X | §2.1에서 "없음"을 확인 |

## 2.1 범위 제외 확인

다음 기능은 **존재하지 않는 것이 정상**이다.

| TC ID | 확인 내용 | REQ |
|---|---|---|
| TC-EXC-001 | 방문자 회원가입/로그인 화면과 API가 없다 | REQ-003 |
| TC-EXC-002 | 댓글에 좋아요 버튼과 API가 없다 | REQ-031 |
| TC-EXC-003 | 게시글 에디터에 동영상 업로드 기능이 없다 | REQ-021 |
| TC-EXC-004 | 답글에는 [답글] 버튼이 없다 | REQ-029 |

---

# 3. 테스트 유형

| 유형 | 도구 | 대상 | 확정 |
|---|---|---|---|
| Backend API/서비스 테스트 | pytest + FastAPI TestClient (httpx) | Router, Service, 검증 로직 | ✅ DEC-008 |
| DB 통합 테스트 | pytest + 테스트용 PostgreSQL, 테스트마다 트랜잭션 롤백 | 제약조건, FK 삭제 정책, 트랜잭션 | ✅ DEC-008 |
| Frontend 컴포넌트 테스트 | Vitest + React Testing Library | COMP-xxx 동작 | ✅ DEC-008 |
| E2E 테스트 | Playwright | §15 통합 시나리오 | ✅ DEC-008 |
| 배포 확인 | Vercel 미리보기 배포에서 수동 확인 | Blob 업로드, Cron, 쿠키 | DEC-007 |
| 수동 테스트 | 브라우저 / 실제 모바일 기기 | 반응형, 사용성 | — |

> 자동 테스트의 이미지 저장소는 **LocalStorage**(테스트 전용 임시 폴더)를 사용한다. Vercel Blob 연동은 미리보기 배포에서 확인한다 (TC-DEP). **시간이 걸리는 규칙(24시간, 2시간, 7일, 10분)은 실제로 기다리지 않고 시간을 조작해서 테스트한다** (예: 생성 시각을 과거로 넣거나 현재 시각을 고정하는 방식).

---

# 4. 테스트 결과 상태

| 상태 | 의미 |
|---|---|
| `Not Run` | 아직 실행하지 않음 |
| `Pass` | 기대 결과와 일치 |
| `Fail` | 기대 결과와 불일치 |
| `Blocked` | 선행 기능 미구현 등으로 실행 불가 |

> v0.1의 `Pending Policy` 상태는 DEC-001~006 결정으로 **모두 해소**되었다 (§20 참고).

**우선순위:** `P1` 핵심 기능(반드시 통과) / `P2` 중요 / `P3` 보조
**자동화:** `A` 자동 테스트 / `M` 수동 테스트

---

# 5. Category 테스트

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-CAT-001 | 기본 카테고리 제공 | 초기 마이그레이션 직후 | `GET /api/categories` | DIY, Portfolio, Blog, Board 4개가 순서 1~4로 반환 | P1 | A | REQ-009 | API-001 |
| TC-CAT-002 | 카테고리 목록 정렬 | 순서가 서로 다른 카테고리 3개 | 목록 조회 | `display_order ASC` 순서, `post_count` 포함 | P1 | A | REQ-013 | API-001 |
| TC-CAT-003 | 카테고리 추가 | 관리자 로그인 | 이름 "여행"으로 생성 | 201, 목록 **맨 뒤**에 "여행" (`display_order` = 기존 최대값 + 1) | P1 | A | REQ-010 | API-002, COMP-111 |
| TC-CAT-004 | 이름 없이 추가 | 관리자 | name `""` 또는 `"   "` | 422 `VALIDATION_ERROR`, 저장되지 않음 | P1 | A | REQ-038 | API-002 |
| TC-CAT-005 | 중복 이름 추가 | "DIY" 존재 | 이름 "diy"로 생성 | 409 `CATEGORY_NAME_DUPLICATED` (대소문자 무시) | P2 | A | REQ-039 | API-002 |
| TC-CAT-006 | 카테고리 수정 | 관리자, "여행" 존재 | 이름을 "Travel"로 수정 | 200, 변경 반영 | P1 | A | REQ-011 | API-003 |
| TC-CAT-007 | 빈 카테고리 삭제 | 게시글 없는 카테고리 | 삭제 | 204, 목록에서 제거 | P1 | A | REQ-012 | API-004 |
| TC-CAT-008 | 게시글이 있는 카테고리 삭제 | 게시글 1개 이상 | 삭제 | **409 `CATEGORY_NOT_EMPTY`**, 카테고리와 게시글 모두 그대로 (DEC-005) | P1 | A | REQ-012 | API-004 |
| TC-CAT-009 | 순서 변경 | 카테고리 4개 | `{ category_ids: [3,1,2,4] }` | 200, 목록·메뉴·홈에 새 순서 반영 | P1 | A | REQ-013 | API-005, COMP-112 |
| TC-CAT-010 | 메뉴 자동 반영 | — | 카테고리 추가 후 공개 화면 새로고침 | Header 메뉴에 새 카테고리 표시 (코드 수정 없음) | P1 | A | REQ-008 | COMP-003, 004 |
| TC-CAT-011 | 존재하지 않는 카테고리 | — | `/category/9999` 접속 | NotFoundPage | P2 | A | REQ-040 | COMP-204 |
| TC-CAT-012 | 이름 길이 제한 | 관리자 | 30자 / 31자 이름으로 생성 | 30자 201, 31자 422 (DEC-006) | P2 | A | REQ-039 | API-002 |
| TC-CAT-013 | 순서 목록 불일치 | 카테고리 4개 | ID 3개만 보내거나 없는 ID 포함 | 422 `CATEGORY_ORDER_MISMATCH`, 순서 변경 없음 | P2 | A | REQ-013 | API-005 |
| TC-CAT-014 | 삭제 버튼 비활성화 | 글이 있는 카테고리 | 관리자 카테고리 화면 확인 | [삭제] 비활성화 + "게시글 N개가 있어 삭제할 수 없습니다" | P2 | A | REQ-012 | COMP-110 |

---

# 6. Post 테스트

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-POST-001 | 게시글 작성 | 관리자 | 제목, 카테고리, TipTap 본문으로 저장 | 201, `created_at`·`updated_at` 저장, 본문 JSONB 저장 | P1 | A | REQ-014 | API-008, COMP-130 |
| TC-POST-002 | 제목 누락 | 관리자 | 제목 `""` 또는 공백만 | 422 `VALIDATION_ERROR`, 저장되지 않음 | P1 | A | REQ-038 | API-008, COMP-131 |
| TC-POST-003 | 카테고리 누락 | 관리자 | `category_id` 없이 저장 | 422, 저장되지 않음 | P1 | A | REQ-015, 038 | API-008 |
| TC-POST-004 | 존재하지 않는 카테고리 | 관리자 | `category_id=9999` | 404 `CATEGORY_NOT_FOUND`, 저장되지 않음 | P2 | A | REQ-015 | API-008 |
| TC-POST-005 | 게시글 수정 | 관리자, 게시글 존재 | 제목 수정 | 200, `updated_at` 갱신, `created_at` 유지 | P1 | A | REQ-016 | API-009 |
| TC-POST-006 | 카테고리 변경 | 관리자 | DIY → Blog | Blog 목록에 표시, DIY 목록에서 제외 | P2 | A | REQ-015 | API-009 |
| TC-POST-007 | 게시글 삭제 | 관리자 | 삭제 | 204, 상세 조회 시 404 `POST_NOT_FOUND` | P1 | A | REQ-017 | API-010, COMP-121 |
| TC-POST-008 | 삭제 시 연결 데이터 | 이미지 3장, 댓글·답글, 좋아요가 있는 게시글 | 삭제 | `post_image`, `comment`, `post_like` 레코드 모두 삭제 + **원본·썸네일 파일 모두 삭제** (DEC-005) | P1 | A | REQ-017 | API-010 |
| TC-POST-009 | 게시글 상세 | 게시글 존재 | `/posts/:id` 접속 | 제목, 카테고리, 본문, 이미지, 등록일, 수정일, 좋아요 수, 댓글 표시 | P1 | A | REQ-022 | API-007, COMP-030~032 |
| TC-POST-010 | 작성자 표시 | — | 상세 화면 확인 | 작성자가 운영자로 표시 | P3 | A | PRD | COMP-031 |
| TC-POST-011 | 카테고리 목록 최신순 | 시간차를 두고 3개 작성 | 목록 조회 | 최근 글이 먼저 | P1 | A | REQ-023 | API-006, COMP-022 |
| TC-POST-012 | 목록 응답 구조 | — | `GET /api/posts` | `content`, `images` 없음. `thumbnail_url`, `comment_count` 포함 | P3 | A | API_SPEC §4.1 | API-006 |
| TC-POST-013 | 페이징 | 한 카테고리에 게시글 25개 | `page=3` (기본 size) | `size=12`, `items` 1개, `total=25` (DEC-006) | P2 | A | REQ-023 | API-006, COMP-023 |
| TC-POST-014 | 존재하지 않는 게시글 | — | `/posts/9999` | 404, NotFoundPage | P1 | A | REQ-040 | API-007, COMP-204 |
| TC-POST-015 | 범위 밖 페이지 | 게시글 5개 | `page=99` | 200, 빈 `items`, `total=5` | P3 | A | REQ-023 | API-006 |
| TC-POST-016 | 페이지 주소 유지 | 게시글 25개 | 2페이지로 이동 후 새로고침 / 뒤로 가기 | URL `?page=2` 유지, 같은 목록 표시 | P2 | A | REQ-023 | COMP-020, 023 |
| TC-POST-017 | 허용되지 않은 노드 | 관리자 | 본문에 `{ "type": "iframe" }` 노드 | 422 `INVALID_CONTENT` (DEC-001) | P1 | A | REQ-044 | API-008 |
| TC-POST-018 | 허용되지 않은 속성 | 관리자 | `image` 노드에 `src`, `onerror` 속성 | 422 `INVALID_CONTENT` | P1 | A | REQ-044 | API-008 |
| TC-POST-019 | 제목 길이 | 관리자 | 200자 / 201자 제목 | 200자 201, 201자 422 (DEC-006) | P2 | A | REQ-039 | API-008 |

---

# 7. Image 테스트

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-IMG-001 | 이미지 업로드 | 관리자 | jpg 업로드 | 201, Image 객체(`url`, `thumbnail_url`, 크기), 저장소(테스트: LocalStorage)의 키 `images/YYYY/MM/`에 원본·썸네일 파일 생성, `post_id = NULL` | P1 | A | REQ-018 | API-019, COMP-133 |
| TC-IMG-002 | DB에 바이너리 미저장 | 업로드 완료 | DB 확인 | `post_image`에 상대 경로와 메타데이터만 있음 | P1 | A | TRD §10 | DATA_MODEL §6 |
| TC-IMG-003 | 본문 중간 삽입 | 에디터 | 문단 → 이미지 → 문단으로 저장 | 상세 화면에서 같은 위치에 이미지 표시 | P1 | A | REQ-018 | COMP-032, 132 |
| TC-IMG-004 | 저장 시 이미지 연결 | 임시 이미지 A, B, C | 본문에 A, B, C 순서로 넣고 저장 | 세 이미지 모두 `post_id` = 새 글, `display_order` = 0, 1, 2 (DEC-002) | P1 | A | REQ-019 | API-008 |
| TC-IMG-005 | 이미지 순서 변경 | 이미지 A, B, C인 글 | C를 맨 앞으로 옮겨 저장 | 상세 화면에 C, A, B 순서, `display_order` 갱신 | P2 | A | REQ-019 | API-009, COMP-132 |
| TC-IMG-006 | 20장 지원 | 관리자 | 이미지 20장으로 저장 | 정상 저장, 정상 표시 | P1 | A | REQ-020 | API-008 |
| TC-IMG-007 | 21장 저장 시도 (API) | 관리자 | `image` 노드 21개로 저장 | **422 `IMAGE_LIMIT_EXCEEDED`**, 저장되지 않음 | P1 | A | REQ-020 | API-008 |
| TC-IMG-008 | 21장째 추가 시도 (UI) | 에디터에 20장 | 이미지 버튼 확인 | 버튼 비활성화 + "이미지는 20장까지" 안내 | P2 | A | REQ-020 | COMP-133 |
| TC-IMG-009 | 허용되지 않는 형식 | 관리자 | .mp4, .exe, .svg 업로드 | **415 `UNSUPPORTED_IMAGE_TYPE`** | P1 | A | REQ-021, 039 | API-019 |
| TC-IMG-010 | 용량 초과 | 관리자 | (UI) 10MB 초과 원본 선택 / (API) 4MB 초과 파일 직접 전송 | (UI) 업로드하지 않고 안내 / (API) **413 `IMAGE_TOO_LARGE`** (DEC-007) | P2 | A | REQ-039 | API-019, COMP-133 |
| TC-IMG-011 | 확장자 위장 | 관리자 | 내용은 텍스트인데 이름이 `.jpg` | 415 또는 422 `INVALID_IMAGE`, 파일 저장 안 됨 | P2 | A | REQ-039 | API-019 |
| TC-IMG-012 | 비관리자 업로드 | 미로그인 | `POST /api/images` | 401 `UNAUTHORIZED` | P1 | A | REQ-042 | API-019 |
| TC-IMG-013 | 리사이징 | 관리자 | (UI) 4000×3000 jpg 선택 / (API) 4000×3000 jpg(4MB 이하)를 직접 전송 | (UI) 브라우저가 1920×1440으로 줄여 전송 / (API) 서버가 1920×1440으로 저장. 둘 다 썸네일 긴 변 400px (DEC-002, 007) | P2 | A | — | API-019, COMP-133 |
| TC-IMG-025 | 브라우저 형식 변환 | 에디터 | png, webp, gif 선택 | png·webp는 webp로 변환 업로드, gif는 원본 그대로 (움직임 유지) | P3 | A | — | COMP-133 |
| TC-IMG-026 | 큰 gif | 에디터 | 5MB gif 선택 | 업로드하지 않고 "이미지가 너무 큽니다" 안내 | P3 | A | — | COMP-133 |
| TC-IMG-014 | 작은 이미지 유지 | 관리자 | 800×600 업로드 | 원본 크기 그대로 800×600 (확대하지 않음) | P3 | A | — | API-019 |
| TC-IMG-015 | 본문에서 빠진 이미지 | 이미지 A, B, C인 글 | 본문에서 B를 지우고 저장 | B의 레코드와 원본·썸네일 파일 삭제, A·C 유지 | P1 | A | REQ-019 | API-009 |
| TC-IMG-016 | 다른 글의 이미지 참조 | 글 1에 연결된 이미지 A | 글 2 본문에 A의 `imageId`를 넣어 저장 | 422 `INVALID_IMAGE_REFERENCE` | P2 | A | REQ-039 | API-008 |
| TC-IMG-017 | 없는 이미지 참조 | 관리자 | 본문에 `imageId: 99999` | 422 `INVALID_IMAGE_REFERENCE` | P2 | A | REQ-039 | API-008 |
| TC-IMG-018 | 같은 이미지 두 번 | 임시 이미지 A | 본문에 A를 두 번 넣어 저장 | 422 `INVALID_IMAGE_REFERENCE` | P3 | A | — | API-008 |
| TC-IMG-019 | 임시 이미지 삭제 | 임시 이미지 | `DELETE /api/images/{id}` | 204, 레코드와 파일 삭제 | P2 | A | — | API-020 |
| TC-IMG-020 | 사용 중인 이미지 삭제 | 글에 연결된 이미지 | `DELETE /api/images/{id}` | 409 `IMAGE_IN_USE`, 삭제 안 됨 | P2 | A | — | API-020 |
| TC-IMG-021 | 임시 이미지 자동 정리 | 생성 25시간 지난 임시 이미지, 생성 1시간 된 임시 이미지 | `GET /api/cron/cleanup` (올바른 `CRON_SECRET`) | 25시간 된 이미지만 레코드·파일 삭제, 결과 건수 응답 (DEC-002, 007) | P2 | A | — | API-028 |
| TC-IMG-027 | 정리 작업 인증 | — | `CRON_SECRET` 없이 / 틀린 값 / 관리자 세션으로 API-028 호출 | 모두 401, 아무것도 삭제되지 않음 | P1 | A | REQ-042 | API-028 |
| TC-IMG-028 | 정리 작업 멱등성 | 정리 대상 데이터 | API-028을 연속 2회 호출 | 두 번째 호출은 삭제 0건, 오류 없음 | P3 | A | — | API-028 |
| TC-IMG-022 | 대표 이미지 | 이미지가 있는 글 / 없는 글 | 목록·홈 조회 | `thumbnail_url` = 본문 첫 이미지 썸네일 / `null`, 카드가 정상 표시 | P2 | A | — | API-006, COMP-014 |
| TC-IMG-023 | 파일명 처리 | 관리자 | 원래 이름 `../../x.jpg`, `내 사진.jpg` | 서버가 만든 무작위 이름으로 저장, `original_name`에 원래 이름 보관, 업로드 폴더 밖으로 나가지 않음 | P1 | A | REQ-039 | API-019 |
| TC-IMG-024 | 업로드 중 저장 잠금 | 에디터에서 이미지 업로드 중 | 저장 버튼 확인 | 업로드가 끝날 때까지 저장 버튼 비활성화 | P3 | A | — | COMP-133, 134 |

---

# 8. Comment 테스트

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-COM-001 | 댓글 작성 | 게시글 존재, 로그인 없음 | 닉네임, 비밀번호, 내용으로 등록 | 201, 목록에 표시 | P1 | A | REQ-024 | API-015, COMP-038 |
| TC-COM-002 | 필수값 누락 | — | 닉네임·비밀번호·내용 중 하나를 비우고 등록 | 422, 저장 안 됨, 화면에서 등록 버튼 비활성화 | P1 | A | REQ-038 | API-015, COMP-038 |
| TC-COM-003 | 비밀번호 해시 저장 | 댓글 작성 | DB `comment.password_hash` 확인 | 평문이 아닌 Argon2 해시 (`$argon2` 접두사) | P1 | A | REQ-043 | DATA_MODEL §7 |
| TC-COM-004 | 응답에 비밀번호 미포함 | 댓글 존재 | API-014, 015, 016 응답 확인 | `password`, `password_hash` 필드 없음 | P1 | A | REQ-043 | API-014 |
| TC-COM-005 | 댓글 정렬 | 시간차를 두고 댓글 3개, 한 댓글에 답글 2개 | 목록 조회 | 댓글과 답글 모두 **작성순** (`created_at ASC`) (DEC-006) | P2 | A | REQ-025 | API-014, COMP-035 |
| TC-COM-006 | 답글 작성 | 댓글 10 존재 | `parent_comment_id=10` | 201, 댓글 10의 `replies`에 표시 | P1 | A | REQ-028 | API-015, COMP-037 |
| TC-COM-007 | 답글의 답글 금지 (API) | 댓글 10 → 답글 11 | `parent_comment_id=11` | 422 `REPLY_DEPTH_EXCEEDED`, 저장 안 됨 | P1 | A | REQ-029 | API-015 |
| TC-COM-008 | 답글의 답글 금지 (UI) | 답글 존재 | 답글 항목 확인 | [답글] 버튼 없음 | P1 | A | REQ-029 | COMP-036 |
| TC-COM-009 | 다른 게시글의 댓글을 부모로 | 게시글 A의 댓글 10 | 게시글 B에 `parent_comment_id=10` | 422 `INVALID_PARENT_COMMENT` | P2 | A | REQ-029, 039 | API-015 |
| TC-COM-010 | 수정 (올바른 비밀번호) | 댓글 존재 | 올바른 비밀번호로 수정 | 200, 내용 변경, `updated_at` 갱신, 화면에 "(수정됨)" | P1 | A | REQ-026 | API-016, COMP-039 |
| TC-COM-011 | 수정 (틀린 비밀번호) | 댓글 존재 | 틀린 비밀번호로 수정 | 403 `INVALID_PASSWORD`, 변경 없음, 실패 안내 | P1 | A | REQ-026, 041 | API-016 |
| TC-COM-012 | 삭제 (답글 없는 댓글) | 답글 없는 댓글 | `POST /api/comments/{id}/delete` 올바른 비밀번호 | 204, 레코드 완전 삭제 | P1 | A | REQ-027 | API-017 |
| TC-COM-013 | 삭제 (틀린 비밀번호) | 댓글 존재 | 틀린 비밀번호로 삭제 | 403 `INVALID_PASSWORD`, 삭제 안 됨 | P1 | A | REQ-027 | API-017 |
| TC-COM-014 | 답글이 있는 댓글 삭제 | 댓글과 답글 2개 | 댓글 삭제 | 204, 댓글은 `is_deleted=true`, `nickname`·`content`·`password_hash` NULL. 목록에서 "삭제된 댓글입니다"로 표시, **답글 2개 유지** (DEC-005) | P1 | A | REQ-027 | API-017, COMP-036 |
| TC-COM-015 | 답글도 비밀번호 사용 | — | 답글 작성 후 비밀번호로 수정·삭제 | 댓글과 동일하게 동작 | P2 | A | REQ-028 | API-015~017 |
| TC-COM-016 | 마지막 답글 삭제 | soft delete된 댓글 + 답글 1개 | 답글 삭제 | 답글 삭제 + **부모 자리도 완전 삭제**, 목록에서 사라짐 | P1 | A | REQ-027 | API-017 |
| TC-COM-017 | 남은 답글이 있을 때 | soft delete된 댓글 + 답글 2개 | 답글 1개 삭제 | 그 답글만 삭제, 부모는 "삭제된 댓글입니다"로 유지 | P2 | A | REQ-027 | API-017 |
| TC-COM-018 | 삭제된 댓글에 답글 | soft delete된 댓글 | 답글 작성 시도 | 422 `COMMENT_ALREADY_DELETED`. 화면에는 [답글] 버튼 없음 | P2 | A | DEC-005 | API-015, COMP-036 |
| TC-COM-019 | 삭제된 댓글 수정·삭제 | soft delete된 댓글 | 수정 / 삭제 요청 | 422 `COMMENT_ALREADY_DELETED`. 화면에 버튼 없음 | P2 | A | DEC-005 | API-016, 017 |
| TC-COM-020 | 입력 길이 경계 | — | 닉네임 1/2/20/21자, 비밀번호 3/4/64/65자, 내용 0/1/1000/1001자 | 범위 안은 201, 범위 밖은 422 (DEC-006) | P2 | A | REQ-039 | API-015 |
| TC-COM-021 | 줄바꿈 표시 | — | 여러 줄 댓글 작성 | 줄바꿈 유지, HTML로 해석되지 않음 | P3 | A | REQ-044 | COMP-036 |

---

# 9. Like 테스트 (DEC-004)

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-LIKE-001 | 좋아요 | like_count=12, 처음 방문 | `POST /api/posts/{id}/like` | 200, `{ like_count: 13, liked: true }`, `sw_visitor` 쿠키 발급 | P1 | A | REQ-030 | API-018, COMP-033 |
| TC-LIKE-002 | 게시글별 집계 | 게시글 A, B | A에만 좋아요 | A만 증가, B 변화 없음 | P1 | A | REQ-030 | API-018 |
| TC-LIKE-003 | 중복 좋아요 | 같은 쿠키로 이미 좋아요 | 다시 `POST .../like` | 200, `like_count` 그대로, `liked: true` (오류 아님) | P1 | A | REQ-032 | API-018 |
| TC-LIKE-004 | 카운트 일관성 | 좋아요·취소를 섞어 여러 번 | `post.like_count`와 `post_like` 건수 비교 | 항상 일치 | P1 | A | REQ-030 | DATA_MODEL §8.4 |
| TC-LIKE-005 | 없는 게시글 | — | `POST /api/posts/9999/like` | 404 `POST_NOT_FOUND` | P2 | A | REQ-040 | API-018 |
| TC-LIKE-006 | 연속 클릭 (UI) | — | 버튼을 빠르게 여러 번 클릭 | 처리 중에는 버튼 비활성화, 최종 상태와 숫자가 서버와 일치 | P3 | A | REQ-032 | COMP-033 |
| TC-LIKE-007 | 좋아요 취소 | 좋아요한 상태 | `DELETE /api/posts/{id}/like` | 200, `{ like_count: -1된 값, liked: false }` | P1 | A | REQ-032 | API-022 |
| TC-LIKE-008 | 취소 멱등성 | 좋아요하지 않은 상태 / 쿠키 없음 | `DELETE .../like` | 200, 숫자 변화 없음, `liked: false` | P2 | A | REQ-032 | API-022 |
| TC-LIKE-009 | 토글 (UI) | 상세 화면 | ❤️ 클릭 → 다시 클릭 | 좋아요 → 취소, 숫자 +1 → -1 | P1 | A | REQ-030 | COMP-033 |
| TC-LIKE-010 | 내 좋아요 표시 | 좋아요한 브라우저 / 다른 브라우저 | 상세 조회 | 좋아요한 브라우저만 `liked: true`, 버튼이 채워진 상태 | P2 | A | REQ-032 | API-007 |
| TC-LIKE-011 | 방문자 구분 | 브라우저 A, B (서로 다른 쿠키) | 둘 다 좋아요 | 숫자 2 증가 | P2 | A | REQ-032 | API-018 |
| TC-LIKE-012 | 동시 요청 | 같은 쿠키 | 같은 좋아요 요청 10개를 동시에 전송 | `like_count` 1만 증가, `post_like` 1건 | P2 | A | REQ-032 | API-018 |
| TC-LIKE-013 | 쿠키 속성 | — | 좋아요 응답의 `Set-Cookie` 확인 | `sw_visitor`, `HttpOnly`, `SameSite=Lax`, 유효기간 1년, 운영에서는 `Secure` | P2 | A | — | API_SPEC §2.2 |

---

# 10. Home 테스트

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-HOME-001 | 홈 기본 구성 | 데이터 존재 | `/` 접속 | 소개, 카테고리 영역, 최신글, 인기글 표시 | P1 | A | REQ-004 | API-021, COMP-010~013 |
| TC-HOME-002 | 카테고리별 최신글 | 카테고리마다 글 5개 | 홈 확인 | 각 카테고리에 **최신 글 3개**, 최신순 (DEC-006) | P1 | A | REQ-005 | API-021, COMP-011 |
| TC-HOME-003 | 전체 최신글 | 여러 카테고리에 글 10개 | 홈 확인 | 카테고리와 관계없이 **최신 5개** | P1 | A | REQ-006 | COMP-012 |
| TC-HOME-004 | 인기글 | 좋아요 수가 서로 다른 글 10개 | 홈 확인 | 좋아요 많은 순 **5개**, 전체 기간 대상 | P1 | A | REQ-007 | COMP-013 |
| TC-HOME-005 | 카테고리 자동 반영 | — | "여행" 추가 후 홈 접속 | "여행" 섹션 자동 표시 | P1 | A | REQ-008 | COMP-011 |
| TC-HOME-006 | 순서 반영 | — | 카테고리 순서 변경 후 홈 접속 | 섹션이 새 순서로 표시 | P2 | A | REQ-013 | COMP-011 |
| TC-HOME-007 | 빈 카테고리 | 글 없는 카테고리 | 홈 확인 | 섹션 표시 + "아직 글이 없습니다" | P3 | A | — | COMP-011, 203 |
| TC-HOME-008 | 게시글 이동 | — | PostCard 클릭 | 해당 게시글 상세로 이동 | P1 | A | REQ-022 | COMP-014 |
| TC-HOME-009 | 인기글 동점 | 좋아요 수가 같은 글 2개 | 홈 확인 | 더 최근에 쓴 글이 먼저 | P3 | A | REQ-007 | API-021 |
| TC-HOME-010 | 글 3개 미만 카테고리 | 글 1개인 카테고리 | 홈 확인 | 1개만 표시 (빈 칸 없음) | P3 | A | REQ-005 | COMP-011 |

---

# 11. Admin 테스트 (DEC-003)

| TC ID | 테스트 | 사전 조건 | 절차 | 기대 결과 | 우선 | 자동 | REQ | API / COMP |
|---|---|---|---|---|---|:-:|---|---|
| TC-ADM-001 | 관리자 로그인 | 관리자 계정 | 올바른 아이디·비밀번호 | 200, `sw_session` 쿠키 발급, `/admin` 이동 | P1 | A | REQ-042 | API-023, COMP-103 |
| TC-ADM-002 | 로그인 실패 | — | 틀린 비밀번호 / 없는 아이디 | 둘 다 401 `INVALID_CREDENTIALS` (어느 쪽이 틀렸는지 구분하지 않음) | P1 | A | REQ-042 | API-023 |
| TC-ADM-003 | 관리자 화면 보호 | 미로그인 | `/admin/posts` 직접 접속 | `/admin/login?redirect=/admin/posts`로 이동, 로그인 후 원래 화면으로 | P1 | A | REQ-042 | COMP-100 |
| TC-ADM-004 | 관리자 API 보호 | 미로그인 | 관리자 API(API-002~005, 008~010, 019, 020, 024~027) 직접 호출 | 모두 401 `UNAUTHORIZED`, 데이터 변경 없음 | P1 | A | REQ-042 | 전체 관리자 API |
| TC-ADM-005 | 로그아웃 | 로그인 상태 | 로그아웃 후 같은 쿠키로 `GET /api/admin/me` | 204 후 401. `admin_session` 레코드 삭제 | P1 | A | REQ-042 | API-024 |
| TC-ADM-006 | 게시글 관리 목록 | 관리자 | `/admin/posts` | 20개/페이지, 수정·삭제 버튼 표시 | P1 | A | REQ-033 | COMP-120, 121 |
| TC-ADM-007 | 삭제 확인 | 관리자 | 게시글 삭제 클릭 | ConfirmDialog에 "사진, 댓글, 좋아요가 모두 삭제" 안내. 취소하면 삭제 안 됨 | P2 | A | REQ-017 | COMP-200 |
| TC-ADM-008 | 작성 중 이탈 | 에디터에서 내용 입력 | 저장하지 않고 다른 메뉴 클릭 | 이탈 확인 표시 | P3 | A | REQ-041 | COMP-134 |
| TC-ADM-009 | 관리자 댓글 목록 | 댓글·답글 존재, soft delete된 댓글 1개 | `GET /api/admin/comments` | 최신순 20개/페이지, 게시글 제목·답글 수 포함, **soft delete된 댓글 제외** | P1 | A | REQ-035 | API-026, COMP-140 |
| TC-ADM-010 | 관리자 댓글 삭제 | 답글 없는 댓글 | `DELETE /api/admin/comments/{id}` (비밀번호 없음) | 204, 공개 화면에서 사라짐 | P1 | A | REQ-035 | API-027, COMP-141 |
| TC-ADM-011 | 관리자 삭제 규칙 | 답글이 있는 댓글 | 관리자 삭제 | soft delete, 답글 유지 (API-017과 같은 규칙) | P1 | A | REQ-035 | API-027 |
| TC-ADM-012 | 로그인 잠금 | — | 틀린 비밀번호 5회 → 6번째에 올바른 비밀번호 | 5번째 실패 후 잠금, 6번째는 **423 `ACCOUNT_LOCKED`** + `locked_until` | P1 | A | REQ-042 | API-023 |
| TC-ADM-013 | 잠금 해제 | 잠금 상태 | 10분 지난 시점으로 시간 조작 후 올바른 로그인 | 200, 실패 횟수 0으로 초기화 | P2 | A | REQ-042 | API-023 |
| TC-ADM-014 | 성공 시 실패 횟수 초기화 | 실패 3회 | 올바른 로그인 | 실패 횟수 0 | P3 | A | REQ-042 | API-023 |
| TC-ADM-015 | 비활동 만료 | 로그인 | 마지막 활동 후 2시간 1분 지난 시점에 요청 | 401 | P1 | A | REQ-042 | DATA_MODEL §10.4 |
| TC-ADM-016 | 활동 시 연장 | 로그인 | 1시간마다 요청하며 5시간 경과 | 계속 유효 (`last_active_at` 갱신) | P2 | A | REQ-042 | DATA_MODEL §10.4 |
| TC-ADM-017 | 최대 7일 만료 | 로그인 | 계속 활동해도 7일 지난 시점 | 401 | P2 | A | REQ-042 | DATA_MODEL §10.4 |
| TC-ADM-018 | 세션 만료 시 편집 화면 | 게시글 편집 중 세션 만료 | 저장 클릭 | "로그인이 만료되었습니다…" 안내 후 로그인 화면, 입력 내용이 바로 사라지지 않음 | P2 | A | REQ-041 | COMP-100, 130 |
| TC-ADM-019 | 초기 관리자 생성 | 빈 `admin_user`, 환경변수 설정 | 관리 명령 `create-admin` 실행 → 한 번 더 실행 | 첫 실행에서 환경변수 값으로 1명 생성, 두 번째는 변화 없음 (DEC-007) | P1 | A | REQ-042 | DATA_MODEL §9.4 |
| TC-ADM-020 | 세션 쿠키 속성 | — | 로그인 응답의 `Set-Cookie` 확인 | `sw_session`, `HttpOnly`, `SameSite=Lax`, 운영에서는 `Secure` | P1 | A | REQ-042 | API_SPEC §2.2 |
| TC-ADM-021 | 세션 토큰 저장 | 로그인 | DB `admin_session` 확인 | 토큰 원문 없음, `token_hash`만 저장 | P2 | A | REQ-042 | DATA_MODEL §10 |

---

# 12. Validation / Error 테스트

| TC ID | 테스트 | 절차 | 기대 결과 | 우선 | 자동 | REQ |
|---|---|---|---|---|:-:|---|
| TC-VAL-001 | Backend 검증 | 화면을 거치지 않고 API로 빈 값 전송 | 422 `VALIDATION_ERROR` | P1 | A | REQ-039 |
| TC-VAL-002 | 제목 길이 | TC-POST-019 참조 | 200자까지 허용 | P2 | A | REQ-039 |
| TC-VAL-003 | 닉네임·비밀번호·내용 길이 | TC-COM-020 참조 | DEC-006 범위만 허용 | P2 | A | REQ-039 |
| TC-VAL-004 | 공백만 입력 | 제목/카테고리 이름/닉네임/댓글 내용에 공백만 | 422 (빈 값으로 취급) | P2 | A | REQ-038 |
| TC-VAL-005 | 앞뒤 공백 제거 | 닉네임 `"  홍길동  "` | `"홍길동"`으로 저장 | P3 | A | REQ-039 |
| TC-VAL-006 | 공통 오류 형식 | 4xx를 일으키는 요청 (FastAPI 기본 422 포함) | `{ "error": { "code", "message", "details" } }` 형식 | P1 | A | API_SPEC §12 |
| TC-VAL-007 | 실패 안내 | 서버 오류를 일부러 발생 | 화면에 실패 메시지 표시 (빈 화면 아님), 응답에 내부 정보 없음 | P1 | A | REQ-041 |
| TC-VAL-008 | 잘못된 ID 형식 | `/api/posts/abc` | 422 (500 아님) | P2 | A | REQ-040 |
| TC-VAL-009 | 검증 오류 상세 | 제목과 카테고리를 모두 비워 전송 | `details`에 두 필드 모두 포함, 화면에서 각 입력란 옆에 표시 | P3 | A | REQ-041 |
| TC-VAL-010 | 페이징 파라미터 | `size=0`, `size=51`, `page=0` | 422 | P3 | A | REQ-039 |

---

# 13. Security 테스트

| TC ID | 테스트 | 절차 | 기대 결과 | 우선 | 자동 | REQ |
|---|---|---|---|---|:-:|---|
| TC-SEC-001 | 댓글 스크립트 | 댓글 내용에 `<script>alert(1)</script>` | 실행되지 않고 문자 그대로 표시 | P1 | A | REQ-044 |
| TC-SEC-002 | 댓글 이벤트 속성 | `<img src=x onerror=alert(1)>` | 실행되지 않음 | P1 | A | REQ-044 |
| TC-SEC-003 | 닉네임 스크립트 | 닉네임에 스크립트 | 실행되지 않음 | P1 | A | REQ-044 |
| TC-SEC-004 | 본문 스크립트 | API로 본문에 `javascript:alert(1)` 링크, 허용 안 된 노드 전송 | **422 `INVALID_CONTENT`**로 저장 거부. 만약 DB에 들어가 있어도 PostContent는 허용되지 않은 노드와 링크를 그리지 않음 (DEC-001) | P1 | A | REQ-044 |
| TC-SEC-005 | 제목 스크립트 | 제목에 스크립트 | 실행되지 않음 | P1 | A | REQ-044 |
| TC-SEC-006 | 비밀번호 평문 미저장 | DB 전체 확인 | 댓글·관리자 비밀번호가 평문으로 없음, Argon2 해시 | P1 | A | REQ-043 |
| TC-SEC-007 | 업로드 파일 실행 방지 | 업로드 이미지 주소로 접근 | 저장된 MIME으로만 제공, `X-Content-Type-Options: nosniff` | P2 | A | REQ-044 |
| TC-SEC-008 | 경로 조작 | TC-IMG-023 참조 | 업로드 폴더를 벗어나지 않음 | P1 | A | REQ-039 |
| TC-SEC-009 | 환경 정보 분리 | 소스 코드 검사 | DB 접속 정보, 관리자 계정이 코드에 하드코딩되지 않음 | P1 | M | TRD §17 |
| TC-SEC-010 | 다른 사이트의 요청 차단 | `Origin: https://evil.example`로 관리자 쿠키를 포함해 POST/PUT/DELETE | 403 `FORBIDDEN_ORIGIN`, 데이터 변경 없음 | P1 | A | REQ-042 |
| TC-SEC-011 | 민감 정보 미노출 | 모든 API 응답 확인 | `password`, `password_hash`, `token_hash`, `visitor_key` 없음 | P1 | A | REQ-043 |
| TC-SEC-012 | 링크 안전 속성 | 본문 링크 렌더링 확인 | `target="_blank"`에 `rel="noopener noreferrer"` | P2 | A | REQ-044 |
| TC-SEC-013 | 쿠키 스크립트 접근 | 브라우저 콘솔에서 `document.cookie` 확인 | `sw_session`, `sw_visitor`가 보이지 않음 (HttpOnly) | P2 | M | REQ-042 |

---

# 14. Responsive 테스트 (DEC-006)

| TC ID | 테스트 | 환경 | 기대 결과 | 우선 | 자동 | REQ |
|---|---|---|---|---|:-:|---|
| TC-RES-001 | 가로 스크롤 없음 | 360 / 768 / 1024 / 1280px | 모든 공개·관리자 화면에서 가로 스크롤 없음 | P1 | A | REQ-036 |
| TC-RES-002 | 모바일 메뉴 | 360px, 767px | 햄버거 메뉴 표시, 열고 닫기, 카테고리로 이동하면 자동 닫힘 | P1 | A | REQ-036 |
| TC-RES-003 | 메뉴 전환 경계 | 767px / 768px | 767px 햄버거, 768px 가로 메뉴 | P2 | A | REQ-036 |
| TC-RES-004 | 홈 레이아웃 | 360 / 768 / 1024px | 카테고리 섹션 1열 / 2열 / 3열 | P2 | A | REQ-036 |
| TC-RES-005 | 목록 레이아웃 | 360 / 768 / 1024px | PostCard 1열 / 2열 / 3열 | P2 | A | REQ-036 |
| TC-RES-006 | 본문 이미지 | 360px, 1920px 이미지 포함 글 | 이미지가 화면 폭을 넘지 않고 비율 유지 | P1 | A | REQ-037 |
| TC-RES-007 | 긴 텍스트 | 360px, 공백 없는 긴 문자열 댓글/URL | 줄바꿈되어 화면 밖으로 넘치지 않음 | P2 | A | REQ-037 |
| TC-RES-008 | 댓글/답글 | 360px | 답글 들여쓰기 12px, 폼 입력 가능 | P2 | A | REQ-037 |
| TC-RES-009 | 관리자 모바일 | 360px | 관리자 목록이 카드형, 주요 기능 사용 가능 | P3 | A | REQ-036 |
| TC-RES-010 | 에디터 모바일 | 360px | 툴바 줄바꿈, 이미지 삽입·저장 가능 | P3 | M | REQ-036 |
| TC-RES-011 | 실제 기기 | Android Chrome / iOS Safari | §15 통합 시나리오 정상 동작 | P2 | M | REQ-036 |

---

# 14-1. 배포 확인 테스트 (Vercel 미리보기, DEC-007)

자동 테스트로 확인하기 어려운 Vercel 환경 연동은 **미리보기 배포**에서 수동으로 확인한다. `main`에 합치기 전에 수행한다.

| TC ID | 테스트 | 절차 | 기대 결과 | 우선 | 자동 |
|---|---|---|---|---|:-:|
| TC-DEP-001 | 화면과 API 연결 | 미리보기 주소에서 홈 접속 | 홈 데이터 정상 표시, `/api/*` 응답 정상 | P1 | M |
| TC-DEP-002 | Blob 업로드 | 관리자로 이미지 3장 포함 글 작성 | 이미지가 Vercel Blob 주소로 표시, 썸네일 표시 | P1 | M |
| TC-DEP-003 | 쿠키 | 관리자 로그인, 좋아요 | `sw_session`, `sw_visitor`에 `Secure`, `HttpOnly`, `SameSite=Lax` | P1 | M |
| TC-DEP-004 | 큰 사진 업로드 | 스마트폰 원본(8~10MB) 업로드 | 브라우저 축소 후 정상 업로드 (요청 크기 오류 없음) | P1 | M |
| TC-DEP-005 | 화면 주소 새로고침 | `/posts/1`, `/admin/posts`에서 새로고침 | 404가 아니라 해당 화면 표시 (SPA 라우팅 설정) | P1 | M |
| TC-DEP-006 | Cron | Vercel 대시보드에서 Cron 수동 실행 | API-028 200, 로그에 결과 건수 | P2 | M |
| TC-DEP-007 | 환경변수 | Vercel 프로젝트 설정 확인 | §17 환경변수가 모두 설정, 코드에 비밀값 없음 | P1 | M |

---

# 15. 통합 테스트 (사용자 시나리오, E2E)

### TC-INT-001 방문자 시나리오 (P1)

```text
홈 접속
 ↓  카테고리별 3개 / 최신 5개 / 인기 5개 확인    (TC-HOME-001~004)
게시글 클릭 → 상세 열람 (본문 중간 이미지)        (TC-POST-009, TC-IMG-003)
 ↓
좋아요 → 다시 눌러 취소 → 다시 좋아요             (TC-LIKE-009)
 ↓
닉네임 + 비밀번호로 댓글 작성                     (TC-COM-001)
 ↓
다른 브라우저(다른 방문자)로 답글 작성            (TC-COM-006)
 ↓
첫 브라우저에서 비밀번호로 내 댓글 수정            (TC-COM-010)
 ↓
내 댓글 삭제 → "삭제된 댓글입니다" + 답글 유지     (TC-COM-014)
```

기대 결과: 회원가입/로그인 없이 모든 단계 완료 (PRD §17 성공 기준 1, 7~10)

### TC-INT-002 운영자 시나리오 (P1)

```text
관리자 로그인                                       (TC-ADM-001)
 ↓
카테고리 "여행" 추가 (맨 뒤) → 순서 변경            (TC-CAT-003, 009)
 ↓
"여행"에 이미지 3장이 본문 중간에 있는 글 작성      (TC-POST-001, TC-IMG-004)
 ↓
공개 홈에서 "여행" 섹션과 최신글, 썸네일 확인        (TC-HOME-005, 003, TC-IMG-022)
 ↓
글 수정: 이미지 1장 제거 + 순서 변경 → 수정일 갱신  (TC-IMG-015, 005, TC-POST-005)
 ↓
관리자 댓글 화면에서 부적절한 댓글 삭제              (TC-ADM-010)
 ↓
"여행" 삭제 시도 → 거부 → 글 삭제 → 카테고리 삭제    (TC-CAT-008, TC-POST-008, TC-CAT-007)
 ↓
로그아웃                                            (TC-ADM-005)
```

기대 결과: PRD §17 성공 기준 2~6 충족

### TC-INT-003 모바일 시나리오 (P2)

TC-INT-001을 360px 모바일 환경에서 동일하게 수행 → PRD §17 성공 기준 11

### TC-INT-004 보안 시나리오 (P1)

```text
미로그인 상태로 관리자 API 전체 호출 → 모두 401     (TC-ADM-004)
틀린 비밀번호 5회 → 잠금                            (TC-ADM-012)
악성 본문·댓글 입력 → 저장 거부 또는 실행 안 됨      (TC-SEC-001~005)
다른 Origin에서 상태 변경 요청 → 403                (TC-SEC-010)
```

---

# 16. Traceability Matrix (REQ → TC)

| REQ | 내용 | TC |
|---|---|---|
| REQ-001 | 관리자 역할 | TC-ADM-001, TC-INT-002 |
| REQ-002 | 방문자 역할 | TC-INT-001 |
| REQ-003 | 회원가입 제외 | TC-EXC-001 |
| REQ-004 | 홈 기본 구성 | TC-HOME-001 |
| REQ-005 | 카테고리별 최신글 | TC-HOME-002, 010 |
| REQ-006 | 전체 최신글 | TC-HOME-003 |
| REQ-007 | 인기글 | TC-HOME-004, 009 |
| REQ-008 | 카테고리 자동 반영 | TC-CAT-010, TC-HOME-005 |
| REQ-009 | 기본 카테고리 | TC-CAT-001 |
| REQ-010 | 카테고리 추가 | TC-CAT-003 |
| REQ-011 | 카테고리 수정 | TC-CAT-006 |
| REQ-012 | 카테고리 삭제 | TC-CAT-007, 008, 014 |
| REQ-013 | 카테고리 순서 | TC-CAT-002, 009, 013, TC-HOME-006 |
| REQ-014 | 게시글 등록 | TC-POST-001 |
| REQ-015 | 카테고리 지정 | TC-POST-003, 004, 006 |
| REQ-016 | 게시글 수정 | TC-POST-005 |
| REQ-017 | 게시글 삭제 | TC-POST-007, 008, TC-ADM-007 |
| REQ-018 | 본문 이미지 | TC-IMG-001, 003 |
| REQ-019 | 이미지 순서 | TC-IMG-004, 005, 015 |
| REQ-020 | 이미지 개수 | TC-IMG-006, 007, 008 |
| REQ-021 | 동영상 제외 | TC-EXC-003, TC-IMG-009 |
| REQ-022 | 게시글 상세 | TC-POST-009, TC-HOME-008 |
| REQ-023 | 카테고리 게시글 목록 | TC-POST-011, 013, 015, 016 |
| REQ-024 | 댓글 작성 | TC-COM-001 |
| REQ-025 | 댓글 표시 | TC-COM-005 |
| REQ-026 | 댓글 수정 | TC-COM-010, 011 |
| REQ-027 | 댓글 삭제 | TC-COM-012, 013, 014, 016, 017 |
| REQ-028 | 답글 작성 | TC-COM-006, 015 |
| REQ-029 | 답글 깊이 제한 | TC-COM-007, 008, 009, TC-EXC-004 |
| REQ-030 | 게시글 좋아요 | TC-LIKE-001, 002, 004, 009 |
| REQ-031 | 댓글 좋아요 제외 | TC-EXC-002 |
| REQ-032 | 중복 좋아요 | TC-LIKE-003, 006, 007, 008, 010, 011, 012 |
| REQ-033 | 게시글 관리 | TC-ADM-006 |
| REQ-034 | 카테고리 관리 | TC-CAT-003~014 |
| REQ-035 | 댓글 관리 | TC-ADM-009, 010, 011 |
| REQ-036 | 반응형 | TC-RES-001~005, 009~011 |
| REQ-037 | 모바일 표시 | TC-RES-006~008 |
| REQ-038 | 필수 입력 검증 | TC-CAT-004, TC-POST-002, 003, TC-COM-002, TC-VAL-004 |
| REQ-039 | 입력값 검증 | TC-CAT-005, 012, TC-POST-019, TC-COM-020, TC-VAL-001~005, 010, TC-IMG-009~011, 016, 017, 023 |
| REQ-040 | 존재하지 않는 콘텐츠 | TC-CAT-011, TC-POST-014, TC-LIKE-005, TC-VAL-008 |
| REQ-041 | 작업 실패 처리 | TC-COM-011, TC-VAL-007, 009, TC-ADM-008, 018 |
| REQ-042 | 관리자 보호 | TC-ADM-001~005, 012~021, TC-IMG-012, TC-SEC-010, 013 |
| REQ-043 | 비밀번호 보호 | TC-COM-003, 004, TC-SEC-006, 011 |
| REQ-044 | XSS 방지 | TC-POST-017, 018, TC-SEC-001~005, 007, 012, TC-COM-021 |

> **모든 REQ(001~044)에 최소 1개 이상의 TC가 연결되어 있다.**

### 결정 사항 → TC

| DEC | TC |
|---|---|
| DEC-001 본문 형식 | TC-POST-017, 018, TC-SEC-004, 012 |
| DEC-002 이미지 | TC-IMG-001, 004~024 |
| DEC-003 관리자 인증 | TC-ADM-001~005, 012~021 |
| DEC-004 좋아요 | TC-LIKE-001~013 |
| DEC-005 삭제 정책 | TC-CAT-008, 014, TC-POST-008, TC-COM-014, 016~019, TC-ADM-011 |
| DEC-006 표시 규칙 | TC-HOME-002~004, 009, TC-POST-013, TC-COM-005, 020, TC-CAT-012, TC-POST-019, TC-RES-001~005 |

---

# 17. 테스트 환경

| 구분 | 내용 | 상태 |
|---|---|---|
| Backend | Python + FastAPI, **테스트 전용 PostgreSQL DB** (개발·운영 DB와 분리) | 확정 |
| PostgreSQL 버전 | 개발 환경 구성 시 확정 (Neon 기본 버전 기준) | TBD-008 |
| DB 초기화 | 테스트마다 트랜잭션 롤백 | ✅ DEC-008 |
| 이미지 저장소 | `STORAGE_BACKEND=local`, 테스트 전용 `UPLOAD_ROOT` 임시 폴더, 테스트 후 삭제 | 확정 |
| 배포 확인 | Vercel 미리보기 배포 + Neon 미리보기 브랜치 + Vercel Blob | ✅ DEC-007 |
| 시간 | 만료·정리 규칙 테스트는 시간을 조작 (실제로 기다리지 않음) | 확정 |
| 환경변수 | 테스트용 `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`, `CRON_SECRET` | 확정 |
| Frontend | Vite 개발 서버 | 확정 |
| 브라우저 | Chrome, Edge, Safari(iOS), Chrome(Android) | 확정 |
| 화면 폭 | 360, 767, 768, 1024, 1280px | 확정 |

---

# 18. 테스트 데이터

| 데이터 | 내용 |
|---|---|
| 카테고리 | 기본 4개 + 테스트용 "여행", 글 없는 카테고리 1개 |
| 게시글 | 카테고리당 5개 이상, 한 카테고리는 25개 (페이징), 작성일·좋아요 수가 서로 다름, 좋아요 수가 같은 글 2개 |
| 이미지 게시글 | 이미지 0장, 3장, 20장인 글 각 1개 |
| 이미지 파일 | 4000×3000 jpg, 800×600 png, webp, gif, 10MB 초과 파일, mp4, 내용이 텍스트인 `.jpg` |
| 댓글 | 답글 없는 댓글, 답글 2개가 있는 댓글, soft delete된 댓글(답글 1개 / 2개) |
| 경계값 | DEC-006 길이 제한 경계 (최소-1, 최소, 최대, 최대+1), 공백만 있는 문자열, 긴 URL |
| 악성 입력 | `<script>`, `onerror`, `javascript:` 링크, 허용 안 된 TipTap 노드, `../` 파일명 |
| 관리자 | 테스트 전용 관리자 계정 (환경변수) |
| 방문자 | 서로 다른 `sw_visitor` 쿠키 2개 이상 |

---

# 19. Definition of Done

기능 하나가 "완료"되려면 다음을 모두 만족해야 한다.

1. 관련 REQ의 **P1 테스트가 모두 `Pass`**이다.
2. 관련 테스트 중 자동화(`A`) 항목은 자동 테스트로 작성되어 있고 통과한다.
3. Frontend Validation과 **Backend Validation이 모두** 동작한다.
4. 관련 보안 테스트(TC-SEC)를 통과한다.
5. Mobile(360px)에서 가로 스크롤 없이 동작한다.
6. 명세(DATA_MODEL / API_SPEC / COMPONENT_SPEC)와 구현이 일치한다. 다르면 **명세를 먼저 수정**하고 사용자 확인을 받는다.
7. 새로운 동작을 추가했다면 이 문서에 TC를 먼저 추가한다.

---

# 20. v0.1 Pending Policy 해소 내역

| TC (v0.1) | 대기 정책 | 결정 | v1.0 TC |
|---|---|---|---|
| TC-CAT-008 | 게시글 있는 카테고리 삭제 | DEC-005 (409 거부) | TC-CAT-008 |
| TC-POST-008 | 게시글 삭제 시 연결 데이터 | DEC-005 (CASCADE + 파일 삭제) | TC-POST-008 |
| TC-POST-013 | 페이징 방식 | DEC-006 (페이지 번호, 12개) | TC-POST-013 |
| TC-IMG-007 | 이미지 최대 개수 | DEC-002 (20장) | TC-IMG-007, 008 |
| TC-IMG-008, 009 | 허용 형식 / 최대 용량 | DEC-002 (jpg/png/webp/gif, 10MB) | TC-IMG-009, 010 |
| TC-COM-005 | 댓글 정렬 | DEC-006 (작성순) | TC-COM-005 |
| TC-COM-014 | 답글 있는 댓글 삭제 | DEC-005 (soft delete) | TC-COM-014, 016~019 |
| TC-LIKE-003 | 중복 좋아요 방지 | DEC-004 (쿠키, 토글) | TC-LIKE-003, 007~013 |
| TC-HOME-002 | 홈 카테고리별 게시글 수 | DEC-006 (3개) | TC-HOME-002 |
| TC-HOME-004 | 인기글 개수 / 기간 | DEC-006 (5개, 전체 기간) | TC-HOME-004, 009 |
| TC-ADM-001 | 관리자 인증 방식 | DEC-003 (세션) | TC-ADM-001, 012~021 |
| TC-ADM-009, 010 | 관리자 댓글 API | API_SPEC v1.0 (API-026, 027) | TC-ADM-009~011 |
| TC-VAL-005 | 길이 제한 | DEC-006 | TC-COM-020, TC-CAT-012, TC-POST-019 |
| TC-SEC-004 | 본문 sanitize 방식 | DEC-001 (허용 노드 검증) | TC-SEC-004, TC-POST-017, 018 |

### 남은 미확정 사항

| 항목 | 결정 시점 |
|---|---|
| PostgreSQL 버전 | 개발 환경 구성 시 (Neon 기본 버전 기준) |

> 테스트 도구와 DB 초기화 방식은 DEC-008로 확정되었다.

---

# 21. 다음 단계

```text
DATA_MODEL v1.0       ✅
API_SPEC v1.0         ✅
COMPONENT_SPEC v1.0   ✅
TEST_CASES v1.0       ← 현재 (완료)
TRD / REQUIREMENTS v1.1  ← 다음
Claude.md
구현
```

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-11-03 | 초기 테스트 케이스 작성 (REQ-001~044 전체 추적) |
| 1.0 (개정) | 2026-11-03 | DEC-007, 008 반영: 업로드 크기(원본 10MB / 서버 4MB)·브라우저 축소 테스트, 정리 작업 API-028 인증·멱등성 테스트, 초기 관리자 관리 명령, Vercel 미리보기 배포 확인 테스트(TC-DEP-001~007) 신규, 테스트 도구 확정 |
| 1.0 | 2026-11-03 | DEC-001~006, API_SPEC v1.0, COMPONENT_SPEC v1.0 반영: Pending Policy 14건 해소, 자동/수동 구분 추가, 테스트 추가(이미지 연결·리사이징·정리, soft delete, 좋아요 취소·멱등·동시성, 로그인 잠금·세션 만료, Origin 검사, 민감 정보 미노출), 통합 시나리오 보강(TC-INT-004 신규), DEC → TC 매핑 추가 |
