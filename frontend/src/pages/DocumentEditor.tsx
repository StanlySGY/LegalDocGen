import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'

type AIAction = { label: string; instruction: string }
const AI_ACTIONS: AIAction[] = [
  { label: '润色', instruction: '润色以下法律文书文本，使其更加专业、严谨、符合法律文书的行文规范，保持原意不变：' },
  { label: '补充法律依据', instruction: '为以下法律文书段落补充相关的法律依据（法律条文、司法解释等），在适当位置插入引用，保持原文结构：' },
  { label: '改写', instruction: '用不同的表述方式重新撰写以下法律文书段落，保持法律含义不变，但改善表达和逻辑：' },
  { label: '精简', instruction: '精简以下法律文书段落，删除冗余表述，保留核心法律论点，使文字更加简洁有力：' },
  { label: '展开论述', instruction: '展开以下法律文书段落，增加详细的事实分析、法律论证和逻辑推理，使论述更加充分：' },
]

export default function DocumentEditor() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [caseName, setCaseName] = useState('')
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // AI edit state
  const [selectedText, setSelectedText] = useState('')
  const [selRange, setSelRange] = useState<{start:number;end:number}|null>(null)
  const [toolbarPos, setToolbarPos] = useState<{x:number;y:number}|null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [customInstruction, setCustomInstruction] = useState('')
  const [showCompare, setShowCompare] = useState(false)

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

  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd)
    if (sel.length > 0) {
      setSelectedText(sel)
      setSelRange({ start: ta.selectionStart, end: ta.selectionEnd })
      const rect = ta.getBoundingClientRect()
      const lines = ta.value.substring(0, ta.selectionStart).split('\n')
      const lineHeight = 20
      const topOffset = lines.length * lineHeight - ta.scrollTop
      const x = rect.left + rect.width / 2
      const y = rect.top + Math.min(Math.max(topOffset - 40, 10), rect.height - 40)
      setToolbarPos({ x, y })
    } else {
      if (!aiLoading && !showCompare) {
        setSelectedText('')
        setToolbarPos(null)
        setSelRange(null)
      }
    }
  }, [aiLoading, showCompare])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  const handleAIEdit = async (instruction: string) => {
    if (!selectedText) return
    setAiLoading(true)
    setAiResult('')
    setShowCompare(true)
    try {
      const res = await api.workflow.aiEdit({ text: selectedText, instruction })
      setAiResult(res.result)
    } catch (e: any) {
      showToast(e.message || 'AI编辑失败', 'err')
      setShowCompare(false)
    }
    setAiLoading(false)
  }

  const handleAccept = () => {
    if (!selRange || !aiResult) return
    const newContent = content.substring(0, selRange.start) + aiResult + content.substring(selRange.end)
    setContent(newContent)
    setShowCompare(false)
    setAiResult('')
    setSelectedText('')
    setToolbarPos(null)
    setSelRange(null)
    showToast('已采纳AI修改')
  }

  const handleReject = () => {
    setShowCompare(false)
    setAiResult('')
  }

  const handleCustomEdit = () => {
    if (customInstruction.trim()) {
      handleAIEdit(customInstruction.trim())
      setCustomInstruction('')
    }
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
        <p style={{fontSize:12,color:'#86909c',marginTop:-8}}>选中文字后可使用 AI 辅助编辑（润色、补充法律依据、改写等）</p>
      </div>

      {/* Floating AI toolbar */}
      {toolbarPos && selectedText && !showCompare && (
        <div style={{
          position:'fixed', left: toolbarPos.x, top: toolbarPos.y,
          transform:'translateX(-50%)', zIndex:90,
          background:'#fff', borderRadius:10, padding:'6px 8px',
          boxShadow:'0 4px 20px rgba(0,0,0,0.15)', border:'1px solid #e5e7eb',
          display:'flex', alignItems:'center', gap:4, flexWrap:'wrap',
          maxWidth:420,
        }}>
          {AI_ACTIONS.map(a => (
            <button key={a.label} className="btn btn-sm" style={{
              background:'#f3f4f6', color:'#4f46e5', border:'none', fontSize:11, padding:'4px 10px', borderRadius:6,
            }} onClick={() => handleAIEdit(a.instruction)} disabled={aiLoading}>
              {a.label}
            </button>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:4,marginLeft:4,borderLeft:'1px solid #e5e7eb',paddingLeft:8}}>
            <input className="input" style={{width:120,fontSize:11,padding:'4px 8px',height:28}} placeholder="自定义指令..."
              value={customInstruction} onChange={e=>setCustomInstruction(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')handleCustomEdit()}}/>
            <button className="btn btn-sm btn-p" style={{fontSize:11,padding:'4px 8px',height:28}} onClick={handleCustomEdit} disabled={!customInstruction.trim()||aiLoading}>执行</button>
          </div>
        </div>
      )}

      {/* AI Compare Panel */}
      {showCompare && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
        }}>
          <div style={{
            background:'#fff', borderRadius:16, padding:24, width:'90%', maxWidth:900, maxHeight:'80vh',
            overflow:'auto', boxShadow:'0 24px 48px rgba(0,0,0,0.15)',
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:15,fontWeight:600}}>AI 修改建议</span>
              <button className="btn btn-o btn-sm" onClick={handleReject}>关闭</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div>
                <div style={{fontSize:12,color:'#86909c',marginBottom:8,fontWeight:600}}>原文</div>
                <div style={{background:'#f7f8fa',border:'1px solid #e5e7eb',borderRadius:8,padding:16,maxHeight:400,overflow:'auto'}}>
                  <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.7,fontFamily:'inherit',margin:0}}>{selectedText}</pre>
                </div>
              </div>
              <div>
                <div style={{fontSize:12,color:'#6366f1',marginBottom:8,fontWeight:600}}>AI 修改后</div>
                <div style={{background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:16,maxHeight:400,overflow:'auto'}}>
                  {aiLoading ? (
                    <div style={{display:'flex',alignItems:'center',gap:8,color:'#86909c',fontSize:13}}>
                      <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0110 10"/></svg>
                      AI 正在处理...
                    </div>
                  ) : (
                    <div className="md"><ReactMarkdown>{aiResult}</ReactMarkdown></div>
                  )}
                </div>
              </div>
            </div>
            {aiResult && !aiLoading && (
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
                <button className="btn btn-o" onClick={handleReject}>放弃修改</button>
                <button className="btn btn-p" onClick={handleAccept}>采纳修改</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 'calc(100vh - 260px)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#86909c', fontWeight: 600 }}>
            编辑区 <span style={{color:'#c9cdd4',fontWeight:400}}>| 选中文字后出现AI工具栏</span>
          </div>
          <textarea
            ref={textareaRef}
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
