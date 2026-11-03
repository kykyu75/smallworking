# SmallWorking COMPONENT_SPEC

- Document: COMPONENT_SPEC.md
- Version: 0.1 (Draft)
- Status: Review
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.0 / TRD v1.0 / DATA_MODEL v0.1 / API_SPEC v0.1

---

## 1. 목적

이 문서는 SmallWorking Frontend(React + TypeScript + Vite)의 **화면(Page)과 컴포넌트(Component) 구조**를 정의한다.

디자인(색상, 폰트, 시각 스타일)을 정하는 문서가 아니라 다음을 정하는 문서다.

> **어떤 화면이 필요하고, 화면 안에 어떤 기능 단위가 있으며, 각각 어떤 API와 요구사항에 연결되는가?**

```text
REQUIREMENTS (REQ-xxx)
        ↓
API_SPEC (API-xxx)
        ↓
COMPONENT_SPEC (COMP-xxx)   ← 현재 문서
        ↓
TEST_CASES (TC-xxx)
        ↓
React 구현
```

---

## 2. 기본 원칙

| 항목 | 원칙 |
|---|---|
| 언어 | 모든 컴포넌트는 TypeScript(`.tsx`)로 작성 |
| 컴포넌트 위치 | 공통 컴포넌트 `src/components/`, 페이지 `src/pages/` |
| API 호출 | 컴포넌트에서 직접 `fetch`하지 않고 `src/services/`를 통해 호출 |
| 타입 | API 응답 타입은 `src/types/`에 정의 (API_SPEC과 일치) |
| 반응형 | **Mobile → Tablet → Desktop** 순서로 설계 (Mobile First) |
| 데이터 책임 | 화면은 표시와 입력만 담당하며 최종 검증과 권한 판단은 Backend가 한다 (TRD §16) |
| 작성자 표시 | 게시글 작성자는 항상 운영자(SmallWorking)로 표시하며 별도 작성자 입력은 없다 |

---

## 3. 화면(라우트) 목록

### 3.1 공개 화면 (Visitor)

| ID | Route | Page | 설명 | 관련 REQ |
|---|---|---|---|---|
| PAGE-001 | `/` | HomePage | 홈 (카테고리별 최신글, 최신글, 인기글) | REQ-004~008 |
| PAGE-002 | `/category/:categoryId` | CategoryPostListPage | 카테고리별 게시글 목록 | REQ-023 |
| PAGE-003 | `/posts/:postId` | PostDetailPage | 게시글 상세, 좋아요, 댓글 | REQ-022, 024~030 |
| PAGE-004 | `*` | NotFoundPage | 존재하지 않는 페이지/콘텐츠 | REQ-040 |

### 3.2 관리자 화면 (Admin)

| ID | Route | Page | 설명 | 관련 REQ |
|---|---|---|---|---|
| PAGE-101 | `/admin/login` | AdminLoginPage | 관리자 로그인 | REQ-042 |
| PAGE-102 | `/admin` | AdminDashboardPage | 관리자 메인 (각 관리 메뉴로 이동) | REQ-001 |
| PAGE-103 | `/admin/categories` | CategoryManagementPage | 카테고리 추가·수정·삭제·순서 변경 | REQ-010~013, 034 |
| PAGE-104 | `/admin/posts` | PostManagementPage | 게시글 목록 및 삭제 | REQ-033 |
| PAGE-105 | `/admin/posts/new` | PostEditorPage | 게시글 작성 | REQ-014, 015, 018~020 |
| PAGE-106 | `/admin/posts/:postId/edit` | PostEditorPage | 게시글 수정 (작성 화면 재사용) | REQ-016 |
| PAGE-107 | `/admin/comments` | CommentManagementPage | 댓글·답글 조회 및 삭제 | REQ-035 |

> `/admin/*` 화면은 인증되지 않은 경우 `/admin/login`으로 이동한다(RequireAdmin). 실제 권한 판단은 Backend에서 한다.

