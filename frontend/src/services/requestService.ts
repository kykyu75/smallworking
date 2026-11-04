// 요청 게시판 API (API-029~034) + 관리자 요청 API (API-035~038), DEC-011
import type { Page } from '../types/api'
import type {
  AdminRequestPage,
  RequestDetail,
  RequestInput,
  RequestStatusFilter,
  RequestSummary,
} from '../types/request'
import { api } from './apiClient'

export const requestService = {
  list: (page: number, size = 12) => api.get<Page<RequestSummary>>('/api/requests', { query: { page, size } }),
  create: (input: RequestInput) => api.post<RequestDetail>('/api/requests', input),
  get: (id: number) => api.get<RequestDetail>(`/api/requests/${id}`),
  open: (id: number, password: string) => api.post<RequestDetail>(`/api/requests/${id}/open`, { password }),
  update: (id: number, input: RequestInput) => api.put<RequestDetail>(`/api/requests/${id}`, input),
  // DELETE 본문은 버려질 수 있어 POST .../delete (API-034)
  remove: (id: number, password: string) => api.post<void>(`/api/requests/${id}/delete`, { password }),
}

export const adminRequestService = {
  list: (status: RequestStatusFilter | undefined, page: number, size = 20) =>
    api.get<AdminRequestPage>('/api/admin/requests', { query: { status, page, size } }),
  saveAnswer: (id: number, answer: string) => api.put<RequestDetail>(`/api/admin/requests/${id}/answer`, { answer }),
  deleteAnswer: (id: number) => api.delete<RequestDetail>(`/api/admin/requests/${id}/answer`),
  remove: (id: number) => api.delete<void>(`/api/admin/requests/${id}`),
}
