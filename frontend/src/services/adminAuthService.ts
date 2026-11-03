// 관리자 인증 API (API-023 login, API-024 logout, API-025 me)
import type { AdminMe, LoginInput } from '../types/admin'
import { api } from './apiClient'

export const adminAuthService = {
  login: (input: LoginInput) => api.post<AdminMe>('/api/admin/login', input),
  logout: () => api.post<void>('/api/admin/logout'),
  me: () => api.get<AdminMe>('/api/admin/me'),
}
