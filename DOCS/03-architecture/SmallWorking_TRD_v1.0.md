# SmallWorking TRD v1.0

> 프로젝트명: SmallWorking  
> 프로젝트 성격: 개인 홈페이지 / 콘텐츠 공유 및 소통 사이트  
> 모토: **지적인 대화를 위한 넓고 얕은 지식**  
> 문서 버전: v1.0  
> 기준 문서: `docs/01-product/PRD.md`, `docs/02-requirements/REQUIREMENTS.md`

---

# 1. 문서 목적

본 문서는 SmallWorking의 REQUIREMENTS v1.0을 만족하기 위해 사용할 **기술 스택, 시스템 아키텍처, 데이터 접근 구조, 파일 저장 구조, 개발 및 배포 방향**을 정의한다.

PRD가 **무엇을 만들 것인가**, REQUIREMENTS가 **무엇을 만족해야 하는가**를 정의했다면, TRD는 이를 구현하기 위한 **기술적인 방법과 구조**를 정의한다.

```text
PRD
 ↓
REQUIREMENTS
 ↓
TRD
 ↓
DATA_MODEL / API_SPEC / COMPONENT_SPEC
 ↓
TEST_CASES
 ↓
Implementation
```

본 문서에서 확정하지 않은 세부 사항은 후속 설계 문서에서 결정한다.

---

# 2. 기술 스택 요약

| 영역 | 기술 | 결정 |
|---|---|---|
| Frontend | React | 확정 |
| Frontend Language | TypeScript | 확정 |
| Build Tool | Vite | 확정 |
| Backend | FastAPI | 확정 |
| Backend Language | Python | 확정 |
| API | REST API | 확정 |
| ORM | SQLAlchemy | 확정 |
| Database | PostgreSQL | 확정 |
| Image Storage | 서버 파일 시스템 | 확정 |
| Rich Text Editor | TipTap | 후보 |
| Authentication | 관리자 인증 | 세부 방식 TBD |
| Deployment | 서버 환경 | 세부 환경 TBD |

---

# 3. 기술 선택 원칙

SmallWorking의 기술 선택은 다음 원칙을 따른다.

1. 개인 프로젝트로 개발 및 유지보수가 가능해야 한다.
2. 웹 개발의 기본 구조를 이해하기 좋은 기술을 우선한다.
3. 특정 기술이나 서비스에 과도하게 종속되지 않도록 한다.
4. 향후 기능 확장이 가능한 구조를 사용한다.
5. AI-assisted development 및 Claude Code를 활용하기 좋은 구조를 지향한다.
6. 개발 환경과 운영 환경의 차이를 최소화한다.
7. 요구사항과 기술 구현을 명확하게 분리한다.

---

# 4. 전체 시스템 아키텍처

SmallWorking은 Frontend와 Backend를 분리하는 구조를 사용한다.

```text
┌─────────────────────────────────────┐
│             Web Browser             │
│                                     │
│       React + TypeScript + Vite     │
└──────────────────┬──────────────────┘
                   │
                   │ HTTP / REST API
                   ↓
┌─────────────────────────────────────┐
│               Backend               │
│                                     │
│              FastAPI                │
│                 │                   │
│            SQLAlchemy               │
│                 │                   │
│        ┌────────┴────────┐          │
│        ↓                 ↓          │
│   PostgreSQL         File Storage   │
│      Data              Images       │
└─────────────────────────────────────┘
```

---

# 5. Frontend

## 5.1 React

Frontend UI는 React를 사용한다.

React를 사용하는 이유:

- 컴포넌트 기반 개발이 가능하다.
- 페이지와 기능을 독립적으로 구성하기 쉽다.
- 커뮤니티 및 라이브러리 생태계가 풍부하다.
- Claude Code를 이용한 코드 생성 및 유지보수에 적합하다.
- 향후 기능 확장이 용이하다.

---

## 5.2 TypeScript

Frontend 개발 언어는 TypeScript를 사용한다.

TypeScript를 사용하는 이유:

- JavaScript에 정적 타입 기능을 제공한다.
- API 데이터 구조를 명확하게 정의할 수 있다.
- 대규모 코드에서 오류를 줄이는 데 도움이 된다.
- React 프로젝트에서 널리 사용된다.

---

## 5.3 Vite

React 프로젝트의 개발 서버 및 Build Tool은 Vite를 사용한다.

Vite의 주요 역할:

```text
개발 서버
   +
TypeScript/React 처리
   +
Production Build
```

---

# 6. Backend

## 6.1 FastAPI

Backend API 서버는 Python 기반 FastAPI를 사용한다.

FastAPI를 사용하는 이유:

