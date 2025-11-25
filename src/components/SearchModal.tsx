import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTagStore } from '@/stores/tagStore'
import type { Tag } from '@/types'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTags: string[] // 선택된 태그 ID 배열
  onTagsChange: (tagIds: string[]) => void
  onSearch: (query: string, tagIds: string[]) => void
}

export default function SearchModal({
  isOpen,
  onClose,
  selectedTags,
  onTagsChange,
  onSearch,
}: SearchModalProps) {
  const { categories, tags, loadCategories, loadTags } = useTagStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryScrollPositions, setCategoryScrollPositions] = useState<Record<string, number>>({})

  useEffect(() => {
    if (isOpen) {
      loadCategories()
      loadTags()
    }
  }, [isOpen, loadCategories, loadTags])

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((id) => id !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  const handleScroll = (categoryId: string, direction: 'left' | 'right') => {
    const container = document.getElementById(`category-${categoryId}`)
    if (!container) return

    const scrollAmount = 200
    const newPosition =
      direction === 'right'
        ? categoryScrollPositions[categoryId] + scrollAmount
        : categoryScrollPositions[categoryId] - scrollAmount

    container.scrollTo({ left: newPosition, behavior: 'smooth' })
    setCategoryScrollPositions((prev) => ({ ...prev, [categoryId]: newPosition }))
  }

  const handleSearch = () => {
    onSearch(searchQuery, selectedTags)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">검색</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
            placeholder="검색어를 입력하세요..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Tag Categories */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {categories.map((category) => {
            const categoryTags = tags.filter((t) => t.categoryId === category.id)
            const hasLeftScroll = categoryScrollPositions[category.id] > 0
            const hasRightScroll = categoryTags.length > 0

            return (
              <div key={category.id} className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{category.name}</h3>
                <div className="relative">
                  {hasLeftScroll && (
                    <button
                      onClick={() => handleScroll(category.id, 'left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                  <div
                    id={`category-${category.id}`}
                    className="flex gap-2 overflow-x-auto scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {categoryTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleTagToggle(tag.id)}
                          className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                            isSelected
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tag.name}
                          {tag.isNew && (
                            <span className="text-xs bg-white text-purple-500 px-1 rounded">(N)</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {hasRightScroll && (
                    <button
                      onClick={() => handleScroll(category.id, 'right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 hover:bg-gray-50"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedTags.length > 0 && (
              <span>{selectedTags.length}개의 태그 선택됨</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              검색
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

