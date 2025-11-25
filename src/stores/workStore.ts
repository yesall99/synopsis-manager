import { create } from 'zustand'
import { workService } from '@/services/storage/storageService'
import type { Work, WorkInput } from '@/types'

interface WorkStore {
  works: Work[]
  currentWork: Work | null
  isLoading: boolean
  error: string | null

  loadWorks: () => Promise<void>
  loadWork: (id: string) => Promise<void>
  createWork: (input: WorkInput) => Promise<Work>
  updateWork: (id: string, input: Partial<WorkInput>) => Promise<Work>
  deleteWork: (id: string) => Promise<void>
  clearCurrentWork: () => void
}

export const useWorkStore = create<WorkStore>((set) => ({
  works: [],
  currentWork: null,
  isLoading: false,
  error: null,

  loadWorks: async () => {
    set({ isLoading: true, error: null })
    try {
      const works = await workService.getAll()
      set({ works, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '작품을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadWork: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const work = await workService.getById(id)
      if (work) {
        set({ currentWork: work, isLoading: false })
      } else {
        set({ error: '작품을 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '작품을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createWork: async (input: WorkInput) => {
    try {
      console.log('workStore.createWork 호출:', input)
      const work = await workService.create(input)
      console.log('workService.create 완료:', work)
      set((state) => ({ works: [...state.works, work] }))
      return work
    } catch (error) {
      console.error('workStore.createWork 에러:', error)
      throw error
    }
  },

  updateWork: async (id: string, input: Partial<WorkInput>) => {
    try {
      const updated = await workService.update(id, input)
      set((state) => ({
        works: state.works.map((w) => (w.id === id ? updated : w)),
        currentWork: state.currentWork?.id === id ? updated : state.currentWork,
      }))
      return updated
    } catch (error) {
      throw error
    }
  },

  deleteWork: async (id: string) => {
    try {
      await workService.delete(id)
      set((state) => ({
        works: state.works.filter((w) => w.id !== id),
        currentWork: state.currentWork?.id === id ? null : state.currentWork,
      }))
    } catch (error) {
      throw error
    }
  },

  clearCurrentWork: () => {
    set({ currentWork: null })
  },
}))

