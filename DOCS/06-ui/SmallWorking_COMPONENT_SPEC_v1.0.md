# SmallWorking COMPONENT_SPEC

- Document: COMPONENT_SPEC.md
- Version: 1.0
- Status: Approved (대화 결정 반영)
- Project: SmallWorking
- Based on: PRD v1.0 / REQUIREMENTS v1.1 / TRD v1.1 / DATA_MODEL v1.0 / API_SPEC v1.0 / DECISIONS DEC-001~008
- Previous: COMPONENT_SPEC v0.1 (2026-11-03)

---

## 1. 목적

이 문서는 SmallWorking Frontend(React + TypeScript + Vite)의 **화면(Page)과 컴포넌트(Component) 구조**를 정의한다.

디자인(색상, 폰트, 시각 스타일)을 정하는 문서가 아니다. 다음을 정한다.

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
| 스타일링 | **Tailwind CSS** 유틸리티 클래스 (DEC-008). 반응형은 `md:`(768px), `lg:`(1024px) 접두사 사용 |
| 라우팅 | React Router (DEC-008) |
| 컴포넌트 위치 | 공통 컴포넌트 `src/components/`, 페이지 `src/pages/` |
| API 호출 | 컴포넌트에서 직접 `fetch`하지 않고 `src/services/`를 통해 호출 |
| 쿠키 전송 | 모든 API 요청은 `credentials: 'include'` (세션·방문자 쿠키, API_SPEC §2.2) |
| 타입 | API 응답 타입은 `src/types/`에 정의 (API_SPEC v1.0과 일치) |
| 반응형 | **Mobile → Tablet → Desktop** 순서로 설계 (Mobile First) |
| 데이터 책임 | 화면은 표시와 입력만 담당. 최종 검증과 권한 판단은 Backend (TRD §16) |
| 오류 표시 | API 오류의 `error.message`를 그대로 사용자에게 보여준다 (API_SPEC §12) |
| 작성자 표시 | 게시글 작성자는 항상 운영자(SmallWorking)로 표시 |
| HTML 렌더링 | `dangerouslySetInnerHTML`을 사용하지 않는다 (DEC-001, REQ-044) |

---

## 3. 화면(라우트) 목록

### 3.1 공개 화면 (Visitor)

| ID | Route | Page | 설명 | 관련 REQ |
|---|---|---|---|---|
| PAGE-001 | `/` | HomePage | 홈 (카테고리별 최신글, 최신글, 인기글) | REQ-004~008 |
| PAGE-002 | `/category/:categoryId?page=n` | CategoryPostListPage | 카테고리별 게시글 목록 | REQ-023 |
| PAGE-003 | `/posts/:postId` | PostDetailPage | 게시글 상세, 좋아요, 댓글 | REQ-022, 024~030 |
| PAGE-004 | `*` | NotFoundPage | 존재하지 않는 페이지/콘텐츠 | REQ-040 |
| PAGE-005 | `/requests?page=n` | RequestBoardPage | 요청 게시판 목록 (DEC-011) | REQ-046 |
| PAGE-006 | `/requests/new` | RequestWritePage | 요청 작성 | REQ-045 |
| PAGE-007 | `/requests/:requestId` | RequestDetailPage | 요청 상세, 비밀글 열람, 수정·삭제, 답변 보기 | REQ-047, 048 |

### 3.2 관리자 화면 (Admin)

| ID | Route | Page | 설명 | 관련 REQ |
|---|---|---|---|---|
| PAGE-101 | `/admin/login` | AdminLoginPage | 관리자 로그인 | REQ-042 |
| PAGE-102 | `/admin` | AdminDashboardPage | 관리자 메인 | REQ-001 |
| PAGE-103 | `/admin/categories` | CategoryManagementPage | 카테고리 추가·수정·삭제·순서 변경 | REQ-010~013, 034 |
| PAGE-104 | `/admin/posts?page=n` | PostManagementPage | 게시글 목록 및 삭제 | REQ-033 |
| PAGE-105 | `/admin/posts/new` | PostEditorPage | 게시글 작성 | REQ-014, 015, 018~020 |
| PAGE-106 | `/admin/posts/:postId/edit` | PostEditorPage | 게시글 수정 (작성 화면 재사용) | REQ-016 |
| PAGE-107 | `/admin/comments?page=n` | CommentManagementPage | 댓글·답글 조회 및 삭제 | REQ-035 |
| PAGE-108 | `/admin/requests?status=&page=n` | RequestManagementPage | 요청 조회, 답변 작성·수정·삭제, 요청 삭제 (DEC-011) | REQ-049 |

> `/admin/*`(로그인 화면 제외)은 COMP-100 RequireAdmin이 API-025로 로그인 상태를 확인한다. 실제 권한 판단은 Backend에서 한다.

---

## 4. 전체 컴포넌트 트리

