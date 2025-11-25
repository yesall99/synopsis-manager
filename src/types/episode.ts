export interface Episode {
  id: string
  workId: string // 작품 ID
  chapterId?: string // 장 ID
  episodeNumber: number // 회차 번호
  title?: string // 회차 제목 (선택)
  content: string // 회차 내용 (HTML)
  wordCount?: number // 글자 수
  publishedAt?: Date // 발행일
  subscriberCount?: number // 선작수 (작품 전체)
  viewCount?: number // 조회수 (회차별)
  order?: number // 정렬 순서
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type EpisodeInput = Omit<Episode, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

