import { create } from 'zustand'
import { synopsisService } from '@/services/storage/storageService'
import type { Synopsis, SynopsisInput } from '@/types'

interface SynopsisState {
  synopses: Synopsis[]
  currentSynopsis: Synopsis | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  selectedCategory: string
  selectedTags: string[]
  
  // Actions
  loadSynopses: () => Promise<void>
  loadSynopsis: (id: string) => Promise<void>
  createSynopsis: (input: SynopsisInput) => Promise<Synopsis>
  updateSynopsis: (id: string, input: Partial<SynopsisInput>) => Promise<void>
  deleteSynopsis: (id: string) => Promise<void>
  searchSynopses: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  setSelectedTags: (tags: string[]) => void
  clearCurrentSynopsis: () => void
}

export const useSynopsisStore = create<SynopsisState>((set, get) => ({
  synopses: [],
  currentSynopsis: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: '',
  selectedTags: [],

  loadSynopses: async () => {
    set({ isLoading: true, error: null })
    try {
      const synopses = await synopsisService.getAll()
      set({ synopses, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '시놉시스를 불러오는데 실패했습니다.',
        isLoading: false 
      })
    }
  },

  loadSynopsis: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const synopsis = await synopsisService.getById(id)
      if (synopsis) {
        set({ currentSynopsis: synopsis, isLoading: false })
      } else {
        set({ error: '시놉시스를 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '시놉시스를 불러오는데 실패했습니다.',
        isLoading: false 
      })
    }
  },

  createSynopsis: async (input: SynopsisInput) => {
    set({ isLoading: true, error: null })
    try {
      const newSynopsis = await synopsisService.create(input)
      set((state) => ({
        synopses: [newSynopsis, ...state.synopses],
        currentSynopsis: newSynopsis,
        isLoading: false,
      }))
      return newSynopsis
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '시놉시스를 생성하는데 실패했습니다.',
        isLoading: false 
      })
      throw error
    }
  },

  updateSynopsis: async (id: string, input: Partial<SynopsisInput>) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await synopsisService.update(id, input)
      set((state) => ({
        synopses: state.synopses.map((s) => (s.id === id ? updated : s)),
        currentSynopsis: state.currentSynopsis?.id === id ? updated : state.currentSynopsis,
        isLoading: false,
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '시놉시스를 업데이트하는데 실패했습니다.',
        isLoading: false 
      })
      throw error
    }
  },

  deleteSynopsis: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await synopsisService.delete(id)
      set((state) => ({
        synopses: state.synopses.filter((s) => s.id !== id),
        currentSynopsis: state.currentSynopsis?.id === id ? null : state.currentSynopsis,
        isLoading: false,
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '시놉시스를 삭제하는데 실패했습니다.',
        isLoading: false 
      })
      throw error
    }
  },

  searchSynopses: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query })
    try {
      if (query.trim()) {
        const results = await synopsisService.search(query)
        set({ synopses: results, isLoading: false })
      } else {
        await get().loadSynopses()
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '검색에 실패했습니다.',
        isLoading: false 
      })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setSelectedCategory: (category: string) => {
    set({ selectedCategory: category })
  },

  setSelectedTags: (tags: string[]) => {
    set({ selectedTags: tags })
  },

  clearCurrentSynopsis: () => {
    set({ currentSynopsis: null })
  },
}))

