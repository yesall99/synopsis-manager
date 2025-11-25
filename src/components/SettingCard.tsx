import { Link, useNavigate } from 'react-router-dom'
import { GripVertical } from 'lucide-react'
import type { Setting } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SettingCardProps {
  setting: Setting
  workId?: string
  isDraggable?: boolean
  activeId?: string | null
}

const typeLabels: Record<Setting['type'], string> = {
  world: '세계관',
  location: '장소',
  time: '시간',
  other: '기타',
}

const typeColors: Record<Setting['type'], string> = {
  world: 'bg-purple-100 text-purple-700',
  location: 'bg-green-100 text-green-700',
  time: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function SettingCard({
  setting,
  workId,
  isDraggable = false,
  activeId = null,
}: SettingCardProps) {
  const navigate = useNavigate()
  const settingWorkId = workId || setting.workId

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = isDraggable
    ? useSortable({ id: setting.id })
    : { attributes: {}, listeners: {}, setNodeRef: null, transform: null, transition: null, isDragging: false, over: null }

  const shouldApplyTransform = isDragging || (activeId && activeId === setting.id)

  const style = isDraggable
    ? {
        transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
        transition: shouldApplyTransform ? undefined : (transition || undefined), // 드래그 중에는 transition 제거
        opacity: isDragging ? 0.5 : 1,
      }
    : {}

  // 드롭 인디케이터 표시
  const showDropIndicator = over && over.id === setting.id && !isDragging

  const handleCardClick = (e: React.MouseEvent) => {
    // 드래그 핸들을 클릭한 경우 네비게이션 방지
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      return
    }
    if (!isDragging) {
      navigate(`/works/${settingWorkId}/settings/${setting.id}`)
    }
  }

  const cardContent = (
    <div className="flex items-start gap-4">
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          data-drag-handle
          className="cursor-grab active:cursor-grabbing flex items-center justify-center p-2 text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{setting.name}</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded ${typeColors[setting.type]}`}>
            {typeLabels[setting.type]}
          </span>
        </div>

        {setting.description && (
          <p className="text-gray-600 text-sm">{setting.description}</p>
        )}
      </div>
    </div>
  )

  if (isDraggable) {
    return (
      <>
        {showDropIndicator && <div className="h-1 bg-blue-500 rounded-full my-2" />}
        <div
          ref={setNodeRef}
          style={style}
          className="block bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md p-6"
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
      to={`/works/${settingWorkId}/settings/${setting.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-6"
    >
      {cardContent}
    </Link>
  )
}
