import { Link } from 'react-router'

// COMP-204 NotFoundPage (REQ-040)
export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-gray-600">주소가 바뀌었거나 삭제된 콘텐츠일 수 있습니다.</p>
      <Link to="/" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white">
        홈으로
      </Link>
    </main>
  )
}
