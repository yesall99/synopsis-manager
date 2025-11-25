export type { Work, WorkInput } from './work'
export type { Synopsis, SynopsisInput, SynopsisStructure, SynopsisSection } from './synopsis'
export type { Episode, EpisodeInput } from './episode'
export type { Chapter, ChapterInput, ChapterStructureType } from './chapter'
export type { Character, CharacterInput } from './character'
export type { Setting, SettingInput, SettingType } from './setting'
export type { TagCategory, Tag, TagCategoryInput, TagInput } from './tag'

export interface SyncStatus {
  isSyncing: boolean
  lastSyncedAt?: Date
  hasUnsyncedChanges: boolean
  error?: string
}

