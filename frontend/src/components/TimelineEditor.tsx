import { useState } from 'react'

interface TimelineEvent {
  date: string
  description: string
}

interface Props {
  events: TimelineEvent[]
  onChange?: (events: TimelineEvent[]) => void
  editable?: boolean
}

export default function TimelineEditor({ events, onChange, editable = false }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditDate(sorted[idx].date)
    setEditDesc(sorted[idx].description)
  }

  const saveEdit = () => {
    if (editingIdx === null || !onChange) return
    const updated = sorted.map((e, i) => i === editingIdx ? { date: editDate, description: editDesc } : e)
    onChange(updated)
    setEditingIdx(null)
  }

  const addEvent = () => {
    if (!onChange) return
    onChange([...sorted, { date: new Date().toISOString().slice(0, 10), description: '新事件' }])
  }

  const removeEvent = (idx: number) => {
    if (!onChange) return
    onChange(sorted.filter((_, i) => i !== idx))
  }

  return (
    <div className="timeline-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>📅 事实时间线</div>
        {editable && <button className="btn btn-o btn-sm" onClick={addEvent}>+ 添加节点</button>}
      </div>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--primary)', borderRadius: 1 }} />
        {sorted.map((event, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: 16, paddingLeft: 16 }}>
            <div style={{ position: 'absolute', left: -17, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', border: '2px solid #fff', boxShadow: '0 0 0 2px var(--primary)' }} />
            {editingIdx === i ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ width: 140, fontSize: 12 }} />
                <input className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                <button className="btn btn-p btn-sm" onClick={saveEdit}>保存</button>
                <button className="btn btn-o btn-sm" onClick={() => setEditingIdx(null)}>取消</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: editable ? 'pointer' : 'default' }} onClick={() => editable && startEdit(i)}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{event.date}</span>
                <span style={{ fontSize: 13, color: 'var(--text-main)' }}>{event.description}</span>
                {editable && (
                  <button className="btn btn-o" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); removeEvent(i) }}>×</button>
                )}
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>暂无时间节点</div>}
      </div>
    </div>
  )
}
