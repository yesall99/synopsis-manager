import { useEffect } from 'react'
import { X, Loader2, Check, AlertCircle } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'

export default function Toast() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 bg-gray-900/90 dark:bg-gray-100/90 text-white dark:text-gray-900 rounded-lg shadow-lg backdrop-blur-sm min-w-[200px] max-w-[300px]"
        >
          {toast.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
          {toast.type === 'success' && <Check className="w-4 h-4 flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-sm flex-1">{toast.message}</span>
          {toast.dismissible && (
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