```text
App
├── PublicLayout
│   ├── Header
│   │   ├── Logo
│   │   ├── CategoryMenu          (Tablet/Desktop: 가로 메뉴)
│   │   └── MobileMenu            (Mobile: 햄버거 + 드로어)
│   ├── <Outlet>
│   │   ├── HomePage
│   │   │   ├── IntroSection
│   │   │   ├── CategorySection × N
│   │   │   │   └── PostCard × 3
│   │   │   ├── LatestPosts
│   │   │   │   └── PostCard × 5
│   │   │   └── PopularPosts
│   │   │       └── PostCard × 5
│   │   │
│   │   ├── CategoryPostListPage
│   │   │   ├── CategoryHeader
│   │   │   ├── PostList
│   │   │   │   └── PostCard × 12
│   │   │   └── Pagination
│   │   │
│   │   ├── PostDetailPage
│   │   │   ├── PostHeader
│   │   │   ├── PostContent        (TipTap JSON 렌더러)
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
        │   ├── RichTextEditor      (TipTap)
        │   │   ├── EditorToolbar
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
| 반응형 | Tablet/Desktop(768px 이상): CategoryMenu / Mobile(767px 이하): MobileMenu |
| REQ | REQ-008, REQ-013, REQ-036 |

### COMP-003 CategoryMenu / COMP-004 MobileMenu

| 항목 | 내용 |
|---|---|
| 역할 | `display_order` 순서로 카테고리 링크 표시 |
| Props | `categories: Category[]`, (Mobile) `isOpen`, `onClose` |
| 동작 | 클릭하면 `/category/:id`로 이동. Mobile 드로어는 이동 후 자동으로 닫힘 |
| 특징 | 카테고리를 추가·삭제하면 코드 수정 없이 자동 반영 |
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
│ 최신 3개   최신 3개       최신 3개      │
│ [Board]   [새 카테고리 → 자동 추가]     │
├───────────────────────────────────────┤
│ LatestPosts   🆕 전체 최신 글 5개       │
├───────────────────────────────────────┤
│ PopularPosts  🔥 인기 글 5개 (좋아요 순) │
├───────────────────────────────────────┤
│ Footer                                │
└───────────────────────────────────────┘
```

### 6.2 데이터 조회

HomePage는 **API-021 `GET /api/home`을 1회 호출**해 모든 영역의 데이터를 받는다.

```text
HomePage
   │  GET /api/home
   ├── categories[].latest_posts → CategorySection
   ├── latest_posts              → LatestPosts
   └── popular_posts             → PopularPosts
```

### 6.3 컴포넌트

| ID | 컴포넌트 | 역할 | Props | REQ |
|---|---|---|---|---|
| COMP-010 | IntroSection | 사이트/운영자 소개 문구 | 없음 (정적 문구) | REQ-004 |
| COMP-011 | CategorySection | 카테고리 이름, 최신 글 3개, "더보기" 링크(`/category/:id`). 글이 없으면 EmptyState | `category: HomeCategory` | REQ-005, REQ-008 |
| COMP-012 | LatestPosts | 전체 최신 글 5개 | `posts: PostSummary[]` | REQ-006 |
| COMP-013 | PopularPosts | 인기 글 5개 (좋아요 순) | `posts: PostSummary[]` | REQ-007 |
| COMP-014 | PostCard | 게시글 요약 카드: 썸네일, 제목, 카테고리, 작성일, ❤️ 좋아요 수, 💬 댓글 수 | `post: PostSummary`, `showCategory?: boolean` | REQ-005~007, REQ-023 |

### 6.4 표시 규칙 (DEC-006 확정)

| 항목 | 결정 |
|---|---|
| 카테고리별 최신 글 수 | **3개** |
| 전체 최신 글 수 | **5개** |
| 인기 글 수 | **5개** |
| 인기 글 기간 | **전체 기간**, 좋아요 수가 같으면 최신 글 우선 |
| 글 없는 카테고리 | 섹션 표시 + "아직 글이 없습니다" |
| PostCard 썸네일 | `thumbnail_url` (본문 첫 이미지). `null`이면 썸네일 영역 없이 텍스트 카드로 표시 (DEC-002) |

---

## 7. CategoryPostListPage (PAGE-002)

| ID | 컴포넌트 | 역할 | Props / 상태 | API | REQ |
|---|---|---|---|---|---|
| COMP-020 | CategoryPostListPage | URL의 `categoryId`, `page`로 목록 조회 | 상태: `page`(URL에서 읽음), `posts`, `total` | API-006 `GET /api/posts?category_id=&page=&size=12` | REQ-023 |
| COMP-021 | CategoryHeader | 카테고리 이름, 설명 표시 | `category: Category` | API-001 | REQ-023 |
| COMP-022 | PostList | PostCard 목록 (최신순) | `posts: PostSummary[]` | — | REQ-023 |
| COMP-023 | Pagination | 페이지 번호 이동. 이동하면 URL `?page=n` 갱신 | `page`, `size`, `total`, `onChange` | — | REQ-023 |

