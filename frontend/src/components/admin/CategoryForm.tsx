// COMP-111 CategoryForm — 카테고리 추가·수정 (REQ-010, 011, 038, DEC-006)
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import type { CategoryInput } from '../../types/category'

const NAME_MAX = 30
const DESCRIPTION_MAX = 200

interface CategoryFormProps {
  initial?: CategoryInput
  submitLabel: string
  onSubmit: (input: CategoryInput) => Promise<void>
  onCancel?: () => void
}

export default function CategoryForm({ initial, submitLabel, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const canSubmit = trimmedName.length > 0 && trimmedName.length <= NAME_MAX && description.length <= DESCRIPTION_MAX && !submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setNameError(null)
    setFormError(null)
    try {
      await onSubmit({ name: trimmedName, description: description.trim() || null })
      if (!initial) {
        setName('')
        setDescription('')
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_NAME_DUPLICATED') setNameError(err.message)
      else setFormError(err instanceof ApiError ? err.message : '저장하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const idPrefix = initial ? `category-edit-${initial.name}` : 'category-new'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-start">
      <div className="flex-1">
        <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium">
          이름 <span className="text-gray-400">({trimmedName.length}/{NAME_MAX})</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          value={name}
          maxLength={NAME_MAX + 10}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={nameError ? true : undefined}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
        {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
      </div>
      <div className="flex-[2]">
        <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium">
          설명 <span className="text-gray-400">(선택, {description.length}/{DESCRIPTION_MAX})</span>
        </label>
        <input
          id={`${idPrefix}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex gap-2 md:pt-6">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm">
            취소
          </button>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-sm text-red-600 md:basis-full">
          {formError}
        </p>
      )}
    </form>
  )
}
