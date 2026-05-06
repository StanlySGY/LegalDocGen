import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'
import type { Party, Material } from '../types'

type AIAction = { label: string; instruction: string }
const AI_ACTIONS: AIAction[] = [
  { label: '润色', instruction: '润色以下法律文书文本，使其更加专业、严谨、符合法律文书的行文规范，保持原意不变：' },
  { label: '核查法条', instruction: '请检查以下文本中引用的法律条文是否准确，是否存在虚构或过时的法条。逐条核实并给出修正建议：' },
  { label: '补充法律依据', instruction: '为以下法律文书段落补充相关的法律依据（法律条文、司法解释等），在适当位置插入引用，保持原文结构：' },
  { label: '改写', instruction: '用不同的表述方式重新撰写以下法律文书段落，保持法律含义不变，但改善表达和逻辑：' },
  { label: '精简', instruction: '精简以下法律文书段落，删除冗余表述，保留核心法律论点，使文字更加简洁有力：' },
  { label: '展开论述', instruction: '展开以下法律文书段落，增加详细的事实分析、法律论证和逻辑推理，使论述更加充分：' },
  { label: '对方律师挑刺', instruction: '假设你是对方代理律师，尝试找出以下法律文书段落中的逻辑漏洞、事实错误、法律适用不当之处，并提出质疑意见：' },
  { label: '法官风险评估', instruction: '假设你是主审法官，从裁判者的角度审视以下法律文书段落，指出可能被驳回或不利于我方的风险点，并给出改进建议：' },
]

type RefTab = 'parties' | 'materials' | 'analysis' | 'dispute'

function diffWords(oldStr: string, newStr: string): Array<{type: 'equal' | 'delete' | 'insert', text: string}> {
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(oldStr + newStr)
  const tokenize = (s: string) => hasCJK ? s.split('') : s.split(/(\s+)/)
  const oldWords = tokenize(oldStr)
  const newWords = tokenize(newStr)
  const m = oldWords.length, n = newWords.length
  const dp: number[][] = Array.from({length: m + 1}, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldWords[i-1] === newWords[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
    }
  }
  const ops: Array<{type: 'equal' | 'delete' | 'insert', text: string}> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
      ops.unshift({type: 'equal', text: oldWords[i-1]}); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({type: 'insert', text: newWords[j-1]}); j--
    } else {
      ops.unshift({type: 'delete', text: oldWords[i-1]}); i--
    }
  }
  return ops
}

