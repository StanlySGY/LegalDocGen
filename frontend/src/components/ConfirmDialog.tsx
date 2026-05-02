import { useEffect, useRef } from 'react'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { confirmRef.current?.focus() }, [])

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-o" onClick={onCancel}>取消</button>
          <button ref={confirmRef} className="btn btn-d" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  )
}
