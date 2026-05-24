import { useState, useEffect } from 'react'
import { api } from '../services/api'
import TemplateSelector from './TemplateSelector'
import type { Case } from '../types'

interface Props { nav: { detail: (id: string) => void; workflow: (id: string) => void } }

export default function CaseList({ nav }: Props) {
  const [cases, setCases] = useState<Case[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', case_type: '' })
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = () => api.cases.list().then(setCases).catch((e: any) => showToast(e.message || '案件加载失败', 'err'))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim()) return
    try {
      const c = await api.cases.create({ ...form, template_id: selectedTemplate?.id || '' })
      setForm({ name: '', description: '', case_type: '' })
      setShowCreate(false)
      setSelectedTemplate(null)
      nav.detail(c.id)
    } catch (e: any) {
      showToast(e.message || '创建失败', 'err')
    }
  }

  const handleTemplateSelect = (templateId: string, templateName: string) => {
    setSelectedTemplate({ id: templateId, name: templateName })
    setShowTemplateSelector(false)
  }

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} onBack={() => setShowTemplateSelector(false)} />
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

      {showCreate && (
        <div className="modal-mask" onClick={()=>setShowCreate(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>新建案件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件名称 *</label>
                <input className="input" placeholder="输入案件名称" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
              </div>
              <div>
                <label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件类型</label>
                <input className="input" placeholder="如：合同纠纷、劳动争议" value={form.case_type} onChange={e=>setForm({...form,case_type:e.target.value})}/>
              </div>
              <div>
                <label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>案件描述</label>
                <textarea className="textarea" style={{height:80}} placeholder="简要描述" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
              </div>
              {selectedTemplate && (
                <div style={{padding:10,background:'#f0fdf4',borderRadius:8,border:'1px solid #d1fae5',fontSize:12,color:'#10b981'}}>
                  ✓ 已选择模板：{selectedTemplate.name}
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setShowTemplateSelector(true)}>选择模板</button>
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
              <th>案件名称</th>
              <th>类型</th>
              <th>状态</th>
              <th>创建时间</th>
              <th style={{textAlign:'right'}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {cases.map(c => (
              <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>nav.detail(c.id)}>
                <td>
                  <div style={{fontWeight:500}}>{c.name}</div>
                  {c.description && <div style={{fontSize:12,color:'#86909c',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{c.description}</div>}
                </td>
                <td>{c.case_type ? <span className="tag t-blue">{c.case_type}</span> : <span style={{color:'#c9cdd4'}}>-</span>}</td>
                <td>
                  <span className={`tag ${c.status==='completed'?'t-green':c.status==='in_progress'?'t-orange':'t-gray'}`}>
                    {c.status==='completed'?'已完成':c.status==='in_progress'?'进行中':'草稿'}
                  </span>
                </td>
                <td style={{color:'#86909c',fontSize:12}}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</td>
                <td style={{textAlign:'right'}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                    <button className="btn btn-o btn-sm" onClick={()=>nav.detail(c.id)}>详情</button>
                    <button className="btn btn-p btn-sm" onClick={()=>nav.workflow(c.id)}>工作流</button>
                  </div>
                </td>
              </tr>
            ))}
            {cases.length===0 && (
              <tr><td colSpan={5}>
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
