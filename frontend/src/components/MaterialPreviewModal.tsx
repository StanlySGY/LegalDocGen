import { useEffect, useCallback } from 'react'

interface MaterialPreviewModalProps {
  open: boolean
  title: string
  content: string
  onClose: () => void
}

export default function MaterialPreviewModal({ open, title, content, onClose }: MaterialPreviewModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box material-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <h3>{title}</h3>
          <button className="btn btn-o btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            关闭
          </button>
        </div>
        <div className="preview-content">
          <pre>{content || '暂无解析内容'}</pre>
        </div>
      </div>
    </div>
  )
}