export default function DocumentEditor() {
  const { id: caseId } = useParams<{ id: string }>()
  const [showHallucinationWarning, setShowHallucinationWarning] = useState(true)
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [caseName, setCaseName] = useState('')
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Undo stack
  const [undoStack, setUndoStack] = useState<string[]>([])
  const pushUndo = () => setUndoStack(prev => [...prev.slice(-50), content])
  const undo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setContent(prev)
    showToast('已撤销')
  }

  // AI edit state
  const [selectedText, setSelectedText] = useState('')
  const [selRange, setSelRange] = useState<{ start: number; end: number } | null>(null)
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [customInstruction, setCustomInstruction] = useState('')
  const [showCompare, setShowCompare] = useState(false)

  // Template state
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [showLoadTpl, setShowLoadTpl] = useState(false)
  const [savedTpls, setSavedTpls] = useState<any[]>([])
  const [showExportOpts, setShowExportOpts] = useState(false)
  const [exportOpts, setExportOpts] = useState({ fontSize: 16, margin: 'standard', preset: 'standard' })

  // Ref panel state
  const [refTab, setRefTab] = useState<RefTab>('parties')
  const [parties, setParties] = useState<Party[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [analysisText, setAnalysisText] = useState('')
  const [disputeText, setDisputeText] = useState('')

  useEffect(() => {
    if (!caseId) return
    api.cases.get(caseId).then(c => setCaseName(c.name))
    api.workflow.getNode(caseId, 'draft_generation').then((n: any) => {
      const text = n.output || ''
      setContent(text)
      setOriginal(text)
    })
    api.parties.list(caseId).then(setParties)
    api.materials.list(caseId).then(setMaterials)
    api.workflow.getNode(caseId, 'legal_analysis').then((n: any) => setAnalysisText(n.output || ''))
    api.workflow.getNode(caseId, 'dispute_focus').then((n: any) => setDisputeText(n.output || ''))
  }, [caseId])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (changed) handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!e.shiftKey) {
          e.preventDefault()
          undo()
        }
      }
      if (e.key === 'Escape') {
        if (showCompare) { setShowCompare(false); setAiResult('') }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [content, original, showCompare, undo])

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
    pushUndo()
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
        body: JSON.stringify({ content, font_size: exportOpts.fontSize, margin: exportOpts.margin, preset: exportOpts.preset }),
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
      setShowExportOpts(false)
    } catch (e: any) {
      showToast(e.message || '导出失败', 'err')
    }
  }

  const handleContentChange = (val: string) => {
    pushUndo()
    setContent(val)
  }

  const handleSaveTemplate = async () => {
    if (!tplName.trim()) return
    try {
      await api.templates.create({ name: tplName.trim(), document_type: '', content })
      setShowSaveTpl(false)
      setTplName('')
      showToast('已保存为模板')
    } catch (e: any) { showToast(e.message || '保存失败', 'err') }
  }

  const handleLoadTemplates = async () => {
    try {
      const tpls = await api.templates.list()
      setSavedTpls(tpls)
      setShowLoadTpl(true)
    } catch (e: any) { showToast(e.message || '加载失败', 'err') }
  }

  const handleApplyTemplate = (tpl: any) => {
    pushUndo()
    setContent(tpl.content)
    setShowLoadTpl(false)
    showToast('已应用模板')
  }

  const changed = content !== original

  const REF_TABS: { key: RefTab; label: string }[] = [
    { key: 'parties', label: '当事人' },
    { key: 'materials', label: '案件材料' },
    { key: 'analysis', label: '法律分析' },
    { key: 'dispute', label: '争议归纳' },
  ]

  return (
    <div>
      {showHallucinationWarning && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#92400e' }}>AI 可能编造不存在的法条和案例，提交法庭前请务必核实所有引用项</span>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#92400e' }} onClick={() => setShowHallucinationWarning(false)}>×</button>
        </div>
      )}
      <div className="breadcrumb mb-5">
        <a onClick={() => navigate('/cases')}>案件管理</a><span style={{ color:'var(--border)' }}>/</span>
        <a onClick={() => navigate(`/cases/${caseId}`)}>{caseName || '案件'}</a><span style={{ color:'var(--border)' }}>/</span>
        <span className="current">文书编辑</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <span className="card-title">文书编辑器</span>
          <div className="flex gap-2">
            {undoStack.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Ctrl+Z 撤销</span>}
            {changed && <span style={{ fontSize: 11, color: '#f59e0b', alignSelf: 'center' }}>未保存</span>}
            <button className="btn btn-o btn-sm" onClick={handleSave} disabled={saving || !changed}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button className="btn btn-o btn-sm" onClick={() => window.print()}>打印预览</button>
            <button className="btn btn-o btn-sm" onClick={handleLoadTemplates}>从模板创建</button>
            <button className="btn btn-o btn-sm" onClick={() => setShowSaveTpl(true)} disabled={!content}>保存为模板</button>
            <button className="btn btn-o btn-sm" onClick={() => setShowExportOpts(true)}>导出 Word</button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -8 }}>选中文字后可使用 AI 辅助编辑 | Ctrl+S 保存 | Ctrl+Z 撤销</p>
      </div>

      {/* Floating AI toolbar */}
      {toolbarPos && selectedText && !showCompare && (
        <div style={{
          position: 'fixed', left: toolbarPos.x, top: toolbarPos.y,
          transform: 'translateX(-50%)', zIndex: 90,
          background: 'var(--bg-card)', borderRadius: 10, padding: '6px 8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
          maxWidth: 420,
        }}>
          {AI_ACTIONS.map(a => (
            <button key={a.label} className="btn btn-sm" style={{
              background: 'var(--bg-secondary)', color: 'var(--accent-hover)', border: 'none', fontSize: 11, padding: '4px 10px', borderRadius: 6,
            }} onClick={() => handleAIEdit(a.instruction)} disabled={aiLoading}>
              {a.label}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
            <input className="input" style={{ width: 120, fontSize: 11, padding: '4px 8px', height: 28 }} placeholder="自定义指令..."
              value={customInstruction} onChange={e => setCustomInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomEdit() }} />
            <button className="btn btn-sm btn-p" style={{ fontSize: 11, padding: '4px 8px', height: 28 }} onClick={handleCustomEdit} disabled={!customInstruction.trim() || aiLoading}>执行</button>
          </div>
        </div>
      )}

      {showCompare && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 800, maxHeight: '80vh',
            overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>AI 修改建议（红线对比）</span>
              <button className="btn btn-o btn-sm" onClick={handleReject}>关闭</button>
            </div>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, maxHeight: 400, overflow: 'auto', lineHeight: 2, fontSize: 14 }}>
              {aiLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0110 10" /></svg>
                  AI 正在处理...
                </div>
              ) : aiResult ? (
                <div>
                  {diffWords(selectedText, aiResult).map((op, i) => {
                    if (op.type === 'equal') return <span key={i}>{op.text}</span>
                    if (op.type === 'delete') return <span key={i} style={{color: '#ef4444', textDecoration: 'line-through', background: '#fef2f2', padding: '0 2px', borderRadius: 2}}>{op.text}</span>
                    return <span key={i} style={{color: '#059669', textDecoration: 'underline', background: '#ecfdf5', padding: '0 2px', borderRadius: 2}}>{op.text}</span>
                  })}
                </div>
              ) : null}
            </div>
            {aiResult && !aiLoading && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-o" onClick={handleReject}>放弃修改</button>
                <button className="btn btn-p" onClick={handleAccept}>采纳修改</button>
              </div>
              
            )}
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div className="editor-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr 1fr', gap: 0, height: 'calc(100vh - 260px)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card)' }}>
        {/* Left: Reference Panel */}
        <div className="ref-panel" style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {REF_TABS.map(t => (
              <div key={t.key} style={{
                flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                color: refTab === t.key ? '#6366f1' : '#86909c', borderBottom: refTab === t.key ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s',
              }} onClick={() => setRefTab(t.key)}>{t.label}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12, fontSize: 12, lineHeight: 1.7 }}>
            {refTab === 'parties' && (
              parties.length > 0 ? parties.map(p => (
                <div key={p.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}
                    {p.role && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>{p.role}</span>}
                  </div>
                  {p.id_number && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>证件：{p.id_number}</div>}
                  {p.address && <div style={{ color: 'var(--text-secondary)' }}>住址：{p.address}</div>}
                  {p.phone && <div style={{ color: 'var(--text-secondary)' }}>电话：{p.phone}</div>}
                </div>
              )) : <div style={{ color: '#c9cdd4', textAlign: 'center', padding: 20 }}>暂无当事人信息 — 请先在案件详情页添加</div>
            )}
            {refTab === 'materials' && (
              materials.length > 0 ? materials.map(m => (
                <div key={m.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 500 }}>{m.filename}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                    {m.parsed_content?.slice(0, 300)}{m.parsed_content?.length > 300 ? '...' : ''}
                  </div>
                </div>
              )) : <div style={{ color: '#c9cdd4', textAlign: 'center', padding: 20 }}>暂无案件材料 — 请先在案件详情页上传</div>
            )}
            {refTab === 'analysis' && (
              analysisText ? <div className="md" style={{ fontSize: 12 }}>{<ReactMarkdown>{analysisText}</ReactMarkdown>}</div>
                : <div style={{ color: '#c9cdd4', textAlign: 'center', padding: 20 }}>暂无法律分析 — 请先执行"法律分析"步骤</div>
            )}
            {refTab === 'dispute' && (
              disputeText ? <div className="md" style={{ fontSize: 12 }}>{<ReactMarkdown>{disputeText}</ReactMarkdown>}</div>
                : <div style={{ color: '#c9cdd4', textAlign: 'center', padding: 20 }}>暂无争议归纳 — 请先执行"争议归纳"步骤</div>
            )}
          </div>
        </div>

        {/* Center: Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            编辑区 <span style={{ color: '#c9cdd4', fontWeight: 400 }}>| 选中文字后出现AI工具栏</span>
          </div>
          <textarea
            ref={textareaRef}
            className="textarea"
            style={{ flex: 1, border: 'none', borderRadius: 0, resize: 'none', minHeight: 0 }}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
          />
        </div>

        {/* Right: Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            实时预览
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div className="md"><ReactMarkdown>{content}</ReactMarkdown></div>
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTpl && (
        <div className="modal-mask" onClick={() => setShowSaveTpl(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>保存为模板</h3>
            <input className="input" placeholder="输入模板名称" value={tplName} onChange={e => setTplName(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-o" onClick={() => setShowSaveTpl(false)}>取消</button>
              <button className="btn btn-p" onClick={handleSaveTemplate}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Modal */}
      {showLoadTpl && (
        <div className="modal-mask" onClick={() => setShowLoadTpl(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3>从模板创建</h3>
            {savedTpls.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedTpls.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.content?.slice(0, 80)}...</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-p btn-sm" onClick={() => handleApplyTemplate(t)}>应用</button>
                      <button className="btn btn-d btn-sm" onClick={async () => {
                        await api.templates.delete(t.id)
                        setSavedTpls(tpls => tpls.filter(x => x.id !== t.id))
                      }}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: 30 }}><p>暂无已保存的模板</p></div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-o" onClick={() => setShowLoadTpl(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showExportOpts && (
        <div className="modal-mask" onClick={() => setShowExportOpts(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>导出 Word 设置</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>正文字号</label>
                <select className="select" value={exportOpts.fontSize} onChange={e => setExportOpts({ ...exportOpts, fontSize: Number(e.target.value) })}>
                  <option value={14}>小四号 (14pt)</option>
                  <option value={16}>四号 (16pt)</option>
                  <option value={18}>小三号 (18pt)</option>
                  <option value={22}>三号 (22pt)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>页边距</label>
                <select className="select" value={exportOpts.margin} onChange={e => setExportOpts({ ...exportOpts, margin: e.target.value })}>
                  <option value="narrow">窄 (2cm)</option>
                  <option value="standard">标准 (法院格式)</option>
                  <option value="wide">宽 (4cm)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>排版预设</label>
                <select className="select" value={exportOpts.preset} onChange={e => setExportOpts({ ...exportOpts, preset: e.target.value })}>
                  <option value="standard">标准排版</option>
                  <option value="court_strict">法院严格格式（方正小标宋/仿宋_GB2312/28磅行距）</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-o" onClick={() => setShowExportOpts(false)}>取消</button>
              <button className="btn btn-p" onClick={handleExport}>导出</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