---

## 4. 전체 컴포넌트 트리

```text
App
├── PublicLayout
│   ├── Header
│   │   ├── Logo
│   │   ├── CategoryMenu          (Desktop/Tablet: 가로 메뉴)
│   │   └── MobileMenu            (Mobile: 햄버거 + 드로어)
│   ├── <Outlet>
│   │   ├── HomePage
│   │   │   ├── IntroSection
│   │   │   ├── CategorySection × N
│   │   │   │   └── PostCard × N
│   │   │   ├── LatestPosts
│   │   │   │   └── PostCard × N
│   │   │   └── PopularPosts
│   │   │       └── PostCard × N
│   │   │
│   │   ├── CategoryPostListPage
│   │   │   ├── CategoryHeader
│   │   │   ├── PostList
│   │   │   │   └── PostCard × N
│   │   │   └── Pagination
│   │   │
│   │   ├── PostDetailPage
│   │   │   ├── PostHeader
│   │   │   ├── PostContent        (본문 + 본문 중간 이미지)
│   │   │   ├── LikeButton
│   │   │   └── CommentSection
│   │   │       ├── CommentList
│   │   │       │   └── CommentItem × N
│   │   │       │       ├── ReplyList
│   │   │       │       │   └── CommentItem(reply) × N
│   │   │       │       └── CommentForm(reply)
│   │   │       ├── CommentForm
│   │   │       └── PasswordDialog
│   │   │
│   │   └── NotFoundPage
│   └── Footer
│
└── AdminLayout  (RequireAdmin)
    ├── AdminNav
    └── <Outlet>
        ├── AdminDashboardPage
        ├── CategoryManagementPage
        │   ├── CategoryForm
        │   └── CategorySortableList
        ├── PostManagementPage
        │   ├── AdminPostTable
        │   └── Pagination
        ├── PostEditorPage
        │   ├── PostMetaForm        (제목, 카테고리)
        │   ├── RichTextEditor      (TipTap 후보)
        │   │   └── ImageUploadButton
        │   └── EditorActions       (저장 / 취소)
        └── CommentManagementPage
            ├── AdminCommentTable
            └── Pagination

공통 UI
├── ConfirmDialog
├── Toast / ErrorMessage
├── LoadingSpinner
└── EmptyState
```

---

## 5. 공통 레이아웃 컴포넌트

### COMP-001 PublicLayout

| 항목 | 내용 |
|---|---|
| 역할 | 공개 화면 공통 틀 (Header + 본문 + Footer) |
| 데이터 | 카테고리 목록을 1회 조회해 Header에 전달 |
| API | API-001 `GET /api/categories` |
| REQ | REQ-008, REQ-013, REQ-036 |

### COMP-002 Header

| 항목 | 내용 |
|---|---|
| 역할 | 로고와 카테고리 메뉴 표시 |
| Props | `categories: Category[]` |
| 반응형 | Desktop/Tablet: CategoryMenu 표시 / Mobile: MobileMenu(햄버거) 표시 |
| REQ | REQ-008, REQ-013, REQ-036 |

### COMP-003 CategoryMenu / COMP-004 MobileMenu

| 항목 | 내용 |
|---|---|
| 역할 | `display_order ASC` 순서로 카테고리 링크 표시 |
| Props | `categories: Category[]`, (Mobile) `isOpen`, `onClose` |
| 동작 | 카테고리를 클릭하면 `/category/:id`로 이동 |
| 특징 | 카테고리를 추가·삭제하면 코드 수정 없이 자동 반영된다 |
| REQ | REQ-008, REQ-013 |

### COMP-005 Footer

| 항목 | 내용 |
|---|---|
| 역할 | 사이트명, 모토("지적인 대화를 위한 넓고 얕은 지식"), 저작권 표시 |
| API | 없음 |

---

## 6. HomePage (PAGE-001)

