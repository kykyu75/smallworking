import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, sentBodies } from '../../test/mockApi'
import type { Comment } from '../../types/comment'
import CommentSection from './CommentSection'

const T = '2026-11-03T09:00:00Z'

function comment(id: number, nickname: string, content: string, replies: Comment[] = [], extra: Partial<Comment> = {}): Comment {
  return { id, nickname, content, is_deleted: false, created_at: T, updated_at: T, replies, ...extra }
}
function reply(id: number, nickname: string, content: string): Comment {
  const { replies: _ignored, ...rest } = comment(id, nickname, content)
  return rest
}

const LIST: Comment[] = [
  comment(1, '작업자', '멋지네요.', [reply(2, 'smallworking', '감사합니다.')]),
  comment(3, '', '', [reply(4, '남은 답글', '여전히 보여요')], { nickname: null, content: null, is_deleted: true }),
  comment(5, '시인', '첫 줄\n둘째 줄 <script>alert(1)</script>', [], { updated_at: '2026-11-03T10:00:00Z' }),
]

function itemOf(text: string) {
  return screen.getByText(text).closest('li') as HTMLElement
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CommentSection (COMP-034~039)', () => {
  it('댓글과 답글을 계층으로, 삭제된 댓글은 안내만 보여준다', async () => {
    mockApi([{ path: '/api/posts/7/comments', body: { items: LIST } }])
    const { container } = render(<CommentSection postId={7} />)

    expect(await screen.findByRole('heading', { name: '💬 댓글 4' })).toBeInTheDocument() // 삭제된 1개 제외
    const replies = within(itemOf('멋지네요.')).getByRole('list', { name: '답글 목록' })
    expect(within(replies).getByText('감사합니다.')).toBeInTheDocument()

    // TC-COM-014: 삭제된 댓글은 안내만, 버튼 없음, 답글은 그대로
    const deletedItem = screen.getByText('삭제된 댓글입니다').closest('li') as HTMLElement
    // 이 항목의 버튼은 남은 답글의 [수정][삭제]뿐이다 (삭제된 댓글 자체에는 버튼 없음, [답글]도 없음)
    expect(within(deletedItem).getAllByRole('button').map((b) => b.textContent)).toEqual(['수정', '삭제'])
    expect(within(deletedItem).getByText('여전히 보여요')).toBeInTheDocument()

    // TC-COM-021, TC-SEC-001: 줄바꿈 유지, 스크립트는 글자로
    const text = screen.getByText(/첫 줄/)
    expect(text).toHaveClass('whitespace-pre-wrap')
    expect(text.textContent).toContain('<script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
    expect(within(itemOf('시인')).getByText('(수정됨)')).toBeInTheDocument()
  })

  // TC-COM-008: 답글에는 [답글] 버튼이 없다
  it('최상위 댓글에만 답글 버튼이 있다', async () => {
    mockApi([{ path: '/api/posts/7/comments', body: { items: LIST } }])
    render(<CommentSection postId={7} />)
    await screen.findByText('멋지네요.')
    const top = screen.getByText('멋지네요.').parentElement!
    expect(within(top).getByRole('button', { name: '답글' })).toBeInTheDocument()
    const replyBlock = screen.getByText('감사합니다.').parentElement!
    expect(within(replyBlock).queryByRole('button', { name: '답글' })).toBeNull()
    expect(within(replyBlock).getByRole('button', { name: '수정' })).toBeInTheDocument()
  })

  // TC-COM-001, TC-COM-002: 필수값을 모두 채워야 등록, 등록하면 목록 다시 불러오기
  it('닉네임·비밀번호·내용을 채워야 등록할 수 있고, 등록하면 목록을 다시 불러온다', async () => {
    const fetchMock = mockApi([
      { path: '/api/posts/7/comments', body: { items: [] } },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: comment(9, '홍길동', '좋은 글') },
    ])
    render(<CommentSection postId={7} />)
    expect(await screen.findByText('아직 댓글이 없습니다')).toBeInTheDocument()

    const form = screen.getByRole('form', { name: '댓글 쓰기' })
    const submit = within(form).getByRole('button', { name: '댓글 등록' })
    fireEvent.change(within(form).getByLabelText('닉네임'), { target: { value: '홍' } }) // 2자 미만
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: '1234' } })
    fireEvent.change(within(form).getByLabelText('댓글 내용'), { target: { value: '  좋은 글  ' } })
    expect(submit).toBeDisabled()
    fireEvent.change(within(form).getByLabelText('닉네임'), { target: { value: '홍길동' } })
    expect(submit).toBeEnabled()
    expect(within(form).getByLabelText('비밀번호')).toHaveAttribute('type', 'password')

    fireEvent.click(submit)
    await waitFor(() => expect(sentBodies(fetchMock, 'POST', '/api/posts/7/comments')).toHaveLength(1))
    expect(sentBodies(fetchMock, 'POST', '/api/posts/7/comments')[0]).toEqual({ nickname: '홍길동', password: '1234', content: '좋은 글' })
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) => url === '/api/posts/7/comments' && !init?.method?.includes('POST'))).toHaveLength(2))
    expect(within(form).getByLabelText('댓글 내용')).toHaveValue('')
  })

  // TC-COM-006: 답글 작성은 parent_comment_id 포함
  it('답글 버튼으로 연 양식은 parent_comment_id를 보낸다', async () => {
    const fetchMock = mockApi([
      { path: '/api/posts/7/comments', body: { items: LIST } },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: reply(10, '방문자', '저도요') },
    ])
    render(<CommentSection postId={7} />)
    fireEvent.click(within(await screen.findByText('멋지네요.').then((el) => el.parentElement!)).getByRole('button', { name: '답글' }))

    const form = screen.getByRole('form', { name: '답글 쓰기' })
    fireEvent.change(within(form).getByLabelText('닉네임'), { target: { value: '방문자' } })
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'abcd' } })
    fireEvent.change(within(form).getByLabelText('답글 내용'), { target: { value: '저도요' } })
    fireEvent.click(within(form).getByRole('button', { name: '답글 등록' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', '/api/posts/7/comments')).toHaveLength(1))
    expect(sentBodies(fetchMock, 'POST', '/api/posts/7/comments')[0]).toMatchObject({ parent_comment_id: 1, content: '저도요' })
    await waitFor(() => expect(screen.queryByRole('form', { name: '답글 쓰기' })).toBeNull())
  })

  // TC-COM-010, TC-COM-011: 비밀번호로 수정, 틀리면 안내하고 입력 유지
  it('수정은 비밀번호가 맞아야 하고, 틀리면 입력을 유지한 채 안내한다', async () => {
    let attempt = 0
    const fetchMock = mockApi([
      { path: '/api/posts/7/comments', body: { items: LIST } },
      {
        method: 'PUT',
        path: '/api/comments/1',
        respond: () =>
          attempt++ === 0
            ? { status: 403, body: { error: { code: 'INVALID_PASSWORD', message: '비밀번호가 일치하지 않습니다.', details: null } } }
            : { status: 200, body: comment(1, '작업자', '고친 내용') },
      },
    ])
    render(<CommentSection postId={7} />)
    const block = (await screen.findByText('멋지네요.')).parentElement!
    fireEvent.click(within(block).getByRole('button', { name: '수정' }))

    const form = screen.getByRole('form', { name: '댓글 수정' })
    fireEvent.change(within(form).getByLabelText('수정할 내용'), { target: { value: '고친 내용' } })
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'wrong' } })
    fireEvent.click(within(form).getByRole('button', { name: '저장' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('비밀번호가 일치하지 않습니다.')
    expect(within(form).getByLabelText('수정할 내용')).toHaveValue('고친 내용')

    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: '1234' } })
    fireEvent.click(within(form).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: '댓글 수정' })).toBeNull())
    expect(sentBodies(fetchMock, 'PUT', '/api/comments/1').at(-1)).toEqual({ password: '1234', content: '고친 내용' })
  })

  // TC-COM-012, TC-COM-013: 삭제는 비밀번호 확인 창, 틀리면 창 유지
  it('삭제는 비밀번호 창을 거치고, 틀리면 창에서 안내한다', async () => {
    let attempt = 0
    const fetchMock = mockApi([
      { path: '/api/posts/7/comments', body: { items: LIST } },
      {
        method: 'POST',
        path: '/api/comments/5/delete',
        respond: () =>
          attempt++ === 0
            ? { status: 403, body: { error: { code: 'INVALID_PASSWORD', message: '비밀번호가 일치하지 않습니다.', details: null } } }
            : { status: 204 },
      },
    ])
    render(<CommentSection postId={7} />)
    const block = (await screen.findByText(/첫 줄/)).parentElement!
    fireEvent.click(within(block).getByRole('button', { name: '삭제' }))

    const dialog = screen.getByRole('dialog', { name: '댓글 삭제' })
    fireEvent.change(within(dialog).getByLabelText('비밀번호'), { target: { value: 'nope' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('비밀번호가 일치하지 않습니다.')

    fireEvent.change(within(dialog).getByLabelText('비밀번호'), { target: { value: '1234' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sentBodies(fetchMock, 'POST', '/api/comments/5/delete')).toEqual([{ password: 'nope' }, { password: '1234' }])
  })

  it('답글이 있는 댓글을 지울 때는 답글이 남는다고 안내한다', async () => {
    mockApi([{ path: '/api/posts/7/comments', body: { items: LIST } }])
    render(<CommentSection postId={7} />)
    const block = (await screen.findByText('멋지네요.')).parentElement!
    fireEvent.click(within(block).getAllByRole('button', { name: '삭제' })[0])
    expect(screen.getByRole('dialog')).toHaveTextContent("'삭제된 댓글입니다'로 표시되고 답글은 남습니다")
  })
})
