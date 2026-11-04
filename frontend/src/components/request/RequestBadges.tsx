// COMP-041 일부 — 종류·상태 배지 (DEC-011)
import { KIND_LABELS, statusLabel } from '../../lib/requestRules'
import type { RequestKind } from '../../types/request'

export function KindBadge({ kind }: { kind: RequestKind }) {
  return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{KIND_LABELS[kind]}</span>
}

export function StatusBadge({ answered }: { answered: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${answered ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
    >
      {statusLabel(answered)}
    </span>
  )
}
