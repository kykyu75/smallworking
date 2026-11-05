// COMP-005 Footer
const CURRENT_YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
      <p className="font-medium text-gray-700">SmallWorking</p>
      <p className="mt-1">지적인 대화를 위한 넓고 얕은 지식</p>
      <p className="mt-1">
        이메일 :{' '}
        <a href="mailto:kykyu@naver.com" className="underline hover:text-gray-900">
          kykyu@naver.com
        </a>
      </p>
      <p className="mt-2">© {CURRENT_YEAR} SmallWorking</p>
    </footer>
  )
}