### 6.1 화면 구성

```text
┌───────────────────────────────────────┐
│ Header                                │
├───────────────────────────────────────┤
│ IntroSection  (사이트 / 운영자 소개)    │
├───────────────────────────────────────┤
│ CategorySection × N                   │
│ [DIY]     [Portfolio]   [Blog]        │
│ 최신 글    최신 글        최신 글       │
│ [Board]   [새 카테고리 → 자동 추가]     │
├───────────────────────────────────────┤
│ LatestPosts   🆕 전체 최신 글           │
├───────────────────────────────────────┤
│ PopularPosts  🔥 인기 글 (좋아요 순)    │
├───────────────────────────────────────┤
│ Footer                                │
└───────────────────────────────────────┘
```

### 6.2 데이터 조회

HomePage는 **API-021 `GET /api/home`을 1회 호출**해 모든 영역의 데이터를 받는 방식을 기본으로 한다.

```text
HomePage
   │  GET /api/home
   ├── categories[].latest_posts → CategorySection
   ├── latest_posts              → LatestPosts
   └── popular_posts             → PopularPosts
```

> API-011/012/013(개별 API)은 각 영역을 따로 갱신해야 할 때 쓸 수 있도록 유지한다.

### 6.3 컴포넌트

| ID | 컴포넌트 | 역할 | Props | REQ |
|---|---|---|---|---|
| COMP-010 | IntroSection | 사이트/운영자 소개 문구 | 없음 (정적 문구) | REQ-004 |
| COMP-011 | CategorySection | 카테고리 이름과 해당 카테고리 최신 글 N개, "더보기" 링크 | `category: {id, name}`, `posts: PostSummary[]` | REQ-005, REQ-008 |
| COMP-012 | LatestPosts | 전체 카테고리 최신 글 목록 | `posts: PostSummary[]` | REQ-006 |
| COMP-013 | PopularPosts | 좋아요 순 인기 글 목록 | `posts: PostSummary[]` | REQ-007 |
| COMP-014 | PostCard | 게시글 요약 카드 (제목, 카테고리, 작성일, 좋아요 수, 썸네일 TBD) | `post: PostSummary`, `showCategory?: boolean` | REQ-005~007, REQ-023 |

### 6.4 표시 개수 (미확정)

| 항목 | 추천안 | 상태 | 관련 ID |
|---|---|---|---|
| 카테고리별 최신 글 수 | 3개 | 미확정 | OPEN-012 |
| 전체 최신 글 수 | 5개 | 미확정 | — |
| 인기 글 수 | 5개 | 미확정 | OPEN-001 |
| 인기 글 집계 기간 | 전체 기간 (향후 7일/30일 확장 검토) | 미확정 | OPEN-002 |
| 게시글이 없는 카테고리 | 섹션은 표시하고 "아직 글이 없습니다" 안내 | 미확정 | — |

---

## 7. CategoryPostListPage (PAGE-002)

| ID | 컴포넌트 | 역할 | Props / 상태 | API | REQ |
|---|---|---|---|---|---|
| COMP-020 | CategoryPostListPage | URL의 `categoryId`로 게시글 목록 조회 | 상태: `page`, `posts`, `total` | API-006 `GET /api/posts?category_id=&page=&size=` | REQ-023 |
| COMP-021 | CategoryHeader | 카테고리 이름, 설명 표시 | `category: Category` | API-001 | REQ-023 |
| COMP-022 | PostList | PostCard 목록 (최신순) | `posts: PostSummary[]` | — | REQ-023 |
| COMP-023 | Pagination | 페이지 이동 | `page`, `size`, `total`, `onChange` | — | REQ-023 |

- 기본 정렬: 등록일 최신순 (REQ-023)
- 존재하지 않는 카테고리 → NotFoundPage 또는 안내 메시지 (REQ-040)

