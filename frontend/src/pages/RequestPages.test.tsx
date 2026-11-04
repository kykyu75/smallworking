// DEC-011 요청 게시판 화면 (PAGE-005~007, PAGE-108, TC-REQ-003~017)
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_CATEGORIES, mockApi, sentBodies, type MockRoute } from '../test/mockApi'
import type { AdminRequest, RequestDetail, RequestSummary } from '../types/request'

const CATEGORIES: MockRoute = { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }
const ME: MockRoute = { path: '/api/admin/me', body: { username: 'admin' } }

function summary(id: number, overrides: Partial<RequestSummary> = {}): RequestSummary {
  return {
    id,
    kind: 'diy',
    title: `요청 ${id}`,
    nickname: '목수',
    is_secret: false,
    answered: false,
    created_at: '2026-11-04T01:00:00Z',
    ...overrides,
  }
}

function detail(overrides: Partial<RequestDetail> = {}): RequestDetail {
  return {
    id: 7,
    kind: 'diy',
    title: '선반 도면 부탁드려요',
    content: '도면을\n공유해 주세요',
    nickname: '목수',
    is_secret: false,
    locked: false,
    answer: null,
    answered_at: null,
    created_at: '2026-11-04T01:00:00Z',
    updated_at: '2026-11-04T01:00:00Z',
    ...overrides,
  }
}

