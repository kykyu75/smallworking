# SmallWorking 배포 가이드 (M11, DEC-012)

| 항목 | 내용 |
|---|---|
| 기준 | DEC-007, DEC-012, TRD v1.1 §15·§17·§18 |
| 구조 | Vercel Services: `web`(frontend/, Vite) + `api`(backend/, FastAPI) · Neon PostgreSQL · Vercel Blob(공개) · Vercel Cron |
| 작성일 | 2026-11-04 |

> 👤 = 사용자가 직접 하는 일 (계정·대시보드) / 🤖 = Claude가 하는 일
> 비밀값(DB 주소, 토큰, 비밀번호)은 **채팅에 붙여 넣지 않는다.** 파일이나 Vercel 화면에만 넣는다.

---

## 1단계 — Vercel 프로젝트 만들기 👤

1. https://vercel.com 에서 **GitHub 계정으로 가입** (Hobby 무료 플랜).
2. **Add New → Project** → `kykyu75/smallworking` 저장소 **Import**.
3. 설정 화면에서 **Root Directory는 비워 둔다**(저장소 맨 위). 나머지는 그대로 두고 **Deploy**.
   - 이때 `main`에는 아직 배포 설정(`vercel.json`)이 없어서 **첫 배포는 실패하거나 빈 화면**이어도 괜찮다. 나중에 병합하면 바뀐다.
4. 프로젝트 **Settings → Functions → Function Region**을 **Singapore (sin1)**로 바꾼다 (DB와 같은 지역).

## 2단계 — Neon 데이터베이스 연결 👤

1. 프로젝트 **Storage** 탭 → **Create Database** → **Neon** (Marketplace).
2. 지역: **AWS Asia Pacific (Singapore)**, 플랜: **Free**, 이름: `smallworking`.
3. 프로젝트 연결 화면:
   - 환경: **Production**, **Preview** 체크 (Development는 체크 안 해도 됨)
   - **Create database branch for deployment → Preview** 체크 (미리보기 배포마다 운영 DB 복사본을 쓴다. Production은 체크하지 않는다)
   - Custom Prefix는 비워 둔다
4. 연결되면 Vercel 환경변수에 `DATABASE_URL`(풀러), `DATABASE_URL_UNPOOLED`(직접 연결) 등이 자동으로 생긴다.

## 3단계 — Blob 저장소(이미지) 만들기 👤

1. 프로젝트 **Storage** 탭 → **Create Storage → Blob**.
2. 접근: **Public** (반드시 Public — 이미지 주소를 바로 보여주는 구조), 이름: `smallworking-images`.
3. 환경: **Production**, **Preview**. → `BLOB_READ_WRITE_TOKEN` 등이 자동으로 생긴다.
4. **공개 주소 확인**: 만든 저장소 화면의 **Browser**에서 아무 작은 파일(예: 메모장으로 만든 `hello.txt`)을 올리고 나온 주소를 복사한다.
   - 예: `https://abcd1234efgh.public.blob.vercel-storage.com/hello.txt`
   - 파일 이름을 뺀 앞부분 `https://abcd1234efgh.public.blob.vercel-storage.com` 이 **BLOB_PUBLIC_BASE_URL**이다.
   - 올린 테스트 파일은 지워도 된다.

## 4단계 — 환경변수 넣기 👤

프로젝트 **Settings → Environment Variables**에서 아래를 추가한다. 환경은 **Production과 Preview** 모두 체크.

| 이름 | 값 |
|---|---|
| `STORAGE_BACKEND` | `blob` |
| `BLOB_PUBLIC_BASE_URL` | 3단계에서 확인한 주소 (끝에 `/` 없이) |
| `CRON_SECRET` | 무작위 문자열 — 아래 명령으로 만든다 |
| `COOKIE_SECURE` | `true` |
| `ALLOWED_ORIGINS` | `https://<프로젝트이름>.vercel.app` (운영 주소. 미리보기 주소는 자동으로 허용됨) |

`CRON_SECRET` 만들기 (본인 PowerShell 창에서, 결과는 채팅에 붙이지 않는다):

```powershell
C:\SmallWorking\backend\.venv\Scripts\python -c "import secrets; print(secrets.token_urlsafe(32))"
```

> `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`은 2·3단계에서 자동으로 들어가므로 직접 넣지 않는다.
> `ADMIN_USERNAME`, `ADMIN_PASSWORD`는 Vercel에 넣지 않는다 (5단계 관리자 생성에서만 사용).

