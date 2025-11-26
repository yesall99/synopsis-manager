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
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">작품 내보내기</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            <strong className="text-gray-900 dark:text-gray-100">{work.title}</strong> 작품을 내보낼 형식을 선택하세요.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-gray-900 dark:text-gray-100"
            >
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">Markdown</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">.md 파일로 다운로드</div>
              </div>
            </button>

            <button
              onClick={handleExportHTML}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-gray-900 dark:text-gray-100"
            >
              <FileCode className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">HTML</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">.html 파일로 다운로드</div>
              </div>
            </button>

            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-gray-900 dark:text-gray-100"
            >
              <Printer className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">인쇄</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">브라우저 인쇄 기능 사용</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