const LOCKED = detail({ is_secret: true, locked: true, title: null, content: null })

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const ERROR = (code: string, message: string) => ({ error: { code, message, details: null } })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('요청 게시판 — 방문자 (DEC-011)', () => {
  it('TC-REQ-003 목록: 비밀글은 제목을 가리고, 종류·상태를 보여준다', async () => {
    mockApi([
      CATEGORIES,
      {
        path: '/api/requests',
        body: {
          items: [summary(2, { is_secret: true, title: null, answered: true, kind: 'material' }), summary(1)],
          page: 1,
          size: 12,
          total: 2,
        },
      },
    ])
    renderAt('/requests')
    const list = await screen.findByRole('list', { name: '요청 목록' })
    const items = within(list).getAllByRole('link')
    expect(items[0]).toHaveTextContent('🔒 비밀글입니다')
    expect(items[0]).toHaveTextContent('자료 요청')
    expect(items[0]).toHaveTextContent('답변 완료')
    expect(items[0]).toHaveAttribute('href', '/requests/2')
    expect(items[1]).toHaveTextContent('요청 1')
    expect(items[1]).toHaveTextContent('접수')
    expect(document.title).toBe('요청하기 - SmallWorking')
  })

  it('TC-REQ-001 작성 → 작성 응답으로 바로 상세 화면 (비밀글도 비밀번호를 다시 묻지 않음)', async () => {
    const created = detail({ id: 31, is_secret: true, kind: 'material', title: '자료 부탁', content: '자료 주세요' })
    const fetchMock = mockApi([CATEGORIES, { method: 'POST', path: '/api/requests', status: 201, body: created }])
    renderAt('/requests/new')
    const form = await screen.findByRole('form', { name: '요청 작성' })
    const submit = within(form).getByRole('button', { name: '요청 등록' })
    expect(submit).toBeDisabled()

    fireEvent.click(within(form).getByLabelText('자료 요청'))
    fireEvent.change(within(form).getByLabelText(/^제목/), { target: { value: '  자료 부탁 ' } })
    fireEvent.change(within(form).getByLabelText('내용'), { target: { value: '자료 주세요' } })
    fireEvent.change(within(form).getByLabelText(/^닉네임/), { target: { value: '목수' } })
    fireEvent.change(within(form).getByLabelText(/^비밀번호/), { target: { value: 'pass1234' } })
    fireEvent.click(within(form).getByLabelText(/^비밀글/))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    expect(await screen.findByRole('heading', { level: 1, name: '자료 부탁' })).toBeInTheDocument()
    expect(screen.getByText('자료 주세요')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/requests/31')
    expect(sentBodies(fetchMock, 'POST', '/api/requests')).toEqual([
      { kind: 'material', title: '자료 부탁', content: '자료 주세요', password: 'pass1234', is_secret: true, nickname: '목수' },
    ])
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/requests/31')).toBe(false)
  })

  it('TC-REQ-005·006·008 비밀글: 비밀번호를 틀리면 안내, 맞으면 내용과 답변, 답변이 있으면 수정 불가', async () => {
    const opened = detail({ is_secret: true, answer: '다음 주에 올릴게요', answered_at: '2026-11-04T02:00:00Z' })
    mockApi([
      CATEGORIES,
      { path: '/api/requests/7', body: LOCKED },
      {
        method: 'POST',
        path: '/api/requests/7/open',
        respond: (_init, call) =>
          call === 0 ? { status: 403, body: ERROR('INVALID_PASSWORD', '비밀번호가 일치하지 않습니다.') } : { status: 200, body: opened },
      },
    ])
    renderAt('/requests/7')
    expect(await screen.findByRole('heading', { level: 1, name: '🔒 비밀글입니다' })).toBeInTheDocument()
    const form = screen.getByRole('form', { name: '비밀글 열기' })
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'wrong' } })
    fireEvent.click(within(form).getByRole('button', { name: '열기' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('비밀번호가 일치하지 않습니다.')

    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'pass1234' } })
    fireEvent.click(within(form).getByRole('button', { name: '열기' }))
    expect(await screen.findByRole('heading', { level: 1, name: '선반 도면 부탁드려요' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '운영자 답변' })).toHaveTextContent('다음 주에 올릴게요')
    expect(screen.getByText('답변이 달려 수정할 수 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument()
  })

  it('TC-REQ-009 잠기면 서버 안내를 그대로 보여준다', async () => {
    mockApi([
      CATEGORIES,
      { path: '/api/requests/7', body: LOCKED },
      {
        method: 'POST',
        path: '/api/requests/7/open',
        status: 423,
        body: ERROR('REQUEST_LOCKED', '비밀번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.'),
      },
    ])
    renderAt('/requests/7')
    const form = await screen.findByRole('form', { name: '비밀글 열기' })
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'pass1234' } })
    fireEvent.click(within(form).getByRole('button', { name: '열기' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('여러 번 틀렸습니다')
  })

  it('TC-REQ-011 수정: 기존 값이 채워진 폼, 비밀번호와 함께 저장', async () => {
    const fetchMock = mockApi([
      CATEGORIES,
      { path: '/api/requests/7', body: detail() },
      { method: 'PUT', path: '/api/requests/7', body: detail({ title: '바뀐 제목', updated_at: '2026-11-04T03:00:00Z' }) },
    ])
    renderAt('/requests/7')
    fireEvent.click(await screen.findByRole('button', { name: '수정' }))
    const form = screen.getByRole('form', { name: '요청 수정' })
    expect(within(form).queryByLabelText(/^닉네임/)).not.toBeInTheDocument()
    expect(within(form).getByLabelText(/^제목/)).toHaveValue('선반 도면 부탁드려요')
    fireEvent.change(within(form).getByLabelText(/^제목/), { target: { value: '바뀐 제목' } })
    fireEvent.change(within(form).getByLabelText(/^비밀번호/), { target: { value: 'pass1234' } })
    fireEvent.click(within(form).getByRole('button', { name: '수정 저장' }))

    expect(await screen.findByRole('heading', { level: 1, name: '바뀐 제목' })).toBeInTheDocument()
    expect(screen.getByText(/\(수정됨\)/)).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', '/api/requests/7')).toEqual([
      { kind: 'diy', title: '바뀐 제목', content: '도면을\n공유해 주세요', password: 'pass1234', is_secret: false },
    ])
  })

  it('TC-REQ-013 삭제: 비밀번호 확인 후 목록으로', async () => {
    const fetchMock = mockApi([
      CATEGORIES,
      { path: '/api/requests/7', body: detail() },
      { method: 'POST', path: '/api/requests/7/delete', status: 204 },
      { path: '/api/requests', body: { items: [], page: 1, size: 12, total: 0 } },
    ])
    renderAt('/requests/7')
    fireEvent.click(await screen.findByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('dialog', { name: '요청 삭제' })
    fireEvent.change(within(dialog).getByLabelText('비밀번호'), { target: { value: 'pass1234' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/requests$/))
    expect(sentBodies(fetchMock, 'POST', '/api/requests/7/delete')).toEqual([{ password: 'pass1234' }])
  })

  it('없는 요청은 404 화면', async () => {
    mockApi([CATEGORIES, { path: '/api/requests/99', status: 404, body: ERROR('REQUEST_NOT_FOUND', '요청 글을 찾을 수 없습니다.') }])
    renderAt('/requests/99')
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
  })
})

