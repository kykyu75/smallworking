import { useOutletContext } from 'react-router'
import type { Category } from '../../types/category'

export interface PublicOutletContext {
  categories: Category[]
  categoriesLoading: boolean
}

export function usePublicContext(): PublicOutletContext {
  return useOutletContext<PublicOutletContext>()
}
