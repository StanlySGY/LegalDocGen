import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import ConfirmDialog from '../components/ConfirmDialog'
import MaterialPreviewModal from '../components/MaterialPreviewModal'
import LoadingSpinner from '../components/LoadingSpinner'
import ReactMarkdown from 'react-markdown'
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, quotaUpgradeMessage } from '../services/api'
import MaterialChecklist from './MaterialChecklist'
import Drawer from '../components/Drawer'
import { getMaterialCompletion, type ChecklistItem } from '../services/materialMatcher'
import type { Case, Material, MaterialCatalogItem, CaseDeadline, CaseNote } from '../types'
import { DOCUMENT_TYPES } from '../types'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

const fileLabel = (type: string) => type === '.pdf' ? 'PDF' : type.startsWith('.doc') ? 'DOC' : 'IMG'
const isFailedStatus = (status: string) => status === 'failed' || status === 'error'
const statusLabel = (status: string) => {
  if (status === 'completed') return '已解析'
  if (status === 'pending' || status === 'parsing') return '解析中'
  return '解析失败'
}
const statusTag = (status: string) => status === 'completed' ? 't-green' : isFailedStatus(status) ? 't-red' : 't-orange'

export default function CaseDetail() {
  const { caseId: caseIdParam } = useParams<{ caseId: string }>()
  const caseId = caseIdParam!
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialInsights, setMaterialInsights] = useState<{catalog:MaterialCatalogItem[];timeline:any[]}>({ catalog: [], timeline: [] })
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loadingCase, setLoadingCase] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const { toasts, showToast, removeToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewMaterial, setPreviewMaterial] = useState<{open:boolean;filename:string;content:string}|null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerContent, setDrawerContent] = useState('')
  const [deadlines, setDeadlines] = useState<CaseDeadline[]>([])
  const [notes, setNotes] = useState<CaseNote[]>([])
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)
  const [deadlineForm, setDeadlineForm] = useState({ title: '', due_date: '', note: '' })
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteForm, setNoteForm] = useState({ title: '', content: '' })
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteForm, setEditNoteForm] = useState({ title: '', content: '' })
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>()

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoadingCase(true)
    try {
      const [c, m, insights, dl, nt] = await Promise.all([
        api.cases.get(caseId), api.materials.list(caseId), api.materials.catalog(caseId),
        api.cases.deadlines(caseId), api.cases.notes(caseId),
      ])
      const tpl = c.template_id ? await api.templates.get(c.template_id) : null
      setChecklist(tpl?.materials_checklist || [])
      setCaseData(c)
      setMaterials(m)
      setMaterialInsights({ catalog: insights.catalog || [], timeline: insights.timeline || [] })
      setDeadlines(dl)
      setNotes(nt)
      setLoadError('')
    } catch (e) {
      const message = e instanceof Error ? e.message : '案件加载失败'
      if (!silent) setLoadError(message)
      showToast(message, { type: 'err' })
    } finally {
      if (!silent) setLoadingCase(false)
    }
  }, [caseId, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasParsingMaterials = materials.some(m => m.parse_status === 'parsing' || m.parse_status === 'pending')
    
    if (hasParsingMaterials) {
      pollTimerRef.current = setInterval(() => {
        load(true)
      }, 5000)
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [materials, load])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const f of files) await api.materials.upload(caseId, f)
      await load(true)
      showToast(`已上传并解析 ${files.length} 个文件`)
    } catch (e) {
      await load(true)
      showToast(quotaUpgradeMessage(e) || (e instanceof Error ? e.message : '上传失败'), { type: 'err' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const openMaterialDrawer = async (materialId: string, filename: string) => {
    try {
      const preview = await api.materials.preview(materialId)
      setDrawerTitle(filename)
      setDrawerContent(preview.parsed_content || '（该文件暂无解析内容）')
      setDrawerOpen(true)
    } catch (e: any) {
      showToast(e.message || '加载预览失败', { type: 'err' })
    }
  }

  const del = async (id: string) => {
    const confirmed = await confirm({
      title: '删除材料',
      message: '确认删除该材料？删除后无法恢复。',
      variant: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    try {
      await api.materials.delete(id)
      await load(true)
      showToast('已删除')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', { type: 'err' })
    }
  }

  const openPreview = (filename: string, content: string) => {
    setPreviewMaterial({ open: true, filename, content })
  }

  const closePreview = () => {
    setPreviewMaterial(null)
  }

  const createDeadline = async () => {
    if (!deadlineForm.title.trim() || !deadlineForm.due_date) return showToast('请填写标题和截止日期', { type: 'err' })
    try {
      await api.cases.createDeadline(caseId, deadlineForm)
      setDeadlineForm({ title: '', due_date: '', note: '' })
      setShowDeadlineForm(false)
      await load(true)
      showToast('期限已添加')
    } catch (e: any) {
      showToast(e.message || '添加失败', { type: 'err' })
    }
  }

  const toggleDeadlineComplete = async (id: string, completed: boolean) => {
    try {
      await api.cases.updateDeadline(caseId, id, { is_completed: !completed })
      await load(true)
    } catch (e: any) {
      showToast(e.message || '更新失败', { type: 'err' })
    }
  }

  const deleteDeadline = async (id: string) => {
    try {
      await api.cases.deleteDeadline(caseId, id)
      await load(true)
      showToast('已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', { type: 'err' })
    }
  }

  const createNote = async () => {
    if (!noteForm.title.trim() && !noteForm.content.trim()) return showToast('请填写标题或内容', { type: 'err' })
    try {
      await api.cases.createNote(caseId, noteForm)
      setNoteForm({ title: '', content: '' })
      setShowNoteForm(false)
      await load(true)
      showToast('笔记已添加')
    } catch (e: any) {
      showToast(e.message || '添加失败', { type: 'err' })
    }
  }

  const toggleNotePin = async (id: string, pinned: boolean) => {
    try {
      await api.cases.updateNote(caseId, id, { pinned: !pinned })
      await load(true)
    } catch (e: any) {
      showToast(e.message || '更新失败', { type: 'err' })
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await api.cases.deleteNote(caseId, id)
      await load(true)
      showToast('已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', { type: 'err' })
    }
  }

  const startEditNote = (n: CaseNote) => {
    setEditingNoteId(n.id)
    setEditNoteForm({ title: n.title, content: n.content })
  }

  const saveEditNote = async () => {
    if (!editingNoteId) return
    try {
      await api.cases.updateNote(caseId, editingNoteId, editNoteForm)
      setEditingNoteId(null)
      await load(true)
      showToast('笔记已更新')
    } catch (e: any) {
      showToast(e.message || '更新失败', { type: 'err' })
    }
  }

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

  const materialCompletion = getMaterialCompletion(checklist, materials)
  const parsedCount = materials.filter(m=>m.parse_status==='completed').length
  const failedCount = materials.filter(m=>isFailedStatus(m.parse_status)).length
  const parsingCount = materials.filter(m=>m.parse_status==='parsing' || m.parse_status==='pending').length
  const hasTemplateGate = Boolean(caseData?.template_id && checklist.length > 0)
  const missingMaterialNames = materialCompletion.missingRequiredItems.slice(0, 4).map(({ item }) => item.name)

  const handleEnterWorkflow = () => {
    if (caseData?.template_id && materialCompletion.missingRequired > 0) {
      const missingNames = materialCompletion.missingRequiredItems.slice(0, 3).map(({ item }) => item.name).join('、')
      showToast(`仍缺少 ${materialCompletion.missingRequired} 项必需材料：${missingNames}`, { type: 'err' })
      return
    }
    navigate(`/cases/${caseId}/workflow`)
  }

  if (loadingCase && !caseData) return <LoadingSpinner text="加载案件信息..." />

  if (loadError && !caseData) {
    return (
      <div className="card auth-loading">
        <strong>案件加载失败</strong>
        <p style={{fontSize:12,color:'#86909c',marginTop:8}}>{loadError}</p>
        <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:14}}>
          <button className="btn btn-o btn-sm" onClick={() => navigate('/cases')}>返回案件列表</button>
          <button className="btn btn-p btn-sm" onClick={() => load()}>重试加载</button>
        </div>
      </div>
    )
  }

  if (!caseData) return null

  return (
    <div>
      <div className="case-detail-hero">
        <div>
          <div className="eyebrow">CASE MATERIAL CENTER</div>
          <div className="flex items-center gap-3" style={{flexWrap:'wrap'}}>
            <h2>{caseData.name}</h2>
            <span className={`tag ${caseData.status==='completed'?'t-green':caseData.status==='in_progress'?'t-orange':caseData.status==='archived'?'t-gray':'t-gray'}`}>
              {caseData.status==='completed'?'已完成':caseData.status==='in_progress'?'进行中':caseData.status==='archived'?'已归档':'草稿'}
            </span>
            {caseData.case_type && <span className="tag t-blue">{caseData.case_type}</span>}
            {caseData.document_type && <span className="tag t-purple">{DOCUMENT_TYPES[caseData.document_type] || caseData.document_type}</span>}
          </div>
          {caseData.description && <p className="text-sm-muted" style={{marginTop:8,lineHeight:1.8}}>{caseData.description}</p>}
          {parsingCount > 0 && (
            <div className="auto-poll-indicator">
              <span className="poll-dot"></span>
              <span>{parsingCount} 个材料正在解析中，自动刷新中...</span>
            </div>
          )}
          <div className="flex-wrap-sm" style={{marginTop:12}}>
            <span className="tag t-purple">个人文书写作</span>
            <span className="tag t-gray">先材料整理，再生成初稿，最后人工复核导出</span>
          </div>
        </div>
        <div className="case-detail-actions">
          <button className="btn btn-o" onClick={() => navigate('/cases')}>返回列表</button>
          {caseData.status === 'archived' ? (
            <button className="btn btn-o" onClick={async () => { await api.cases.unarchive(caseId); load() }}>解除归档</button>
          ) : (
            <>
              {(caseData.status === 'completed' || caseData.status === 'in_progress') && (
                <button className="btn btn-o" onClick={async () => { await api.cases.archive(caseId); load() }}>归档案件</button>
              )}
            </>
          )}
          <button className="btn btn-p" onClick={handleEnterWorkflow} disabled={caseData.status === 'archived'}>进入工作流</button>
        </div>
      </div>

      {caseData.status === 'archived' && (
        <div className="notice-card notice-info" style={{marginBottom:16}}>
          <div>
            <strong>案件已归档，处于只读模式</strong>
            <span>归档案件无法修改材料或生成内容。如需编辑，请先点击「解除归档」。</span>
            {caseData.archive_note && <span style={{marginTop:4,display:'block',fontSize:12}}>归档备注：{caseData.archive_note}</span>}
          </div>
        </div>
      )}

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">材料数量</div><div className="s-value">{materials.length}</div><div className="s-hint">已上传证据材料</div></div>
        <div className="stat-card s-green"><div className="s-label">已解析</div><div className="s-value">{parsedCount}</div><div className="s-hint">可用于 AI 上下文</div></div>
        <div className="stat-card s-orange"><div className="s-label">解析失败</div><div className="s-value">{failedCount}</div><div className="s-hint">需重新上传或人工处理</div></div>
        <div className="stat-card s-blue"><div className="s-label">齐备度</div><div className="s-value">{hasTemplateGate ? `${materialCompletion.completionPercent}%` : '-'}</div><div className="s-hint">模板必需材料匹配</div></div>
      </div>

      {hasTemplateGate && (
        <div className={`notice-card ${materialCompletion.missingRequired > 0 ? 'notice-warn' : 'notice-success'}`}>
          <div>
            <strong>材料齐备度：{materialCompletion.completedRequired}/{materialCompletion.requiredItems.length}</strong>
            <span>
              {materialCompletion.missingRequired > 0
                ? `缺失项：${missingMaterialNames.join('、')}${materialCompletion.missingRequired > missingMaterialNames.length ? '等' : ''}。建议补齐后再生成，降低事实缺漏风险。`
                : '必需材料已齐备，可以进入工作流；生成前仍建议核对页码引用和事实时间线。'}
            </span>
          </div>
        </div>
      )}

      {caseData.template_id && <MaterialChecklist caseId={caseId} templateId={caseData.template_id} />}

      <div className="evidence-grid">
        <div className="card">
          <div className="card-hd"><span className="card-title">证据材料目录</span><span className="tag t-purple">页码级引用</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:310,overflow:'auto'}}>
            {materialInsights.catalog.map((item, index) => (
              <div key={item.id || index} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:12,background:'#fafbfc'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <strong className="text-sm" style={{cursor:'pointer',color:'var(--primary)'}} onClick={()=>openMaterialDrawer(item.id, item.filename)}>{index + 1}. {item.filename}</strong>
                  <span className={`tag ${statusTag(item.parse_status)}`}>{statusLabel(item.parse_status)}</span>
                </div>
                <div style={{fontSize:11,color:'#4f46e5',marginTop:7,fontWeight:600}}>{item.citation || '页码未识别'}</div>
                <div style={{fontSize:12,color:'#64748b',marginTop:6,lineHeight:1.7}}>{item.excerpt || '暂无可解析内容'}</div>
              </div>
            ))}
            {materialInsights.catalog.length===0 && <div className="empty refined-empty p-md"><p>暂无证据目录，上传材料后自动生成</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><span className="card-title">材料事实时间线</span><span className="tag t-blue">自动识别</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:310,overflow:'auto'}}>
            {materialInsights.timeline.slice(0, 20).map((item, index) => (
              <div key={`${item.date}-${index}`} style={{borderLeft:'3px solid #6366f1',padding:'8px 0 8px 12px',background:'#f8fafc',borderRadius:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'#4f46e5'}}>{item.date}</div>
                <div style={{fontSize:12,lineHeight:1.7,marginTop:3}}>{item.event}</div>
                <div style={{fontSize:11,color:'#86909c',marginTop:3}}>来源：{item.source}</div>
              </div>
            ))}
            {materialInsights.timeline.length===0 && <div className="empty refined-empty p-md"><p>未识别到明确日期事实</p></div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div>
            <span className="card-title">案件材料</span>
            <p className="text-xs-desc">支持 PDF、Word、图片；上传后自动解析并写入证据目录。</p>
          </div>
        </div>
        <div className="material-upload-zone">
          <div>
            <strong>{uploading ? '正在上传并解析材料...' : '先上传关键材料，再进入文书生成'}</strong>
            <p>建议文件名包含材料类型，例如“合同”“流水”“通知书”，便于自动匹配清单、生成证据目录和页码引用。</p>
            <div className="material-upload-tips">
              <span>推荐命名：材料类型-日期-来源</span>
              <span>扫描件优先转为清晰 PDF 或图片</span>
              <span>先上传合同、付款流水、通知书等核心证据</span>
            </div>
          </div>
          <label className={`btn ${uploading?'btn-o':'btn-p'} btn-sm`} style={{cursor:'pointer'}}>
            {uploading ? '处理中...' : '+ 上传材料'}
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" hidden onChange={handleUpload} disabled={uploading}/>
          </label>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {materials.map(m => (
            <div key={m.id} className={`material-card ${isFailedStatus(m.parse_status) ? 'failed' : ''}`}>
              <div className="material-card-main">
                <span className="file-icon">{fileLabel(m.file_type)}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.filename}</div>
                  <div className="flex items-center gap-2" style={{marginTop:5,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:'#86909c'}}>{(m.file_size/1024).toFixed(1)} KB</span>
                    <span className={`tag ${statusTag(m.parse_status)}`}>{statusLabel(m.parse_status)}</span>
                    {m.parse_task_id && <span className="tag t-gray">任务 {m.parse_task_id.slice(0, 8)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-o btn-sm" onClick={()=>openPreview(m.filename, m.parsed_content)}>查看</button>
                <button className="btn btn-d btn-sm" onClick={()=>del(m.id)}>删除</button>
              </div>
              {isFailedStatus(m.parse_status) && (
                <div className="material-fix-hint">解析失败时可先查看任务号，删除后重新上传清晰 PDF/Word，或改传可复制文字版本。</div>
              )}
            </div>
          ))}
          {materials.length===0 && (
            <div className="empty refined-empty" style={{padding:'50px 16px'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p>暂无材料，先上传 PDF / Word / 图片文件</p>
              <span>建议从合同、付款流水、聊天记录、通知书等能支撑事实的材料开始。</span>
              <button className="btn btn-p btn-sm" onClick={() => fileRef.current?.click()}>上传第一份材料</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <span className="card-title">关键期限</span>
          <button className="btn btn-p btn-sm" onClick={() => setShowDeadlineForm(true)} disabled={caseData.status === 'archived'}>+ 添加期限</button>
        </div>
        {showDeadlineForm && (
          <div style={{padding:'12px 16px',background:'#f8fafc',borderRadius:8,marginBottom:12}}>
            <input className="input" placeholder="期限标题（如：提交答辩状）" value={deadlineForm.title} onChange={e => setDeadlineForm({ ...deadlineForm, title: e.target.value })} style={{marginBottom:8}} />
            <input className="input" type="date" value={deadlineForm.due_date} onChange={e => setDeadlineForm({ ...deadlineForm, due_date: e.target.value })} style={{marginBottom:8}} />
            <textarea className="textarea" placeholder="备注（可选）" value={deadlineForm.note} onChange={e => setDeadlineForm({ ...deadlineForm, note: e.target.value })} style={{height:60,marginBottom:8}} />
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-p btn-sm" onClick={createDeadline}>确认</button>
              <button className="btn btn-o btn-sm" onClick={() => setShowDeadlineForm(false)}>取消</button>
            </div>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {deadlines.map(d => (
            <div key={d.id} style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:d.is_completed?'#f0fdf4':'#fff'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={d.is_completed} onChange={() => toggleDeadlineComplete(d.id, d.is_completed)} />
                    <strong style={{textDecoration:d.is_completed?'line-through':'none',fontSize:13}}>{d.title}</strong>
                  </div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:4}}>截止：{d.due_date}</div>
                  {d.note && <div style={{fontSize:12,color:'#86909c',marginTop:4}}>{d.note}</div>}
                </div>
                <button className="btn btn-d btn-sm" onClick={() => deleteDeadline(d.id)}>删除</button>
              </div>
            </div>
          ))}
          {deadlines.length === 0 && <div className="empty refined-empty p-md"><p>暂无期限提醒</p></div>}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <span className="card-title">办案笔记</span>
          <button className="btn btn-p btn-sm" onClick={() => setShowNoteForm(true)} disabled={caseData.status === 'archived'}>+ 添加笔记</button>
        </div>
        {showNoteForm && (
          <div style={{padding:'12px 16px',background:'#f8fafc',borderRadius:8,marginBottom:12}}>
            <input className="input" placeholder="笔记标题" value={noteForm.title} onChange={e => setNoteForm({ ...noteForm, title: e.target.value })} style={{marginBottom:8}} />
            <textarea className="textarea" placeholder="笔记内容（支持 Markdown 格式）" value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} style={{height:120,marginBottom:8}} />
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="btn btn-p btn-sm" onClick={createNote}>确认</button>
              <button className="btn btn-o btn-sm" onClick={() => setShowNoteForm(false)}>取消</button>
              <span style={{fontSize:11,color:'#94a3b8'}}>支持 Markdown</span>
            </div>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {sortedNotes.map(n => (
            <div key={n.id} style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:n.pinned?'#fef3c7':'#fff'}}>
              {editingNoteId === n.id ? (
                <div>
                  <input className="input" value={editNoteForm.title} onChange={e => setEditNoteForm({ ...editNoteForm, title: e.target.value })} placeholder="标题" style={{marginBottom:8}} />
                  <textarea className="textarea" value={editNoteForm.content} onChange={e => setEditNoteForm({ ...editNoteForm, content: e.target.value })} style={{height:120,marginBottom:8}} />
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-p btn-sm" onClick={saveEditNote}>保存</button>
                    <button className="btn btn-o btn-sm" onClick={() => setEditingNoteId(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    {n.title && <strong style={{fontSize:13,display:'block',marginBottom:6}}>{n.pinned && '📌 '}{n.title}</strong>}
                    <div className="md" style={{fontSize:12,color:'#334155',lineHeight:1.7}}><ReactMarkdown>{n.content}</ReactMarkdown></div>
                    {n.updated_at && <div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>{new Date(n.updated_at).toLocaleString('zh-CN')}</div>}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button className="btn btn-o btn-sm" onClick={() => startEditNote(n)}>编辑</button>
                    <button className="btn btn-o btn-sm" onClick={() => toggleNotePin(n.id, n.pinned)}>{n.pinned ? '取消置顶' : '置顶'}</button>
                    <button className="btn btn-d btn-sm" onClick={() => deleteNote(n.id)}>删除</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {notes.length === 0 && <div className="empty refined-empty p-md"><p>暂无办案笔记，记录策略要点、沟通内容或庭审记录</p></div>}
        </div>
      </div>
      <Toaster toasts={toasts} onRemove={removeToast} />
      <MaterialPreviewModal
        open={previewMaterial?.open || false}
        title={previewMaterial?.filename || '材料预览'}
        content={previewMaterial?.content || ''}
        onClose={closePreview}
      />
      <Drawer open={drawerOpen} title={drawerTitle} onClose={() => setDrawerOpen(false)}>
        <div style={{ fontSize: 13, lineHeight: 2, whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>{drawerContent}</div>
      </Drawer>
      {dialogProps && <ConfirmDialog {...dialogProps} />}
    </div>
  )
}
