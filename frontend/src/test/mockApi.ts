// 테스트용 fetch 모의: 경로·메서드별로 응답을 정한다.
import { vi } from 'vitest'

export interface MockResponse {
  status: number
  body?: unknown
}

export interface MockRoute {
  method?: string
  path: string
  status?: number
  body?: unknown
  /** 요청마다 응답을 바꿔야 할 때 사용 (예: 저장 후 목록 갱신) */
  respond?: (init: RequestInit | undefined, callIndex: number) => MockResponse
}

export function mockApi(routes: MockRoute[]) {
  const callCounts = new Map<MockRoute, number>()
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    // 가장 구체적인(긴) 경로를 먼저 찾는다
    const route = [...routes]
      .sort((a, b) => b.path.length - a.path.length)
      .find((r) => (r.method ?? 'GET').toUpperCase() === method && (url === r.path || url.startsWith(`${r.path}?`) || url.startsWith(`${r.path}/`) || url === r.path))
    if (!route) {
      return new Response(JSON.stringify({ error: { code: 'NOT_MOCKED', message: `${method} ${url}`, details: null } }), {
        status: 599,
      })
    }
    const index = callCounts.get(route) ?? 0
    callCounts.set(route, index + 1)
    const { status, body } = route.respond ? route.respond(init, index) : { status: route.status ?? 200, body: route.body }
    const text = body === undefined ? null : JSON.stringify(body)
    return new Response(status === 204 ? null : text, { status })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** fetch 모의에서 특정 메서드·경로로 보낸 요청 본문(JSON)을 꺼낸다. */
export function sentBodies(fetchMock: ReturnType<typeof mockApi>, method: string, path: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url) === path && (init?.method ?? 'GET').toUpperCase() === method)
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined))
}

export const UNAUTHORIZED = { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', details: null } }

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'DIY', description: '직접 만들어 본 것들', display_order: 1, post_count: 0 },
  { id: 2, name: 'Portfolio', description: '프로젝트와 작업물', display_order: 2, post_count: 3 },
  { id: 3, name: 'Blog', description: null, display_order: 3, post_count: 0 },
  { id: 4, name: 'Board', description: '자유로운 이야기', display_order: 4, post_count: 0 },
]