- REST API 작성이 간결하다.
- Python 기반이라 AI 및 데이터 처리 기능 확장에 유리하다.
- API 타입 정의와 검증을 명확하게 구성할 수 있다.
- OpenAPI 기반 API 문서를 자동으로 제공할 수 있다.

Backend의 기본 역할:

- 게시물 API
- 카테고리 API
- 댓글 API
- 답글 API
- 좋아요 API
- 관리자 기능 API
- 이미지 업로드 처리
- 인증 처리
- 데이터 검증

---

# 7. API 통신

Frontend와 Backend 간 통신은 REST API를 사용한다.

```text
React
  │
  │ HTTP Request
  ↓
FastAPI
  │
  │ Database / File 처리
  ↓
PostgreSQL / File Storage
```

기본 HTTP Method는 다음 원칙을 따른다.

| Method | 용도 |
|---|---|
| GET | 조회 |
| POST | 생성 |
| PUT / PATCH | 수정 |
| DELETE | 삭제 |

구체적인 API URL과 Request/Response 구조는 `API_SPEC.md`에서 정의한다.

---

# 8. Database

## 8.1 PostgreSQL

SmallWorking의 관계형 데이터베이스는 PostgreSQL을 사용한다.

SQLite로 시작하지 않고 PostgreSQL을 초기 단계부터 사용한다.

선택 이유:

- 관계형 데이터 모델에 적합하다.
- 게시물/카테고리/댓글/답글/좋아요 등의 관계를 명확하게 표현할 수 있다.
- 실제 서버 환경에서 사용하는 DB 구조를 학습할 수 있다.
- 향후 데이터가 증가해도 확장하기 좋다.
- 프로젝트 초기부터 운영 환경과 유사한 DB 구조를 사용할 수 있다.

---

# 9. ORM

Backend의 데이터베이스 접근에는 SQLAlchemy를 사용한다.

구조:

```text
FastAPI
   ↓
SQLAlchemy
   ↓
PostgreSQL
```

SQLAlchemy의 역할:

- Python 객체와 DB 테이블 연결
- CRUD 처리
- DB 세션 관리
- 관계 데이터 처리

실제 테이블과 컬럼 구조는 `DATA_MODEL.md`에서 정의한다.

---

# 10. 이미지 저장

## 10.1 저장 위치

게시물 이미지는 PostgreSQL에 Binary 데이터로 저장하지 않는다.

실제 이미지 파일은 **서버 파일 시스템에 저장**한다.

```text
Server
│
├── Application
│
├── PostgreSQL
│
└── uploads/
    └── images/
        ├── 2026/
        │   ├── image-001.jpg
        │   ├── image-002.jpg
        │   └── ...
        └── ...
```

PostgreSQL에는 이미지 파일 자체가 아니라 이미지와 게시물의 관계 및 파일 위치를 관리하는 정보를 저장한다.

예:

```text
Post
 └── Image
      ├── file_name
      ├── file_path
      ├── display_order
      └── ...
```

정확한 이미지 테이블 구조는 `DATA_MODEL.md`에서 정의한다.

---

## 10.2 이미지 처리 원칙

이미지는 게시물 본문의 원하는 위치에 삽입할 수 있어야 한다.

따라서 단순히 게시물에 이미지 목록만 연결하는 것이 아니라 **본문 내 이미지 위치를 표현할 수 있는 구조**를 고려한다.

구체적인 Editor 데이터 형식은 `COMPONENT_SPEC.md`와 `DATA_MODEL.md`에서 확정한다.

---

## 10.3 이미지 용량

v1.0에서는 게시물 하나당 약 20개의 이미지를 지원한다.

정확한 최대 개수 및 파일 크기 제한은 다음 설계 단계에서 결정한다.

```text
OPEN
- 개별 이미지 최대 용량
- 허용 이미지 형식
- 이미지 리사이징 여부
- 썸네일 생성 여부
- 전체 저장공간 관리 정책
```

---

# 11. Rich Text Editor

게시물 본문 작성에는 Rich Text Editor를 사용한다.

현재 후보 기술은 **TipTap**이다.

Editor는 다음 기능을 지원할 수 있어야 한다.

- 텍스트 입력
- 기본 텍스트 서식
- 이미지 삽입
- 본문 중간 이미지 배치
- 이미지 순서 관리

다만 TipTap의 최종 채택 및 세부 Editor 기능은 `COMPONENT_SPEC.md` 작성 단계에서 확정한다.

---

# 12. 인증 및 권한

SmallWorking은 다음 두 종류의 사용자를 구분한다.

```text
Admin
  └── 관리 기능 사용

Visitor
  └── 공개 콘텐츠 이용
```

방문자는 회원가입 및 로그인을 하지 않는다.

