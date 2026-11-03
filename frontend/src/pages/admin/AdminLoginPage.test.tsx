import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { UNAUTHORIZED, mockApi } from '../../test/mockApi'
import { safeRedirect } from '../../lib/redirect'

afterEach(() => {
  vi.unstubAllGlobals()
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillAndSubmit(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('아이디'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('관리자 인증 화면', () => {
  // TC-ADM-003: 로그인하지 않으면 로그인 화면으로, redirect에 원래 주소
  it('로그인하지 않은 상태로 관리자 화면에 들어가면 로그인 화면으로 보낸다', async () => {
    mockApi([{ path: '/api/admin/me', status: 401, body: UNAUTHORIZED }])
    renderApp('/admin')
    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/login?redirect=%2Fadmin')
  })

  it('로그인 상태면 관리자 화면을 보여준다', async () => {
    mockApi([{ path: '/api/admin/me', status: 200, body: { username: 'admin' } }])
    renderApp('/admin')
    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  // TC-ADM-001: 로그인 성공 → redirect 주소로 이동
  it('로그인에 성공하면 원래 가려던 관리자 화면으로 이동한다', async () => {
    mockApi([{ method: 'POST', path: '/api/admin/login', status: 200, body: { username: 'admin' } }])
    renderApp('/admin/login?redirect=%2Fadmin')
    fillAndSubmit('admin', 'pw')
    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument()
  })

  // TC-ADM-002
  it('아이디·비밀번호가 틀리면 서버 메시지를 보여주고 비밀번호를 지운다', async () => {
    mockApi([
      {
        method: 'POST',
        path: '/api/admin/login',
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.', details: null } },
      },
    ])
    renderApp('/admin/login')
    fillAndSubmit('admin', 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('아이디 또는 비밀번호가 올바르지 않습니다.')
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
  })

  // TC-ADM-012: 잠금 안내 + 해제 시각
  it('계정이 잠기면 잠금 안내와 다시 시도할 시각을 보여준다', async () => {
    mockApi([
      {
        method: 'POST',
        path: '/api/admin/login',
        status: 423,
        body: {
          error: {
            code: 'ACCOUNT_LOCKED',
            message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
            details: { locked_until: '2026-11-03T09:10:00+00:00' },
          },
        },
      },
    ])
    renderApp('/admin/login')
    fillAndSubmit('admin', 'pw')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('로그인 시도가 너무 많습니다.')
    expect(alert).toHaveTextContent('이후 다시 시도할 수 있습니다')
  })

  it('아이디나 비밀번호가 비어 있으면 로그인 버튼이 비활성화된다', () => {
    mockApi([])
    renderApp('/admin/login')
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled()
  })
})

describe('safeRedirect', () => {
  it('관리자 경로만 허용하고 나머지는 /admin으로 바꾼다', () => {
    expect(safeRedirect('/admin/posts?page=2')).toBe('/admin/posts?page=2')
    expect(safeRedirect('https://evil.example')).toBe('/admin')
    expect(safeRedirect('//evil.example')).toBe('/admin')
    expect(safeRedirect('/admin/login')).toBe('/admin')
    expect(safeRedirect(null)).toBe('/admin')
  })
})
