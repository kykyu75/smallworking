import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { DEFAULT_CATEGORIES, mockApi, sentBodies, type MockRoute } from '../../test/mockApi'
import type { PostDetail } from '../../types/post'

// jsdom에는 canvas가 없으므로 브라우저 축소는 건너뛴다 (축소 자체는 imageResize.test.ts에서 검증)
vi.mock('../../lib/imageResize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/imageResize')>()
  return { ...actual, prepareImage: async (file: File) => file }
})

const ME: MockRoute = { path: '/api/admin/me', body: { username: 'admin' } }
const CATEGORIES: MockRoute = { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }

const EXISTING: PostDetail = {
  id: 42,
  category_id: 1,
  category_name: 'DIY',
  title: '주방 타일 시공',
  thumbnail_url: '/uploads/images/2026/11/7_thumb.jpg',
  like_count: 3,
  comment_count: 1,
  created_at: '2026-11-03T09:00:00Z',
  updated_at: '2026-11-03T09:00:00Z',
  liked: false,
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '타일을 붙였다.' }] },
      { type: 'image', attrs: { imageId: 7 } },
    ],
  },
  images: [
    {
      id: 7,
      url: '/uploads/images/2026/11/7.jpg',
      thumbnail_url: '/uploads/images/2026/11/7_thumb.jpg',
      original_name: 'tile.jpg',
      mime_type: 'image/jpeg',
      file_size: 1000,
      width: 800,
      height: 600,
    },
  ],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
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

function chooseImage(name = 'new.jpg') {
  const input = screen.getByTestId('image-file-input')
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(10)], name, { type: 'image/jpeg' })] } })
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('게시글 작성 화면 (COMP-130~135)', () => {
  it('제목·카테고리·본문이 모두 있어야 저장할 수 있다', async () => {
    mockApi([ME, CATEGORIES])
    renderAt('/admin/posts/new')
    const save = await screen.findByRole('button', { name: '저장' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^제목 \(/), { target: { value: '새 글' } })
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '1' } })
    expect(save).toBeDisabled() // 본문이 비어 있음
    expect(screen.getByRole('toolbar', { name: '서식' })).toBeInTheDocument()
  })

  // TC-POST-001, TC-IMG-003: 이미지를 올리면 본문에 들어가고, imageId만 저장된다
  it('이미지를 넣고 저장하면 imageId만 담긴 본문을 보낸다', async () => {
    const created = { ...EXISTING, id: 50, title: '새 글' }
    const fetchMock = mockApi([
      ME,
      CATEGORIES,
      {
        method: 'POST',
        path: '/api/images',
        status: 201,
        body: { ...EXISTING.images[0], id: 9, url: '/uploads/images/2026/11/9.jpg' },
      },
      { method: 'POST', path: '/api/posts', status: 201, body: created },
      { path: '/api/posts', body: { items: [], page: 1, size: 20, total: 0 } },
    ])
    renderAt('/admin/posts/new')
    await screen.findByRole('button', { name: '저장' })
    fireEvent.change(screen.getByLabelText(/^제목 \(/), { target: { value: '  새 글  ' } })
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '1' } })

    chooseImage()
    const editor = screen.getByRole('textbox', { name: '본문' })
    await waitFor(() => expect(editor.querySelector('img[data-image-id="9"]')).not.toBeNull())
    expect(editor.querySelector('img')).toHaveAttribute('src', '/uploads/images/2026/11/9.jpg')
    expect(screen.getByText('이미지 1 / 20')).toBeInTheDocument()

    const save = screen.getByRole('button', { name: '저장' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/posts'))
    const [body] = sentBodies(fetchMock, 'POST', '/api/posts') as { title: string; category_id: number; content: { content: unknown[] } }[]
    expect(body.title).toBe('새 글')
    expect(body.category_id).toBe(1)
    expect(body.content.content).toContainEqual({ type: 'image', attrs: { imageId: 9 } })
    expect(JSON.stringify(body.content)).not.toContain('src')
  })
})

describe('게시글 수정 화면', () => {
  // TC-POST-005: 기존 글을 불러와 고친 뒤 PUT
  it('기존 글을 불러와 제목을 고쳐 저장한다', async () => {
    const fetchMock = mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts/42', body: EXISTING },
      { method: 'PUT', path: '/api/posts/42', body: { ...EXISTING, title: '주방 타일 시공 후기' } },
      { path: '/api/posts', body: { items: [], page: 1, size: 20, total: 0 } },
    ])
    renderAt('/admin/posts/42/edit')
    const titleInput = await screen.findByDisplayValue('주방 타일 시공')
    const editor = screen.getByRole('textbox', { name: '본문' })
    expect(within(editor).getByText('타일을 붙였다.')).toBeInTheDocument()
    expect(editor.querySelector('img')).toHaveAttribute('src', '/uploads/images/2026/11/7.jpg')

    fireEvent.change(titleInput, { target: { value: '주방 타일 시공 후기' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/posts'))
    expect(await screen.findByRole('status')).toHaveTextContent("'주방 타일 시공 후기' 글을 저장했습니다.")
    const [body] = sentBodies(fetchMock, 'PUT', '/api/posts/42') as { title: string; content: unknown }[]
    expect(body.title).toBe('주방 타일 시공 후기')
    expect(body.content).toEqual(EXISTING.content)
  })

  // TC-VAL-009: 서버 검증 오류는 해당 입력란 옆에
  it('서버의 필드 오류를 입력란 옆에 보여준다', async () => {
    mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts/42', body: EXISTING },
      {
        method: 'PUT',
        path: '/api/posts/42',
        status: 422,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력값을 확인해 주세요.',
            details: [{ field: 'title', reason: '제목은 200자 이하여야 합니다.' }],
          },
        },
      },
    ])
    renderAt('/admin/posts/42/edit')
    await screen.findByDisplayValue('주방 타일 시공')
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('제목은 200자 이하여야 합니다.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('입력값을 확인해 주세요.')
  })

  // TC-ADM-018: 편집 중 세션 만료 → 안내, 입력 내용 유지
  it('저장하다 로그인이 만료되면 안내하고 입력 내용을 그대로 둔다', async () => {
    mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts/42', body: EXISTING },
      {
        method: 'PUT',
        path: '/api/posts/42',
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', details: null } },
      },
    ])
    renderAt('/admin/posts/42/edit')
    const titleInput = await screen.findByDisplayValue('주방 타일 시공')
    fireEvent.change(titleInput, { target: { value: '아직 저장 안 한 제목' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent).join(' ')).toContain('로그인이 만료되었습니다')
    expect(screen.getByDisplayValue('아직 저장 안 한 제목')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/posts/42/edit')

    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))
    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument()
  })

  // TC-ADM-008: 저장하지 않고 메뉴로 이동하면 확인
  it('저장하지 않은 변경이 있으면 메뉴 이동 전에 확인하고, 취소하면 머문다', async () => {
    mockApi([ME, CATEGORIES, { path: '/api/posts/42', body: EXISTING }])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/admin/posts/42/edit')
    fireEvent.change(await screen.findByDisplayValue('주방 타일 시공'), { target: { value: '바뀜' } })

    fireEvent.click(screen.getByRole('link', { name: '카테고리' }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/posts/42/edit')
  })

  it('없는 글이면 안내한다', async () => {
    mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts/999', status: 404, body: { error: { code: 'POST_NOT_FOUND', message: '게시글을 찾을 수 없습니다.', details: null } } },
    ])
    renderAt('/admin/posts/999/edit')
    expect(await screen.findByRole('alert')).toHaveTextContent('게시글을 찾을 수 없습니다.')
  })
})