| 항목 | 추천안 | 상태 | 관련 ID |
|---|---|---|---|
| 페이징 방식 | 페이지 번호 방식 (`page`, `size`), 1페이지 10개 | 미확정 | OPEN-006 |

---

## 8. PostDetailPage (PAGE-003)

### 8.1 화면 구성

```text
┌───────────────────────────────────────┐
│ PostHeader                            │
│  [DIY]  주방 타일 시공                  │
│  SmallWorking · 2026-09-15 (수정됨)    │
├───────────────────────────────────────┤
│ PostContent                           │
│  문단                                  │
│  [이미지]                              │
│  문단                                  │
│  [이미지]                              │
├───────────────────────────────────────┤
│ LikeButton   ❤️ 12                    │
├───────────────────────────────────────┤
│ CommentSection                        │
│  CommentItem                          │
│   └─ ReplyItem                        │
│  CommentForm (닉네임/비밀번호/내용)     │
└───────────────────────────────────────┘
```

### 8.2 컴포넌트

| ID | 컴포넌트 | 역할 | Props / 상태 | API | REQ |
|---|---|---|---|---|---|
| COMP-030 | PostDetailPage | 게시글 상세 조회 및 하위 컴포넌트 구성 | 상태: `post`, `loading`, `error` | API-007 | REQ-022, REQ-040 |
| COMP-031 | PostHeader | 카테고리, 제목, 작성자(운영자 고정), 작성일, 수정일 | `post: PostDetail` | — | REQ-022 |
| COMP-032 | PostContent | 본문 렌더링. **본문 중간 지정 위치에 이미지 표시**, 모바일에서 이미지가 화면 너비를 넘지 않음 | `content`, `images: PostImage[]` | — | REQ-018, 019, 037, 044 |
| COMP-033 | LikeButton | 좋아요 표시 및 클릭 | `postId`, `likeCount`, 상태: `liked`, `pending` | API-018 | REQ-030, REQ-032 |
| COMP-034 | CommentSection | 댓글 목록 조회 및 댓글 영역 관리 | `postId`, 상태: `comments` | API-014 | REQ-025 |
| COMP-035 | CommentList | 최상위 댓글 목록 | `comments: Comment[]` | — | REQ-025 |
| COMP-036 | CommentItem | 댓글 1개 (닉네임, 내용, 작성일, [답글][수정][삭제]) | `comment`, `isReply: boolean` | — | REQ-025~028 |
| COMP-037 | ReplyList | 댓글의 답글 목록 (1단계) | `replies: Comment[]` | — | REQ-028, 029 |
| COMP-038 | CommentForm | 댓글/답글 작성 폼 (닉네임, 비밀번호, 내용) | `postId`, `parentCommentId?`, `onSubmitted` | API-015 | REQ-024, 028, 038 |
| COMP-039 | PasswordDialog | 수정·삭제 시 비밀번호 입력 | `mode: 'edit' \| 'delete'`, `commentId`, `onConfirm` | API-016, API-017 | REQ-026, 027 |

### 8.3 핵심 동작 규칙

1. **답글 깊이 1단계**: `CommentItem`이 `isReply=true`이면 **[답글] 버튼을 표시하지 않는다**. Backend도 별도로 거부한다 (API-015).
2. **본문 렌더링 보안**: 본문은 허용된 노드/태그만 렌더링하며 `dangerouslySetInnerHTML`을 그대로 쓰지 않는다 (REQ-044). 최종 방식은 본문 저장 형식이 확정된 후 결정한다.
3. **댓글 내용**: 일반 텍스트로만 표시한다(HTML로 해석하지 않음).
4. **실패 처리**: 작성·수정·삭제에 실패하거나 비밀번호가 틀리면 Toast/ErrorMessage로 알린다 (REQ-041).
5. **필수값 검증**: 닉네임, 비밀번호, 내용이 비어 있으면 전송 버튼을 비활성화하고 안내한다 (REQ-038).

