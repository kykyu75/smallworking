// 공통 API 타입 (API_SPEC v1.0 §2.1, §12 / COMPONENT_SPEC v1.0 §11)

export interface Page<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export interface ApiErrorDetail {
  field: string
  reason: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: ApiErrorDetail[] | Record<string, unknown> | null
  }
}
