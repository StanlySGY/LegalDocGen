import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Case } from '../types'

const CASE_TYPES = ['合同纠纷', '劳动争议', '婚姻家庭', '侵权责任', '知识产权', '公司事务', '房产纠纷', '债权债务', '刑事辩护', '行政纠纷', '其他']

export default function CaseList() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<Case[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', case_type: '', case_number: '', court: '', cause: '', filing_date: '' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  // Batch state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = () => api.cases.list({status:filterStatus, search, case_type:filterType}).then(setCases)
  useEffect(() => { load() }, [search, filterStatus, filterType])

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
    load()
    showToast(`已删除 ${selected.size} 个案件`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>案件管理</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>管理和组织您的法律案件</p>
        </div>
        <button className="btn btn-p" onClick={() => setShowCreate(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建案件
        </button>
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
            <button className="btn btn-d btn-sm" onClick={handleBatchDelete}>删除选中 ({selected.size})</button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-mask" onClick={()=>setShowCreate(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>新建案件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件名称 *</label><input className="input" placeholder="输入案件名称" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案号</label><input className="input" placeholder="如：(2024)京0105民初1234号" value={form.case_number} onChange={e=>setForm({...form,case_number:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>管辖法院</label><input className="input" placeholder="如：北京市朝阳区人民法院" value={form.court} onChange={e=>setForm({...form,court:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案由</label><input className="input" placeholder="如：民间借贷纠纷" value={form.cause} onChange={e=>setForm({...form,cause:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件类型</label>
                  <select className="select" value={form.case_type} onChange={e=>setForm({...form,case_type:e.target.value})}>
                    <option value="">选择类型</option>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>立案日期</label><input type="date" className="input" value={form.filing_date} onChange={e=>setForm({...form,filing_date:e.target.value})}/></div>
              </div>
              <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件描述</label><textarea className="textarea" style={{height:60}} placeholder="简要描述" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setShowCreate(false)}>取消</button>
                <button className="btn btn-p" onClick={create}>创建</button>
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
                  {c.cause && <div style={{fontSize:11,color:'#86909c',marginTop:2}}>{c.cause}</div>}
                </td>
                <td style={{fontSize:12,color:'#86909c'}}>{c.case_number || '-'}</td>
                <td>{c.case_type ? <span className="tag t-blue">{c.case_type}</span> : <span style={{color:'#c9cdd4'}}>-</span>}</td>
                <td>
                  <span className={`tag ${c.status==='completed'?'t-green':c.status==='in_progress'?'t-orange':'t-gray'}`}>
                    {c.status==='completed'?'已完成':c.status==='in_progress'?'进行中':'草稿'}
                  </span>
                </td>
                <td style={{color:'#86909c',fontSize:12}}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</td>
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
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
