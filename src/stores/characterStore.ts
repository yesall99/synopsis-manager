import { create } from 'zustand'
import { characterService } from '@/services/storage/storageService'
import type { Character, CharacterInput } from '@/types'

interface CharacterState {
  characters: Character[]
  currentCharacter: Character | null
  isLoading: boolean
  error: string | null
  searchQuery: string

  // Actions
  loadCharacters: () => Promise<void>
  loadCharacter: (id: string) => Promise<void>
  createCharacter: (input: CharacterInput) => Promise<Character>
  updateCharacter: (id: string, input: Partial<CharacterInput>) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  searchCharacters: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  clearCurrentCharacter: () => void
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  currentCharacter: null,
  isLoading: false,
  error: null,
  searchQuery: '',

  loadCharacters: async () => {
    set({ isLoading: true, error: null })
    try {
      const characters = await characterService.getAll()
      set({ characters, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '캐릭터를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadCharacter: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const character = await characterService.getById(id)
      if (character) {
        set({ currentCharacter: character, isLoading: false })
      } else {
        set({ error: '캐릭터를 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '캐릭터를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createCharacter: async (input: CharacterInput) => {
    set({ isLoading: true, error: null })
    try {
      const newCharacter = await characterService.create(input)
      set((state) => ({
        characters: [newCharacter, ...state.characters],
        currentCharacter: newCharacter,
        isLoading: false,
      }))
      return newCharacter
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '캐릭터를 생성하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  updateCharacter: async (id: string, input: Partial<CharacterInput>) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await characterService.update(id, input)
      set((state) => ({
        characters: state.characters.map((c) => (c.id === id ? updated : c)),
        currentCharacter: state.currentCharacter?.id === id ? updated : state.currentCharacter,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '캐릭터를 업데이트하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  deleteCharacter: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await characterService.delete(id)
      set((state) => ({
        characters: state.characters.filter((c) => c.id !== id),
        currentCharacter: state.currentCharacter?.id === id ? null : state.currentCharacter,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '캐릭터를 삭제하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  searchCharacters: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query })
    try {
      const allCharacters = await characterService.getAll()
      if (query.trim()) {
        const lowerQuery = query.toLowerCase()
        const filtered = allCharacters.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.description.toLowerCase().includes(lowerQuery) ||
            c.role?.toLowerCase().includes(lowerQuery) ||
            c.notes.toLowerCase().includes(lowerQuery)
        )
        set({ characters: filtered, isLoading: false })
      } else {
        set({ characters: allCharacters, isLoading: false })
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

  clearCurrentCharacter: () => {
    set({ currentCharacter: null })
  },
}))

