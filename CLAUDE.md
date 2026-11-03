# CLAUDE.md — SmallWorking 개발 헌법

> 이 파일은 Claude Code가 SmallWorking을 개발할 때 **항상 지켜야 하는 규칙**이다.
> 명세 문서가 "무엇을 만드는가"를 정한다면, 이 파일은 "어떻게 일하는가"를 정한다.

---

## 1. 프로젝트 한 줄 요약

**SmallWorking** — "지적인 대화를 위한 넓고 얕은 지식". 운영자 1명이 DIY·포트폴리오·블로그 글을 올리고, 방문자는 회원가입 없이 읽고, 좋아요를 누르고, 닉네임+비밀번호로 댓글을 다는 반응형 개인 홈페이지.

```text
React + TypeScript + Vite + Tailwind   →  Vercel (정적)
FastAPI + SQLAlchemy (Python 3.12)     →  Vercel Functions (/api/*)
PostgreSQL                             →  Neon
이미지                                  →  Vercel Blob (개발: 로컬 폴더)
```

---

## 2. 명세 문서 (Source of Truth)

작업 전에 **관련 문서를 먼저 읽는다.** 코드와 문서가 다르면 문서가 맞다.

| 문서 | 경로 | 역할 |
|---|---|---|
| PRD | `DOCS/01-product/SmallWorking_PRD_v1.0.md` | 무엇을 만드는가, 범위 |
| REQUIREMENTS | `DOCS/02-requirements/SmallWorking_REQUIREMENTS_v1.1.md` | REQ-001~044 |
| TRD | `DOCS/03-architecture/SmallWorking_TRD_v1.1.md` | 기술 스택, 아키텍처, 배포, 환경변수 |
| DATA_MODEL | `DOCS/04-data/SmallWorking_DATA_MODEL_v1.0.md` | 테이블, 제약조건, 삭제 정책 |
| API_SPEC | `DOCS/05-api/SmallWorking_API_SPEC_v1.0.md` | API-001~028, 오류 코드 |
| COMPONENT_SPEC | `DOCS/06-ui/SmallWorking_COMPONENT_SPEC_v1.0.md` | 화면, COMP-xxx, 타입 |
| TEST_CASES | `DOCS/07-testing/SmallWorking_TEST_CASES_v1.0.md` | TC-xxx, Definition of Done |
| DECISIONS | `DOCS/SmallWorking_DECISIONS.md` | DEC-001~008, 결정 이유 |

- **항상 가장 높은 버전 파일**을 읽는다. 이전 버전(v0.1 등)은 기록용이며 구현 기준이 아니다.
- 문서끼리 충돌하면 우선순위: **DECISIONS > DATA_MODEL / API_SPEC / COMPONENT_SPEC > TRD > REQUIREMENTS > PRD**. 그래도 애매하면 사용자에게 묻는다.
- `홈페이지.md`는 이전 ChatGPT 대화 기록이다. 배경 참고용이며 구현 기준이 아니다.

---

## 3. 절대 원칙

1. **명세에 없는 기능을 추가하지 않는다.** PRD §14, REQUIREMENTS §14의 범위 제외 기능(회원가입, 댓글 좋아요, 다단계 답글, 동영상 등)은 만들지 않는다.
2. **명세와 다르게 구현해야 할 이유가 생기면, 코드부터 바꾸지 않는다.** 이유를 설명하고 사용자 확인을 받은 뒤 → 문서 수정 → 코드 수정 순서로 한다.
3. **TBD / 미확정 사항을 임의로 정하지 않는다.** 선택지와 추천안을 제시하고 사용자가 정한다. 정해지면 DECISIONS에 기록한다.
4. **DEC-008 목록에 없는 라이브러리를 사용자 확인 없이 추가하지 않는다.** (패키지 하나라도 추가 전에 이유와 대안을 말한다.)
5. **비밀값을 코드에 쓰지 않는다.** DB 접속 정보, 관리자 계정, 토큰은 환경변수로만 다룬다. `.env`는 Git에 올리지 않는다.
6. **테스트 없이 "완료"라고 하지 않는다.** TEST_CASES §19 Definition of Done을 따른다. 테스트를 실행하지 못했으면 못했다고 말한다.
7. **기존 기능을 수정할 때는 관련 TC를 먼저 확인**하고, 수정 후 해당 테스트를 다시 실행한다.
8. **되돌리기 어려운 작업(파일·데이터 삭제, DB 마이그레이션 적용, 배포, 강제 push)은 실행 전에 사용자에게 확인**한다.