| 항목 | 결정 (DEC-006) |
|---|---|
| 페이징 | 페이지 번호 방식, **12개/페이지** |
| 페이지 주소 | `/category/:id?page=2` — 새로고침, 공유, 뒤로 가기 시 같은 페이지 유지 |
| 범위 밖 페이지 | 빈 목록 + EmptyState |
| 존재하지 않는 카테고리 | `404 CATEGORY_NOT_FOUND` → NotFoundPage (REQ-040) |

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
│ LikeButton   ❤️ 12   (누르면 토글)      │
├───────────────────────────────────────┤
│ CommentSection   💬 댓글 3             │
│  CommentItem                          │
│   └─ ReplyItem                        │
│  (삭제된 댓글입니다)                    │
│   └─ ReplyItem                        │
│  CommentForm (닉네임/비밀번호/내용)     │
└───────────────────────────────────────┘
```

### 8.2 컴포넌트

| ID | 컴포넌트 | 역할 | Props / 상태 | API | REQ |
|---|---|---|---|---|---|
| COMP-030 | PostDetailPage | 게시글 상세 조회 및 하위 컴포넌트 구성 | 상태: `post`, `loading`, `error` | API-007 | REQ-022, REQ-040 |
| COMP-031 | PostHeader | 카테고리, 제목, 작성자(운영자 고정), 작성일, 수정일(작성일과 다를 때 "수정됨" 표시) | `post: PostDetail` | — | REQ-022 |
| COMP-032 | PostContent | **TipTap JSON을 허용된 노드만 React 요소로 렌더링**. `image` 노드는 `imageId`로 `post.images`에서 찾아 표시 | `content: TiptapDoc`, `images: PostImage[]` | — | REQ-018, 019, 037, 044 |
| COMP-033 | LikeButton | 좋아요 토글 | `postId`, `initialCount`, `initialLiked`, 상태: `liked`, `count`, `pending` | API-018 (좋아요), API-022 (취소) | REQ-030, REQ-032 |
| COMP-034 | CommentSection | 댓글 목록 조회 및 댓글 영역 관리 | `postId`, 상태: `comments` | API-014 | REQ-025 |
| COMP-035 | CommentList | 최상위 댓글 목록 (작성순) | `comments: Comment[]` | — | REQ-025 |
| COMP-036 | CommentItem | 댓글 1개: 닉네임, 내용, 작성일, [답글][수정][삭제] | `comment: Comment`, `isReply: boolean` | — | REQ-025~028 |
| COMP-037 | ReplyList | 댓글의 답글 목록 (1단계, 작성순) | `replies: Comment[]` | — | REQ-028, 029 |
| COMP-038 | CommentForm | 댓글/답글 작성 폼 (닉네임, 비밀번호, 내용) | `postId`, `parentCommentId?`, `onSubmitted` | API-015 | REQ-024, 028, 038 |
| COMP-039 | PasswordDialog | 수정·삭제 시 비밀번호 입력 | `mode: 'edit' \| 'delete'`, `commentId`, `onDone` | API-016 (수정), API-017 `POST /api/comments/{id}/delete` (삭제) | REQ-026, 027 |

### 8.3 PostContent 렌더링 규칙 (DEC-001)

| TipTap 노드 / 마크 | 렌더링 |
|---|---|
| `paragraph` | `<p>` |
| `heading` (level 2, 3) | `<h2>`, `<h3>` |
| `bulletList` / `orderedList` / `listItem` | `<ul>` / `<ol>` / `<li>` |
| `blockquote` | `<blockquote>` |
| `codeBlock` / `code` | `<pre><code>` / `<code>` |
| `horizontalRule` / `hardBreak` | `<hr>` / `<br>` |
| `image` | `<img src={images[imageId].url} alt={alt} loading="lazy">`, `max-width: 100%` |
| `bold` / `italic` / `strike` | `<strong>` / `<em>` / `<s>` |
| `link` | `<a href target="_blank" rel="noopener noreferrer">`, `http(s)://`, `mailto:`만 |
| `table` / `tableRow` (DEC-010) | `<div class="table-scroll" role="region" aria-label="표"><table><tbody>` / `<tr>`. 표 상자 안에서만 가로 스크롤, 페이지는 넘치지 않음 |
| `tableHeader` / `tableCell` (DEC-010) | `<th scope="col">` / `<td>`. `align`은 `text-center`·`text-right` 클래스 (style 속성 사용 안 함). 칸 최소 폭 6rem |
| 그 외 노드 / 마크 | **렌더링하지 않음** (무시) |
| `imageId`가 `images`에 없음 | 해당 이미지 자리 생략 |

> 텍스트는 React가 자동으로 이스케이프하므로 스크립트가 실행되지 않는다.
> 이 렌더러는 편집기(TipTap)를 불러오지 않고 공개 화면에서 가볍게 동작해야 한다.

### 8.4 LikeButton 동작 (DEC-004)

```text
클릭
 ├─ liked = false → POST   /api/posts/{id}/like   (API-018)
 └─ liked = true  → DELETE /api/posts/{id}/like   (API-022)
        ↓
응답의 like_count, liked로 화면 갱신
요청 처리 중(pending)에는 버튼 비활성화
```

- 실패 시 이전 상태로 되돌리고 Toast로 안내한다.

### 8.5 CommentItem 표시 규칙

| 상태 | 표시 | 버튼 |
|---|---|---|
| 일반 댓글 | 닉네임, 내용, 작성일 | [답글] [수정] [삭제] |
| 답글 (`isReply`) | 닉네임, 내용, 작성일 (들여쓰기) | [수정] [삭제] — **[답글] 없음** (REQ-029) |
| 삭제된 댓글 (`is_deleted`) | **"삭제된 댓글입니다"** (회색), 답글은 그대로 아래 표시 | **버튼 없음** (DEC-005) |
| 수정됨 | 작성일 옆 "(수정됨)" | — |

### 8.6 핵심 동작 규칙

