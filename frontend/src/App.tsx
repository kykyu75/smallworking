import { Route, Routes } from 'react-router'
import AdminLayout from './components/admin/AdminLayout'
import RequireAdmin from './components/admin/RequireAdmin'
import PublicLayout from './components/layout/PublicLayout'
import { AdminAuthProvider } from './hooks/AdminAuthContext'
import CategoryPostListPage from './pages/CategoryPostListPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import CategoryManagementPage from './pages/admin/CategoryManagementPage'

// 라우트 구조: COMPONENT_SPEC v1.0 §3 (단계별로 추가)
export default function App() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categoryId" element={<CategoryPostListPage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
