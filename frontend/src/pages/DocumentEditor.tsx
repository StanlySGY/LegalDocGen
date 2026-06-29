import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'

const aiActions = [
  { label: '润色', instruction: '请润色以下文字，使其更专业、严谨，保持法律文书风格' },
  { label: '补充法条', instruction: '请为以下内容补充相关法律条文引用' },
  { label: '改写', instruction: '请改写以下内容，保持含义不变但使用不同表达方式' },
  { label: '精简', instruction: '请精简以下内容，去除冗余，保留核心信息' },
  { label: '对方挑刺', instruction: '你是对方律师，请从对方视角找出以下内容的逻辑漏洞和证据短板' },
]

export default function DocumentEditor() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [caseName, setCaseName] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnnotation, setAiAnnotation] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    if (!caseId) return
    api.cases.get(caseId).then(c => setCaseName(c.name)).catch(() => {})
    api.workflow.getNode(caseId, 'draft_generation').then(n => { if (n.output) setContent(n.output) }).catch(() => {})
    api.workflow.history(caseId, 'draft_generation').then(setHistory).catch(() => {})
  }, [caseId])

  const pushUndo = useCallback((val: string) => { setUndoStack(prev => [...prev.slice(-50), val]); setRedoStack([]) }, [])

  const handleUndo = useCallback(() => {
    setUndoStack(prev => { if (!prev.length) return prev; const last = prev[prev.length - 1]; setRedoStack(r => [...r, content]); setContent(last); return prev.slice(0, -1) })
  }, [content])

  const handleRedo = useCallback(() => {
    setRedoStack(prev => { if (!prev.length) return prev; const last = prev[prev.length - 1]; setUndoStack(u => [...u, content]); setContent(last); return prev.slice(0, -1) })
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
    if (!caseId) return; setSaving(true)
    try { await api.workflow.saveOutput(caseId, 'draft_generation', content); showToast('已保存', { type: 'ok' }) }
    catch (e: any) { showToast(e.message || '保存失败', { type: 'err' }) }
    setSaving(false)
  }, [caseId, content])

  const handleExport = useCallback(async () => {
    if (!caseId) return
    try { await api.workflow.export(caseId) } catch (e: any) { showToast(e.message || '导出失败', { type: 'err' }) }
  }, [caseId])

  const handleAiAction = useCallback(async (instruction: string) => {
    const text = selectedText || content
    if (!text.trim()) return showToast('请先选中文字或确保有内容', { type: 'err' })
    setAiLoading(true); setAiAnnotation('')
    try { const result = await api.workflow.aiEdit({ text, instruction }); setAiAnnotation(result.result) }
    catch (e: any) { showToast(e.message || 'AI操作失败', { type: 'err' }) }
    setAiLoading(false)
  }, [selectedText, content])

  const handleApplyAiResult = useCallback(() => {
    if (!aiAnnotation) return
    if (selectedText) { setContent(content.replace(selectedText, aiAnnotation)) } else { setContent(aiAnnotation) }
    setAiAnnotation(''); showToast('已应用AI结果')
  }, [aiAnnotation, selectedText, content])

  const handleToolbarAction = useCallback((prefix: string, suffix: string) => {
    const textarea = document.querySelector('.doc-textarea') as HTMLTextAreaElement
    if (!textarea) return
    const s = textarea.selectionStart, e = textarea.selectionEnd
    setContent(content.substring(0, s) + prefix + (content.substring(s, e) || '文本') + suffix + content.substring(e))
  }, [content])

  return (
    <div style={{ padding: '16px 0' }}>
      <Toaster toasts={toasts} onRemove={removeToast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: '#86909c', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/cases')}>案件工作台</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/cases/' + caseId)}>{caseName || '案件详情'}</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>文书编辑</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{caseName || '文书编辑'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-o btn-sm" onClick={handleUndo} disabled={undoStack.length === 0}>撤销</button>
          <button className="btn btn-o btn-sm" onClick={handleRedo} disabled={redoStack.length === 0}>重做</button>
          <button className="btn btn-o btn-sm" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          <button className="btn btn-p btn-sm" onClick={handleExport}>导出Word</button>
          <button className={`btn btn-sm ${showPreview ? 'btn-p' : 'btn-o'}`} onClick={() => setShowPreview(!showPreview)}>{showPreview ? '编辑模式' : '预览模式'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: showPreview ? 1 : undefined, width: showPreview ? undefined : '100%' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#86909c', marginRight: 4 }}>格式：</span>
            <button className="btn btn-o" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleToolbarAction('**', '**')}>B</button>
            <button className="btn btn-o" style={{ fontSize: 11, padding: '2px 8px', fontStyle: 'italic' }} onClick={() => handleToolbarAction('*', '*')}>I</button>
            <button className="btn btn-o" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleToolbarAction('\n## ', '\n')}>H</button>
            <button className="btn btn-o" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleToolbarAction('\n- ', '\n')}>L</button>
            <span style={{ width: 1, height: 16, background: '#e5e7eb', margin: '0 4px' }} />
            <span style={{ fontSize: 11, color: '#86909c', marginRight: 4 }}>AI：</span>
            {aiActions.map(a => (
              <button key={a.label} className="ai-assist-btn" onClick={() => handleAiAction(a.instruction)} disabled={aiLoading}>
                {aiLoading ? '...' : a.label}
              </button>
            ))}
          </div>
          <textarea
            className="doc-textarea"
            value={content}
            onChange={e => { pushUndo(content); setContent(e.target.value) }}
            onSelect={e => { const el = e.target as HTMLTextAreaElement; setSelectedText(el.value.substring(el.selectionStart, el.selectionEnd)) }}
            placeholder="在此编辑文书内容..."
            style={{ width: '100%', minHeight: 600, padding: 20, fontSize: 14, lineHeight: 2, border: '1px solid #e5e7eb', borderRadius: 10, resize: 'vertical', fontFamily: 'Noto Serif SC, SimSun, serif' }}
          />
          {aiAnnotation && (
            <div style={{ marginTop: 12, padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>AI 建议结果</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-p btn-sm" onClick={handleApplyAiResult}>应用到文书</button>
                  <button className="btn btn-o btn-sm" onClick={() => setAiAnnotation('')}>取消</button>
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#166534' }}>{aiAnnotation}</div>
            </div>
          )}
        </div>
        {showPreview && (
          <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto', padding: 20, background: '#f8fafc', minHeight: 600 }}>
            <div style={{ fontSize: 11, color: '#86909c', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>实时预览</div>
            <div className="md legal-prose"><ReactMarkdown>{content || '（开始编辑后这里会显示排版预览）'}</ReactMarkdown></div>
          </div>
        )}
        {history.length > 0 && (
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="card" style={{ padding: 16, position: 'sticky', top: 80 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>版本历史</div>
              {history.map((h) => (
                <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }} onClick={() => { pushUndo(content); setContent(h.output) }}>
                  <div style={{ fontWeight: 600 }}>v{h.version}</div>
                  <div style={{ color: '#86909c', fontSize: 11 }}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
