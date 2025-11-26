import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, Edit2, Trash2, Loader2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useChapterStore } from '@/stores/chapterStore'
import type { Chapter } from '@/types'

interface SortableChapterCardProps {
  chapter: Chapter
  workId: string
  onDelete: (id: string) => void
  activeId: string | null
}

function SortableChapterCard({ chapter, workId, onDelete, activeId }: SortableChapterCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = useSortable({ id: chapter.id })

  const shouldApplyTransform = isDragging || (activeId && activeId === chapter.id)

  const style = {
    transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldApplyTransform ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const showDropIndicator = over && over.id === chapter.id && !isDragging

  return (
    <>
      {showDropIndicator && (
        <div className="h-0.5 bg-gray-300 rounded-full my-2" />
      )}
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing flex items-center justify-center p-2 text-gray-400 hover:text-gray-600"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 mb-2">{chapter.title}</h3>
              {chapter.structureType && (
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 mb-2">
                  {chapter.structureType === 'gi' ? '기' :
                   chapter.structureType === 'seung' ? '승' :
                   chapter.structureType === 'jeon' ? '전' :
                   chapter.structureType === 'gyeol' ? '결' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/works/${workId}/chapters/${chapter.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              편집
            </Link>
            <button
              onClick={() => onDelete(chapter.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ChapterManagement() {
  const { workId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const { chapters, isLoading, loadChapters, deleteChapter, updateChapter } = useChapterStore()
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (workId) {
      loadChapters()
    }
  }, [workId, loadChapters])

  const workChapters = chapters
    .filter((c) => c.workId === workId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const handleDelete = async (chapterId: string) => {
    if (confirm('정말 이 장을 삭제하시겠습니까? 장에 속한 회차는 삭제되지 않습니다.')) {
      try {
        await deleteChapter(chapterId)
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleChapterDragStart = (event: any) => {
    setActiveChapterId(event.active.id as string)
  }

  const handleChapterDragCancel = () => {
    setActiveChapterId(null)
  }

  const handleChapterDragEnd = async (event: DragEndEvent) => {
    setActiveChapterId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = workChapters.findIndex((c) => c.id === active.id)
    const newIndex = workChapters.findIndex((c) => c.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(workChapters, oldIndex, newIndex)
      for (let i = 0; i < reordered.length; i++) {
        await updateChapter(reordered[i].id, { order: i })
      }
      await loadChapters() // 데이터 다시 로드
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-end">
            <Link
              to={`/works/${workId}/chapters/new`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 장
            </Link>
          </div>
        </div>

        {workChapters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500 mb-4">장이 없습니다.</p>
            <Link
              to={`/works/${workId}/chapters/new`}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors inline-block rounded"
            >
              첫 장 만들기
            </Link>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleChapterDragStart}
            onDragCancel={handleChapterDragCancel}
            onDragEnd={handleChapterDragEnd}
          >
            <SortableContext items={workChapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4 overflow-hidden">
                {workChapters.map((chapter) => (
                  <SortableChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    workId={workId || ''}
                    onDelete={handleDelete}
                    activeId={activeChapterId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

