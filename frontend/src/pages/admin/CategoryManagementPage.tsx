// PAGE-103 CategoryManagementPage (COMP-110 + COMP-112 CategorySortableList, REQ-010~013, 034, DEC-005)
import { useState } from 'react'
import CategoryForm from '../../components/admin/CategoryForm'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useCategories } from '../../hooks/useCategories'
import { ApiError } from '../../services/apiClient'
import { categoryService } from '../../services/categoryService'
import type { Category, CategoryInput } from '../../types/category'

type Notice = { kind: 'success' | 'error'; text: string } | null

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function CategoryManagementPage() {
  const { categories, loading, error, reload, setCategories } = useCategories()
  const [order, setOrder] = useState<Category[] | null>(null) // 저장 전 순서 (null = 변경 없음)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const list = order ?? categories
  const orderChanged = order !== null && order.some((c, i) => c.id !== categories[i]?.id)

  async function handleCreate(input: CategoryInput) {
    await categoryService.create(input)
    setNotice({ kind: 'success', text: `'${input.name}' 카테고리를 추가했습니다.` })
    setOrder(null)
    await reload()
  }

  async function handleUpdate(id: number, input: CategoryInput) {
    await categoryService.update(id, input)
    setEditingId(null)
    setNotice({ kind: 'success', text: '카테고리를 수정했습니다.' })
    await reload()
  }

  async function handleSaveOrder() {
    if (!order) return
    setBusy(true)
    try {
      const saved = await categoryService.reorder(order.map((c) => c.id))
      setCategories(saved)
      setOrder(null)
      setNotice({ kind: 'success', text: '순서를 저장했습니다.' })
    } catch (err) {
      // CATEGORY_ORDER_MISMATCH 등: 최신 목록으로 다시 불러온다
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : '순서를 저장하지 못했습니다.' })
      setOrder(null)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await categoryService.remove(deleting.id)
      setNotice({ kind: 'success', text: `'${deleting.name}' 카테고리를 삭제했습니다.` })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : '삭제하지 못했습니다.' })
    } finally {
      setDeleting(null)
      setBusy(false)
      setOrder(null)
      await reload()
    }
  }

  return (
    <section>
      <h1 className="text-xl font-bold">카테고리 관리</h1>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">새 카테고리</h2>
        <CategoryForm submitLabel="추가" onSubmit={handleCreate} />
        <p className="mt-2 text-xs text-gray-500">새 카테고리는 목록 맨 뒤에 추가됩니다.</p>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded px-3 py-2 text-sm ${notice.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
        >
          {notice.text}
        </p>
      )}

      {loading && categories.length === 0 ? (
        <LoadingSpinner />
      ) : error ? (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      ) : (
        <>
          <ol aria-label="카테고리 목록" className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {list.map((category, index) => (
              <li key={category.id} className="p-4">
                {editingId === category.id ? (
                  <CategoryForm
                    initial={{ name: category.name, description: category.description }}
                    submitLabel="저장"
                    onSubmit={(input) => handleUpdate(category.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`${category.name} 위로`}
                        disabled={index === 0 || busy}
                        onClick={() => setOrder(move(list, index, index - 1))}
                        className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`${category.name} 아래로`}
                        disabled={index === list.length - 1 || busy}
                        onClick={() => setOrder(move(list, index, index + 1))}
                        className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{category.name}</p>
                      {category.description && <p className="text-sm text-gray-500">{category.description}</p>}
                      <p className="text-xs text-gray-400">게시글 {category.post_count}개</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(category.id)}
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        aria-label={`${category.name} 삭제`}
                        disabled={category.post_count > 0 || busy}
                        onClick={() => setDeleting(category)}
                        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                    {category.post_count > 0 && (
                      <p className="w-full text-xs text-gray-500">게시글 {category.post_count}개가 있어 삭제할 수 없습니다.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-3 flex justify-end gap-2">
            {orderChanged && (
              <button type="button" onClick={() => setOrder(null)} className="rounded border border-gray-300 px-4 py-2 text-sm">
                순서 되돌리기
              </button>
            )}
            <button
              type="button"
              disabled={!orderChanged || busy}
              onClick={handleSaveOrder}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              순서 저장
            </button>
          </div>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="카테고리 삭제"
          message={`'${deleting.name}' 카테고리를 삭제합니다. 되돌릴 수 없습니다.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
