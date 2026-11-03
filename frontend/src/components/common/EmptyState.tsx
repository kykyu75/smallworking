// COMP-203 EmptyState
export default function EmptyState({ message = '아직 글이 없습니다' }: { message?: string }) {
  return <p className="py-6 text-center text-sm text-gray-400">{message}</p>
}
