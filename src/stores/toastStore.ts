import { create } from 'zustand'

export type ToastType = 'loading' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
  dismissible?: boolean
  duration?: number // ms, 0이면 자동으로 사라지지 않음
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, options?: { dismissible?: boolean; duration?: number }) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type, options = {}) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const toast: Toast = {
      id,
      message,
      type,
      dismissible: options.dismissible ?? (type !== 'loading'),
      duration: options.duration ?? (type === 'loading' ? 0 : 3000),
    }
    
    set((state) => ({ toasts: [...state.toasts, toast] }))
    
    // 자동 제거
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, toast.duration)
    }
    
    return id
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  clearToasts: () => {
    set({ toasts: [] })
  },
}))

