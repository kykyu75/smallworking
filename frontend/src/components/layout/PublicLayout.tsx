// COMP-001 PublicLayout — 공개 화면 공통 틀. 카테고리 목록을 1회 조회해 Header와 하위 화면에 전달한다.
import { Outlet } from 'react-router'
import { useCategories } from '../../hooks/useCategories'
import type { PublicOutletContext } from './publicOutletContext'
import Footer from './Footer'
import Header from './Header'

export default function PublicLayout() {
  const { categories, loading } = useCategories()
  const context: PublicOutletContext = { categories, categoriesLoading: loading }

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <Header categories={categories} />
      <div className="flex-1">
        <Outlet context={context} />
      </div>
      <Footer />
    </div>
  )
}
