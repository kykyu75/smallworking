// 카테고리 API (API-001~005)
import type { Category, CategoryInput } from '../types/category'
import { api } from './apiClient'

interface CategoryList {
  items: Category[]
}

export const categoryService = {
  list: async () => (await api.get<CategoryList>('/api/categories')).items,
  create: (input: CategoryInput) => api.post<Category>('/api/categories', input),
  update: (id: number, input: CategoryInput) => api.put<Category>(`/api/categories/${id}`, input),
  remove: (id: number) => api.delete<void>(`/api/categories/${id}`),
  reorder: async (categoryIds: number[]) =>
    (await api.put<CategoryList>('/api/categories/order', { category_ids: categoryIds })).items,
}
