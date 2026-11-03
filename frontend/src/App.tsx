import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import LoadingSpinner from './components/common/LoadingSpinner'
import AdminLayout from './components/admin/AdminLayout'
import RequireAdmin from './components/admin/RequireAdmin'
import PublicLayout from './components/layout/PublicLayout'
import { AdminAuthProvider } from './hooks/AdminAuthContext'
import CategoryPostListPage from './pages/CategoryPostListPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import PostDetailPage from './pages/PostDetailPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import CategoryManagementPage from './pages/admin/CategoryManagementPage'
import CommentManagementPage from './pages/admin/CommentManagementPage'
import PostManagementPage from './pages/admin/PostManagementPage'

// 에디터(TipTap)는 크기가 커서 관리자가 글쓰기 화면을 열 때만 불러온다.
// 공개 화면은 편집기를 불러오지 않는다 (COMPONENT_SPEC §8.3).
const PostEditorPage = lazy(() => import('./pages/admin/PostEditorPage'))

function EditorRoute() {
  return (
    <Suspense fallback={<LoadingSpinner label="편집기를 불러오는 중입니다" />}>
      <PostEditorPage />
    </Suspense>
  )
}

// 라우트 구조: COMPONENT_SPEC v1.0 §3 (단계별로 추가)
export default function App() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categoryId" element={<CategoryPostListPage />} />
          <Route path="/posts/:postId" element={<PostDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="categories" element={<CategoryManagementPage />} />
          <Route path="posts" element={<PostManagementPage />} />
          <Route path="posts/new" element={<EditorRoute />} />
          <Route path="posts/:postId/edit" element={<EditorRoute />} />
          <Route path="comments" element={<CommentManagementPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
