// COMP-002 Header (REQ-008, REQ-013, REQ-036)
import { Link } from 'react-router'
import type { Category } from '../../types/category'
import CategoryMenu from './CategoryMenu'
import MobileMenu from './MobileMenu'

export default function Header({ categories }: { categories: Category[] }) {
  return (
    <header className="relative border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-bold">
          SmallWorking
        </Link>
        <CategoryMenu categories={categories} />
        <MobileMenu categories={categories} />
      </div>
    </header>
  )
}