1. **답글 깊이 1단계**: 답글에는 [답글] 버튼이 없다. Backend도 `REPLY_DEPTH_EXCEEDED`로 거부한다.
2. **댓글 내용**: 일반 텍스트로만 표시 (줄바꿈은 유지, HTML로 해석하지 않음).
3. **입력 제한** (DEC-006): 닉네임 2~20자, 비밀번호 4~64자, 내용 1~1,000자. 화면에서 글자 수를 보여주고, 범위를 벗어나면 등록 버튼 비활성화 (REQ-038).
4. **비밀번호 입력**: `type="password"`, 브라우저 자동 저장 비활성화 (`autocomplete="new-password"`).
5. **실패 처리**: 비밀번호 불일치(`INVALID_PASSWORD`) 등 모든 실패는 `error.message`로 안내 (REQ-041).
6. **작성·수정·삭제 후**: 댓글 목록(API-014)을 다시 불러온다.
7. **댓글 정렬**: 작성순 (오래된 댓글이 위), 전체 표시 (DEC-006).

---

## 9. 관리자 화면

### 9.1 AdminLayout / 인증 (DEC-003)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-100 | RequireAdmin | 관리자 화면 진입 시 로그인 상태 확인. `401`이면 `/admin/login?redirect=<원래 주소>`로 이동 | API-025 `GET /api/admin/me` | REQ-042 |
| COMP-101 | AdminLayout | 관리자 공통 틀 (AdminNav + 본문) | — | REQ-001 |
| COMP-102 | AdminNav | 대시보드 / 카테고리 / 게시글 / 댓글 / 사이트 보기 / 로그아웃 | API-024 (로그아웃) | REQ-001, 042 |
| COMP-103 | AdminLoginPage | 아이디·비밀번호 로그인 폼. 성공하면 `redirect` 주소 또는 `/admin`으로 이동 | API-023 `POST /api/admin/login` | REQ-042 |

#### 로그인 화면 오류 표시

| 응답 | 화면 |
|---|---|
| `401 INVALID_CREDENTIALS` | "아이디 또는 비밀번호가 올바르지 않습니다." |
| `423 ACCOUNT_LOCKED` | "로그인 시도가 너무 많습니다." + 잠금 해제 시각(`locked_until`) 표시 |

#### 세션 만료 처리

- 관리자 화면에서 어떤 API든 `401`이 오면 **작업 중인 내용을 잃지 않도록** 안내 후 로그인 화면으로 이동한다.
- 게시글 편집 중이면 "로그인이 만료되었습니다. 내용을 복사해 두고 다시 로그인해 주세요."라고 먼저 알린다.

### 9.2 AdminDashboardPage (PAGE-102)

| 항목 | 내용 |
|---|---|
| 역할 | 관리 메뉴 바로가기 (카테고리 관리, 새 글 쓰기, 게시글 관리, 댓글 관리) |
| 데이터 | v1.0에서는 별도 통계 없음 (관리자 통계는 PRD §16 향후 확장) |

### 9.3 CategoryManagementPage (PAGE-103)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-110 | CategoryManagementPage | 카테고리 목록 (이름, 설명, 글 수)과 관리 기능 | API-001 | REQ-034 |
| COMP-111 | CategoryForm | 추가·수정 폼: 이름(필수, 1~30자), 설명(선택, 0~200자). **새 카테고리는 자동으로 맨 뒤에 추가** | API-002, API-003 | REQ-010, 011, 038 |
| COMP-112 | CategorySortableList | ▲▼ 버튼으로 순서를 바꾸고 [순서 저장]을 누르면 **ID 순서 배열**을 전송 | API-005 `{ category_ids: [...] }` | REQ-013 |
| — | 삭제 버튼 + ConfirmDialog | 카테고리 삭제 | API-004 | REQ-012 |

#### 삭제 동작 (DEC-005)

| 상황 | 화면 |
|---|---|
| 글 수(`post_count`) = 0 | [삭제] 활성화 → ConfirmDialog → 삭제 |
| 글 수 ≥ 1 | [삭제] 비활성화 + "게시글 N개가 있어 삭제할 수 없습니다" 안내 |
| 그래도 `409 CATEGORY_NOT_EMPTY` 응답 | 오류 메시지 표시 후 목록 새로고침 |

| 오류 | 화면 |
|---|---|
| `409 CATEGORY_NAME_DUPLICATED` | 이름 입력란 아래에 "이미 있는 카테고리 이름입니다." |
| `422 CATEGORY_ORDER_MISMATCH` | "카테고리 목록이 바뀌었습니다." + 목록 새로고침 |

### 9.4 PostManagementPage (PAGE-104)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-120 | PostManagementPage | 게시글 목록 (카테고리 필터, **20개/페이지**), [새 글 쓰기] | API-006 `size=20` | REQ-033 |
| COMP-121 | AdminPostTable | 제목, 카테고리, 작성일, 좋아요 수, 댓글 수, [보기][수정][삭제] | API-010 | REQ-017, 033 |

- 삭제 ConfirmDialog 문구: "이 게시글과 사진, 댓글, 좋아요가 모두 삭제됩니다. 되돌릴 수 없습니다." (DEC-005)

### 9.5 PostEditorPage (PAGE-105 / 106)