관리자는 관리자 기능을 사용할 수 있도록 별도의 인증 절차를 거쳐야 한다.

관리자 인증 방식은 현재 TBD로 둔다.

후속 설계에서 다음 사항을 결정한다.

- 관리자 로그인 방식
- 세션 또는 Token 방식
- 관리자 비밀번호 저장 방식
- 인증 만료 정책
- 관리자 API 접근 제어

---

# 13. 댓글 비밀번호

방문자는 회원가입 없이 댓글을 작성한다.

댓글 수정/삭제 시 작성 당시 입력한 비밀번호를 사용한다.

비밀번호는 평문으로 저장하지 않는다.

Backend에서 안전한 방식으로 저장 및 검증한다.

구체적인 해시 알고리즘과 구현 방식은 보안 설계 및 API 설계 단계에서 확정한다.

---

# 14. 기본 보안

SmallWorking은 최소한 다음 보안 항목을 고려한다.

## 14.1 입력값 검증

Backend에서 모든 주요 입력값을 검증한다.

```text
Browser
   ↓
Frontend Validation
   ↓
Backend Validation
   ↓
Database
```

Frontend 검증만으로 데이터의 유효성을 판단하지 않는다.

---

## 14.2 XSS 대응

게시물 본문과 댓글에는 HTML/Script 기반 공격이 발생하지 않도록 적절한 Sanitization 및 출력 처리를 적용한다.

특히 Rich Text Editor에서 생성되는 HTML 또는 콘텐츠 구조를 신뢰하지 않고 서버 측에서도 검증한다.

---

## 14.3 관리자 API 보호

관리자 전용 API는 인증되지 않은 방문자가 사용할 수 없어야 한다.

---

# 15. 프로젝트 디렉터리 구조

최종 프로젝트는 다음과 같은 방향으로 구성한다.

```text
SmallWorking/
│
├── .claude/
│
├── docs/
│   ├── 01-product/
│   │   └── PRD.md
│   │
│   ├── 02-requirements/
│   │   └── REQUIREMENTS.md
│   │
│   ├── 03-architecture/
│   │   └── TRD.md
│   │
│   ├── 04-data/
│   │   └── DATA_MODEL.md
│   │
│   ├── 05-api/
│   │   └── API_SPEC.md
│   │
│   ├── 06-ui/
│   │   └── COMPONENT_SPEC.md
│   │
│   └── 07-testing/
│       └── TEST_CASES.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── assets/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── core/
│   │
│   ├── uploads/
│   │   └── images/
│   │
│   ├── tests/
│   └── requirements.txt
│
├── tests/
│
├── Claude.md
├── README.md
└── .gitignore
```

> 위 구조는 최종적인 방향을 정의한 것이며, 실제 디렉터리와 파일 생성은 구현 단계에서 진행한다.

---

# 16. Frontend / Backend 책임 분리

각 영역의 책임을 명확하게 분리한다.

| 기능 | Frontend | Backend |
|---|---|---|
| 화면 표시 | O | X |
| 사용자 입력 UI | O | X |
| 입력값 1차 검증 | O | O |
| 데이터 저장 | X | O |
| 데이터 조회 | API 호출 | O |
| DB 접근 | X | O |
| 이미지 업로드 UI | O | O |
| 이미지 파일 저장 | X | O |
| 관리자 인증 UI | O | O |
| 권한 확인 | X | O |

중요한 원칙:

> Frontend는 사용자 인터페이스를 담당하고, Backend는 데이터와 권한을 최종적으로 책임진다.

---

# 17. 환경 분리

개발 환경과 운영 환경을 구분한다.

```text
Development
    ↓
Local Frontend
Local FastAPI
Local PostgreSQL
Local File Storage

Production
    ↓
Production Frontend
Production FastAPI
Production PostgreSQL
Production File Storage
```

DB 접속 정보, 관리자 인증 정보 등 환경별 설정값은 코드에 직접 작성하지 않고 환경 변수 등 별도의 설정 방식으로 관리한다.

구체적인 환경 변수 관리 방법은 구현 단계에서 정의한다.

---

# 18. 배포 방향

SmallWorking은 최종적으로 실제 인터넷에서 접근 가능한 웹사이트로 배포한다.

기본적인 운영 구조는 다음을 목표로 한다.

```text
Internet
   ↓
Web Server / Reverse Proxy
   ↓
Frontend
   ↓
Backend API
   ├── PostgreSQL
   └── Image File Storage
```

실제 클라우드 또는 서버 제공업체는 v1.0 TRD에서는 확정하지 않는다.

배포 환경 선택 시 다음을 고려한다.

- 비용
- PostgreSQL 지원
- 서버 파일 저장공간
- 백업
- HTTPS
- 도메인 연결
- 유지보수 편의성

