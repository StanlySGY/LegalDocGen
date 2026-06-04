import { useState, useCallback, useRef } from 'react'

export type ToastType = 'ok' | 'err' | 'warning' | 'info'

export interface Toast {
  id: string
  msg: string
  type: ToastType
  duration?: number
}

interface ToastOptions {
  type?: ToastType
  duration?: number
}

const DEFAULT_DURATION = 3000

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((msg: string, options: ToastOptions = {}) => {
    const { type = 'ok', duration = DEFAULT_DURATION } = options
    const id = `toast-${++counterRef.current}-${Date.now()}`
    
    const newToast: Toast = { id, msg, type, duration }
    
    setToasts(prev => [...prev, newToast])
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    
    return id
  }, [removeToast])

  const success = useCallback((msg: string, duration?: number) => 
    showToast(msg, { type: 'ok', duration }), [showToast])
  
  const error = useCallback((msg: string, duration?: number) => 
    showToast(msg, { type: 'err', duration }), [showToast])
  
  const warning = useCallback((msg: string, duration?: number) => 
    showToast(msg, { type: 'warning', duration }), [showToast])
  
  const info = useCallback((msg: string, duration?: number) => 
    showToast(msg, { type: 'info', duration }), [showToast])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  return {
    toasts,
    showToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info
  }
}