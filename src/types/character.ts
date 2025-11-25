export interface Character {
  id: string
  workId: string // 작품 ID
  name: string
  description: string
  age?: number
  role?: string
  isMainCharacter?: boolean // 주연 여부
  order?: number // 정렬 순서
  notes: string
  synopsisIds: string[]
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type CharacterInput = Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

