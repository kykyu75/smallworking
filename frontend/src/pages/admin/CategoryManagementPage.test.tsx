import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { DEFAULT_CATEGORIES, mockApi, sentBodies, type MockRoute } from '../../test/mockApi'

const ME: MockRoute = { path: '/api/admin/me', body: { username: 'admin' } }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <App />
    </MemoryRouter>,
  )
}

async function rows() {
  const list = await screen.findByRole('list', { name: '카테고리 목록' })
  return within(list).getAllByRole('listitem')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('카테고리 관리 화면 (COMP-110~112)', () => {
  // TC-CAT-003
  it('새 카테고리를 추가하면 API로 보내고 목록을 다시 불러온다', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      {
        method: 'POST',
        path: '/api/categories',
        status: 201,
        body: { id: 9, name: '여행', description: null, display_order: 5, post_count: 0 },
      },
    ])
    renderPage()
    await rows()
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '  여행  ' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('status')).toHaveTextContent("'여행' 카테고리를 추가했습니다.")
    expect(sentBodies(fetchMock, 'POST', '/api/categories')).toEqual([{ name: '여행', description: null }])
  })

  // TC-CAT-004: 이름이 비면 추가 버튼 비활성화
  it('이름이 비어 있으면 추가 버튼이 비활성화된다', async () => {
    mockApi([ME, { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }])
    renderPage()
    await rows()
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  // TC-CAT-005: 중복 이름 안내는 이름 입력란 아래에
  it('중복 이름이면 이름 입력란 아래에 안내한다', async () => {
    mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      {
        method: 'POST',
        path: '/api/categories',
        status: 409,
        body: { error: { code: 'CATEGORY_NAME_DUPLICATED', message: '이미 있는 카테고리 이름입니다.', details: null } },
      },
    ])
    renderPage()
    await rows()
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: 'diy' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByText('이미 있는 카테고리 이름입니다.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^이름/)).toHaveAttribute('aria-invalid', 'true')
  })

  // TC-CAT-014: 글이 있는 카테고리는 삭제 버튼 비활성화 + 안내
  it('게시글이 있는 카테고리는 삭제할 수 없다고 안내한다', async () => {
    mockApi([ME, { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }])
    renderPage()
    await rows()
    expect(screen.getByRole('button', { name: 'Portfolio 삭제' })).toBeDisabled()
    expect(screen.getByText('게시글 3개가 있어 삭제할 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DIY 삭제' })).toBeEnabled()
  })

  // TC-CAT-007, TC-ADM-007: 확인 창 → 삭제, 취소하면 삭제 안 함
  it('삭제는 확인 창을 거치고, 취소하면 요청하지 않는다', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { method: 'DELETE', path: '/api/categories', status: 204 },
    ])
    renderPage()
    await rows()

    fireEvent.click(screen.getByRole('button', { name: 'Blog 삭제' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sentBodies(fetchMock, 'DELETE', '/api/categories/3')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Blog 삭제' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByRole('status')).toHaveTextContent("'Blog' 카테고리를 삭제했습니다.")
    expect(sentBodies(fetchMock, 'DELETE', '/api/categories/3')).toHaveLength(1)
  })

  // TC-CAT-009: ▲▼로 순서를 바꾸고 저장하면 ID 순서 배열을 보낸다
  it('순서를 바꿔 저장하면 전체 ID를 새 순서대로 보낸다', async () => {
    const reordered = [DEFAULT_CATEGORIES[2], DEFAULT_CATEGORIES[0], DEFAULT_CATEGORIES[1], DEFAULT_CATEGORIES[3]]
    const fetchMock = mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { method: 'PUT', path: '/api/categories/order', body: { items: reordered } },
    ])
    renderPage()
    await rows()
    const save = screen.getByRole('button', { name: '순서 저장' })
    expect(save).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Blog 위로' }))
    fireEvent.click(screen.getByRole('button', { name: 'Blog 위로' }))
    expect((await rows()).map((li) => within(li).getByText(/^(DIY|Portfolio|Blog|Board)$/).textContent)).toEqual([
      'Blog',
      'DIY',
      'Portfolio',
      'Board',
    ])
    fireEvent.click(save)

    expect(await screen.findByRole('status')).toHaveTextContent('순서를 저장했습니다.')
    expect(sentBodies(fetchMock, 'PUT', '/api/categories/order')).toEqual([{ category_ids: [3, 1, 2, 4] }])
  })

  // TC-CAT-013: 목록이 바뀌었으면 안내 후 새로고침
  it('순서 저장 중 목록이 바뀌었으면 안내하고 최신 목록을 다시 불러온다', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      {
        method: 'PUT',
        path: '/api/categories/order',
        status: 422,
        body: {
          error: { code: 'CATEGORY_ORDER_MISMATCH', message: '카테고리 목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.', details: null },
        },
      },
    ])
    renderPage()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Board 위로' }))
    fireEvent.click(screen.getByRole('button', { name: '순서 저장' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('카테고리 목록이 바뀌었습니다.')
    const listCalls = fetchMock.mock.calls.filter(([url, init]) => url === '/api/categories' && !init?.method?.match(/POST/))
    expect(listCalls.length).toBeGreaterThanOrEqual(2)
  })

  // TC-CAT-006
  it('수정 버튼으로 이름과 설명을 바꿀 수 있다', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { method: 'PUT', path: '/api/categories', body: { ...DEFAULT_CATEGORIES[3], name: '자유게시판' } },
    ])
    renderPage()
    const boardRow = (await rows())[3]
    fireEvent.click(within(boardRow).getByRole('button', { name: '수정' }))
    const nameInput = within((await rows())[3]).getByLabelText(/^이름/)
    fireEvent.change(nameInput, { target: { value: '자유게시판' } })
    fireEvent.click(within((await rows())[3]).getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('카테고리를 수정했습니다.')
    expect(sentBodies(fetchMock, 'PUT', '/api/categories/4')).toEqual([{ name: '자유게시판', description: '자유로운 이야기' }])
  })
})
