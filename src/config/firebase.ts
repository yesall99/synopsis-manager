import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase 설정
// 사용자가 Firebase 프로젝트를 생성한 후 이 값들을 채워넣어야 합니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// Firebase 설정이 있는지 확인
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  )
}

// Firebase 초기화
let app: ReturnType<typeof initializeApp> | null = null
let auth: ReturnType<typeof getAuth> | null = null
let db: ReturnType<typeof getFirestore> | null = null
let initError: Error | null = null

export function initFirebase() {
  if (!isFirebaseConfigured()) {
    return null
  }

  if (app) return { app, auth, db }
  if (initError) {
    throw initError
  }

  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)

    return { app, auth, db }
  } catch (error) {
    initError = error instanceof Error ? error : new Error('Firebase 초기화 실패')
    console.warn('Firebase 초기화 실패 (선택적 기능):', error)
    return null
  }
}

export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) {
    return null
  }
  if (!auth) {
    const result = initFirebase()
    if (!result) return null
  }
  return auth
}

export function getFirebaseDB() {
  if (!isFirebaseConfigured()) {
    return null
  }
  if (!db) {
    const result = initFirebase()
    if (!result) return null
  }
  return db
}

export const googleProvider = new GoogleAuthProvider()

