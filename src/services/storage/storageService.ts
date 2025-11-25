import {
  getAllWorks,
  getWork,
  addWork,
  updateWork,
  deleteWork,
  getAllSynopses,
  getSynopsis,
  addSynopsis,
  updateSynopsis,
  deleteSynopsis,
  searchSynopses,
  getSynopsesByWorkId,
  getAllCharacters,
  getCharacter,
  addCharacter,
  updateCharacter,
  deleteCharacter,
  getCharactersByWorkId,
  getAllSettings,
  getSetting,
  addSetting,
  updateSetting,
  deleteSetting,
  getSettingsByWorkId,
  getAllTags,
  getAllEpisodes,
  getEpisode,
  addEpisode,
  updateEpisode,
  deleteEpisode,
  getEpisodesByWorkId,
  getAllChapters,
  getChapter,
  addChapter,
  updateChapter,
  deleteChapter,
  getChaptersByWorkId,
} from './indexedDB'
import type { Work, Synopsis, Character, Setting, Episode, Chapter, WorkInput, SynopsisInput, CharacterInput, SettingInput, EpisodeInput, ChapterInput } from '@/types'

// Works service
export const workService = {
  async getAll(): Promise<Work[]> {
    return getAllWorks()
  },

  async getById(id: string): Promise<Work | null> {
    const work = await getWork(id)
    return work || null
  },

  async create(input: WorkInput): Promise<Work> {
    const now = new Date()
    const work: Work = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addWork(work)
    return work
  },

  async update(id: string, input: Partial<WorkInput>): Promise<Work> {
    const existing = await getWork(id)
    if (!existing) {
      throw new Error(`Work with id ${id} not found`)
    }
    const updated: Work = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateWork(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteWork(id)
  },
}

// Synopses service
export const synopsisService = {
  async getAll(): Promise<Synopsis[]> {
    return getAllSynopses()
  },

  async getByWorkId(workId: string): Promise<Synopsis[]> {
    return getSynopsesByWorkId(workId)
  },

  async getById(id: string): Promise<Synopsis | null> {
    const synopsis = await getSynopsis(id)
    return synopsis || null
  },

  async create(input: SynopsisInput): Promise<Synopsis> {
    const now = new Date()
    const synopsis: Synopsis = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addSynopsis(synopsis)
    return synopsis
  },

  async update(id: string, input: Partial<SynopsisInput>): Promise<Synopsis> {
    const existing = await getSynopsis(id)
    if (!existing) {
      throw new Error(`Synopsis with id ${id} not found`)
    }
    const updated: Synopsis = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateSynopsis(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteSynopsis(id)
  },

  async search(query: string): Promise<Synopsis[]> {
    return searchSynopses(query)
  },
}

// Characters service
export const characterService = {
  async getAll(): Promise<Character[]> {
    return getAllCharacters()
  },

  async getByWorkId(workId: string): Promise<Character[]> {
    return getCharactersByWorkId(workId)
  },

  async getById(id: string): Promise<Character | null> {
    const character = await getCharacter(id)
    return character || null
  },

  async create(input: CharacterInput): Promise<Character> {
    const now = new Date()
    const character: Character = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addCharacter(character)
    return character
  },

  async update(id: string, input: Partial<CharacterInput>): Promise<Character> {
    const existing = await getCharacter(id)
    if (!existing) {
      throw new Error(`Character with id ${id} not found`)
    }
    const updated: Character = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateCharacter(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteCharacter(id)
  },
}

// Settings service
export const settingService = {
  async getAll(): Promise<Setting[]> {
    return getAllSettings()
  },

  async getByWorkId(workId: string): Promise<Setting[]> {
    return getSettingsByWorkId(workId)
  },

  async getById(id: string): Promise<Setting | null> {
    const setting = await getSetting(id)
    return setting || null
  },

  async create(input: SettingInput): Promise<Setting> {
    const now = new Date()
    const setting: Setting = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addSetting(setting)
    return setting
  },

  async update(id: string, input: Partial<SettingInput>): Promise<Setting> {
    const existing = await getSetting(id)
    if (!existing) {
      throw new Error(`Setting with id ${id} not found`)
    }
    const updated: Setting = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateSetting(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteSetting(id)
  },
}

// Episodes service
export const episodeService = {
  async getAll(): Promise<Episode[]> {
    return getAllEpisodes()
  },

  async getByWorkId(workId: string): Promise<Episode[]> {
    return getEpisodesByWorkId(workId)
  },

  async getById(id: string): Promise<Episode | null> {
    const episode = await getEpisode(id)
    return episode || null
  },

  async create(input: EpisodeInput): Promise<Episode> {
    const now = new Date()
    const episode: Episode = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addEpisode(episode)
    return episode
  },

  async update(id: string, input: Partial<EpisodeInput>): Promise<Episode> {
    const existing = await getEpisode(id)
    if (!existing) {
      throw new Error(`Episode with id ${id} not found`)
    }
    const updated: Episode = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateEpisode(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteEpisode(id)
  },
}

// Chapters service
export const chapterService = {
  async getAll(): Promise<Chapter[]> {
    return getAllChapters()
  },

  async getByWorkId(workId: string): Promise<Chapter[]> {
    return getChaptersByWorkId(workId)
  },

  async getById(id: string): Promise<Chapter | null> {
    const chapter = await getChapter(id)
    return chapter || null
  },

  async create(input: ChapterInput): Promise<Chapter> {
    const now = new Date()
    const chapter: Chapter = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDirty: true,
    }
    await addChapter(chapter)
    return chapter
  },

  async update(id: string, input: Partial<ChapterInput>): Promise<Chapter> {
    const existing = await getChapter(id)
    if (!existing) {
      throw new Error(`Chapter with id ${id} not found`)
    }
    const updated: Chapter = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      isDirty: true,
    }
    await updateChapter(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteChapter(id)
  },
}

// Tags service
export const tagService = {
  async getAll(): Promise<Array<{ name: string; count: number; color?: string }>> {
    return getAllTags()
  },
}