```text
┌───────────────────────────────────────┐
│ 카테고리 [DIY ▼]                       │
│ 제목     [__________________] 12/200   │
├───────────────────────────────────────┤
│ [B][I][S][H2][H3][•][1.][❝][</>][―][🔗][🖼] │  ← EditorToolbar
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
| COMP-130 | PostEditorPage | 작성/수정 모드 처리 (`postId` 유무로 구분) | 상태: `title`, `categoryId`, `content`, `dirty`, `saving` | API-007(수정 시 조회), API-008, API-009 | REQ-014~016 |
| COMP-131 | PostMetaForm | 제목(1~200자, 글자 수 표시), 카테고리 선택 (필수) | `title`, `categoryId`, `categories`, `onChange` | API-001 | REQ-014, 015, 038 |
| COMP-132 | RichTextEditor | **TipTap** 에디터. 텍스트 입력, 서식, **커서 위치에 이미지 삽입**, 이미지 끌어서 이동 | `value: TiptapDoc`, `images`, `onChange` | — | REQ-018, 019 |
| COMP-135 | EditorToolbar | 서식 버튼. **DATA_MODEL §5.4 허용 노드/마크와 정확히 일치** | `editor` | — | REQ-044 |
| COMP-133 | ImageUploadButton | 이미지 선택 → 사전 검사 → **브라우저에서 축소** → 업로드 → 에디터에 `image { imageId }` 노드 삽입 | `onUploaded(image)`, `currentCount` | API-019, API-020 | REQ-018, 020, 021 |
| COMP-134 | EditorActions | 저장 / 취소. 저장하지 않은 변경이 있으면 이동 전에 확인 | `onSave`, `onCancel`, `saving` | — | REQ-041 |

#### 에디터 결정 사항 (DEC-001, DEC-002)

| 항목 | 결정 |
|---|---|
| 에디터 | **TipTap** |
| 저장 형식 | TipTap JSON, `image` 노드는 `attrs: { imageId, alt? }`만 저장 (`src` 저장 안 함) |
| 에디터 안 이미지 표시 | `imageId`로 업로드 응답 또는 `post.images`의 `url`을 찾아 표시 |
| 툴바 | 굵게, 기울임, 취소선, 제목(H2/H3), 글머리 목록, 번호 목록, 인용, 코드 블록, 구분선, 링크, **표 넣기**, 이미지 |
| 표 (DEC-010) | [표 넣기]는 3×3(첫 행 제목 칸). 커서가 표 안에 있을 때만 "표 편집" 묶음 표시: 아래에 행 추가, 오른쪽에 열 추가, 행 삭제, 열 삭제, 표 삭제. Tab으로 다음 칸 이동. 칸 합치기·너비 조절·색 없음. 칸 안에 표를 넣을 수 없음 (붙여 넣은 표 안의 표는 문단으로 풀림). 붙여 넣은 표의 합쳐진 칸은 풀고 짧은 행은 끝에 빈 칸을 채움. 구현: `components/editor/tableNodes.ts` |
| 링크 입력 | `http://`, `https://`, `mailto:`만 허용 |
| 게시글당 최대 이미지 | **20장**. 20장이면 이미지 버튼 비활성화, "이미지는 20장까지" 안내 |
| 업로드 전 사전 검사 | 형식 jpg/png/webp/gif, 원본 용량 10MB 이하. 벗어나면 업로드하지 않고 안내 (서버도 다시 검사) |
| 브라우저 축소 (DEC-007) | Canvas API로 긴 변 1920px로 축소 후 업로드 (작은 이미지는 확대하지 않음). jpg → jpg, png·webp → webp(품질 0.85). **gif는 변환하지 않음** |
| 축소 후 크기 확인 | 결과가 **4MB를 넘으면** 업로드하지 않고 "이미지가 너무 큽니다" 안내 (주로 큰 gif) |
| 이미지 주소 | 업로드 응답의 `url`을 그대로 사용 (개발: `/uploads/...`, 운영: Vercel Blob 주소) |
| 여러 장 선택 | 한 번에 여러 장 선택 가능, 남은 개수까지만 순서대로 업로드 |
| 업로드 중 | 해당 위치에 "업로드 중..." 표시, 그동안 저장 버튼 비활성화 |
| 업로드 취소 / 직후 삭제 | **[M5 구현 세부]** 이미지를 지운 즉시가 아니라, **저장에 성공했거나 [취소]로 나갈 때** 이번 편집에서 올렸지만 본문에 없는 임시 이미지를 API-020으로 삭제한다. 즉시 지우면 "되돌리기(Ctrl+Z)"로 다시 나타난 이미지가 깨지기 때문이다. 요청이 실패하거나 창을 그냥 닫아도 정리 작업이 지운다 |
| 편집기 불러오기 | **[M5 구현 세부]** TipTap은 글쓰기 화면을 열 때만 불러온다(지연 로딩). 공개 화면 번들에는 포함되지 않는다 (§8.3) |
| 화면 이동 확인 | **[M5 구현 세부]** 저장하지 않은 변경이 있으면 관리자 메뉴 링크·로그아웃·[취소]에서 확인 창, 브라우저 닫기·새로고침은 브라우저 기본 확인 |
| 썸네일 | 서버가 생성 (400px). 서버는 1920px 초과 이미지를 다시 축소해 방어한다 |
| 동영상 | 업로드 버튼 없음 (REQ-021) |
| 붙여넣기 (DEC-009) | 서식 있는 복사(웹페이지 등)는 TipTap 기본 붙여넣기로 허용 서식만 남긴다. **Markdown 원문·HTML 소스** 텍스트는 서식으로 바꿔 커서 위치에 넣는다: 제목은 h2·h3로 맞추고, 표는 표로(DEC-010), 이미지는 버린다. 결과는 `normalizeDoc`을 거친다. 코드블록 안에서는 변환하지 않는다. `Ctrl+Z` 한 번으로 되돌린다. 구현: `lib/pasteFormats.ts`, `components/editor/pasteExtension.ts` (TC-POST-020~023, TC-SEC-014) |

