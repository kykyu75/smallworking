// PAGE-105/106 PostEditorPage (COMP-130 + COMP-131 PostMetaForm + COMP-134 EditorActions)
// REQ-014~016, 018~020, DEC-001, DEC-002, COMPONENT_SPEC §9.5
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import RichTextEditor from '../../components/editor/RichTextEditor'
import { useCategories } from '../../hooks/useCategories'
import { setLeaveGuard, confirmLeave } from '../../lib/leaveGuard'
import { EMPTY_DOC, collectImageIds, hasBody, normalizeDoc } from '../../lib/tiptapDoc'
import { ApiError } from '../../services/apiClient'
import { imageService } from '../../services/imageService'
import { postService } from '../../services/postService'
import type { PostImage } from '../../types/image'
import type { PostDetail, TiptapDoc } from '../../types/post'

const TITLE_MAX = 200
const LEAVE_MESSAGE = '저장하지 않은 내용이 있습니다. 이 화면을 나가면 사라집니다. 나갈까요?'

type FieldErrors = Partial<Record<'title' | 'category_id' | 'content', string>>

const ERROR_TEXT: Record<string, string> = {
  INVALID_CONTENT: '본문 형식이 올바르지 않습니다.',
  IMAGE_LIMIT_EXCEEDED: '이미지는 게시글당 20장까지 넣을 수 있습니다.',
  INVALID_IMAGE_REFERENCE: '이미지 정보가 올바르지 않습니다. 해당 이미지를 다시 넣어 주세요.',
}

interface Loaded {
  post: PostDetail | null
}

export default function PostEditorPage() {
  const { postId } = useParams()
  const editId = postId ? Number(postId) : null
  const navigate = useNavigate()
  const { categories, loading: categoriesLoading } = useCategories()

  const [loaded, setLoaded] = useState<Loaded | null>(editId === null ? { post: null } : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [doc, setDoc] = useState<TiptapDoc>(EMPTY_DOC)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  // 이번 편집 중 새로 올린 임시 이미지 — 저장·취소 후 본문에 없는 것은 바로 지운다 (남으면 정리 작업이 지움)
  const uploadedIds = useRef<Set<number>>(new Set())

  // 수정 모드: 기존 글 불러오기 (API-007)
  useEffect(() => {
    if (editId === null) return
    let active = true
    postService
      .get(editId)
      .then((post) => {
        if (!active) return
        setTitle(post.title)
        setCategoryId(post.category_id)
        setDoc(post.content)
        setLoaded({ post })
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof ApiError ? err.message : '게시글을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [editId])

  // 저장하지 않은 변경이 있으면 이동 전 확인 (TC-ADM-008)
  useEffect(() => {
    if (!dirty) return
    setLeaveGuard(LEAVE_MESSAGE)
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      setLeaveGuard(null)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])

  const trimmedTitle = title.trim()
  const canSave =
    trimmedTitle.length > 0 && trimmedTitle.length <= TITLE_MAX && categoryId !== '' && hasBody(doc) && !saving && !uploading

  function discardUnusedUploads(keepIds: number[]) {
    const keep = new Set(keepIds)
    for (const id of uploadedIds.current) {
      if (!keep.has(id)) void imageService.removeTemp(id).catch(() => undefined)
    }
    uploadedIds.current.clear()
  }

  async function handleSave() {
    if (!canSave) return // canSave가 참이면 categoryId는 선택된 숫자다
    setSaving(true)
    setFieldErrors({})
    setFormError(null)
    const content = normalizeDoc(doc)
    try {
      const input = { category_id: categoryId, title: trimmedTitle, content }
      const saved = editId === null ? await postService.create(input) : await postService.update(editId, input)
      discardUnusedUploads(collectImageIds(content))
      setDirty(false)
      setLeaveGuard(null)
      navigate('/admin/posts', { state: { notice: `'${saved.title}' 글을 저장했습니다.` } })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // RequireAdmin이 만료 안내를 띄운다. 입력 내용은 그대로 둔다 (TC-ADM-018)
          setFormError('로그인이 만료되어 저장하지 못했습니다. 내용을 복사해 두고 다시 로그인해 주세요.')
        } else {
          const errors: FieldErrors = {}
          for (const detail of err.fieldErrors) {
            if (detail.field === 'title' || detail.field === 'category_id' || detail.field === 'content') {
              errors[detail.field] = detail.reason
            }
          }
          setFieldErrors(errors)
          setFormError(ERROR_TEXT[err.code] ?? err.message)
        }
      } else {
        setFormError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!confirmLeave()) return
    setLeaveGuard(null)
    discardUnusedUploads(loaded?.post ? collectImageIds(loaded.post.content) : [])
    navigate('/admin/posts')
  }

  if (loadError) {
    return (
      <p role="alert" className="text-red-600">
        {loadError}
      </p>
    )
  }
  if (!loaded || categoriesLoading) return <LoadingSpinner />

  const initialImages: PostImage[] = loaded.post?.images ?? []

  return (
    <section>
      <h1 className="text-xl font-bold">{editId === null ? '새 글 쓰기' : '글 수정'}</h1>

      {/* COMP-131 PostMetaForm */}
      <div className="mt-4 grid gap-4 md:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor="post-category" className="block text-sm font-medium">
            카테고리
          </label>
          <select
            id="post-category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
              setDirty(true)
            }}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">선택하세요</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.category_id && <p className="mt-1 text-sm text-red-600">{fieldErrors.category_id}</p>}
        </div>
        <div>
          <label htmlFor="post-title" className="block text-sm font-medium">
            제목{' '}
            <span className={trimmedTitle.length > TITLE_MAX ? 'text-red-600' : 'text-gray-400'}>
              ({trimmedTitle.length}/{TITLE_MAX})
            </span>
          </label>
          <input
            id="post-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setDirty(true)
            }}
            aria-invalid={fieldErrors.title ? true : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
          {fieldErrors.title && <p className="mt-1 text-sm text-red-600">{fieldErrors.title}</p>}
        </div>
      </div>

      <div className="mt-4">
        <RichTextEditor
          initialContent={loaded.post?.content ?? EMPTY_DOC}
          initialImages={initialImages}
          onChange={(next) => {
            setDoc(next)
            setDirty(true)
          }}
          onImageUploaded={(image) => uploadedIds.current.add(image.id)}
          onUploadingChange={setUploading}
        />
        {fieldErrors.content && <p className="mt-1 text-sm text-red-600">{fieldErrors.content}</p>}
      </div>

      {formError && (
        <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {/* COMP-134 EditorActions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        {uploading && <span className="text-sm text-gray-500">이미지를 올리는 중에는 저장할 수 없습니다.</span>}
        <button type="button" onClick={handleCancel} className="rounded border border-gray-300 px-4 py-2 text-sm">
          취소
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>
  )
}
