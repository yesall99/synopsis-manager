import { Link, useNavigate } from 'react-router-dom'
import { GripVertical } from 'lucide-react'
import type { Character } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface CharacterCardProps {
  character: Character
  workId?: string
  isDraggable?: boolean
  activeId?: string | null
}

export default function CharacterCard({
  character,
  workId,
  isDraggable = false,
  activeId = null,
}: CharacterCardProps) {
  const navigate = useNavigate()
  const characterWorkId = workId || character.workId

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = isDraggable
    ? useSortable({ id: character.id })
    : { attributes: {}, listeners: {}, setNodeRef: null, transform: null, transition: null, isDragging: false, over: null }

  const shouldApplyTransform = isDragging || (activeId && activeId === character.id)

  const style = isDraggable
    ? {
        transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
        transition: shouldApplyTransform ? undefined : (transition || undefined), // 드래그 중에는 transition 제거
        opacity: isDragging ? 0.5 : 1,
      }
    : {}

  // 드롭 인디케이터 표시
  const showDropIndicator = over && over.id === character.id && !isDragging

  const handleCardClick = (e: React.MouseEvent) => {
    // 드래그 핸들을 클릭한 경우 네비게이션 방지
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      return
    }
    if (!isDragging) {
      navigate(`/works/${characterWorkId}/characters/${character.id}`)
    }
  }

  const cardContent = (
    <div className="flex items-start gap-4">
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          data-drag-handle
          className="cursor-grab active:cursor-grabbing flex items-center justify-center p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{character.name}</h3>
        
        {character.role && (
          <span className="inline-block px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded mb-2">
            {character.role}
          </span>
        )}

        {character.age && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">나이: {character.age}세</p>
        )}

        {character.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm">{character.description}</p>
        )}
      </div>
    </div>
  )

  if (isDraggable) {
    return (
      <>
        {showDropIndicator && <div className="h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full my-2" />}
        <div
          ref={setNodeRef}
          style={style}
          className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all p-4 sm:p-6"
          onClick={handleCardClick}
          onDragStart={(e) => e.preventDefault()}
        >
          {cardContent}
        </div>
      </>
    )
  }

  return (
    <Link
      to={`/works/${characterWorkId}/characters/${character.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all p-4 sm:p-6"
    >
      {cardContent}
    </Link>
  )
}

