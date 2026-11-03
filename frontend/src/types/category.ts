// 카테고리 타입 (API-001~005, COMPONENT_SPEC §11)

export interface Category {
  id: number
  name: string
  description: string | null
  display_order: number
  post_count: number
}

export interface CategoryInput {
  name: string
  description: string | null
}
