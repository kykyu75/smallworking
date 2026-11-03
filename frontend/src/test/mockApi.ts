// 테스트용 fetch 모의: 경로·메서드별로 응답을 정한다.
import { vi } from 'vitest'

export interface MockRoute {
  method?: string
  path: string
  status: number
  body?: unknown
}

export function mockApi(routes: MockRoute[]) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    const route = routes.find((r) => (r.method ?? 'GET').toUpperCase() === method && url.startsWith(r.path))
    if (!route) return new Response(JSON.stringify({ error: { code: 'NOT_MOCKED', message: url, details: null } }), { status: 599 })
    const text = route.body === undefined ? null : JSON.stringify(route.body)
    return new Response(route.status === 204 ? null : text, { status: route.status })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const UNAUTHORIZED = { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', details: null } }
