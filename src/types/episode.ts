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
  // 본문 설정
  layoutMode?: 'scroll' | 'page' // 레이아웃 모드: 스크롤/페이지
  bodyWidth?: 400 | 600 | 800 // 본문 폭 (px)
  firstLineIndent?: 'none' | '0.5' | '1' | '2' // 첫 줄 들여쓰기: 없음, 0.5칸, 1칸, 2칸
  paragraphSpacing?: 'none' | '0.5' | '1' | '2' // 문단 사이 간격: 없음, 0.5줄, 1줄, 2줄
  createdAt: Date
  updatedAt: Date
  syncedAt?: Date
  isDirty?: boolean
}

export type EpisodeInput = Omit<Episode, 'id' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDirty'>