### 8.4 미확정 사항

| 항목 | 추천안 | 상태 | 관련 ID |
|---|---|---|---|
| 댓글 정렬 | 작성순(오래된 글이 위), 답글도 작성순 | 미확정 | OPEN-011 |
| 좋아요 재클릭 | 좋아요 취소(토글) | 미확정 | OPEN-009 |
| 답글이 있는 댓글 삭제 시 표시 | "삭제된 댓글입니다"로 표시하고 답글은 유지 | 미확정 | DATA_MODEL 미정 |
| 댓글 페이징 | v0.1에서는 전체 표시 | 미확정 | — |

---

## 9. 관리자 화면

### 9.1 AdminLayout / 인증

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-100 | RequireAdmin | 관리자 인증 여부를 확인하고, 미인증이면 `/admin/login`으로 이동 | 인증 API (**API_SPEC 추가 필요**) | REQ-042 |
| COMP-101 | AdminLayout | 관리자 공통 틀 (AdminNav + 본문) | — | REQ-001 |
| COMP-102 | AdminNav | 대시보드 / 카테고리 / 게시글 / 댓글 / 로그아웃 메뉴 | — | REQ-001 |
| COMP-103 | AdminLoginPage | 관리자 로그인 폼 | 인증 API (**API_SPEC 추가 필요**) | REQ-042 |

> 관리자 인증 방식(Session / JWT)은 TBD-002/003이다. 컴포넌트는 인증 방식이 정해지지 않아도 구현할 수 있도록 `services/auth`로 분리한다.

### 9.2 CategoryManagementPage (PAGE-103)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-110 | CategoryManagementPage | 카테고리 목록과 관리 기능 | API-001 | REQ-034 |
| COMP-111 | CategoryForm | 카테고리 추가·수정 (이름 필수, 설명 선택) | API-002, API-003 | REQ-010, 011, 038 |
| COMP-112 | CategorySortableList | 순서 변경 (▲▼ 버튼 또는 드래그) 후 저장 | API-005 | REQ-013 |
| — | (삭제 버튼 + ConfirmDialog) | 카테고리 삭제 | API-004 | REQ-012 |

- 카테고리 삭제 시 게시글이 있는 경우의 처리는 **OPEN-008 (미확정)**이다. 확정 전까지 화면은 Backend의 오류 메시지(예: 409)를 그대로 보여준다.

### 9.3 PostManagementPage (PAGE-104)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-120 | PostManagementPage | 게시글 목록 (카테고리 필터), 새 글 작성 버튼 | API-006 | REQ-033 |
| COMP-121 | AdminPostTable | 제목, 카테고리, 작성일, 좋아요 수, [수정][삭제] | API-010 | REQ-017, 033 |

### 9.4 PostEditorPage (PAGE-105 / 106)

```text
┌───────────────────────────────────────┐
│ 카테고리 [DIY ▼]                       │
│ 제목     [__________________________]  │
├───────────────────────────────────────┤
│ [B] [I] [H2] [목록] [🖼 이미지]         │  ← 툴바
│                                       │
│  본문 입력...                          │
│  [이미지]  ← 커서 위치에 삽입            │
│  본문 입력...                          │
│                                       │
│                          이미지 3 / 20 │
├───────────────────────────────────────┤
│                      [취소]  [저장]    │
└───────────────────────────────────────┘
```

