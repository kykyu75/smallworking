import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, setUnauthorizedHandler } from './apiClient'

function mockFetch(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body)
  const fn = vi.fn().mockResolvedValue(new Response(status === 204 ? null : text, { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

describe('apiClient', () => {
  it('쿠키를 포함해 요청하고 JSON을 돌려준다', async () => {
    const fetchMock = mockFetch(200, { status: 'ok' })
    await expect(api.get('/api/health')).resolves.toEqual({ status: 'ok' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/health')
    expect(init.credentials).toBe('include')
    expect(init.method).toBe('GET')
  })

  it('query에서 빈 값은 빼고 주소에 붙인다', async () => {
    const fetchMock = mockFetch(200, { items: [] })
    await api.get('/api/posts', { query: { category_id: 1, page: 2, size: undefined, q: '' } })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts?category_id=1&page=2')
  })

  it('body는 JSON으로 보낸다', async () => {
    const fetchMock = mockFetch(201, { id: 1 })
    await api.post('/api/categories', { name: '여행' })
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ name: '여행' }))
  })

  it('204는 undefined를 돌려준다', async () => {
    mockFetch(204)
    await expect(api.delete('/api/posts/1')).resolves.toBeUndefined()
  })

  // TC-VAL-006 / TC-VAL-009: 공통 오류 형식 → ApiError, 필드별 오류
  it('오류 응답을 ApiError로 바꾸고 필드 오류를 제공한다', async () => {
    mockFetch(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값을 확인해 주세요.',
        details: [{ field: 'title', reason: '1~200자' }],
      },
    })
    const error = await api.post('/api/posts', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.' })
    expect((error as ApiError).fieldErrors).toEqual([{ field: 'title', reason: '1~200자' }])
  })

  it('형식이 다른 오류 응답도 안전한 메시지로 바꾼다', async () => {
    mockFetch(502, { unexpected: true })
    await expect(api.get('/api/home')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' })
  })

  it('네트워크 오류는 NETWORK_ERROR로 바꾼다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.get('/api/home')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('401이면 등록된 핸들러를 호출한다', async () => {
    mockFetch(401, { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', details: null } })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    await expect(api.get('/api/admin/me')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0][0]).toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
