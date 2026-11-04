// PAGE-006 RequestWritePage (COMP-042 RequestForm, REQ-045, DEC-011)
// 작성 응답(내용 포함)을 상세 화면에 넘겨, 비밀글이어도 비밀번호를 다시 묻지 않는다
import { Link, useNavigate } from 'react-router'
import RequestForm from '../components/request/RequestForm'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { requestService } from '../services/requestService'
import type { RequestInput } from '../types/request'

export default function RequestWritePage() {
  useDocumentTitle('요청 남기기')
  const navigate = useNavigate()

  async function handleSubmit(input: RequestInput) {
    const created = await requestService.create(input)
    navigate(`/requests/${created.id}`, { replace: true, state: { detail: created } })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/requests" className="text-sm text-gray-500 hover:text-gray-900">
        ← 요청 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">요청 남기기</h1>
      <p className="mt-2 text-sm text-gray-600">
        답변은 이 게시판에 달립니다. 연락처 같은 개인정보는 적지 않는 것을 권합니다.
      </p>
      <div className="mt-6">
        <RequestForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate('/requests')} />
      </div>
    </main>
  )
}
