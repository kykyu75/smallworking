// COMP-023 Pagination — 페이지 번호 방식 (DEC-006)
interface PaginationProps {
  page: number
  size: number
  total: number
  onChange: (page: number) => void
}

const WINDOW = 5

export default function Pagination({ page, size, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / size))
  if (totalPages <= 1) return null

  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1))
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i)

  const base = 'min-w-9 rounded px-3 py-1.5 text-sm'
  return (
    <nav aria-label="페이지" className="mt-6 flex flex-wrap items-center justify-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${base} disabled:opacity-30`}>
        이전
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={`${base} ${p === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${base} disabled:opacity-30`}
      >
        다음
      </button>
    </nav>
  )
}