#### 저장 시 오류 표시

| 오류 | 화면 |
|---|---|
| `422 VALIDATION_ERROR` | `details`의 필드 옆에 안내 |
| `422 INVALID_CONTENT` | "본문 형식이 올바르지 않습니다." |
| `422 IMAGE_LIMIT_EXCEEDED` | "이미지는 게시글당 20장까지 넣을 수 있습니다." |
| `422 INVALID_IMAGE_REFERENCE` | "이미지 정보가 올바르지 않습니다. 해당 이미지를 다시 넣어 주세요." |
| `413` / `415` (업로드) | 용량·형식 안내 |

### 9.6 CommentManagementPage (PAGE-107)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-140 | CommentManagementPage | 전체 댓글·답글 목록 (최신순, **20개/페이지**) | API-026 `GET /api/admin/comments` | REQ-035 |
| COMP-141 | AdminCommentTable | 닉네임, 내용(요약), 게시글 제목(링크), 구분(댓글/답글), 답글 수, 작성일, [삭제] | API-027 `DELETE /api/admin/comments/{id}` | REQ-035 |

- 삭제 ConfirmDialog: 답글이 있는 댓글이면 "답글 N개는 유지되고 '삭제된 댓글입니다'로 표시됩니다."라고 안내 (DEC-005)
- 비밀번호 입력 없이 삭제한다.

### 9.7 요청 게시판 (DEC-011, PAGE-005~007, PAGE-108)

| ID | 컴포넌트 | 역할 | API | REQ |
|---|---|---|---|---|
| COMP-006 | RequestMenuLink | 공개 메뉴(가로·햄버거) 맨 끝 **"요청하기"** → `/requests` | — | REQ-046 |
| COMP-040 | RequestBoardPage | 목록 (최신순 12개/페이지, `?page=n`), [요청 남기기] 버튼 | API-029 | REQ-046 |
| COMP-041 | RequestListItem | 종류 배지, 제목(비밀글은 "🔒 비밀글입니다"), 닉네임, 작성일, 상태 배지(접수 / 답변 완료) | — | REQ-046 |
| COMP-042 | RequestForm | 종류 선택, 제목(글자 수), 내용(글자 수), 닉네임, 비밀번호, 비밀글 체크. 작성·수정에 같이 사용 (수정 때는 닉네임 숨김) | API-030, API-033 | REQ-045, 048 |
| COMP-043 | RequestDetailPage | 상세. `locked`면 비밀번호 입력란(COMP-044), 열면 제목·내용·답변. [수정][삭제] (답변이 있으면 수정 버튼 대신 "답변이 달려 수정할 수 없습니다") | API-031, 032, 034 | REQ-047, 048 |
| COMP-044 | SecretUnlockForm | 비밀번호 입력 → API-032. 실패·잠금 메시지는 서버 메시지 그대로 | API-032 | REQ-047 |
| COMP-045 | RequestAnswer | 운영자 답변 상자 ("SmallWorking 답변", 답변 시각) | — | REQ-049 |
| COMP-150 | RequestManagementPage | 상태 탭(전체 / 접수 / 답변 완료), 최신순 20개/페이지, 요청 카드(비밀글 표시, 전체 내용) | API-035 | REQ-049 |
| COMP-151 | AnswerEditor | 답변 입력(1~2,000자) [답변 저장] / [답변 삭제], 요청 [삭제] (ConfirmDialog) | API-036~038 | REQ-049 |

- 작성 후에는 작성 응답(내용 포함)으로 상세 화면을 바로 보여준다. 비밀글이어도 이때는 비밀번호를 다시 묻지 않는다.
- 수정은 상세 화면 안에서 RequestForm을 연다. 저장할 때 비밀번호를 함께 보낸다.
- 삭제는 PasswordDialog(COMP-039 재사용) → 목록으로 이동.
- 운영자가 로그인한 상태에서 공개 상세 화면을 열면 비밀글도 바로 보인다 (API-031).
- 대시보드(PAGE-102)에 **"새 요청 N건"** 바로가기 (API-035 `open_count`). 관리자 메뉴에 **"요청"** 추가.
- 내용·답변은 일반 텍스트로 표시한다 (줄바꿈 유지, `whitespace-pre-wrap`, 긴 글자 줄바꿈).

---

## 10. 공통 UI 컴포넌트

| ID | 컴포넌트 | 역할 | REQ |
|---|---|---|---|
| COMP-200 | ConfirmDialog | 삭제 등 되돌릴 수 없는 작업 전 확인 | REQ-012, 017, 027 |
| COMP-201 | Toast / ErrorMessage | 작업 성공·실패 알림. API 오류의 `error.message` 표시 | REQ-041 |
| COMP-202 | LoadingSpinner | 데이터 로딩 표시 | — |
| COMP-203 | EmptyState | 데이터가 없을 때 안내 ("아직 글이 없습니다", "아직 댓글이 없습니다") | — |
| COMP-204 | NotFoundPage | 존재하지 않는 게시글, 카테고리, 경로 안내 및 [홈으로] | REQ-040 |

---

## 11. Frontend 타입 (API_SPEC v1.0 기준)

