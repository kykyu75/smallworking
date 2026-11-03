// PAGE-002 CategoryPostListPage — M3: CategoryHeader(COMP-021)까지. 게시글 목록·페이징은 M6에서 구현한다.
import { useParams } from 'react-router'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { usePublicContext } from '../components/layout/publicOutletContext'
import NotFoundPage from './NotFoundPage'

export default function CategoryPostListPage() {
  const { categoryId } = useParams()
  const { categories, categoriesLoading } = usePublicContext()

  if (categoriesLoading) return <LoadingSpinner />
  const category = categories.find((c) => String(c.id) === categoryId)
  if (!category) return <NotFoundPage />

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">{category.name}</h1>
        {category.description && <p className="mt-2 text-gray-600">{category.description}</p>}
      </header>
      <p className="mt-8 text-sm text-gray-400">게시글 목록은 준비 중입니다.</p>
    </main>
  )
}
