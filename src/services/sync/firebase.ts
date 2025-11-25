import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { getFirebaseAuth, getFirebaseDB, googleProvider } from '@/config/firebase'
import type { Synopsis, Character, Setting } from '@/types'

// Firestore에 저장할 때 Date를 Timestamp로 변환
function toFirestore(data: any): any {
  if (data instanceof Date) {
    return Timestamp.fromDate(data)
  }
  if (Array.isArray(data)) {
    return data.map(toFirestore)
  }
  if (data && typeof data === 'object') {
    const result: any = {}
    for (const key in data) {
      if (key !== 'isDirty') {
        // isDirty는 클라이언트 전용이므로 제외
        result[key] = toFirestore(data[key])
      }
    }
    return result
  }
  return data
}

// Firestore에서 가져올 때 Timestamp를 Date로 변환
function fromFirestore(data: any): any {
  if (data instanceof Timestamp) {
    return data.toDate()
  }
  if (Array.isArray(data)) {
    return data.map(fromFirestore)
  }
  if (data && typeof data === 'object' && data !== null) {
    const result: any = {}
    for (const key in data) {
      result[key] = fromFirestore(data[key])
    }
    return result
  }
  return data
}

// 인증
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth()
  if (!auth) {
    throw new Error('Firebase가 설정되지 않았습니다. .env 파일에 Firebase 설정을 추가해주세요.')
  }
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth()
  if (!auth) return
  await signOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): (() => void) | null {
  const auth = getFirebaseAuth()
  if (!auth) return null
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth()
  if (!auth) return null
  return auth.currentUser
}

// 사용자별 컬렉션 경로
function getUserCollectionPath(collectionName: string, userId: string): string {
  return `users/${userId}/${collectionName}`
}

// Synopses 동기화
export async function syncSynopsesToCloud(
  synopses: Synopsis[],
  userId: string
): Promise<void> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const batch = writeBatch(db)
  const collectionPath = getUserCollectionPath('synopses', userId)

  synopses.forEach((synopsis) => {
    const docRef = doc(db, collectionPath, synopsis.id)
    const data = toFirestore({
      ...synopsis,
      syncedAt: new Date(),
    })
    batch.set(docRef, data)
  })

  await batch.commit()
}

export async function syncSynopsesFromCloud(userId: string): Promise<Synopsis[]> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const collectionPath = getUserCollectionPath('synopses', userId)
  const q = query(collection(db, collectionPath))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = fromFirestore(doc.data())
    return {
      ...data,
      id: doc.id,
    } as Synopsis
  })
}

// Characters 동기화
export async function syncCharactersToCloud(
  characters: Character[],
  userId: string
): Promise<void> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const batch = writeBatch(db)
  const collectionPath = getUserCollectionPath('characters', userId)

  characters.forEach((character) => {
    const docRef = doc(db, collectionPath, character.id)
    const data = toFirestore({
      ...character,
      syncedAt: new Date(),
    })
    batch.set(docRef, data)
  })

  await batch.commit()
}

export async function syncCharactersFromCloud(userId: string): Promise<Character[]> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const collectionPath = getUserCollectionPath('characters', userId)
  const q = query(collection(db, collectionPath))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = fromFirestore(doc.data())
    return {
      ...data,
      id: doc.id,
    } as Character
  })
}

// Settings 동기화
export async function syncSettingsToCloud(
  settings: Setting[],
  userId: string
): Promise<void> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const batch = writeBatch(db)
  const collectionPath = getUserCollectionPath('settings', userId)

  settings.forEach((setting) => {
    const docRef = doc(db, collectionPath, setting.id)
    const data = toFirestore({
      ...setting,
      syncedAt: new Date(),
    })
    batch.set(docRef, data)
  })

  await batch.commit()
}

export async function syncSettingsFromCloud(userId: string): Promise<Setting[]> {
  const db = getFirebaseDB()
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.')
  }
  const collectionPath = getUserCollectionPath('settings', userId)
  const q = query(collection(db, collectionPath))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = fromFirestore(doc.data())
    return {
      ...data,
      id: doc.id,
    } as Setting
  })
}

// 전체 동기화
export interface SyncResult {
  synopses: { uploaded: number; downloaded: number }
  characters: { uploaded: number; downloaded: number }
  settings: { uploaded: number; downloaded: number }
  conflicts: Array<{ type: string; id: string; local: Date; remote: Date }>
}

export async function syncAll(
  localData: {
    synopses: Synopsis[]
    characters: Character[]
    settings: Setting[]
  },
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    synopses: { uploaded: 0, downloaded: 0 },
    characters: { uploaded: 0, downloaded: 0 },
    settings: { uploaded: 0, downloaded: 0 },
    conflicts: [],
  }

  try {
    // 업로드 (변경된 것만)
    const synopsesToUpload = localData.synopses.filter((s) => s.isDirty)
    const charactersToUpload = localData.characters.filter((c) => c.isDirty)
    const settingsToUpload = localData.settings.filter((s) => s.isDirty)

    if (synopsesToUpload.length > 0) {
      await syncSynopsesToCloud(synopsesToUpload, userId)
      result.synopses.uploaded = synopsesToUpload.length
    }

    if (charactersToUpload.length > 0) {
      await syncCharactersToCloud(charactersToUpload, userId)
      result.characters.uploaded = charactersToUpload.length
    }

    if (settingsToUpload.length > 0) {
      await syncSettingsToCloud(settingsToUpload, userId)
      result.settings.uploaded = settingsToUpload.length
    }

    // 다운로드
    const cloudSynopses = await syncSynopsesFromCloud(userId)
    const cloudCharacters = await syncCharactersFromCloud(userId)
    const cloudSettings = await syncSettingsFromCloud(userId)

    result.synopses.downloaded = cloudSynopses.length
    result.characters.downloaded = cloudCharacters.length
    result.settings.downloaded = cloudSettings.length

    // 충돌 감지 (간단한 버전: 타임스탬프 비교)
    cloudSynopses.forEach((cloud) => {
      const local = localData.synopses.find((l) => l.id === cloud.id)
      if (local && local.updatedAt > cloud.updatedAt) {
        result.conflicts.push({
          type: 'synopsis',
          id: cloud.id,
          local: local.updatedAt,
          remote: cloud.updatedAt,
        })
      }
    })

    return result
  } catch (error) {
    console.error('동기화 실패:', error)
    throw error
  }
}

