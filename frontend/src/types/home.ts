// 홈 화면 데이터 (API-021, COMPONENT_SPEC §11)
import type { PostSummary } from './post'

export interface HomeCategory {
  id: number
  name: string
  description: string | null
  latest_posts: PostSummary[]
}

export interface HomeData {
  categories: HomeCategory[]
  latest_posts: PostSummary[]
  popular_posts: PostSummary[]
}