---

## 4. 작업 방식

### 4.1 사용자와의 대화

- 사용자와는 **한국어**로, **대화형**으로 진행한다.
- 결정이 필요하면 **한 번에 하나씩**, 선택지 + **추천안과 이유**를 함께 제시한다.
- 문서 초안을 만들면 **바로 `.md` 파일로 저장**한다 (내용만 보여주고 끝내지 않는다).
- 작업이 끝나면 무엇을 했고, 무엇을 확인해야 하고, 다음 단계가 무엇인지 짧게 알린다.

### 4.2 기능 하나를 구현하는 순서

```text
1. 관련 REQ / DEC / DATA_MODEL / API / COMP / TC 확인
2. 구현 계획을 짧게 설명 (명세와 다른 점이 있으면 여기서 질문)
3. Backend: 모델 → 마이그레이션 → 스키마 → 저장소(Repository) → 서비스 → 라우터
4. Backend 테스트 작성·실행 (관련 TC ID를 테스트 이름이나 주석에 남김)
5. Frontend: 타입 → 서비스 → 훅 → 컴포넌트 → 페이지
6. Frontend 테스트 작성·실행
7. 결과 보고: 통과한 TC, 실패하거나 실행 못 한 TC, 남은 일
```

### 4.3 새 기능·변경 요청이 들어오면

```text
PRD / REQUIREMENTS 범위 확인
   ↓ 범위 밖이면 사용자에게 알리고 문서 갱신 여부를 묻는다
DECISIONS → 관련 명세 문서 갱신
   ↓
TEST_CASES에 TC 추가
   ↓
구현
```

---

## 5. 기술 스택 (DEC-008, 변경 금지)

| 영역 | 사용 |
|---|---|
| Frontend | React, TypeScript, Vite, React Router, Tailwind CSS, TipTap |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, psycopg(v3), argon2-cffi, Pillow, Vercel Blob Python SDK |
| 테스트 | pytest + TestClient(httpx), Vitest + React Testing Library + jsdom, Playwright |
| 개발 도구 | uvicorn (로컬 실행), oxlint (Frontend 코드 검사) |
| 배포 | Vercel (GitHub 연동), Neon, Vercel Blob, Vercel Cron |
| 사용하지 않음 | 서버 데이터 캐시 라이브러리(TanStack Query 등), CSS-in-JS, 별도 UI 컴포넌트 라이브러리, JWT |

---

## 6. 디렉터리 구조

```text
SmallWorking/
├── CLAUDE.md
├── DOCS/                    # 명세 문서 (§2)
├── vercel.json              # 빌드, /api/* 연결, Cron
├── api/
│   └── index.py             # Vercel Functions 진입점 (backend app 불러오기만)
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app 생성, 라우터 등록, 오류 핸들러
│   │   ├── core/            # 설정(환경변수), 보안(해시, 세션), 의존성
│   │   ├── models/          # SQLAlchemy 모델 (DATA_MODEL과 1:1)
│   │   ├── schemas/         # Pydantic 요청/응답 (API_SPEC과 1:1)
│   │   ├── repositories/    # DB 접근
│   │   ├── services/        # 비즈니스 규칙 (삭제 정책, 이미지 연결 등)
│   │   ├── api/             # 라우터 (엔드포인트별 파일)
│   │   ├── storage/         # StorageBackend, LocalStorage, BlobStorage
│   │   └── cli.py           # create-admin, cleanup 등 관리 명령
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/           # PAGE-xxx
    │   ├── components/      # COMP-xxx (공통/기능별 하위 폴더)
    │   ├── hooks/           # useXxx 데이터 훅
    │   ├── services/        # apiClient.ts + 기능별 서비스
    │   ├── types/           # COMPONENT_SPEC §11
    │   └── lib/             # TipTap 렌더러, 이미지 축소 등 유틸
    ├── tests/
    ├── package.json
    └── vite.config.ts       # /api, /uploads → 로컬 FastAPI 프록시
```