function adminItem(id: number, overrides: Partial<AdminRequest> = {}): AdminRequest {
  return {
    id,
    kind: 'diy',
    title: `요청 ${id}`,
    content: `내용 ${id}`,
    nickname: '목수',
    is_secret: false,
    answer: null,
    answered_at: null,
    created_at: '2026-11-04T01:00:00Z',
    updated_at: '2026-11-04T01:00:00Z',
    ...overrides,
  }
}

describe('요청 관리 — 운영자 (PAGE-108)', () => {
  it('TC-REQ-016 비밀글 내용까지 보이고, 탭으로 상태를 거른다', async () => {
    const fetchMock = mockApi([
      ME,
      {
        path: '/api/admin/requests',
        respond: () => ({
          status: 200,
          body: { items: [adminItem(2, { is_secret: true, title: '비밀 요청', content: '비밀 내용' }), adminItem(1)], page: 1, size: 20, total: 2, open_count: 2 },
        }),
      },
    ])
    renderAt('/admin/requests')
    const list = await screen.findByRole('list', { name: '요청 목록' })
    expect(within(list).getByText('비밀 내용')).toBeInTheDocument()
    expect(within(list).getByText('🔒 비밀글')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '접수 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '접수 2' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/requests?status=open'))
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/admin/requests?status=open'))).toBe(true),
    )
  })

  it('TC-REQ-014·015 답변 저장·삭제 후 목록을 다시 불러온다', async () => {
    const fetchMock = mockApi([
      ME,
      {
        path: '/api/admin/requests',
        respond: (_init, call) => ({
          status: 200,
          body: {
            items: [call === 0 ? adminItem(5) : adminItem(5, { answer: '올렸습니다', answered_at: '2026-11-04T02:00:00Z' })],
            page: 1,
            size: 20,
            total: 1,
            open_count: call === 0 ? 1 : 0,
          },
        }),
      },
      { method: 'PUT', path: '/api/admin/requests/5/answer', body: {} },
      { method: 'DELETE', path: '/api/admin/requests/5/answer', body: {} },
    ])
    renderAt('/admin/requests')
    const form = await screen.findByRole('form', { name: '요청 5 답변' })
    const save = within(form).getByRole('button', { name: '답변 저장' })
    expect(save).toBeDisabled()
    fireEvent.change(within(form).getByLabelText('답변'), { target: { value: ' 올렸습니다 ' } })
    fireEvent.click(save)
    expect(await screen.findByRole('status')).toHaveTextContent('답변을 저장했습니다.')
    expect(sentBodies(fetchMock, 'PUT', '/api/admin/requests/5/answer')).toEqual([{ answer: '올렸습니다' }])

    const deleteButton = await screen.findByRole('button', { name: '답변 삭제' })
    fireEvent.click(deleteButton)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('답변을 삭제했습니다.'))
  })

  it('TC-REQ-017 요청 삭제는 확인 후', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/admin/requests', body: { items: [adminItem(3)], page: 1, size: 20, total: 1, open_count: 1 } },
      { method: 'DELETE', path: '/api/admin/requests/3', status: 204 },
    ])
    renderAt('/admin/requests')
    fireEvent.click(await screen.findByRole('button', { name: "요청 '요청 3' 삭제" }))
    const dialog = screen.getByRole('dialog', { name: '요청 삭제' })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 삭제했습니다.')
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/admin/requests/3' && init?.method === 'DELETE')).toBe(true)
  })

  it('대시보드에 새 요청 수를 보여준다', async () => {
    mockApi([ME, { path: '/api/admin/requests', body: { items: [], page: 1, size: 1, total: 3, open_count: 3 } }])
    renderAt('/admin')
    const link = await screen.findByRole('link', { name: /새 요청 3건/ })
    expect(link).toHaveAttribute('href', '/admin/requests?status=open')
  })
})
