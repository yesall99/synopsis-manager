export interface Work {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type WorkInput = Omit<Work, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