---

## 7. 코딩 규칙

### 7.1 공통

- 이름: Python은 `snake_case`, TypeScript 변수·함수는 `camelCase`, 컴포넌트·타입은 `PascalCase`. API JSON 필드는 `snake_case` (API_SPEC §2).
- 사용자에게 보이는 문구는 **한국어**. 코드 식별자는 영어. 주석은 한국어 또는 영어 모두 가능.
- 명세 ID를 코드에 남긴다: 예) `# API-017`, `// COMP-133`, `def test_tc_com_007_reply_depth()`.
- 한 함수·컴포넌트는 한 가지 일만 한다. 비슷한 코드가 세 번 나오면 공통화를 검토한다.

### 7.2 Backend

- 라우터에는 요청 검증과 응답 변환만 둔다. **규칙(삭제 정책, 답글 깊이, 이미지 연결, 좋아요 증감)은 services에** 둔다.
- 모든 입력은 Pydantic 스키마로 검증한다. 문자열은 앞뒤 공백 제거 후 길이 검사 (DEC-006).
- 오류는 반드시 API_SPEC §12 형식(`{"error": {"code","message","details"}}`)과 §12.2 오류 코드를 사용한다. FastAPI 기본 422도 변환한다.
- 응답에 `password`, `password_hash`, `token_hash`, `visitor_key`를 절대 넣지 않는다.
- 좋아요 증감, 게시글 저장 + 이미지 연결은 **하나의 트랜잭션**. 파일 삭제는 **DB 커밋 후**.
- 고정 경로 라우트를 변수 경로보다 먼저 선언한다 (API_SPEC §2.4).
- 관리자 API는 공통 의존성(`require_admin`)으로 보호한다. 상태 변경 요청은 Origin 검사 (API_SPEC §2.3).
- 이미지 저장은 **항상 `StorageBackend`를 통해서만** 한다. 파일 경로를 직접 다루지 않는다.

### 7.3 Frontend

- API 호출은 `services/apiClient.ts`를 통해서만 한다 (`credentials: 'include'`, ApiError 변환, 401 처리).
- 타입은 `types/`에 두고 API_SPEC 응답과 맞춘다. `any`를 쓰지 않는다.
- **`dangerouslySetInnerHTML` 금지.** 본문은 `lib/`의 TipTap JSON 렌더러로 허용된 노드만 그린다 (COMPONENT_SPEC §8.3).
- 스타일은 Tailwind 유틸리티 클래스. **Mobile First**로 작성하고 `md:`(768px), `lg:`(1024px)로 확장한다. 어떤 폭(최소 360px)에서도 가로 스크롤이 없어야 한다.
- 오류 메시지는 서버 응답의 `error.message`를 그대로 보여준다.

---

## 8. 보안 체크리스트 (구현할 때마다 확인)

- [ ] 관리자 API에 `require_admin`이 붙어 있는가 (TC-ADM-004)
- [ ] 상태 변경 요청에 Origin 검사가 적용되는가 (TC-SEC-010)
- [ ] 비밀번호는 Argon2 해시로만 저장하는가 (TC-SEC-006)
- [ ] 응답에 민감 필드가 없는가 (TC-SEC-011)
- [ ] 본문은 허용 노드만 저장·렌더링하는가, 댓글은 일반 텍스트인가 (TC-SEC-001~005)
- [ ] 업로드 파일은 실제 형식을 검사하고 서버가 만든 이름으로 저장하는가 (TC-IMG-011, 023)
- [ ] 쿠키는 `HttpOnly`, `SameSite=Lax`, 운영에서 `Secure`인가 (TC-ADM-020, TC-LIKE-013)
- [ ] 비밀값이 코드·로그·커밋에 없는가 (TC-SEC-009)

