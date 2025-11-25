import { useState } from 'react'
import { X, FileText, FileCode, Printer } from 'lucide-react'
import type { Work, Synopsis, Character, Setting, Tag } from '@/types'
import { workToMarkdown, downloadWorkMarkdown } from '@/utils/export/workMarkdown'
import { workToHTML, downloadWorkHTML } from '@/utils/export/workHTML'

interface WorkExportDialogProps {
  work: Work
  synopsis: Synopsis | null
  characters: Character[]
  settings: Setting[]
  tags: Tag[]
  isOpen: boolean
  onClose: () => void
}

export default function WorkExportDialog({
  work,
  synopsis,
  characters,
  settings,
  tags,
  isOpen,
  onClose,
}: WorkExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const handleExportMarkdown = () => {
    setIsExporting(true)
    try {
      const markdown = workToMarkdown(work, synopsis, characters, settings, tags)
      downloadWorkMarkdown(markdown, work.title)
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
      const html = workToHTML(work, synopsis, characters, settings, tags)
      downloadWorkHTML(html, work.title)
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
      const html = workToHTML(work, synopsis, characters, settings, tags)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
      }
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
          <h2 className="text-xl font-bold text-gray-900">작품 내보내기</h2>
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
            <strong>{work.title}</strong> 작품을 내보낼 형식을 선택하세요.
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