```ts
// src/types/category.ts
export interface Category {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  post_count: number;
}

// src/types/post.ts
export interface PostSummary {
  id: number;
  category_id: number;
  category_name: string;
  title: string;
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;   // ISO 8601
  updated_at: string;
}

export interface PostImage {
  id: number;
  url: string;
  thumbnail_url: string;
  original_name: string | null;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface TiptapDoc extends TiptapNode {
  type: 'doc';
}

export interface PostDetail extends PostSummary {
  content: TiptapDoc;
  images: PostImage[];
  liked: boolean;
}

export interface PostInput {
  category_id: number;
  title: string;
  content: TiptapDoc;
}

// src/types/home.ts
export interface HomeCategory {
  id: number;
  name: string;
  description: string | null;
  latest_posts: PostSummary[];
}

export interface HomeData {
  categories: HomeCategory[];
  latest_posts: PostSummary[];
  popular_posts: PostSummary[];
}

// src/types/comment.ts
export interface Comment {
  id: number;
  nickname: string | null;   // is_deleted면 null
  content: string | null;    // is_deleted면 null
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  replies?: Comment[];       // 최상위 댓글만 가짐 (1단계)
}

export interface AdminComment {
  id: number;
  post_id: number;
  post_title: string;
  parent_comment_id: number | null;
  nickname: string;
  content: string;
  reply_count: number;
  created_at: string;
}

// src/types/like.ts
export interface LikeResult {
  post_id: number;
  like_count: number;
  liked: boolean;
}

// src/types/api.ts
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: { field: string; reason: string }[] | null;
  };
}
```

> 타입은 API_SPEC v1.0의 Response 구조와 1:1로 맞춘다. API_SPEC이 바뀌면 이 타입도 함께 수정한다.

---

## 12. 반응형 기준 (DEC-006 확정)

| 구분 | 폭 |
|---|---|
| Mobile | ~ 767px |
| Tablet | 768px ~ 1023px |
| Desktop | 1024px ~ |

| 영역 | Mobile | Tablet | Desktop |
|---|---|---|---|
| Header 메뉴 | 햄버거 + 드로어 | 가로 메뉴 | 가로 메뉴 |
| Home CategorySection | 1열 | 2열 | 3열 |
| Latest / Popular | 세로 배치 | 세로 배치 | 2열 나란히 |
| 카테고리 목록 PostCard | 1열 | 2열 | 3열 (12개 = 4줄) |
| PostContent 본문 폭 | 화면 폭 - 여백 16px | 최대 720px | 최대 720px |
| PostContent 이미지 | `max-width: 100%`, `height: auto` | 같음 | 같음 |
| 긴 텍스트 / URL | `overflow-wrap: anywhere` | 같음 | 같음 |
| 답글 들여쓰기 | 12px | 24px | 32px |
| Admin 테이블 | 카드형 목록으로 전환 | 테이블 | 테이블 |
| PostEditor 툴바 | 줄바꿈 허용 | 한 줄 | 한 줄 |

공통 규칙: 어떤 화면 폭(최소 360px)에서도 **가로 스크롤이 생기지 않아야 한다** (REQ-036, REQ-037).

---

## 13. 상태 관리 / 데이터 흐름

```text
Page
 │  useXxx() hook   (src/hooks)
 ↓
services/xxxService (src/services)  ← 공통 apiClient: credentials 포함, ApiError 변환, 401 처리
 │  HTTP
 ↓
FastAPI /api/...
```

| 항목 | 방침 | 상태 |
|---|---|---|
| 서버 데이터 | 페이지 단위 조회 + 커스텀 훅(`src/hooks/`) | 확정 |
| 전역 상태 | 관리자 로그인 상태만 Context(`AdminAuthContext`)로 관리 | 확정 |
| 공통 API 클라이언트 | `src/services/apiClient.ts` 하나로 요청·오류 처리 통일 | 확정 |
| 에디터 | TipTap (`@tiptap/react` 및 필요한 확장) | 확정 (DEC-001) |
| 라우팅 라이브러리 | React Router | 확정 (DEC-008) |
| 스타일링 방식 | Tailwind CSS (Vite 플러그인) | 확정 (DEC-008) |
| 서버 데이터 캐시 라이브러리 | 사용 안 함 (커스텀 훅) | 확정 (DEC-008) |
| 브라우저 이미지 축소 | Canvas API (라이브러리 없음) | 확정 (DEC-007) |
| 로컬 개발 | Vite 개발 서버가 `/api`, `/uploads`를 로컬 FastAPI로 프록시 (운영과 같은 "같은 도메인" 구조) | 확정 (DEC-007) |

> Claude.md 원칙: **임의로 새로운 라이브러리를 추가하지 않는다.** 위 라이브러리는 Claude.md 작성 시 확정한다.

---

## 14. Traceability (REQ → API → COMP)

