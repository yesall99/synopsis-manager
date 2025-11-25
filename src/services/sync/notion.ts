import { Client } from '@notionhq/client'
import type { Work, Synopsis, Character, Setting, Episode, Chapter, Tag } from '@/types'

// Cloudflare Pages Functions 프록시를 사용하는 노션 API 클라이언트
// 개발/프로덕션 환경 모두 `/api/notion` 프록시를 통해 호출합니다.
const getProxyUrl = (path: string): string => {
  // 개발 환경에서는 Vite 프록시 사용, 프로덕션에서는 Cloudflare Pages Functions 사용
  return `/api/notion/${path}`
}

// 커스텀 fetch 함수: 프록시를 통해 노션 API 호출
const proxyFetch = async (url: string, options?: any): Promise<Response> => {
  const apiKey = localStorage.getItem('notionApiKey')
  if (!apiKey) {
    throw new Error('Notion API key not found')
  }

  // 노션 API URL에서 경로 추출
  const notionApiBase = 'https://api.notion.com/v1/'
  let path = ''
  if (url.startsWith(notionApiBase)) {
    path = url.replace(notionApiBase, '')
  } else {
    // 이미 프록시 URL인 경우
    const urlObj = new URL(url, window.location.origin)
    path = urlObj.pathname.replace('/api/notion/', '')
  }
  
  // 프록시 URL로 변환
  const proxyUrl = getProxyUrl(path)
  
  // 헤더 정규화 (대소문자 구분 없이)
  const headers = new Headers(options?.headers || {})
  
  // Authorization 헤더 확인 및 설정
  // 노션 클라이언트가 auth 옵션을 사용하면 내부적으로 Authorization 헤더를 추가할 수 있음
  const existingAuth = headers.get('Authorization') || headers.get('authorization')
  if (!existingAuth) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  }
  
  // Notion-Version 헤더 확인 및 설정
  if (!headers.get('Notion-Version') && !headers.get('notion-version')) {
    headers.set('Notion-Version', '2022-06-28')
  }
  
  // Content-Type 헤더 확인 및 설정
  if (!headers.get('Content-Type') && !headers.get('content-type')) {
    headers.set('Content-Type', 'application/json')
  }
  
  // 프록시를 통해 요청
  return fetch(proxyUrl, {
    method: options?.method || 'GET',
    headers: headers,
    body: options?.body,
  })
}

// 노션 API 클라이언트 가져오기
export function getNotionClient(): Client | null {
  const apiKey = localStorage.getItem('notionApiKey')
  if (!apiKey) {
    return null
  }
  
  // 커스텀 fetch를 사용하는 클라이언트 생성
  return new Client({ 
    auth: apiKey,
    fetch: proxyFetch,
  })
}

// 노션 데이터베이스 ID 저장/불러오기
const NOTION_DB_IDS_KEY = 'notionDatabaseIds'

interface NotionDatabaseIds {
  works?: string
  synopses?: string
  characters?: string
  settings?: string
  episodes?: string
  chapters?: string
  tags?: string
}

export function getNotionDatabaseIds(): NotionDatabaseIds {
  const saved = localStorage.getItem(NOTION_DB_IDS_KEY)
  return saved ? JSON.parse(saved) : {}
}

export function setNotionDatabaseIds(ids: NotionDatabaseIds): void {
  localStorage.setItem(NOTION_DB_IDS_KEY, JSON.stringify(ids))
}

// 노션 데이터베이스 생성
export async function createNotionDatabase(
  client: Client,
  parentPageId: string,
  title: string,
  properties: any
): Promise<string> {
  try {
    const response = await client.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: title,
          },
        },
      ],
      // @ts-ignore - Notion API types may not match exactly
      properties: properties,
    })
    return response.id
  } catch (error) {
    console.error('노션 데이터베이스 생성 실패:', error)
    throw error
  }
}

// 루트 페이지 ID 가져오기 (사용자가 통합을 연결한 페이지)
export function getRootPageId(): string | null {
  return localStorage.getItem('notionRootPageId')
}

export function setRootPageId(pageId: string): void {
  localStorage.setItem('notionRootPageId', pageId)
}

// 통합이 접근 가능한 페이지 목록 가져오기
// Cloudflare Workers나 서버 사이드 프록시를 통해 호출해야 합니다.
export async function getAccessiblePages(client: Client): Promise<Array<{ id: string; title: string }>> {
  try {
    // 필터 없이 모든 접근 가능한 항목 가져오기
    const response = await client.search({})
    
    const pages = response.results
      .filter((item: any) => item.object === 'page')
      .map((page: any) => {
        // 페이지 제목 추출
        let title = '제목 없음'
        
        // 노션 페이지의 제목은 properties가 아닌 다른 곳에 있을 수 있음
        // 페이지 객체를 직접 확인
        if (page.properties) {
          // properties에서 title 속성 찾기
          const titleProp = Object.values(page.properties).find((prop: any) => 
            prop.type === 'title' && prop.title && prop.title.length > 0
          ) as any
          
          if (titleProp?.title?.[0]?.plain_text) {
            title = titleProp.title[0].plain_text
          }
        }
        
        // 페이지 URL에서 제목 추출 시도 (fallback)
        if (title === '제목 없음' && page.url) {
          const urlParts = page.url.split('/')
          const lastPart = urlParts[urlParts.length - 1]
          if (lastPart && lastPart !== page.id) {
            title = decodeURIComponent(lastPart.replace(/-/g, ' '))
          }
        }
        
        return {
          id: page.id,
          title: title,
        }
      })
    
    return pages
  } catch (error) {
    console.error('노션 페이지 목록 가져오기 실패:', error)
    throw error
  }
}

