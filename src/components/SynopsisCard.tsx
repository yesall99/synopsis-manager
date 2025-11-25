import { Link } from 'react-router-dom'
import { Calendar, Tag } from 'lucide-react'
import type { Synopsis } from '@/types'

interface SynopsisCardProps {
  synopsis: Synopsis
}

export default function SynopsisCard({ synopsis }: SynopsisCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // HTML에서 텍스트만 추출 (간단한 버전)
  const getPlainText = (html: string) => {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  const preview = getPlainText(synopsis.content).substring(0, 150)
  const hasMore = getPlainText(synopsis.content).length > 150

  return (
    <Link
      to={`/synopsis/${synopsis.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-6"
    >
      <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
        {synopsis.title}
      </h3>
      
      {synopsis.category && (
        <span className="inline-block px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded mb-3">
          {synopsis.category}
        </span>
      )}

      {synopsis.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {synopsis.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
          {synopsis.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{synopsis.tags.length - 3}</span>
          )}
        </div>
      )}

      {preview && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {preview}
          {hasMore && '...'}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(synopsis.updatedAt)}
        </span>
      </div>
    </Link>
  )
}

