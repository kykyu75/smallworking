// COMP-045 RequestAnswer — 운영자 답변 상자 (REQ-049)
import { formatDateTime } from '../../lib/format'

export default function RequestAnswer({ answer, answeredAt }: { answer: string; answeredAt: string | null }) {
  return (
    <section aria-label="운영자 답변" className="mt-8 rounded-lg border border-green-200 bg-green-50 p-5">
      <p className="text-sm font-semibold text-green-800">
        SmallWorking 답변
        {answeredAt && <span className="ml-2 font-normal text-green-700">{formatDateTime(answeredAt)}</span>}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-gray-800">{answer}</p>
    </section>
  )
}
