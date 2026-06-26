import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Case, DocumentTypeOption } from '../types'
import { STAGE_NAMES_LAWYER } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'

const CASE_TYPES = ['合同纠纷', '劳动争议', '婚姻家庭', '侵权责任', '知识产权', '公司事务', '房产纠纷', '债权债务', '刑事辩护', '行政纠纷', '其他']

const TYPE_COLORS: Record<string, string> = {
  '合同纠纷': '#6366f1', '劳动争议': '#f59e0b', '婚姻家庭': '#ec4899',
  '侵权责任': '#ef4444', '知识产权': '#3b82f6', '公司事务': '#10b981',
  '房产纠纷': '#8b5cf6', '债权债务': '#f97316', '刑事辩护': '#dc2626',
  '行政纠纷': '#0ea5e9', '其他': '#86909c',
}

export default function CaseList() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<Case[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', case_type: '', case_number: '', court: '', cause: '', filing_date: '' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [showBatchConfirm, setShowBatchConfirm] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  // Debounced search to minimize API calls
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Batch state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showQuick, setShowQuick] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [quickDocType, setQuickDocType] = useState('')
  const [docTypes, setDocTypes] = useState<DocumentTypeOption[]>([])
  const [quickGenerating, setQuickGenerating] = useState(false)
  const [quickProgress, setQuickProgress] = useState(0)
  const [quickStage, setQuickStage] = useState('')

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = () => api.cases.list({status:filterStatus, keyword:debouncedSearch, case_type:filterType}).then(setCases)
  useEffect(() => { load() }, [debouncedSearch, filterStatus, filterType])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { api.config.getDocumentTypes().then(d => { setDocTypes(d.types); if(d.types.length) setQuickDocType(d.types[0].key) }) }, [])

  const handleQuickGenerate = async () => {
    if (!quickText.trim()) { showToast('请粘贴案情描述', 'err'); return }
    if (!quickDocType) { showToast('请选择文书类型', 'err'); return }
    setQuickGenerating(true); setQuickProgress(0); setQuickStage('创建案件...')
    try {
      const c = await api.cases.create({ name: quickText.slice(0, 30).replace(/\n/g, ' ') || '极速生成案件', description: quickText })
      setQuickStage('上传材料...')
      const blob = new Blob([quickText], { type: 'text/plain' })
      const file = new File([blob], '案情描述.txt', { type: 'text/plain' })
      await api.materials.upload(c.id, file)
      setQuickStage('开始生成文书...')
      for await (const event of api.workflow.quickGenerate(c.id, { document_type: quickDocType })) {
        if (event.error) { showToast(event.error, 'err'); setQuickGenerating(false); return }
        if (event.status === 'running') { setQuickStage(event.name || STAGE_NAMES_LAWYER[event.stage] || event.stage); setQuickProgress(event.progress) }
        if (event.status === 'done') { setQuickProgress(event.progress) }
        if (event.done) { setQuickProgress(100); showToast('文书生成完成'); setShowQuick(false); navigate(`/cases/${c.id}`) }
      }
    } catch (e: any) { showToast(e.message || '生成失败', 'err') }
    setQuickGenerating(false)
  }

  const create = async () => {
    if (!form.name.trim()) { showToast('请填写案件名称','err'); return }
    const c = await api.cases.create(form)
    setForm({ name: '', description: '', case_type: '', case_number: '', court: '', cause: '', filing_date: '' })
    setShowCreate(false)
    navigate(`/cases/${c.id}`)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (selected.size === cases.length) setSelected(new Set())
    else setSelected(new Set(cases.map(c => c.id)))
  }
  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    await api.cases.batchDelete(Array.from(selected))
    setSelected(new Set())
    setShowBatchConfirm(false)
    load()
    showToast(`已删除 ${selected.size} 个案件`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--text-primary)'}}>案件管理</h2>
          <p style={{fontSize:13,color:'var(--text-secondary)',marginTop:4}}>管理和组织您的法律案件</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-o" onClick={() => setShowQuick(true)}>
            ⚡ 极速生成
          </button>
          <button className="btn btn-p" onClick={() => setShowCreate(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建案件
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">总案件数</div><div className="s-value">{cases.length}</div></div>
        <div className="stat-card s-blue"><div className="s-label">进行中</div><div className="s-value">{cases.filter(c=>c.status==='in_progress').length}</div></div>
        <div className="stat-card s-green"><div className="s-label">已完成</div><div className="s-value">{cases.filter(c=>c.status==='completed').length}</div></div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:16,padding:'12px 16px'}}>
        <div className="flex items-center gap-3" style={{flexWrap:'wrap'}}>
          <input className="input" style={{width:200}} placeholder="搜索案件名称、案号、案由..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="select" style={{width:120}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
          <select className="select" style={{width:120}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="">全部类型</option>
            {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {selected.size > 0 && (
            <button className="btn btn-d btn-sm" onClick={() => setShowBatchConfirm(true)}>删除选中 ({selected.size})</button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-mask" onClick={()=>setShowCreate(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>新建案件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案件名称 *</label><input className="input" placeholder="输入案件名称" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案号</label><input className="input" placeholder="如：(2024)京0105民初1234号" value={form.case_number} onChange={e=>setForm({...form,case_number:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>管辖法院</label><input className="input" placeholder="如：北京市朝阳区人民法院" value={form.court} onChange={e=>setForm({...form,court:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案由</label><input className="input" placeholder="如：民间借贷纠纷" value={form.cause} onChange={e=>setForm({...form,cause:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案件类型</label>
                  <select className="select" value={form.case_type} onChange={e=>setForm({...form,case_type:e.target.value})}>
                    <option value="">选择类型</option>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>立案日期</label><input type="date" className="input" value={form.filing_date} onChange={e=>setForm({...form,filing_date:e.target.value})}/></div>
              </div>
              <div><label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案件描述</label><textarea className="textarea" style={{height:60}} placeholder="简要描述" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setShowCreate(false)}>取消</button>
                <button className="btn btn-p" onClick={create}>创建</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuick && (
        <div className="modal-mask" onClick={() => !quickGenerating && setShowQuick(false)}>
          <div className="modal-box" style={{maxWidth:600}} onClick={e => e.stopPropagation()}>
            <h3>⚡ 极速生成文书</h3>
            <p style={{fontSize:13,color:'var(--text-secondary)',marginTop:-12,marginBottom:16}}>粘贴案情描述，选择文书类型，一键生成</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>案情描述 *</label>
                <textarea className="textarea" style={{height:160}} placeholder="粘贴案件材料、案情经过、当事人信息等..." value={quickText} onChange={e => setQuickText(e.target.value)} disabled={quickGenerating} />
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,display:'block'}}>文书类型 *</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:6}}>
                  {docTypes.map(dt => (
                    <div key={dt.key} className={`doc-type-card ${quickDocType === dt.key ? 'selected' : ''}`} onClick={() => !quickGenerating && setQuickDocType(dt.key)} style={{padding:'8px 10px',fontSize:12}}>
                      {dt.name}
                    </div>
                  ))}
                </div>
              </div>
              {quickGenerating && (
                <div>
                  <div style={{fontSize:12,color:'var(--accent)',marginBottom:4}}>{quickStage}</div>
                  <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${quickProgress}%`,background:'linear-gradient(90deg,#6366f1,#a78bfa)',borderRadius:3,transition:'width 0.3s'}} />
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={() => setShowQuick(false)} disabled={quickGenerating}>取消</button>
                <button className="btn btn-p" onClick={handleQuickGenerate} disabled={quickGenerating || !quickText.trim() || !quickDocType}>
                  {quickGenerating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding:0}}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{width:30}}>
                <input type="checkbox" checked={cases.length>0&&selected.size===cases.length} onChange={toggleAll}/>
              </th>
              <th>案件名称</th>
              <th>案号</th>
              <th>类型</th>
              <th>状态</th>
              <th>创建时间</th>
              <th style={{textAlign:'right'}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {cases.map(c => (
              <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/cases/${c.id}`)}>
                <td onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggleSelect(c.id)}/>
                </td>
                <td>
                  <div style={{fontWeight:500}}>{c.name}</div>
                  {c.cause && <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{c.cause}</div>}
                </td>
                <td style={{fontSize:12,color:'var(--text-secondary)'}}>{c.case_number || '-'}</td>
                <td>{c.case_type ? <span className="tag" style={{background:`${TYPE_COLORS[c.case_type]||'#6366f1'}18`,color:TYPE_COLORS[c.case_type]||'#6366f1'}}>{c.case_type}</span> : <span style={{color:'var(--text-muted)'}}>-</span>}</td>
                <td>
                  <span className={`tag ${c.status==='completed'?'t-green':c.status==='in_progress'?'t-orange':'t-gray'}`}>
                    {c.status==='completed'?'已完成':c.status==='in_progress'?'进行中':'草稿'}
                  </span>
                </td>
                <td style={{color:'var(--text-secondary)',fontSize:12}}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</td>
                <td style={{textAlign:'right'}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                    <button className="btn btn-o btn-sm" onClick={()=>navigate(`/cases/${c.id}`)}>详情</button>
                    <button className="btn btn-p btn-sm" onClick={()=>navigate(`/cases/${c.id}/workflow`)}>工作流</button>
                  </div>
                </td>
              </tr>
            ))}
            {cases.length===0 && (
              <tr><td colSpan={7}>
                <div className="empty" style={{padding:'60px 0'}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  <p>暂无案件，点击「新建案件」开始</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showBatchConfirm && <ConfirmDialog message={`确定删除选中的 ${selected.size} 个案件？此操作不可恢复。`} onConfirm={handleBatchDelete} onCancel={() => setShowBatchConfirm(false)} />}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
