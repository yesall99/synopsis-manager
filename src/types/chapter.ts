export type ChapterStructureType = 'gi' | 'seung' | 'jeon' | 'gyeol' | null

export interface Chapter {
  id: string
  workId: string // 작품 ID
  title: string // 장 제목 (예: "제 3장 오월동주")
  structureType?: ChapterStructureType // 기/승/전/결 구분
  order?: number // 정렬 순서
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type ChapterInput = Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