---

# 19. 개발 도구

개발 과정에서는 Claude Code를 AI 개발 보조 도구로 사용한다.

Claude Code의 역할:

- Spec 문서 기반 코드 생성
- 코드 수정
- 테스트 코드 작성
- 오류 분석
- 리팩터링 지원
- 문서 업데이트 지원

단, Claude Code가 임의로 요구사항이나 설계를 변경하지 않도록 프로젝트의 `Claude.md`에서 개발 규칙을 정의한다.

---

# 20. SDD 문서와 기술 구조의 관계

SmallWorking의 문서는 다음과 같이 연결한다.

```text
PRD
 │
 │ 제품 목표 / 범위
 ↓
REQUIREMENTS
 │
 │ 기능 요구사항
 ↓
TRD
 │
 │ 기술 / 아키텍처
 ├───────────────┐
 ↓               ↓
DATA_MODEL      API_SPEC
 │               │
 └───────┬───────┘
         ↓
 COMPONENT_SPEC
         ↓
 TEST_CASES
         ↓
      CODE
```

새로운 기능이 추가되는 경우 코드부터 수정하지 않는다.

권장 흐름:

```text
새로운 아이디어
      ↓
PRD / REQUIREMENTS 검토
      ↓
필요한 요구사항 추가 또는 수정
      ↓
TRD / DATA / API / COMPONENT 수정
      ↓
TEST_CASES 수정
      ↓
Implementation
```

---

# 21. TRD에서 확정된 사항

v1.0에서 다음 기술 선택을 확정한다.

```text
Frontend
React + TypeScript + Vite

Backend
Python + FastAPI

API
REST API

Database
PostgreSQL

ORM
SQLAlchemy

Image Storage
Server File System
```

이 기술 선택은 이후 DATA_MODEL, API_SPEC, COMPONENT_SPEC 작성의 기준으로 사용한다.

---

# 22. 미확정 사항

다음 항목은 후속 문서에서 결정한다.

| ID | 항목 | 결정 문서 |
|---|---|---|
| TBD-001 | TipTap 최종 채택 여부 | COMPONENT_SPEC |
| TBD-002 | 관리자 인증 방식 | TRD 보완 / API_SPEC |
| TBD-003 | JWT 또는 Session 방식 | 인증 설계 |
| TBD-004 | 이미지 최대 파일 크기 | API_SPEC |
| TBD-005 | 이미지 허용 확장자 | API_SPEC |
| TBD-006 | 이미지 리사이징 정책 | COMPONENT_SPEC / TRD |
| TBD-007 | 이미지 썸네일 정책 | COMPONENT_SPEC |
| TBD-008 | PostgreSQL 버전 | 개발/배포 환경 |
| TBD-009 | 실제 배포 서버 | 배포 단계 |
| TBD-010 | Reverse Proxy | 배포 단계 |
| TBD-011 | 백업 정책 | 운영 단계 |

---

# 23. 요구사항 추적성

TRD의 기술 선택은 REQUIREMENTS와 연결되어야 한다.

예:

```text
REQ-014 게시물 등록
        ↓
FastAPI
        ↓
SQLAlchemy
        ↓
PostgreSQL

REQ-018 게시물 본문 이미지
        ↓
React Editor
        ↓
FastAPI Upload
        ↓
Server File Storage
        ↓
PostgreSQL Image Metadata
```

향후 각 설계 문서와 테스트 케이스에도 Requirement ID를 가능한 한 유지한다.

---

# 24. 버전 관리

| 버전 | 내용 |
|---|---|
| v0.1 | 기술 후보 검토 |
| **v1.0** | SmallWorking 초기 기술 스택 및 아키텍처 확정 |
| v1.x | 기존 기술 구조의 보완 |
| v2.0 | 주요 기술 구조 변경 또는 대규모 확장 |

---

# 25. 다음 단계

TRD v1.0 확정 후 다음 문서를 작성한다.

```text
04-data/
└── DATA_MODEL.md
```

DATA_MODEL에서는 SmallWorking에서 실제로 사용할 데이터 구조를 정의한다.

예상 주요 데이터:

```text
Category
    │
    └── Post
          │
          ├── PostImage
          │
          ├── Comment
          │      └── Reply
          │
          └── Like
```

다음 단계에서는 각 데이터의 필드, 관계, 제약조건, 삭제 정책 등을 구체적으로 정의한다.

---

## 핵심 정리

SmallWorking의 기술적 기본 방향은 다음과 같다.

> **React + TypeScript + Vite / FastAPI + Python / SQLAlchemy + PostgreSQL / Server File System**

이 구조를 기준으로 이후 데이터 모델, API, UI 컴포넌트, 테스트를 설계한다.
