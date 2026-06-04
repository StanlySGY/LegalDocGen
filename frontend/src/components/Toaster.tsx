import { type Toast, type ToastType } from '../hooks/useToast'

interface ToasterProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const typeStyles: Record<ToastType, string> = {
  ok: 'toast-ok',
  err: 'toast-err',
  warning: 'toast-warning',
  info: 'toast-info'
}

const typeIcons: Record<ToastType, string> = {
  ok: '✓',
  err: '✕',
  warning: '⚠',
  info: 'ℹ'
}

export default function Toaster({ toasts, onRemove }: ToasterProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toaster-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${typeStyles[toast.type]}`}
          onClick={() => onRemove(toast.id)}
        >
          <span className="toast-icon">{typeIcons[toast.type]}</span>
          <span className="toast-message">{toast.msg}</span>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); onRemove(toast.id) }}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}