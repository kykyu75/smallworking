import { useEffect } from 'react'

const SITE = 'SmallWorking'

/** 브라우저 탭 제목: "<제목> - SmallWorking" */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} - ${SITE}` : SITE
  }, [title])
}
