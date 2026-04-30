import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'

export default function DocumentEditor() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [caseName, setCaseName] = useState('')
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    if (!caseId) return
    api.cases.get(caseId).then(c => setCaseName(c.name))
    api.workflow.getNode(caseId, 'draft_generation').then((n: any) => {
      const text = n.output || ''
      setContent(text)
      setOriginal(text)
    })
  }, [caseId])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async () => {
    if (!caseId) return
    setSaving(true)
    try {
      await api.workflow.saveOutput(caseId, 'draft_generation', content)
      setOriginal(content)
      showToast('已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', 'err')
    }
    setSaving(false)
  }

  const handleExport = async () => {
    if (!caseId) return
    try {
      const res = await fetch(`/api/workflow/export/${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('导出失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${caseName || '文书'}.docx`
      a.click()
      URL.revokeObjectURL(url)
      showToast('已导出')
    } catch (e: any) {
      showToast(e.message || '导出失败', 'err')
    }
  }

  const changed = content !== original

  return (
    <div>
      <div className="breadcrumb mb-5">
        <a onClick={() => navigate('/cases')}>案件管理</a><span style={{ color: '#d1d5db' }}>/</span>
        <a onClick={() => navigate(`/cases/${caseId}`)}>{caseName || '案件'}</a><span style={{ color: '#d1d5db' }}>/</span>
        <span className="current">文书编辑</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <span className="card-title">文书编辑器</span>
          <div className="flex gap-2">
            {changed && <span style={{ fontSize: 11, color: '#f59e0b', alignSelf: 'center' }}>未保存</span>}
            <button className="btn btn-o btn-sm" onClick={handleSave} disabled={saving || !changed}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button className="btn btn-p btn-sm" onClick={handleExport}>导出 Word</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 'calc(100vh - 220px)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#86909c', fontWeight: 600 }}>
            Markdown 源码
          </div>
          <textarea
            className="textarea"
            style={{ flex: 1, border: 'none', borderRadius: 0, resize: 'none', minHeight: 0 }}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#86909c', fontWeight: 600 }}>
            实时预览
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div className="md"><ReactMarkdown>{content}</ReactMarkdown></div>
          </div>
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
