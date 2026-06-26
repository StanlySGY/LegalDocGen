import { useEffect, useRef } from 'react'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
}

export default function Drawer({ open, title, onClose, children, width = 400 }: DrawerProps) {
  const maskRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) { document.addEventListener('keydown', handler); document.body.style.overflow = 'hidden' }
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div ref={maskRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, transition: 'opacity 0.3s' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width, maxWidth: '90vw', background: 'var(--bg-card, #fff)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 201, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted, #86909c)', padding: '4px 8px' }}>x</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </>
  )
}
