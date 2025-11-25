// 태그 대분류 (예: 장르, 관계, 인물(공), 인물(수), 소재, 분위기/기타)
export interface TagCategory {
  id: string
  name: string // 대분류 이름 (예: "장르", "관계")
  order: number // 정렬 순서
  createdAt: Date
  updatedAt: Date
}

// 태그 소분류 (예: 가이드버스, 헌터물, 현대물)
export interface Tag {
  id: string
  categoryId: string // 대분류 ID
  name: string // 태그 이름 (예: "가이드버스", "헌터물")
  order: number // 정렬 순서
  isNew?: boolean // 새 태그 표시
  createdAt: Date
  updatedAt: Date
}

export type TagCategoryInput = Omit<TagCategory, 'id' | 'createdAt' | 'updatedAt'>
export type TagInput = Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>