| ID | 컴포넌트 | 역할 | Props / 상태 | API | REQ |
|---|---|---|---|---|---|
| COMP-130 | PostEditorPage | 작성/수정 모드 처리 (`postId` 유무로 구분) | 상태: `title`, `categoryId`, `content`, `images`, `dirty` | API-007(수정 시 조회), API-008, API-009 | REQ-014~016 |
| COMP-131 | PostMetaForm | 제목, 카테고리 선택 (필수) | `title`, `categoryId`, `categories`, `onChange` | API-001 | REQ-014, 015, 038 |
| COMP-132 | RichTextEditor | 텍스트 입력, 기본 서식, **커서 위치에 이미지 삽입**, 이미지 순서 변경(본문 내 이동) | `value`, `onChange` | — | REQ-018, 019 |
| COMP-133 | ImageUploadButton | 이미지 선택, 업로드 후 에디터에 삽입. 개수 제한을 넘으면 막음 | `onUploaded(image)`, `currentCount` | API-019 | REQ-018, 020, 021 |
| COMP-134 | EditorActions | 저장 / 취소. 저장하지 않은 변경이 있으면 이동 전에 확인 | `onSave`, `onCancel`, `saving` | — | REQ-041 |

#### 에디터 관련 미확정 사항

| 항목 | 추천안 | 상태 | 관련 ID |
|---|---|---|---|
| 에디터 | TipTap 채택 | 미확정 | TBD-001 / OPEN-005 |
| 본문 저장 형식 | TipTap JSON (`JSONB`), 이미지는 `imageId`로 참조 | 미확정 | DATA_MODEL §5.3 |
| 게시글당 최대 이미지 | 20장 | 미확정 | OPEN-003 |
| 허용 형식 / 최대 용량 | jpg, png, webp, gif / 장당 10MB | 미확정 | TBD-004, 005 |
| 리사이징 | 업로드 시 긴 변 기준 축소 (예: 1920px) | 미확정 | TBD-006 |
| 썸네일 (PostCard) | 본문 첫 이미지를 썸네일로 사용 | 미확정 | TBD-007 |
| 동영상 | 업로드 버튼 없음 (지원 안 함) | **확정** | REQ-021 |

### 9.5 CommentManagementPage (PAGE-107)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-140 | CommentManagementPage | 전체 댓글·답글 목록 (최신순, 게시글 제목 포함) | **관리자 댓글 목록 API (API_SPEC 추가 필요)** | REQ-035 |
| COMP-141 | AdminCommentTable | 닉네임, 내용, 게시글, 작성일, [삭제] (비밀번호 없이 관리자 권한으로 삭제) | **관리자 댓글 삭제 API (API_SPEC 추가 필요)** | REQ-035 |

---

## 10. 공통 UI 컴포넌트

| ID | 컴포넌트 | 역할 | REQ |
|---|---|---|---|
| COMP-200 | ConfirmDialog | 삭제 등 되돌릴 수 없는 작업 전 확인 | REQ-012, 017, 027 |
| COMP-201 | Toast / ErrorMessage | 작업 성공·실패 알림. API 오류 응답의 `error.message` 표시 | REQ-041 |
| COMP-202 | LoadingSpinner | 데이터 로딩 표시 | — |
| COMP-203 | EmptyState | 데이터가 없을 때 안내 ("아직 글이 없습니다") | — |
| COMP-204 | NotFoundPage | 존재하지 않는 게시글, 카테고리, 경로 안내 및 홈으로 이동 | REQ-040 |

---

## 11. Frontend 타입 (API_SPEC 기준)

```ts
// src/types/category.ts
interface Category {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
}

// src/types/post.ts
interface PostSummary {
  id: number;
  category_id: number;
  category_name: string;
  title: string;
  like_count: number;
  created_at: string;   // ISO 8601
  updated_at: string;
}

interface PostImage {
  id: number;
  file_path: string;
  original_name: string | null;
}

interface PostDetail extends PostSummary {
  content: unknown;     // 저장 형식 확정 후 타입 확정 (TipTap JSON / HTML)
  images: PostImage[];
}

// src/types/comment.ts
interface Comment {
  id: number;
  nickname: string;
  content: string;
  created_at: string;
  replies?: Comment[];  // 최상위 댓글만 가짐 (1단계)
}

// src/types/api.ts
interface ApiError {
  error: { code: string; message: string };
}
```

