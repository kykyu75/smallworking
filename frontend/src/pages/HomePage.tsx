// PAGE-001 HomePage (COMP-010~014, REQ-004~008, DEC-006)
// API-021 한 번으로 카테고리별 최신 3개, 전체 최신 5개, 인기 5개를 그린다.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import EmptyState from '../components/common/EmptyState'
import LoadingSpinner from '../components/common/LoadingSpinner'
import PostCard from '../components/post/PostCard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ApiError } from '../services/apiClient'
import { homeService } from '../services/homeService'
import type { HomeCategory, HomeData } from '../types/home'
import type { PostSummary } from '../types/post'

// COMP-010 IntroSection
function IntroSection() {
  return (
    <section className="border-b border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold md:text-4xl">SmallWorking</h1>
        <p className="mt-3 text-lg text-gray-600">지적인 대화를 위한 넓고 얕은 지식</p>
        <p className="mt-2 text-gray-500">직접 만들고, 경험하고, 공부하고, 생각한 것들을 기록합니다.</p>
      </div>
    </section>
  )
}

// COMP-011 CategorySection
function CategorySection({ category }: { category: HomeCategory }) {
  const headingId = `home-category-${category.id}`
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-bold">
          {category.name}
        </h2>
        <Link to={`/category/${category.id}`} className="shrink-0 text-sm text-gray-500 hover:text-gray-900">
          더보기 →
        </Link>
      </div>
      {category.description && <p className="mt-1 text-sm text-gray-500">{category.description}</p>}
      {category.latest_posts.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-2">
          {category.latest_posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} variant="row" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// COMP-012 LatestPosts / COMP-013 PopularPosts
function PostListSection({ title, posts, ranked = false }: { title: string; posts: PostSummary[]; ranked?: boolean }) {
  const headingId = ranked ? 'home-popular' : 'home-latest'
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-bold">
        {title}
      </h2>
      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {posts.map((post, index) => (
            <li key={post.id}>
              <PostCard post={post} variant="row" showCategory rank={ranked ? index + 1 : undefined} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function HomePage() {
  useDocumentTitle(null)
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    homeService
      .get()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '홈 화면을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <IntroSection />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {error ? (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        ) : !data ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-10">
            {/* Mobile 1열 / Tablet 2열 / Desktop 3열 (COMPONENT_SPEC §12) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.categories.map((category) => (
                <CategorySection key={category.id} category={category} />
              ))}
            </div>
            {/* Desktop에서 최신·인기 나란히 */}
            <div className="grid gap-8 lg:grid-cols-2">
              <PostListSection title="🆕 최신 글" posts={data.latest_posts} />
              <PostListSection title="🔥 인기 글" posts={data.popular_posts} ranked />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
