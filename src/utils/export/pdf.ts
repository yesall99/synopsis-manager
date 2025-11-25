// PDF 내보내기는 html2pdf 라이브러리를 사용하거나
// 브라우저의 인쇄 기능을 활용합니다.
// 여기서는 간단하게 인쇄 기능을 사용하는 방법을 제공합니다.

import type { Synopsis } from '@/types'
import { synopsisToHTML } from './html'

export function printSynopsis(synopsis: Synopsis): void {
  const html = synopsisToHTML(synopsis)
  const printWindow = window.open('', '_blank')
  
  if (!printWindow) {
    alert('팝업이 차단되었습니다. 팝업을 허용해주세요.')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()
  
  printWindow.onload = () => {
    printWindow.print()
  }
}

// html2pdf를 사용하는 경우 (선택적)
export async function exportToPDF(synopsis: Synopsis): Promise<void> {
  try {
    // html2pdf 라이브러리가 설치되어 있다면 사용
    // const html2pdf = (await import('html2pdf.js')).default
    // const element = document.createElement('div')
    // element.innerHTML = synopsisToHTML(synopsis)
    // html2pdf().set({ filename: `${synopsis.title}.pdf` }).from(element).save()
    
    // 현재는 인쇄 기능 사용
    printSynopsis(synopsis)
  } catch (error) {
    console.error('PDF 내보내기 실패:', error)
    alert('PDF 내보내기에 실패했습니다. 인쇄 기능을 사용해주세요.')
  }
}