---

## 9. Vercel 제약 (DEC-007)

- 함수에는 **오래 유지되는 디스크가 없다** → 파일은 Vercel Blob에 저장 (개발은 LocalStorage).
- 요청 본문 크기 제한(약 4.5MB) → 서버 업로드 최대 **4MB**, 브라우저에서 1920px로 먼저 축소.
- **서버 시작 시점이 없다** → 시작할 때 실행하는 코드(초기 데이터 생성, 마이그레이션)를 두지 않는다. 관리 명령으로 실행한다.
- 백그라운드 작업 없음 → 정리 작업은 Vercel Cron이 `/api/cron/cleanup`(API-028)을 하루 1회 호출.
- 실행 시간 제한 → 한 요청에서 오래 걸리는 처리를 하지 않는다. 정리 작업은 한 번에 처리하는 개수를 제한한다.
- 정확한 제한 값은 구현 시 **Vercel 공식 문서로 확인**하고, 문서와 다르면 사용자에게 알린다.

---

## 10. 환경변수 (TRD v1.1 §17)

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 접속 |
| `STORAGE_BACKEND` | `local` / `blob` |
| `UPLOAD_ROOT` | 로컬 저장 폴더 (개발) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (운영) |
| `BLOB_PUBLIC_BASE_URL` | Vercel Blob store 공개 주소 — 저장 키로 이미지 주소를 만든다 (운영, M4 추가) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `create-admin` 명령에서만 사용 |
| `ALLOWED_ORIGINS` | Origin 검사 허용 주소 |
| `CRON_SECRET` | API-028 인증 |
| `COOKIE_SECURE` | 운영 `true`, 로컬 `false` |

- 새 환경변수가 필요하면 TRD §17과 이 표를 먼저 갱신한다. `.env.example`에는 이름만 두고 값은 비운다.

---

## 11. 테스트 규칙

- Backend: `backend/tests/`, pytest. 테스트 DB는 개발 DB와 분리하고 **테스트마다 트랜잭션 롤백**.
- 이미지 테스트는 `STORAGE_BACKEND=local` + 임시 `UPLOAD_ROOT`. 실제 Blob은 미리보기 배포에서 확인 (TC-DEP).
- 시간 규칙(24시간, 2시간, 7일, 10분)은 **기다리지 않고 시간을 조작**해 테스트한다.
- Frontend: Vitest + React Testing Library. E2E: Playwright (360 / 768 / 1280px 포함).
- 테스트 이름이나 주석에 TC ID를 남긴다.
- 실패한 테스트를 지우거나 건너뛰게 만들어 통과시키지 않는다. 실패 원인을 보고한다.

---

## 12. Git 규칙

