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

// 데이터베이스가 존재하고 활성화되어 있는지 확인
async function verifyDatabase(client: Client, databaseId: string): Promise<boolean> {
  try {
    const database = await client.databases.retrieve({ database_id: databaseId })
    // @ts-ignore - Notion API types may not match exactly
    if (database.archived) {
      console.warn(`데이터베이스 ${databaseId}가 아카이브되어 있습니다.`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`데이터베이스 ${databaseId} 확인 실패 (존재하지 않거나 접근 불가):`, error)
    return false
  }
}

// 데이터베이스가 이미 존재하는지 확인하고 속성 추가
async function ensureDatabaseProperties(
  client: Client,
  databaseId: string,
  expectedProperties: Record<string, any>
): Promise<void> {
  try {
    const database = await client.databases.retrieve({ database_id: databaseId })
    // @ts-ignore - Notion API types may not match exactly
    if (database.archived) {
      throw new Error('데이터베이스가 아카이브되어 있습니다.')
    }
    // @ts-ignore - Notion API types may not match exactly
    const existingProps = database.properties || {}
    
    console.log(`데이터베이스 ${databaseId}의 기존 속성:`, Object.keys(existingProps))
    
    // 필요한 속성들이 모두 있는지 확인
    const missingProps: Record<string, any> = {}
    for (const [propName, propDef] of Object.entries(expectedProperties)) {
      if (!existingProps[propName]) {
        missingProps[propName] = propDef
      }
    }
    
    console.log(`누락된 속성:`, Object.keys(missingProps))
    
    // 없는 속성 추가
    if (Object.keys(missingProps).length > 0) {
      try {
        // @ts-ignore - Notion API types may not match exactly
        await client.databases.update({
          database_id: databaseId,
          // @ts-ignore
          properties: missingProps,
        })
        console.log(`데이터베이스 ${databaseId}에 속성 추가 완료:`, Object.keys(missingProps))
        
        // 속성 추가 후 다시 확인
        const updatedDatabase = await client.databases.retrieve({ database_id: databaseId })
        // @ts-ignore
        const updatedProps = updatedDatabase.properties || {}
        console.log(`속성 추가 후 데이터베이스 속성:`, Object.keys(updatedProps))
        
        // 여전히 누락된 속성이 있는지 확인
        const stillMissing: string[] = []
        for (const propName of Object.keys(expectedProperties)) {
          if (!updatedProps[propName]) {
            stillMissing.push(propName)
          }
        }
        if (stillMissing.length > 0) {
          console.error(`속성 추가 후에도 여전히 누락된 속성:`, stillMissing)
          throw new Error(`속성 추가 실패: ${stillMissing.join(', ')}`)
        }
      } catch (error: any) {
        // 아카이브된 부모 페이지 오류인 경우 재시도하지 않음
        if (error?.message?.includes('archived')) {
          console.warn(`데이터베이스 ${databaseId}의 부모 페이지가 아카이브되어 있습니다.`)
          throw new Error('ARCHIVED_PARENT')
        }
        console.warn(`데이터베이스 ${databaseId}에 속성 추가 실패:`, error)
        throw error
      }
    } else {
      console.log(`모든 속성이 이미 존재합니다.`)
    }
  } catch (error: any) {
    if (error?.message === 'ARCHIVED_PARENT') {
      throw error
    }
    console.error(`데이터베이스 ${databaseId} 확인 실패:`, error)
    throw error
  }
}

// 초기 데이터베이스 설정 (작품 데이터베이스만 생성)
export async function initializeNotionDatabases(client: Client, rootPageId: string): Promise<NotionDatabaseIds> {
  // 페이지 접근 권한 확인
  const hasAccess = await verifyRootPage(client, rootPageId)
  if (!hasAccess) {
    throw new Error('노션 페이지에 접근할 수 없습니다. 통합이 해당 페이지에 연결되어 있는지 확인해주세요.')
  }

  const dbIds = getNotionDatabaseIds()
  
  // 기존 작품 데이터베이스가 있으면 유효성 및 속성 확인
  if (dbIds.works) {
    console.log('기존 작품 데이터베이스 발견. 유효성 확인 중...')
    const isValid = await verifyDatabase(client, dbIds.works)
    
    if (isValid) {
      try {
        // 데이터베이스 속성 확인
        const database = await client.databases.retrieve({ database_id: dbIds.works })
        // @ts-ignore
        const existingProps = database.properties || {}
        console.log('기존 데이터베이스 속성:', Object.keys(existingProps))
        
        // 필수 속성이 모두 있는지 확인
        const requiredProps = ['제목', '카테고리', '태그', '생성일', '수정일']
        const hasAllProps = requiredProps.every(prop => existingProps[prop])
        
        if (hasAllProps) {
          console.log('기존 데이터베이스 속성 확인 완료')
          return dbIds
        } else {
          console.warn('기존 데이터베이스에 필수 속성이 없습니다. 새로 생성합니다.')
          // 필수 속성이 없으면 새로 생성
          setNotionDatabaseIds({})
        }
      } catch (error: any) {
        // 아카이브된 부모 페이지 오류인 경우 새로 생성
        if (error?.message === 'ARCHIVED_PARENT' || error?.message?.includes('archived')) {
          console.warn('기존 데이터베이스의 부모 페이지가 아카이브되어 있습니다. 새로 생성합니다.')
          setNotionDatabaseIds({})
        } else {
          console.warn('기존 데이터베이스 확인 실패, 새로 생성합니다:', error)
          setNotionDatabaseIds({})
        }
      }
    } else {
      console.warn('기존 데이터베이스가 유효하지 않습니다. 새로 생성합니다.')
      // 유효하지 않은 데이터베이스 ID 제거
      setNotionDatabaseIds({})
    }
  }

  // 기존 데이터베이스가 없거나 속성 확인 실패 시 새로 생성
  const newDbIds: NotionDatabaseIds = {}

  // Works 데이터베이스만 생성 (하위 페이지는 작품 페이지 내부에 생성)
  newDbIds.works = await createNotionDatabase(client, rootPageId, '작품', {
    '제목': { title: {} },
    '카테고리': { rich_text: {} },
    '태그': { multi_select: { options: [] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  setNotionDatabaseIds(newDbIds)
  return newDbIds
}

// 데이터를 노션 형식으로 변환
function workToNotionProperties(work: Work, workPageId?: string): any {
  return {
    '제목': {
      title: [{ text: { content: work.title } }],
    },
    '카테고리': {
      rich_text: work.category ? [{ text: { content: work.category } }] : [],
    },
    '태그': {
      multi_select: work.tags.map(tag => ({ name: tag })),
    },
    '생성일': {
      date: work.createdAt ? { start: work.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: work.updatedAt ? { start: work.updatedAt.toISOString() } : null,
    },
  }
}

function synopsisToNotionProperties(synopsis: Synopsis, workPageId: string): any {
  // 기/승/전/결 구조를 JSON 문자열로 변환
  const structureJson = JSON.stringify(synopsis.structure)
  
  return {
    '작품': {
      relation: [{ id: workPageId }],
    },
    '구조': {
      rich_text: [{ text: { content: structureJson } }],
    },
    '생성일': {
      date: synopsis.createdAt ? { start: synopsis.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: synopsis.updatedAt ? { start: synopsis.updatedAt.toISOString() } : null,
    },
  }
}

function characterToNotionProperties(character: Character, workPageId: string): any {
  return {
    '이름': {
      title: [{ text: { content: character.name } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '역할': {
      rich_text: character.role ? [{ text: { content: character.role } }] : [],
    },
    '주연 여부': {
      checkbox: character.isMainCharacter || false,
    },
    '설명': {
      rich_text: character.description ? [{ text: { content: character.description } }] : [],
    },
    '생성일': {
      date: character.createdAt ? { start: character.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: character.updatedAt ? { start: character.updatedAt.toISOString() } : null,
    },
  }
}

function settingToNotionProperties(setting: Setting, workPageId: string): any {
  const typeMap: Record<string, string> = {
    'world': '세계관',
    'location': '장소',
    'time': '시간',
    'other': '기타',
  }
  
  return {
    '이름': {
      title: [{ text: { content: setting.name } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '유형': {
      select: setting.type ? { name: typeMap[setting.type] || '기타' } : null,
    },
    '설명': {
      rich_text: setting.description ? [{ text: { content: setting.description } }] : [],
    },
    '생성일': {
      date: setting.createdAt ? { start: setting.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: setting.updatedAt ? { start: setting.updatedAt.toISOString() } : null,
    },
  }
}

function chapterToNotionProperties(chapter: Chapter, workPageId: string): any {
  const structureMap: Record<string, string> = {
    'gi': '기',
    'seung': '승',
    'jeon': '전',
    'gyeol': '결',
  }
  
  return {
    '제목': {
      title: [{ text: { content: chapter.title } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '구조 구분': {
      select: chapter.structureType ? { name: structureMap[chapter.structureType] || null } : null,
    },
    '생성일': {
      date: chapter.createdAt ? { start: chapter.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: chapter.updatedAt ? { start: chapter.updatedAt.toISOString() } : null,
    },
  }
}

function episodeToNotionProperties(episode: Episode, workPageId: string, chapterPageId?: string): any {
  return {
    '회차 번호': {
      number: episode.episodeNumber,
    },
    '제목': {
      title: episode.title ? [{ text: { content: episode.title } }] : [],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '장': {
      relation: chapterPageId ? [{ id: chapterPageId }] : [],
    },
    '내용': {
      rich_text: episode.content ? [{ text: { content: episode.content.replace(/<[^>]*>/g, '') } }] : [],
    },
    '글자수': {
      number: episode.wordCount || null,
    },
    '글자수(공백제외)': {
      number: null, // TODO: wordCountWithoutSpaces 필드 추가 필요
    },
    '선작수': {
      number: episode.subscriberCount || null,
    },
    '조회수': {
      number: episode.viewCount || null,
    },
    '생성일': {
      date: episode.createdAt ? { start: episode.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: episode.updatedAt ? { start: episode.updatedAt.toISOString() } : null,
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
  console.log('=== 노션 동기화 시작 ===')
  console.log('노션 동기화 데이터:', {
    works: data.works.length,
    synopses: data.synopses.length,
    characters: data.characters.length,
    settings: data.settings.length,
    episodes: data.episodes.length,
    chapters: data.chapters.length,
    tags: data.tags.length,
  })

  let dbIds = getNotionDatabaseIds()
  console.log('현재 저장된 데이터베이스 ID:', dbIds)

  // 데이터베이스가 없으면 초기화
  if (!dbIds.works) {
    console.log('데이터베이스가 없어서 초기화 시작...')
    const rootPageId = getRootPageId()
    if (!rootPageId) {
      throw new Error('Root page ID is required. Please connect to Notion first.')
    }
    await initializeNotionDatabases(client, rootPageId)
    dbIds = getNotionDatabaseIds()
    console.log('초기화 후 데이터베이스 ID:', dbIds)
  } else {
    console.log('기존 데이터베이스 사용:', dbIds.works)
  }

  // 작품별로 페이지 ID 매핑 저장
  const workPageMap = new Map<string, string>()
  const serialPageMap = new Map<string, string>() // 연재 페이지 ID 매핑
  const chapterPageMap = new Map<string, string>()

  // 1. Works 동기화
  if (dbIds.works) {
    console.log(`작품 ${data.works.length}개 동기화 시작...`)
    console.log(`데이터베이스 ID: ${dbIds.works}`)
    
    if (data.works.length === 0) {
      console.warn('동기화할 작품이 없습니다.')
      return
    }
    
    for (const work of data.works) {
      try {
        console.log(`작품 "${work.title}" 동기화 시도 중...`)
        
        // 데이터베이스 속성 다시 확인
        try {
          const db = await client.databases.retrieve({ database_id: dbIds.works })
          // @ts-ignore
          const dbProps = db.properties || {}
          console.log(`작품 생성 전 데이터베이스 속성 확인:`, Object.keys(dbProps))
          
          // 필수 속성이 없으면 다시 추가 시도
          const requiredProps = ['제목', '카테고리', '태그', '생성일', '수정일']
          const missingRequired = requiredProps.filter(prop => !dbProps[prop])
          if (missingRequired.length > 0) {
            console.warn(`필수 속성이 누락되어 있습니다:`, missingRequired)
            await ensureDatabaseProperties(client, dbIds.works, {
              '제목': { title: {} },
              '카테고리': { rich_text: {} },
              '태그': { multi_select: { options: [] } },
              '생성일': { date: {} },
              '수정일': { date: {} },
            })
          }
        } catch (error) {
          console.warn('데이터베이스 속성 확인 실패:', error)
        }
        
        const properties = workToNotionProperties(work)
        console.log('작품 속성:', JSON.stringify(properties, null, 2))
        
        const workPage = await client.pages.create({
          parent: { database_id: dbIds.works },
          properties: properties,
        })
        workPageMap.set(work.id, workPage.id)
        console.log(`작품 "${work.title}" 동기화 완료 (ID: ${workPage.id})`)
        
        // 작품 페이지 내부에 연재 페이지 생성
        try {
          const serialPage = await client.pages.create({
            parent: { page_id: workPage.id },
            properties: {
              title: {
                title: [{ text: { content: '연재' } }],
              },
            },
          })
          serialPageMap.set(work.id, serialPage.id)
          console.log(`작품 "${work.title}"의 연재 페이지 생성 완료`)
        } catch (error) {
          console.warn(`작품 "${work.title}"의 연재 페이지 생성 실패:`, error)
          if (error instanceof Error) {
            console.warn('에러 메시지:', error.message)
          }
        }
      } catch (error) {
        console.error(`작품 ${work.id} (${work.title}) 동기화 실패:`, error)
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message)
          console.error('에러 스택:', error.stack)
        }
        // 에러가 발생해도 계속 진행
      }
    }
    console.log(`작품 동기화 완료: ${workPageMap.size}개 성공`)
    
    if (workPageMap.size === 0) {
      console.error('작품 동기화가 실패했습니다. 브라우저 콘솔의 에러 메시지를 확인해주세요.')
    }
  } else {
    console.error('작품 데이터베이스 ID가 없습니다.')
    return
  }

  // 2. 각 작품별로 하위 페이지 생성
  for (const work of data.works) {
    const workPageId = workPageMap.get(work.id)
    if (!workPageId) continue

    // 2-1. 시놉시스 페이지 생성 (작품 페이지 하위)
    const synopsis = data.synopses.find(s => s.workId === work.id)
    if (synopsis) {
      try {
        const structureJson = JSON.stringify(synopsis.structure)
        await client.pages.create({
          parent: { page_id: workPageId },
          properties: {
            title: {
              title: [{ text: { content: '시놉시스' } }],
            },
          },
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: structureJson },
                  },
                ],
              },
            },
          ],
        })
        console.log(`작품 "${work.title}"의 시놉시스 페이지 생성 완료`)
      } catch (error) {
        console.error(`작품 "${work.title}"의 시놉시스 페이지 생성 실패:`, error)
      }
    }

    // 2-2. 캐릭터 페이지들 생성 (작품 페이지 하위)
    const characters = data.characters.filter(c => c.workId === work.id)
    if (characters.length > 0) {
      try {
        const charactersPage = await client.pages.create({
          parent: { page_id: workPageId },
          properties: {
            title: {
              title: [{ text: { content: '캐릭터' } }],
            },
          },
        })
        
        // 각 캐릭터를 하위 페이지로 생성
        for (const character of characters) {
          try {
            await client.pages.create({
              parent: { page_id: charactersPage.id },
              properties: {
                title: {
                  title: [{ text: { content: character.name } }],
                },
              },
              children: [
                {
                  object: 'block',
                  type: 'paragraph',
                  paragraph: {
                    rich_text: [
                      {
                        type: 'text',
                        text: { content: character.description || '' },
                      },
                    ],
                  },
                },
              ],
            })
          } catch (error) {
            console.error(`캐릭터 "${character.name}" 페이지 생성 실패:`, error)
          }
        }
        console.log(`작품 "${work.title}"의 캐릭터 페이지 생성 완료 (${characters.length}개)`)
      } catch (error) {
        console.error(`작품 "${work.title}"의 캐릭터 페이지 생성 실패:`, error)
      }
    }

    // 2-3. 설정 페이지들 생성 (작품 페이지 하위)
    const settings = data.settings.filter(s => s.workId === work.id)
    if (settings.length > 0) {
      try {
        const settingsPage = await client.pages.create({
          parent: { page_id: workPageId },
          properties: {
            title: {
              title: [{ text: { content: '설정' } }],
            },
          },
        })
        
        // 각 설정을 하위 페이지로 생성
        for (const setting of settings) {
          try {
            await client.pages.create({
              parent: { page_id: settingsPage.id },
              properties: {
                title: {
                  title: [{ text: { content: setting.name } }],
                },
              },
              children: [
                {
                  object: 'block',
                  type: 'paragraph',
                  paragraph: {
                    rich_text: [
                      {
                        type: 'text',
                        text: { content: setting.description || '' },
                      },
                    ],
                  },
                },
              ],
            })
          } catch (error) {
            console.error(`설정 "${setting.name}" 페이지 생성 실패:`, error)
          }
        }
        console.log(`작품 "${work.title}"의 설정 페이지 생성 완료 (${settings.length}개)`)
      } catch (error) {
        console.error(`작품 "${work.title}"의 설정 페이지 생성 실패:`, error)
      }
    }

    // 2-4. 연재 페이지 내부에 장과 회차 생성
    const serialPageId = serialPageMap.get(work.id)
    if (serialPageId) {
      const chapters = data.chapters.filter(c => c.workId === work.id)
      
      // 장별로 그룹화하여 생성
      for (const chapter of chapters) {
        try {
          const chapterPage = await client.pages.create({
            parent: { page_id: serialPageId },
            properties: {
              title: {
                title: [{ text: { content: chapter.title } }],
              },
            },
          })
          chapterPageMap.set(chapter.id, chapterPage.id)
          
          // 해당 장의 회차들 생성
          const episodes = data.episodes.filter(e => e.chapterId === chapter.id)
          for (const episode of episodes) {
            try {
              await client.pages.create({
                parent: { page_id: chapterPage.id },
                properties: {
                  title: {
                    title: [{ text: { content: `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}` } }],
                  },
                },
                children: [
                  {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                      rich_text: [
                        {
                          type: 'text',
                          text: { content: episode.content.replace(/<[^>]*>/g, '') || '' },
                        },
                      ],
                    },
                  },
                ],
              })
            } catch (error) {
              console.error(`회차 ${episode.episodeNumber}화 페이지 생성 실패:`, error)
            }
          }
          console.log(`장 "${chapter.title}" 및 회차 ${episodes.length}개 생성 완료`)
        } catch (error) {
          console.error(`장 "${chapter.title}" 페이지 생성 실패:`, error)
        }
      }
      
      // 장이 없는 회차들도 생성
      const episodesWithoutChapter = data.episodes.filter(e => e.workId === work.id && !e.chapterId)
      for (const episode of episodesWithoutChapter) {
        try {
          await client.pages.create({
            parent: { page_id: serialPageId },
            properties: {
              title: {
                title: [{ text: { content: `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}` } }],
              },
            },
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: episode.content.replace(/<[^>]*>/g, '') || '' },
                    },
                  ],
                },
              },
            ],
          })
        } catch (error) {
          console.error(`회차 ${episode.episodeNumber}화 페이지 생성 실패:`, error)
        }
      }
    }
  }

  // 7. Tags 동기화 (태그는 작품과 직접 연결하지 않음)
  if (dbIds.tags) {
    console.log(`태그 ${data.tags.length}개 동기화 시작...`)
    let tagSuccessCount = 0
    for (const tag of data.tags) {
      try {
        await client.pages.create({
          parent: { database_id: dbIds.tags },
          properties: {
            '이름': {
              title: [{ text: { content: tag.name } }],
            },
            '카테고리': {
              rich_text: tag.categoryId ? [{ text: { content: tag.categoryId } }] : [],
            },
            '생성일': {
              date: tag.createdAt ? { start: tag.createdAt.toISOString() } : null,
            },
            '수정일': {
              date: tag.updatedAt ? { start: tag.updatedAt.toISOString() } : null,
            },
          },
        })
        tagSuccessCount++
        console.log(`태그 "${tag.name}" 동기화 완료`)
      } catch (error) {
        console.error(`태그 ${tag.id} (${tag.name}) 동기화 실패:`, error)
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message)
        }
      }
    }
    console.log(`태그 동기화 완료: ${tagSuccessCount}개 성공`)
  } else {
    console.warn('태그 데이터베이스 ID가 없습니다.')
  }

  console.log('노션 동기화 완료!')
  console.log('작품 페이지를 열면 연결된 시놉시스, 캐릭터, 설정, 장, 회차가 Relation 속성으로 표시됩니다.')
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

