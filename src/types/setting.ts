export type SettingType = 'world' | 'location' | 'time' | 'other'

export interface Setting {
  id: string
  workId: string // 작품 ID
  name: string
  description: string
  type: SettingType
  order?: number // 정렬 순서
  notes: string
  synopsisIds: string[]
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type SettingInput = Omit<Setting, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