- 저장소 초기화와 GitHub 연결은 사용자와 함께 진행한다 (현재 Git 저장소 아님).
- `main` = 운영 배포. 기능 작업은 브랜치(`feat/...`, `fix/...`, `docs/...`)에서 한다.
- 커밋 메시지: `<type>: <요약>` (예: `feat: 댓글 soft delete (API-017, TC-COM-014)`). type은 `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- 문서 변경과 코드 변경은 가능하면 커밋을 나눈다.
- `.env`, `backend/uploads/`, `node_modules/`, 빌드 결과물은 커밋하지 않는다.
- 강제 push, 기록 재작성, `main` 직접 push는 사용자 확인 후에만 한다.

---

## 13. 구현 순서 (제안)

| 단계 | 내용 | 주요 TC |
|---|---|---|
| M0 | 저장소·프로젝트 뼈대: Vite+Tailwind, FastAPI, Alembic, 로컬 PostgreSQL, 프록시, 테스트 실행 환경 | — |
| M1 | DB 모델·마이그레이션·Seed, 공통 오류 형식, apiClient | TC-CAT-001, TC-VAL-006 |
| M2 | 관리자 인증 (로그인·잠금·세션·Origin 검사·create-admin) | TC-ADM-001~005, 012~021 |
| M3 | 카테고리 API + 관리 화면 + 공개 메뉴 | TC-CAT-* |
| M4 | 이미지 업로드 (StorageBackend, 브라우저 축소, 썸네일) | TC-IMG-001~014, 023~026 |
| M5 | 게시글 API + TipTap 에디터 + 본문 렌더러 | TC-POST-*, TC-IMG-015~022, TC-SEC-004 |
| M6 | 공개 화면: 홈, 카테고리 목록, 게시글 상세 | TC-HOME-*, TC-POST-009~016 |
| M7 | 좋아요 | TC-LIKE-* |
| M8 | 댓글·답글·soft delete + 관리자 댓글 관리 | TC-COM-*, TC-ADM-009~011 |
| M9 | 정리 작업 (API-028, cli cleanup) | TC-IMG-021, 027, 028 |
| M10 | 반응형·보안 점검, E2E | TC-RES-*, TC-SEC-*, TC-INT-* |
| M11 | Vercel 배포 (Neon, Blob, Cron, 환경변수) | TC-DEP-* |

각 단계가 끝나면 사용자에게 결과를 보고하고 다음 단계로 넘어갈지 확인한다.

---

## 14. 명령어

> Windows PowerShell 기준. Backend 명령은 `backend/`, Frontend 명령은 `frontend/` 폴더에서 실행한다.

| 작업 | 명령 |
|---|---|
| Backend 가상환경 만들기 (최초 1회) | `py -3.12 -m venv .venv` → `.\.venv\Scripts\python -m pip install -r requirements-dev.txt` |
| Backend 실행 | `.\.venv\Scripts\python -m uvicorn app.main:app --reload` → http://127.0.0.1:8000/api/docs |
| Frontend 설치 (최초 1회) | `npm install` |
| Frontend 실행 | `npm run dev` → http://localhost:5173 (`/api`, `/uploads`는 Backend로 프록시) |
| 마이그레이션 적용 | `.\.venv\Scripts\python -m alembic upgrade head` |
| 마이그레이션 생성 | `.\.venv\Scripts\python -m alembic revision --autogenerate -m "<설명>"` (생성된 파일은 반드시 검토) |
| 관리자 생성 | `.\.venv\Scripts\python -m app.cli create-admin` (M2) |
| 정리 작업 (로컬) | `.\.venv\Scripts\python -m app.cli cleanup` (24시간 지난 임시 이미지·고아 파일, 만료 세션) |
| Backend 테스트 | `.\.venv\Scripts\python -m pytest` (테스트 DB `smallworking_test` 사용) |
| Frontend 테스트 | `npm test` |
| Frontend 타입 검사 + 빌드 | `npm run build` |
| Frontend lint | `npm run lint` |
| E2E 테스트 | (M10에서 Playwright 설치 시 확정) |

### 로컬 환경 메모

- Python: 프로젝트는 **3.12** (`backend/.venv`). PC에 3.13도 있으므로 `py -3.12`로 지정한다.
- PowerShell에서 `npm`이 "스크립트를 실행할 수 없으므로" 오류를 내면 실행 정책 문제다. `npm.cmd run dev`처럼 `npm.cmd`를 쓰거나, 사용자가 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`를 한 번 실행한다 (시스템 설정이므로 Claude가 임의로 바꾸지 않는다).
- PostgreSQL 17 (Windows 서비스 `postgresql-x64-17`, 자동 시작). DB: `smallworking_dev`, `smallworking_test` / 앱 계정: `smallworking`.
- 비밀값 위치: `backend/.env` (앱 설정), 루트 `.env.local` (PostgreSQL 관리자 비밀번호). 둘 다 Git 제외.
- `backend/alembic.ini`는 **ASCII만** 사용한다 (Alembic이 cp949로 읽음).
- `.env` 파일은 BOM이 있어도 읽히도록 처리되어 있다 (`app/core/config.py`).

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-11-03 | 최초 작성 (PRD v1.0, REQUIREMENTS v1.1, TRD v1.1, DATA_MODEL·API_SPEC·COMPONENT_SPEC·TEST_CASES v1.0, DEC-001~008 기준) |