## 5단계 — 운영 DB 준비 (마이그레이션 + 관리자) 👤 → 🤖

1. 👤 Vercel **Settings → Environment Variables**에서 `DATABASE_URL_UNPOOLED` 값을 복사한다 (눈 아이콘으로 보기).
2. 👤 메모장으로 `C:\SmallWorking\backend\.env.neon` 파일을 만든다 (Git에 올라가지 않는 파일):

   ```text
   DATABASE_URL=<복사한 DATABASE_URL_UNPOOLED 값>
   ADMIN_USERNAME=<운영 관리자 아이디>
   ADMIN_PASSWORD=<운영 관리자 비밀번호, 12자 이상, 개발용과 다르게>
   ```

3. 👤 Claude에게 "운영 DB 준비해줘"라고 말한다.
4. 🤖 확인을 받은 뒤 다음을 실행한다 (`SW_ENV_FILE`을 지정하면 개발용 `.env`는 읽지 않는다):

   ```powershell
   $env:SW_ENV_FILE = ".env.neon"
   .\.venv\Scripts\python -m alembic upgrade head      # 테이블 생성 + 기본 카테고리 4개 + DB 시간대 UTC
   .\.venv\Scripts\python -m app.cli create-admin       # 운영 관리자 1명
   Remove-Item Env:SW_ENV_FILE
   ```

5. 👤 끝나면 `.env.neon`은 지워도 된다 (다시 필요하면 같은 방법으로 만든다).

> 미리보기 DB(Neon 미리보기 브랜치)는 미리보기 배포 때 운영 DB를 복사해서 만들어지므로, **운영 DB 준비를 먼저** 해야 미리보기에서도 테이블과 관리자가 있다.

## 6단계 — 미리보기 배포 확인 🤖 + 👤

1. 🤖 `feat/m11-vercel` 브랜치를 push → Vercel이 **미리보기 배포**를 만든다 (Vercel 화면의 Deployments).
2. 👤 미리보기 주소를 알려준다 (Vercel 로그인 상태에서만 열림).
3. 🤖·👤 TEST_CASES §14-1 **TC-DEP-001~007**을 확인한다:

| TC | 확인 |
|---|---|
| TC-DEP-001 | 홈이 열리고 `/api/*` 응답 정상 (`/api/health` → `{"status":"ok","database":"ok"}`) |
| TC-DEP-002 | 관리자로 사진 3장 넣은 글 작성 → 사진 주소가 `…public.blob.vercel-storage.com/…`, 썸네일 표시 |
| TC-DEP-003 | `sw_session`, `sw_visitor` 쿠키에 `Secure`, `HttpOnly`, `SameSite=Lax` |
| TC-DEP-004 | 스마트폰 원본(8~10MB) 사진도 브라우저에서 줄여 정상 업로드 |
| TC-DEP-005 | `/posts/1`, `/requests`, `/admin/posts`에서 새로고침해도 404가 아님 |
| TC-DEP-006 | Vercel 대시보드에서 Cron 수동 실행 → 200, 로그에 결과 건수. 비밀값 없이 부르면 401 |
| TC-DEP-007 | 환경변수가 모두 설정, 코드에 비밀값 없음 |
| (추가) | 응답 시각이 `…Z`(UTC)로 끝남 — 풀러 연결 시간대 확인 (DEC-012) |

## 7단계 — 운영 배포 🤖 (사용자 확인 후)

1. 🤖 미리보기 확인 결과를 보고하고, **`main` 병합 = 운영 배포**이므로 확인을 받는다.
2. 🤖 병합·push → Vercel이 운영 배포.
3. 👤 운영 주소에서 관리자 로그인 → 첫 글 작성.
4. 다음 날 Vercel **Settings → Cron Jobs**(또는 Logs)에서 정리 작업이 실행됐는지 확인 (Hobby는 지정 시각 ±59분).

---

## 이후 운영 메모

- 코드 변경: 브랜치 → 미리보기 확인 → (확인 후) `main` 병합.
- **새 마이그레이션이 있는 변경**은 병합 **전에** 5단계 방법으로 운영 DB에 먼저 적용한다 (추가만 하는 변경이어야 기존 코드와 함께 동작). 미리보기 브랜치는 운영 DB를 복사하므로, 미리보기에서 새 테이블이 필요하면 그 브랜치 DB에도 적용한다.
- 비밀번호·토큰이 노출되면 Vercel 환경변수에서 바꾸고 다시 배포한다.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-11-04 | 최초 작성 (DEC-012) |