| REQ | 내용 | API | COMP |
|---|---|---|---|
| REQ-004~007 | 홈 구성, 최신글, 인기글 | API-021 | COMP-010~014 |
| REQ-008 | 카테고리 자동 반영 | API-001, API-021 | COMP-003, 004, 011 |
| REQ-010~013 | 카테고리 관리 | API-002~005 | COMP-110~112 |
| REQ-014~016 | 게시글 작성·수정 | API-008, API-009 | COMP-130, 131 |
| REQ-017 | 게시글 삭제 | API-010 | COMP-121, 200 |
| REQ-018~020 | 본문 이미지, 순서, 개수 | API-019, API-020, API-008/009 | COMP-032, 132, 133 |
| REQ-021 | 동영상 제외 | — | COMP-133, 135 (동영상 버튼 없음) |
| REQ-022 | 게시글 상세 | API-007 | COMP-030~032 |
| REQ-023 | 카테고리 게시글 목록 | API-006 | COMP-020~023 |
| REQ-024, 025 | 댓글 작성·표시 | API-014, API-015 | COMP-034~036, 038 |
| REQ-026, 027 | 댓글 수정·삭제 | API-016, API-017 | COMP-036, 039 |
| REQ-028, 029 | 답글, 1단계 제한 | API-015 | COMP-036~038 |
| REQ-030, 032 | 게시글 좋아요, 중복 방지 | API-018, API-022 | COMP-033 |
| REQ-033 | 게시글 관리 | API-006, 010 | COMP-120, 121 |
| REQ-035 | 댓글 관리 | API-026, API-027 | COMP-140, 141 |
| REQ-036, 037 | 반응형, 모바일 표시 | — | §12 전체 |
| REQ-038, 039 | 입력 검증 | 각 API | COMP-038, 111, 131 |
| REQ-040, 041 | 오류 처리 | API_SPEC §12 | COMP-201, 204 |
| REQ-042 | 관리자 보호 | API-023~025 | COMP-100, 103 |
| REQ-044 | XSS 방지 | API-008/009 | COMP-032, 036, 135 |

---

## 15. 후속 반영 사항 (v0.1 §15 처리 결과)

| No | 내용 | 결과 |
|---|---|---|
| F-001 | 관리자 인증 API | ✅ API-023~025 |
| F-002 | 관리자 댓글 목록·삭제 API | ✅ API-026, 027 |
| F-003 | 임시 이미지와 `post_id NOT NULL` 충돌 | ✅ DATA_MODEL v1.0 `post_id` NULL 허용 |
| F-004 | 이미지 경로 규칙 통일 | ✅ 저장소 키 `images/YYYY/MM/` (DEC-002, DEC-007) |
| F-005 | 라우트 충돌 | ✅ API_SPEC v1.0 §2.4 선언 순서 규칙 |
| F-006 | PostSummary 썸네일 필드 | ✅ `thumbnail_url` |
| F-007 | 좋아요 상태 조회 | ✅ API-007 `liked` |

---

## 16. 확정 / 미확정 요약

### 확정

- 공개 화면 4개, 관리자 화면 7개(작성/수정 공유)의 라우트 구조와 페이지 주소 규칙
- 홈 표시 개수 3 / 5 / 5, 인기글 전체 기간, 목록 12개(관리자 20개)/페이지, 댓글 작성순 (DEC-006)
- TipTap 에디터, 허용 노드 기반 렌더링, 툴바 구성 (DEC-001)
- 이미지 업로드 흐름, 20장·10MB·형식 사전 검사, 썸네일 표시 (DEC-002)
- 로그인·로그아웃·세션 만료 처리 (DEC-003)
- 좋아요 토글 (DEC-004)
- 삭제된 댓글 표시, 카테고리 삭제 제한 표시 (DEC-005)
- 반응형 브레이크포인트 768 / 1024 (DEC-006)
- 게시글 작성자 운영자 고정, 답글에 [답글] 버튼 없음, 동영상 UI 없음

- 라이브러리: React Router, Tailwind CSS, 데이터 캐시 라이브러리 없음 (DEC-008)
- 업로드 전 브라우저 축소 (DEC-007)

### 미확정 (구현 단계)

| 항목 | 비고 |
|---|---|
| 실제 디자인 (색상, 폰트, 로고) | 구현 단계 |
| IntroSection 소개 문구 | 운영자가 직접 작성 |

---

## 17. 다음 단계

```text
DATA_MODEL v1.0      ✅
API_SPEC v1.0        ✅
COMPONENT_SPEC v1.0  ← 현재 (완료)
TEST_CASES v1.0      ← 다음
TRD / REQUIREMENTS v1.1
Claude.md
구현
```

---

## 18. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1 | 2026-11-03 | 초기 화면·컴포넌트 구조 초안 작성 (이전 초안 유실로 재작성) |
| 1.0 (개정) | 2026-11-04 | DEC-011 반영: 요청 게시판 PAGE-005~007·108, §9.7 COMP-006·040~045·150·151 |
| 1.0 (개정) | 2026-11-04 | DEC-010 반영: 본문 표 — 툴바 [표 넣기]·표 편집 버튼(COMP-135), PostContent 표 렌더링(§8.3), 붙여넣기 표 유지 |
| 1.0 (개정) | 2026-11-04 | DEC-009 반영: COMP-132 붙여넣기 시 Markdown 원문·HTML 소스를 서식으로 변환 |
| 1.0 (개정) | 2026-11-03 | DEC-007, 008 반영: Tailwind CSS·React Router 확정, 업로드 전 브라우저 축소(1920px, 4MB 확인), 이미지 주소는 응답 `url` 사용, 로컬 개발 프록시 |
| 1.0 | 2026-11-03 | DEC-001~006 및 API_SPEC v1.0 반영: TipTap 확정·렌더링 규칙(§8.3), 좋아요 토글, 삭제된 댓글 표시, 로그인·세션 만료 처리, 카테고리 삭제 제한, 에디터 이미지 규칙, 관리자 댓글 화면 API 연결, 타입 갱신, 표시 개수·페이징·브레이크포인트 확정, EditorToolbar(COMP-135) 추가 |
