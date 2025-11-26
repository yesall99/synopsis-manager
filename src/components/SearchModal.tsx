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
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">검색</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
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
            className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">{category.name}</h3>
                <div className="relative">
                  {hasLeftScroll && (
                    <button
                      onClick={() => handleScroll(category.id, 'left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-sm rounded-full p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
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
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors ${
                            isSelected
                              ? 'bg-gray-900 dark:bg-gray-700 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                  {hasRightScroll && (
                    <button
                      onClick={() => handleScroll(category.id, 'right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-sm rounded-full p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedTags.length > 0 && (
              <span>{selectedTags.length}개의 태그 선택됨</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              검색
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

