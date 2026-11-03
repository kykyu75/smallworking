// 홈 화면 API (API-021). 홈은 이 API 한 번으로 모든 영역을 그린다 (COMPONENT_SPEC §6.2)
import type { HomeData } from '../types/home'
import { api } from './apiClient'

export const homeService = {
  get: () => api.get<HomeData>('/api/home'),
}
