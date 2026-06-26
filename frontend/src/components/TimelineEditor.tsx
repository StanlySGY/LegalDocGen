import { useState } from 'react'

interface TimelineEvent {
  id: string
  date: string
  description: string
  source?: string
}

interface Props {
  events: TimelineEvent[]
  onChange: (events: TimelineEvent[]) => void
  readOnly?: boolean
}

export default function TimelineEditor({ events, onChange, readOnly = false }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

  const update = (id: string, patch: Partial<TimelineEvent>) => {
    onChange(events.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  const addEvent = () => {
    const today = new Date().toISOString().slice(0, 10)
    onChange([...events, { id: crypto.randomUUID(), date: today, description: '' }])
  }

  const remove = (id: string) => {
    if (confirm('确定删除此时间节点？')) {
      onChange(events.filter(e => e.id !== id))
    }
  }

  if (events.length === 0 && readOnly) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>暂无时间线</div>
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border)', borderRadius: 1 }} />

      {sorted.map((ev) => (
        <div key={ev.id} style={{ position: 'relative', marginBottom: 16, paddingLeft: 24 }}>
          <div style={{
            position: 'absolute', left: -4, top: 6, width: 16, height: 16,
            borderRadius: '50%', background: editingId === ev.id ? 'var(--accent)' : 'var(--border)',
            border: '3px solid var(--bg-card)', zIndex: 1,
          }} />

          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              {editingId === ev.id ? (
                <input
                  type="date"
                  className="input"
                  style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                  value={ev.date}
                  onChange={e => update(ev.id, { date: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  autoFocus
                />
              ) : (
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', cursor: readOnly ? 'default' : 'pointer' }}
                  onClick={() => !readOnly && setEditingId(ev.id)}
                >
                  {ev.date}
                </span>
              )}
              {!readOnly && (
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px' }}
                  onClick={() => remove(ev.id)}
                >×</button>
              )}
            </div>

            {readOnly ? (
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>{ev.description}</p>
            ) : (
              <textarea
                className="textarea"
                style={{ width: '100%', minHeight: 40, fontSize: 13, border: 'none', background: 'transparent', padding: 0, resize: 'vertical' }}
                value={ev.description}
                onChange={e => update(ev.id, { description: e.target.value })}
                placeholder="输入事件描述..."
              />
            )}

            {ev.source && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                来源: {ev.source}
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          className="btn btn-o btn-sm"
          style={{ marginLeft: 24, marginTop: 4 }}
          onClick={addEvent}
        >
          + 添加时间节点
        </button>
      )}

      {events.length === 0 && !readOnly && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          暂无时间线，请在案件梳理阶段生成或手动添加
        </div>
      )}
    </div>
  )
}
