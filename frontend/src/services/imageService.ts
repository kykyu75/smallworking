// 이미지 API (API-019 업로드, API-020 임시 이미지 삭제)
import type { PostImage } from '../types/image'
import { api } from './apiClient'

export const imageService = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<PostImage>('/api/images', form)
  },
  removeTemp: (id: number) => api.delete<void>(`/api/images/${id}`),
}
