// 공통 API 클라이언트 (COMPONENT_SPEC v1.0 §13, CLAUDE.md §7.3)
// - 모든 요청에 쿠키 포함 (credentials: 'include', API_SPEC §2.2)
// - 오류 응답을 ApiError로 변환 (API_SPEC §12)
// - 관리자 화면의 401 처리는 onUnauthorized 핸들러로 연결한다 (COMP-100, M2)

import type { ApiErrorBody, ApiErrorDetail } from '../types/api'

const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
const UNKNOWN_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorBody['error']['details']

  constructor(status: number, code: string, message: string, details: ApiErrorBody['error']['details'] = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** 입력값 검증 오류의 필드별 메시지 (TC-VAL-009) */
  get fieldErrors(): ApiErrorDetail[] {
    return Array.isArray(this.details) ? this.details : []
  }
}

type UnauthorizedHandler = (error: ApiError) => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** 401 응답을 받았을 때 호출할 함수를 등록한다 (관리자 로그인 화면 이동 등). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  query?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  let payload: BodyInit | undefined

  if (body instanceof FormData) {
    payload = body // multipart: Content-Type은 브라우저가 boundary와 함께 지정
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  }

  if (response.status === 204) return undefined as T

  const data = await parseJson(response)

  if (!response.ok) {
    const error = isApiErrorBody(data)
      ? new ApiError(response.status, data.error.code, data.error.message, data.error.details ?? null)
      : new ApiError(response.status, 'UNKNOWN_ERROR', UNKNOWN_ERROR_MESSAGE)
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler(error)
    throw error
  }

  return data as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('DELETE', path, options),
}
