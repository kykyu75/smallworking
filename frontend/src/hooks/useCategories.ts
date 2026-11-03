// 카테고리 목록 훅 (API-001)
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../services/apiClient'
import { categoryService } from '../services/categoryService'
import type { Category } from '../types/category'

export interface UseCategories {
  categories: Category[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setCategories: (categories: Category[]) => void
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : '카테고리를 불러오지 못했습니다.'
}

export function useCategories(): UseCategories {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true) // 처음 화면은 불러오는 중으로 시작
  const [error, setError] = useState<string | null>(null)

  // 처음 한 번 불러오기. 화면이 사라진 뒤 도착한 응답은 무시한다.
  useEffect(() => {
    let active = true
    categoryService
      .list()
      .then((list) => {
        if (!active) return
        setCategories(list)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(errorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // 저장·삭제 뒤 다시 불러오기 (사용자 동작에서 호출)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await categoryService.list())
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  return { categories, loading, error, reload, setCategories }
}