> 타입은 API_SPEC의 Response 구조와 1:1로 맞춘다. API_SPEC이 바뀌면 이 타입도 함께 수정한다.

---

## 12. 반응형 기준

| 구분 | 폭 (제안) | 상태 |
|---|---|---|
| Mobile | ~ 767px | 미확정 |
| Tablet | 768px ~ 1023px | 미확정 |
| Desktop | 1024px ~ | 미확정 |

| 영역 | Mobile | Tablet | Desktop |
|---|---|---|---|
| Header 메뉴 | 햄버거 + 드로어 | 가로 메뉴 | 가로 메뉴 |
| Home CategorySection | 1열 | 2열 | 3열 |
| Latest / Popular | 세로 배치 | 세로 배치 | 2열 나란히 (검토) |
| PostContent 이미지 | `max-width: 100%` | `max-width: 100%` | 본문 폭 안에서 표시 |
| 댓글 영역 | 답글 들여쓰기 최소화 | 기본 | 기본 |
| Admin 테이블 | 카드형 목록으로 전환 | 테이블 | 테이블 |
| PostEditor | 툴바 줄바꿈 허용 | 기본 | 기본 |

공통 규칙: 어떤 화면 폭에서도 **가로 스크롤이 생기지 않아야 한다** (REQ-036, REQ-037).

---

## 13. 상태 관리 / 데이터 흐름

| 항목 | 방침 (v0.1 제안) | 상태 |
|---|---|---|
| 라우팅 | React Router | 미확정 |
| 서버 데이터 | 페이지 단위 조회 + 커스텀 훅(`src/hooks/`) | 미확정 |
| 전역 상태 | 관리자 로그인 상태만 Context로 관리 | 미확정 |
| 스타일링 | TBD (CSS Modules / Tailwind 등) | 미확정 |

```text
Page
 │  useXxx() hook   (src/hooks)
 ↓
services/xxxService (src/services)
 │  HTTP
 ↓
FastAPI /api/...
```

> Claude.md 원칙: **임의로 새로운 라이브러리를 추가하지 않는다.** 위 라이브러리는 확정 후 Claude.md/TRD에 반영한다.

---

## 14. Traceability (REQ → API → COMP)

| REQ | 내용 | API | COMP |
|---|---|---|---|
| REQ-004~007 | 홈 구성, 최신글, 인기글 | API-021 (API-011~013) | COMP-010~014 |
| REQ-008 | 카테고리 자동 반영 | API-001, API-021 | COMP-003, 004, 011 |
| REQ-010~013 | 카테고리 관리 | API-002~005 | COMP-110~112 |
| REQ-014~016 | 게시글 작성·수정 | API-008, API-009 | COMP-130, 131 |
| REQ-017 | 게시글 삭제 | API-010 | COMP-121, 200 |
| REQ-018~020 | 본문 이미지, 순서, 개수 | API-019, API-020 | COMP-032, 132, 133 |
| REQ-021 | 동영상 제외 | — | COMP-133 (동영상 버튼 없음) |
| REQ-022 | 게시글 상세 | API-007 | COMP-030~032 |
| REQ-023 | 카테고리 게시글 목록 | API-006 | COMP-020~023 |
| REQ-024, 025 | 댓글 작성·표시 | API-014, API-015 | COMP-034~036, 038 |
| REQ-026, 027 | 댓글 수정·삭제 | API-016, API-017 | COMP-036, 039 |
| REQ-028, 029 | 답글, 1단계 제한 | API-015 | COMP-036~038 |
| REQ-030 | 게시글 좋아요 | API-018 | COMP-033 |
| REQ-033 | 게시글 관리 | API-006, 010 | COMP-120, 121 |
| REQ-035 | 댓글 관리 | **추가 필요** | COMP-140, 141 |
| REQ-036, 037 | 반응형, 모바일 표시 | — | §12 전체 |
| REQ-038, 039 | 입력 검증 | 각 API | COMP-038, 111, 131 |
| REQ-040, 041 | 오류 처리 | 공통 오류 응답 | COMP-201, 204 |
| REQ-042 | 관리자 보호 | **추가 필요** | COMP-100, 103 |
| REQ-044 | XSS 방지 | — | COMP-032, 036 |

