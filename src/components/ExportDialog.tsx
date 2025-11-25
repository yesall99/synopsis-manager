import { useState } from 'react'
import { X, Download, FileText, FileCode, Printer } from 'lucide-react'
import type { Synopsis } from '@/types'
import { synopsisToMarkdown, downloadMarkdown } from '@/utils/export/markdown'
import { synopsisToHTML, downloadHTML } from '@/utils/export/html'
import { printSynopsis } from '@/utils/export/pdf'

interface ExportDialogProps {
  synopsis: Synopsis
  workTitle?: string // 작품 제목
  isOpen: boolean
  onClose: () => void
}

export default function ExportDialog({ synopsis, workTitle, isOpen, onClose }: ExportDialogProps) {
  const displayTitle = workTitle || '시놉시스'
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const handleExportMarkdown = () => {
    setIsExporting(true)
    try {
      const markdown = synopsisToMarkdown(synopsis, workTitle)
      downloadMarkdown(markdown, displayTitle)
      onClose()
    } catch (error) {
      console.error('Markdown 내보내기 실패:', error)
      alert('내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportHTML = () => {
    setIsExporting(true)
    try {
      const html = synopsisToHTML(synopsis, workTitle)
      downloadHTML(html, displayTitle)
      onClose()
    } catch (error) {
      console.error('HTML 내보내기 실패:', error)
      alert('내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    try {
      printSynopsis(synopsis)
      onClose()
    } catch (error) {
      console.error('인쇄 실패:', error)
      alert('인쇄에 실패했습니다.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">내보내기</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            <strong>{displayTitle}</strong> 시놉시스를 내보낼 형식을 선택하세요.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FileText className="w-5 h-5 text-gray-600" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">Markdown</div>
                <div className="text-sm text-gray-500">.md 파일로 다운로드</div>
              </div>
            </button>

            <button
              onClick={handleExportHTML}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FileCode className="w-5 h-5 text-gray-600" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">HTML</div>
                <div className="text-sm text-gray-500">.html 파일로 다운로드</div>
              </div>
            </button>

            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Printer className="w-5 h-5 text-gray-600" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">인쇄</div>
                <div className="text-sm text-gray-500">브라우저 인쇄 기능 사용</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

