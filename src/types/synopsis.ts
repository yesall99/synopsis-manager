export interface SynopsisSection {
  id: string
  title: string
  content: string
  order: number
}

export interface SynopsisStructure {
  gi: SynopsisSection[] // 기
  seung: SynopsisSection[] // 승
  jeon: SynopsisSection[] // 전
  gyeol: SynopsisSection[] // 결
}

export interface Synopsis {
  id: string
  workId: string // 작품 ID (1:1 관계)
  structure: SynopsisStructure // 기/승/전/결 구조 (필수)
  characterIds: string[]
  settingIds: string[]
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean // 동기화 필요 여부
}

export type SynopsisInput = Omit<Synopsis, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

