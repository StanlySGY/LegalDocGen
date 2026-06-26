import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'

export default function DocumentEditor() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [caseName, setCaseName] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    if (!caseId) return
    api.cases.get(caseId).then(c => setCaseName(c.name)).catch(() => {})
    api.workflow.getNode(caseId, 'draft_generation').then(n => {
      if (n.output) setContent(n.output)
    }).catch(() => {})
    api.workflow.history(caseId, 'draft_generation').then(setHistory).catch(() => {})
  }, [caseId])

  const pushUndo = useCallback((val: string) => {
    setUndoStack(prev => [...prev.slice(-50), val])
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setRedoStack(r => [...r, content])
      setContent(last)
      return prev.slice(0, -1)
    })
  }, [content])

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setUndoStack(u => [...u, content])
      setContent(last)
      return prev.slice(0, -1)
    })
  }, [content])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  const handleSave = useCallback(async () => {
    if (!caseId) return
    setSaving(true)
    try {
      await api.workflow.saveOutput(caseId, 'draft_generation', content)
      showToast('已保存', { type: 'ok' })
    } catch (e: any) { showToast(e.message || '保存失败', { type: 'err' }) }
    setSaving(false)
  }, [caseId, content])

  const handleExport = useCallback(async () => {
    if (!caseId) return
    try { await api.workflow.export(caseId) } catch (e: any) { showToast(e.message || '导出失败', { type: 'err' }) }
  }, [caseId])

  return (
    <div style={{ padding: '16px 0' }}>
      <Toaster toasts={toasts} onRemove={removeToast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: '#86909c', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/cases')}>案件工作台</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${caseId}`)}>{caseName || '案件详情'}</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>文书编辑</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{caseName || '文书编辑'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-o btn-sm" onClick={handleUndo} disabled={undoStack.length === 0} title="撤销 Ctrl+Z">↩ 撤销</button>
          <button className="btn btn-o btn-sm" onClick={handleRedo} disabled={redoStack.length === 0} title="重做 Ctrl+Y">↪ 重做</button>
          <button className="btn btn-o btn-sm" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '💾 保存'}</button>
          <button className="btn btn-p btn-sm" onClick={handleExport}>📄 导出Word</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <textarea
            value={content}
            onChange={e => { pushUndo(content); setContent(e.target.value) }}
            placeholder="在此编辑文书内容..."
            style={{ width: '100%', minHeight: 600, padding: 20, fontSize: 14, lineHeight: 2, border: '1px solid #e5e7eb', borderRadius: 10, resize: 'vertical', fontFamily: "'Noto Serif SC', 'SimSun', serif" }}
          />
        </div>
        {history.length > 0 && (
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="card" style={{ padding: 16, position: 'sticky', top: 80 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>版本历史</div>
              {history.map((h, i) => (
                <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => { pushUndo(content); setContent(h.output) }}>
                  <div style={{ fontWeight: 600 }}>v{h.version}</div>
                  <div style={{ color: '#86909c', fontSize: 11 }}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                  <div style={{ color: '#86909c', fontSize: 11 }}>{h.model_used}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
