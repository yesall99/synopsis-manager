import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Edit2, Save, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SynopsisEditor from './SynopsisEditor'
import type { SynopsisStructure, SynopsisSection } from '@/types'

interface SynopsisStructureEditorProps {
  structure: SynopsisStructure
  onChange: (structure: SynopsisStructure) => void
}

const sectionLabels = {
  gi: '기',
  seung: '승',
  jeon: '전',
  gyeol: '결',
}

function SortableSectionItem({
  section,
  sectionType,
  label,
  index,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  activeId,
}: {
  section: SynopsisSection
  sectionType: keyof SynopsisStructure
  label: string
  index: number
  isEditing: boolean
  onStartEdit: (section: SynopsisSection) => void
  onCancelEdit: (id: string) => void
  onSaveEdit: (type: keyof SynopsisStructure, id: string, data: { title: string; content: string }) => void
  onRemove: (type: keyof SynopsisStructure, id: string) => void
  activeId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, over } = useSortable({
    id: section.id,
  })
  const titleInputRef = useRef<HTMLInputElement>(null)
  const wasEditingRef = useRef(false)
  const [draft, setDraft] = useState({
    title: section.title || '',
    content: section.content || '',
  })

  useEffect(() => {
    if (isEditing) {
      setDraft({
        title: section.title || '',
        content: section.content || '',
      })
    }
  }, [isEditing, section.title, section.content])

  // 드래그 중일 때만 transform 적용 (드래그 중이 아닌 항목은 transform 비활성화)
  const shouldApplyTransform = isDragging || (activeId && activeId === section.id)

  const style = {
    transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldApplyTransform ? transition : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  // 같은 섹션 내에서만 드롭 인디케이터 표시
  const showDropIndicator = over && over.id === section.id && !isDragging

  // 편집 모드 진입 시 한 번만 포커스 (모바일 깜빡임 방지)
  useEffect(() => {
    if (!isEditing) {
      wasEditingRef.current = false
      return
    }

    const input = titleInputRef.current
    if (!input) {
      return
    }

    if (!wasEditingRef.current || document.activeElement !== input) {
      const timer = window.setTimeout(() => {
        if (document.activeElement !== input) {
          input.focus()
        }
      }, 0)
      wasEditingRef.current = true
      return () => window.clearTimeout(timer)
    }

    wasEditingRef.current = true
  }, [isEditing])

  return (
    <>
      {showDropIndicator && (
        <div className="h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full my-2 mx-4" />
      )}
      <div ref={setNodeRef} style={style} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
        {isEditing ? (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <GripVertical className="w-5 h-5" />
                </div>
                <input
                  key={`title-input-${section.id}`}
                  ref={titleInputRef}
                  type="text"
                  value={draft.title}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setDraft((prev) => ({ ...prev, title: newValue }))
                  }}
                  onBlur={(e) => {
                    // 포커스가 다른 input이나 편집 가능한 요소로 이동하는 경우에만 blur 처리
                    const relatedTarget = e.relatedTarget as HTMLElement
                    if (relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable)) {
                      return
                    }
                  }}
                  className="flex-1 px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent font-medium text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSaveEdit(sectionType, section.id, draft)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="저장"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onCancelEdit(section.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="취소"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(sectionType, section.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="ml-8">
              <SynopsisEditor
                content={draft.content}
                onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
                placeholder={`${draft.title || '항목'} 내용을 작성하세요...`}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <GripVertical className="w-5 h-5" />
                </div>
                <h4 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{section.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onStartEdit(section)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="편집"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(sectionType, section.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="ml-8">
              {section.content ? (
                <div
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center">내용이 없습니다.</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// 빈 섹션 드롭 영역
function EmptySectionDropZone({
  sectionType,
  label,
}: {
  sectionType: keyof SynopsisStructure
  label: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${sectionType}`,
  })

  return (
    <div
      ref={setNodeRef}
      className={`text-center py-8 text-sm text-gray-400 dark:text-gray-500 transition-colors ${
        isOver ? 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg' : ''
      }`}
    >
      {isOver ? (
        <p className="text-gray-700 dark:text-gray-300 font-medium">여기에 드롭하세요</p>
      ) : (
        <p>{label} 항목이 없습니다. 추가 버튼을 클릭하거나 다른 섹션에서 드래그하여 추가하세요.</p>
      )}
    </div>
  )
}

export default function SynopsisStructureEditor({
  structure,
  onChange,
}: SynopsisStructureEditorProps) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      return
    }

    // 드래그된 항목 찾기
    let draggedSection: { section: SynopsisSection; type: keyof SynopsisStructure } | null = null
    ;(['gi', 'seung', 'jeon', 'gyeol'] as const).forEach((type) => {
      const found = structure[type].find((s) => s.id === active.id)
      if (found) {
        draggedSection = { section: found, type }
      }
    })

    if (!draggedSection) {
      return
    }

    // 같은 항목 위에 드롭한 경우 무시
    if (active.id === over.id) {
      return
    }

    // 타겟이 드롭 영역인 경우
    if (typeof over.id === 'string' && over.id.startsWith('drop-')) {
      const targetSectionType = over.id.replace('drop-', '') as keyof SynopsisStructure

      // 같은 섹션이면 무시
      if (draggedSection.type === targetSectionType) {
        return
      }

      const newStructure: SynopsisStructure = {
        gi: [...structure.gi.filter((s) => s.id !== draggedSection!.section.id)],
        seung: [...structure.seung.filter((s) => s.id !== draggedSection!.section.id)],
        jeon: [...structure.jeon.filter((s) => s.id !== draggedSection!.section.id)],
        gyeol: [...structure.gyeol.filter((s) => s.id !== draggedSection!.section.id)],
      }

      // 드래그된 항목을 타겟 섹션에 추가
      newStructure[targetSectionType].push(draggedSection.section)

      // 순서 재정렬
      ;(['gi', 'seung', 'jeon', 'gyeol'] as const).forEach((type) => {
        newStructure[type] = newStructure[type].map((s, index) => ({
          ...s,
          order: index,
        }))
      })

      onChange(newStructure)
      return
    }

    // 타겟 항목이 있는 섹션 찾기
    const targetSection = (['gi', 'seung', 'jeon', 'gyeol'] as const).find((type) =>
      structure[type].some((s) => s.id === over.id)
    )

    if (!targetSection) {
      return
    }

    const targetSections = structure[targetSection]
    const oldIndex = targetSections.findIndex((s) => s.id === active.id)
    const newIndex = targetSections.findIndex((s) => s.id === over.id)

    // 같은 섹션 내에서 순서만 변경
    if (draggedSection.type === targetSection) {
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return
      }
      const newSections = arrayMove(targetSections, oldIndex, newIndex)
      const newStructure: SynopsisStructure = {
        ...structure,
        [targetSection]: newSections.map((s, index) => ({
          ...s,
          order: index,
        })),
      }
      onChange(newStructure)
      return
    }

    // 다른 섹션의 항목 위에 드롭한 경우 - 해당 위치에 삽입
    if (newIndex === -1) {
      return
    }

    const newStructure: SynopsisStructure = {
      gi: [...structure.gi.filter((s) => s.id !== draggedSection.section.id)],
      seung: [...structure.seung.filter((s) => s.id !== draggedSection.section.id)],
      jeon: [...structure.jeon.filter((s) => s.id !== draggedSection.section.id)],
      gyeol: [...structure.gyeol.filter((s) => s.id !== draggedSection.section.id)],
    }

    // 타겟 섹션의 항목들 사이에 삽입
    const targetSectionsWithoutDragged = targetSections.filter((s) => s.id !== draggedSection.section.id)
    targetSectionsWithoutDragged.splice(newIndex, 0, draggedSection.section)

    newStructure[targetSection] = targetSectionsWithoutDragged.map((s, index) => ({
      ...s,
      order: index,
    }))

    // 모든 섹션의 순서 재정렬
    ;(['gi', 'seung', 'jeon', 'gyeol'] as const).forEach((type) => {
      if (type !== targetSection) {
        newStructure[type] = newStructure[type].map((s, index) => ({
          ...s,
          order: index,
        }))
      }
    })

    onChange(newStructure)
  }

  const addSection = (type: keyof SynopsisStructure) => {
    const sections = structure[type]
    const newSection: SynopsisSection = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      order: sections.length,
    }
    setEditingIds(new Set([...editingIds, newSection.id]))
    onChange({
      ...structure,
      [type]: [...sections, newSection],
    })
  }

  const removeSection = (type: keyof SynopsisStructure, id: string) => {
    const sections = structure[type].filter((s) => s.id !== id)
    const reordered = sections.map((s, index) => ({ ...s, order: index }))
    onChange({
      ...structure,
      [type]: reordered,
    })
  }

  const startEdit = (section: SynopsisSection) => {
    setEditingIds(new Set([...editingIds, section.id]))
  }

  const cancelEdit = (id: string) => {
    const newEditingIds = new Set(editingIds)
    newEditingIds.delete(id)
    setEditingIds(newEditingIds)
  }

  const saveEdit = (type: keyof SynopsisStructure, id: string, data: { title: string; content: string }) => {
    const sections = structure[type].map((s) =>
      s.id === id ? { ...s, title: data.title, content: data.content } : s
    )
    onChange({
      ...structure,
      [type]: sections,
    })

    cancelEdit(id)
  }

  // 섹션 컴포넌트
  const SectionContainer = ({
    type,
    label,
    sections,
    editingIds,
    onAddSection,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRemoveSection,
    activeId,
  }: {
    type: keyof SynopsisStructure
    label: string
    sections: SynopsisSection[]
    editingIds: Set<string>
    onAddSection: (type: keyof SynopsisStructure) => void
    onStartEdit: (section: SynopsisSection) => void
    onCancelEdit: (id: string) => void
    onSaveEdit: (type: keyof SynopsisStructure, id: string, data: { title: string; content: string }) => void
    onRemoveSection: (type: keyof SynopsisStructure, id: string) => void
    activeId: string | null
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `drop-${type}`,
    })

    return (
      <div
        ref={setNodeRef}
        className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors ${
          isOver ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 border-2 border-dashed' : 'bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">{label}</h3>
          <button
            onClick={() => onAddSection(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>

        {isOver && sections.length > 0 && (
          <div className="mb-4 text-center py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
            <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">여기에 드롭하세요</p>
          </div>
        )}

        {sections.length === 0 ? (
          <EmptySectionDropZone sectionType={type} label={label} />
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => {
              const isEditing = editingIds.has(section.id)

              return (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  sectionType={type}
                  label={label}
                  index={index}
                  isEditing={isEditing}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  onRemove={onRemoveSection}
                  activeId={activeId}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // 모든 항목 ID를 하나의 배열로 모음 (크로스 섹션 드래그를 위해)
  const allItemIds = [
    ...structure.gi.map((s) => s.id),
    ...structure.seung.map((s) => s.id),
    ...structure.jeon.map((s) => s.id),
    ...structure.gyeol.map((s) => s.id),
  ]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          <SectionContainer
            type="gi"
            label="기"
            sections={structure.gi}
            editingIds={editingIds}
            onAddSection={addSection}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onRemoveSection={removeSection}
            activeId={activeId}
          />
          <SectionContainer
            type="seung"
            label="승"
            sections={structure.seung}
            editingIds={editingIds}
            onAddSection={addSection}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onRemoveSection={removeSection}
            activeId={activeId}
          />
          <SectionContainer
            type="jeon"
            label="전"
            sections={structure.jeon}
            editingIds={editingIds}
            onAddSection={addSection}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onRemoveSection={removeSection}
            activeId={activeId}
          />
          <SectionContainer
            type="gyeol"
            label="결"
            sections={structure.gyeol}
            editingIds={editingIds}
            onAddSection={addSection}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onRemoveSection={removeSection}
            activeId={activeId}
          />
        </div>
      </SortableContext>
    </DndContext>
  )
}
