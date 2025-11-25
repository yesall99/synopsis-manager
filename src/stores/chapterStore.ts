import { create } from 'zustand'
import { chapterService } from '@/services/storage/storageService'
import type { Chapter, ChapterInput } from '@/types'

interface ChapterState {
  chapters: Chapter[]
  currentChapter: Chapter | null
  isLoading: boolean
  error: string | null

  // Actions
  loadChapters: () => Promise<void>
  loadChapter: (id: string) => Promise<void>
  createChapter: (input: ChapterInput) => Promise<Chapter>
  updateChapter: (id: string, input: Partial<ChapterInput>) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  clearCurrentChapter: () => void
}

export const useChapterStore = create<ChapterState>((set, get) => ({
  chapters: [],
  currentChapter: null,
  isLoading: false,
  error: null,

  loadChapters: async () => {
    set({ isLoading: true, error: null })
    try {
      const chapters = await chapterService.getAll()
      set({ chapters, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '장을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadChapter: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const chapter = await chapterService.getById(id)
      if (chapter) {
        set({ currentChapter: chapter, isLoading: false })
      } else {
        set({ error: '장을 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '장을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createChapter: async (input: ChapterInput) => {
    set({ isLoading: true, error: null })
    try {
      const newChapter = await chapterService.create(input)
      set((state) => ({
        chapters: [newChapter, ...state.chapters],
        currentChapter: newChapter,
        isLoading: false,
      }))
      return newChapter
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '장을 생성하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  updateChapter: async (id: string, input: Partial<ChapterInput>) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await chapterService.update(id, input)
      set((state) => ({
        chapters: state.chapters.map((c) => (c.id === id ? updated : c)),
        currentChapter: state.currentChapter?.id === id ? updated : state.currentChapter,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '장을 업데이트하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  deleteChapter: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await chapterService.delete(id)
      set((state) => ({
        chapters: state.chapters.filter((c) => c.id !== id),
        currentChapter: state.currentChapter?.id === id ? null : state.currentChapter,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '장을 삭제하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  clearCurrentChapter: () => {
    set({ currentChapter: null })
  },
}))

