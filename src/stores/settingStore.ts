import { create } from 'zustand'
import { settingService } from '@/services/storage/storageService'
import type { Setting, SettingInput, SettingType } from '@/types'

interface SettingState {
  settings: Setting[]
  currentSetting: Setting | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  selectedType: SettingType | ''

  // Actions
  loadSettings: () => Promise<void>
  loadSetting: (id: string) => Promise<void>
  createSetting: (input: SettingInput) => Promise<Setting>
  updateSetting: (id: string, input: Partial<SettingInput>) => Promise<void>
  deleteSetting: (id: string) => Promise<void>
  searchSettings: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedType: (type: SettingType | '') => void
  clearCurrentSetting: () => void
}

export const useSettingStore = create<SettingState>((set, get) => ({
  settings: [],
  currentSetting: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedType: '',

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const settings = await settingService.getAll()
      set({ settings, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '설정을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadSetting: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const setting = await settingService.getById(id)
      if (setting) {
        set({ currentSetting: setting, isLoading: false })
      } else {
        set({ error: '설정을 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '설정을 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createSetting: async (input: SettingInput) => {
    set({ isLoading: true, error: null })
    try {
      const newSetting = await settingService.create(input)
      set((state) => ({
        settings: [newSetting, ...state.settings],
        currentSetting: newSetting,
        isLoading: false,
      }))
      return newSetting
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '설정을 생성하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  updateSetting: async (id: string, input: Partial<SettingInput>) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await settingService.update(id, input)
      set((state) => ({
        settings: state.settings.map((s) => (s.id === id ? updated : s)),
        currentSetting: state.currentSetting?.id === id ? updated : state.currentSetting,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '설정을 업데이트하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  deleteSetting: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await settingService.delete(id)
      set((state) => ({
        settings: state.settings.filter((s) => s.id !== id),
        currentSetting: state.currentSetting?.id === id ? null : state.currentSetting,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '설정을 삭제하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  searchSettings: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query })
    try {
      const allSettings = await settingService.getAll()
      if (query.trim()) {
        const lowerQuery = query.toLowerCase()
        const filtered = allSettings.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.description.toLowerCase().includes(lowerQuery) ||
            s.notes.toLowerCase().includes(lowerQuery)
        )
        set({ settings: filtered, isLoading: false })
      } else {
        set({ settings: allSettings, isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '검색에 실패했습니다.',
        isLoading: false,
      })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setSelectedType: (type: SettingType | '') => {
    set({ selectedType: type })
  },

  clearCurrentSetting: () => {
    set({ currentSetting: null })
  },
}))

