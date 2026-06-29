import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface CommandItem {
  id: string
  label: string
  description: string
  icon: string
  action: () => void
  category: string
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cases, setCases] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      api.cases.list().then(setCases).catch(() => setCases([]))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => i + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)) }
      if (e.key === 'Enter') { e.preventDefault(); filteredItems[selectedIndex]?.action() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selectedIndex])

  const staticItems: CommandItem[] = [
    { id: 'new-case', label: '新建案件', description: '创建新的法律案件', icon: '📋', action: () => { navigate('/cases'); onClose() }, category: '案件' },
    { id: 'goto-cases', label: '案件工作台', description: '查看所有案件', icon: '📂', action: () => { navigate('/cases'); onClose() }, category: '导航' },
    { id: 'goto-legal', label: '法条核验', description: '核验文书中的法条引用', icon: '📖', action: () => { navigate('/legal-articles'); onClose() }, category: '导航' },
    { id: 'goto-tasks', label: '后台任务', description: '查看材料解析任务', icon: '⚡', action: () => { navigate('/tasks'); onClose() }, category: '导航' },
    { id: 'goto-channels', label: 'AI 服务设置', description: '配置模型渠道', icon: '🤖', action: () => { navigate('/channels'); onClose() }, category: '导航' },
    { id: 'goto-config', label: 'Prompt 模板', description: '管理生成模板', icon: '📝', action: () => { navigate('/config'); onClose() }, category: '导航' },
    { id: 'goto-help', label: '使用教程', description: '查看操作指南', icon: '❓', action: () => { navigate('/help'); onClose() }, category: '导航' },
  ]

  const caseItems: CommandItem[] = cases.map(c => ({
    id: `case-${c.id}`,
    label: c.name,
    description: `${c.case_type || '未分类'} · ${c.status === 'completed' ? '已完成' : c.status === 'in_progress' ? '进行中' : '草稿'}`,
    icon: '📁',
    action: () => { navigate(`/cases/${c.id}`); onClose() },
    category: '案件',
  }))

  const allItems = [...caseItems, ...staticItems]
  const filteredItems = query.trim()
    ? allItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase()) || item.description.toLowerCase().includes(query.toLowerCase()))
    : allItems

  const grouped = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, CommandItem[]>)

  if (!open) return null

  return (
    <div className="modal-mask" style={{ zIndex: 500 }} onClick={onClose}>
      <div style={{ width: 520, maxHeight: 420, background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', marginTop: '-10vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }} placeholder="搜索案件、功能、操作..." style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: 'var(--text-main)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px', background: 'var(--bg-hover)', borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 340, overflow: 'auto', padding: '8px 0' }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{ padding: '6px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{category}</div>
              {items.map(item => {
                const idx = filteredItems.indexOf(item)
                return (
                  <div key={item.id} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: idx === selectedIndex ? 'var(--primary-light)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={item.action}>
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {filteredItems.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>无匹配结果</div>}
        </div>
      </div>
    </div>
  )
}