// 루트 페이지 확인
export async function verifyRootPage(client: Client, pageId: string): Promise<boolean> {
  try {
    await client.pages.retrieve({ page_id: pageId })
    return true
  } catch (error) {
    console.error('노션 페이지 확인 실패:', error)
    return false
  }
}

// 초기 데이터베이스 설정
export async function initializeNotionDatabases(client: Client, rootPageId: string): Promise<NotionDatabaseIds> {
  // 페이지 접근 권한 확인
  const hasAccess = await verifyRootPage(client, rootPageId)
  if (!hasAccess) {
    throw new Error('노션 페이지에 접근할 수 없습니다. 통합이 해당 페이지에 연결되어 있는지 확인해주세요.')
  }

  const dbIds: NotionDatabaseIds = {}

  // Works 데이터베이스
  dbIds.works = await createNotionDatabase(client, rootPageId, '작품', {
    '제목': { title: {} },
    '카테고리': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Synopses 데이터베이스
  dbIds.synopses = await createNotionDatabase(client, rootPageId, '시놉시스', {
    '작품 ID': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Characters 데이터베이스
  dbIds.characters = await createNotionDatabase(client, rootPageId, '캐릭터', {
    '이름': { title: {} },
    '작품 ID': { rich_text: {} },
    '역할': { rich_text: {} },
    '주연 여부': { checkbox: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Settings 데이터베이스
  dbIds.settings = await createNotionDatabase(client, rootPageId, '설정', {
    '이름': { title: {} },
    '작품 ID': { rich_text: {} },
    '유형': { select: { options: [] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Episodes 데이터베이스
  dbIds.episodes = await createNotionDatabase(client, rootPageId, '회차', {
    '회차 번호': { number: {} },
    '제목': { title: {} },
    '작품 ID': { rich_text: {} },
    '장 ID': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Chapters 데이터베이스
  dbIds.chapters = await createNotionDatabase(client, rootPageId, '장', {
    '제목': { title: {} },
    '작품 ID': { rich_text: {} },
    '구조 구분': { select: { options: [] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Tags 데이터베이스
  dbIds.tags = await createNotionDatabase(client, rootPageId, '태그', {
    '이름': { title: {} },
    '카테고리 ID': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  setNotionDatabaseIds(dbIds)
  return dbIds
}

// 데이터를 노션 형식으로 변환
function workToNotionProperties(work: Work): any {
  return {
    '제목': {
      title: [{ text: { content: work.title } }],
    },
    '카테고리': {
      rich_text: work.category ? [{ text: { content: work.category } }] : [],
    },
    '생성일': {
      date: work.createdAt ? { start: work.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: work.updatedAt ? { start: work.updatedAt.toISOString() } : null,
    },
  }
}

// 노션에서 데이터 가져오기 (간단한 버전)
export async function syncToNotion(
  client: Client,
  data: {
    works: Work[]
    synopses: Synopsis[]
    characters: Character[]
    settings: Setting[]
    episodes: Episode[]
    chapters: Chapter[]
    tags: Tag[]
  }
): Promise<void> {
  const dbIds = getNotionDatabaseIds()

  // 데이터베이스가 없으면 초기화
  if (!dbIds.works) {
    const rootPageId = getRootPageId()
    if (!rootPageId) {
      throw new Error('Root page ID is required. Please connect to Notion first.')
    }
    await initializeNotionDatabases(client, rootPageId)
    const newDbIds = getNotionDatabaseIds()
    Object.assign(dbIds, newDbIds)
  }

  // Works 동기화
  if (dbIds.works) {
    for (const work of data.works) {
      try {
        await client.pages.create({
          parent: { database_id: dbIds.works },
          properties: workToNotionProperties(work),
        })
      } catch (error) {
        console.error(`작품 ${work.id} 동기화 실패:`, error)
      }
    }
  }
}

// 노션에서 데이터 가져오기
export async function syncFromNotion(client: Client): Promise<{
  works: Work[]
  synopses: Synopsis[]
  characters: Character[]
  settings: Setting[]
  episodes: Episode[]
  chapters: Chapter[]
  tags: Tag[]
}> {
  const dbIds = getNotionDatabaseIds()
  const result = {
    works: [] as Work[],
    synopses: [] as Synopsis[],
    characters: [] as Character[],
    settings: [] as Setting[],
    episodes: [] as Episode[],
    chapters: [] as Chapter[],
    tags: [] as Tag[],
  }

  // TODO: 노션에서 데이터를 읽어와서 변환하는 로직 구현
  // 현재는 빈 배열 반환

  return result
}