---

## 15. 후속 반영 필요 (다른 문서)

이 문서를 작성하며 발견한, 다른 문서에 반영해야 할 사항이다.

| No | 대상 문서 | 내용 |
|---|---|---|
| F-001 | API_SPEC | 관리자 인증 API 추가 (로그인 / 로그아웃 / 인증 상태 확인) |
| F-002 | API_SPEC | 관리자 댓글 목록 API, 관리자 댓글 삭제 API 추가 (REQ-035) |
| F-003 | API_SPEC / DATA_MODEL | 이미지를 게시글 저장 전에 업로드하는 흐름과 `post_image.post_id NOT NULL`이 충돌함. 임시 이미지 처리 방식 결정 필요 |
| F-004 | TRD / API_SPEC | 이미지 저장 경로 규칙 통일 (TRD `uploads/images/2026/` vs API `/uploads/posts/101/`) |
| F-005 | API_SPEC | 라우트 충돌 주의: `/api/categories/order` vs `/api/categories/{id}`, `/api/posts/latest·popular` vs `/api/posts/{id}` |
| F-006 | API_SPEC | 게시글 요약(PostSummary)에 썸네일 필드 추가 여부 (TBD-007과 연계) |
| F-007 | API_SPEC | 좋아요 상태(`liked`) 조회 방법. 상세 응답에 포함할지 결정 (OPEN-009와 연계) |

---

## 16. 확정 / 미확정 요약

### 확정

- 공개 화면 4개, 관리자 화면 7개(작성/수정 공유)의 라우트 구조
- Home은 카테고리별 최신글, 전체 최신글, 인기글로 구성하며 카테고리를 추가하면 자동 반영
- 게시글 작성자는 운영자로 고정 표시
- 답글은 1단계까지 (답글에는 [답글] 버튼 없음)
- 동영상 업로드 UI 없음
- Mobile First 반응형, 가로 스크롤 금지
- API 호출은 `services/`, 타입은 `types/`로 분리

### 미확정 (추천안만 기재)

| ID | 항목 | 추천안 |
|---|---|---|
| OPEN-001 | 인기글 표시 개수 | 5개 |
| OPEN-002 | 인기글 집계 기간 | 전체 기간 |
| OPEN-003 | 이미지 최대 개수 | 20장 |
| OPEN-005 / TBD-001 | 에디터 | TipTap |
| OPEN-006 | 페이징 방식 | 페이지 번호, 10개 |
| OPEN-011 | 댓글 정렬 | 작성순 |
| OPEN-012 | 홈 카테고리별 게시글 수 | 3개 |
| TBD-004/005 | 이미지 용량·형식 | 10MB / jpg·png·webp·gif |
| TBD-006 | 리사이징 | 긴 변 1920px |
| TBD-007 | 썸네일 | 본문 첫 이미지 |
| — | 반응형 브레이크포인트 | 768 / 1024 |
| — | 라우팅·스타일링 라이브러리 | React Router / TBD |

> **원칙:** 미확정 항목은 구현 전에 사용자와의 대화를 통해 하나씩 확정하고, 확정되면 이 문서의 버전을 올린다.

---

## 17. 다음 단계

```text
PRD
 ↓
REQUIREMENTS
 ↓
TRD
 ↓
DATA_MODEL
 ↓
API_SPEC
 ↓
COMPONENT_SPEC   ← 현재
 ↓
TEST_CASES       ← 다음 단계
 ↓
Claude.md
 ↓
구현
```

---

## 18. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-11-03 | 초기 화면·컴포넌트 구조 초안 작성 (이전 초안 유실로 재작성) |
