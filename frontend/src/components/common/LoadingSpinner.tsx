// COMP-202 LoadingSpinner
export default function LoadingSpinner({ label = '불러오는 중입니다' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-16 text-gray-500">
      <span className="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
