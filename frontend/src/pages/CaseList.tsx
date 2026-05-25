import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import TemplateSelector from './TemplateSelector'
import type { Case } from '../types'

interface Props { nav: { detail: (id: string) => void; workflow: (id: string) => void } }

type CaseForm = { name: string; description: string; case_type: string }

const emptyForm: CaseForm = { name: '', description: '', case_type: '' }
const statusText: Record<string, string> = { draft: '草稿', in_progress: '进行中', completed: '已完成' }

export default function CaseList({ nav }: Props) {
  const [cases, setCases] = useState<Case[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [form, setForm] = useState<CaseForm>(emptyForm)
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [filters, setFilters] = useState({ keyword: '', status: '', case_type: '' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingCase, setEditingCase] = useState<Case | null>(null)
  const [editForm, setEditForm] = useState<CaseForm>(emptyForm)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = useCallback(() => {
    api.cases.list(filters).then(data => { setCases(data); setSelectedIds([]) }).catch((e: any) => showToast(e.message || '案件加载失败', 'err'))
  }, [filters])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    try {
      const c = await api.cases.create({ ...form, template_id: selectedTemplate?.id || '' })
      setForm(emptyForm)
      setShowCreate(false)
      setSelectedTemplate(null)
      nav.detail(c.id)
    } catch (e: any) {
      showToast(e.message || '创建失败', 'err')
    }
  }

  const openEdit = (item: Case) => {
    setEditingCase(item)
    setEditForm({ name: item.name, description: item.description || '', case_type: item.case_type || '' })
  }

  const saveEdit = async () => {
    if (!editingCase || !editForm.name.trim()) return
    try {
      await api.cases.update(editingCase.id, editForm)
      setEditingCase(null)
      load()
      showToast('已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', 'err')
    }
  }

  const deleteOne = async (id: string) => {
    if (!window.confirm('确认删除该案件及其材料和工作流记录？')) return
    try {
      await api.cases.delete(id)
      load()
      showToast('已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', 'err')
    }
  }

  const batchDelete = async () => {
    if (!selectedIds.length) return showToast('请先选择案件', 'err')
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 个案件？`)) return
    try {
      await api.cases.batchDelete(selectedIds)
      load()
      showToast('批量删除完成')
    } catch (e: any) {
      showToast(e.message || '批量删除失败', 'err')
    }
  }

  const batchExport = async () => {
    if (!selectedIds.length) return showToast('请先选择案件', 'err')
    try {
      await api.workflow.exportBatch(selectedIds)
      showToast('批量导出成功')
    } catch (e: any) {
      showToast(e.message || '批量导出失败', 'err')
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === cases.length ? [] : cases.map(c => c.id))
  }

  const handleTemplateSelect = (templateId: string, templateName: string) => {
    setSelectedTemplate({ id: templateId, name: templateName })
    setShowTemplateSelector(false)
  }

  const caseTypes = Array.from(new Set(cases.map(c => c.case_type).filter(Boolean)))

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} onBack={() => setShowTemplateSelector(false)} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 page-title-row">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>案件管理</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>管理、筛选和批量交付法律案件</p>
        </div>
        <button className="btn btn-p" onClick={() => setShowCreate(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建案件
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">当前结果</div><div className="s-value">{cases.length}</div></div>
        <div className="stat-card s-blue"><div className="s-label">进行中</div><div className="s-value">{cases.filter(c=>c.status==='in_progress').length}</div></div>
        <div className="stat-card s-green"><div className="s-label">已完成</div><div className="s-value">{cases.filter(c=>c.status==='completed').length}</div></div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="filters-grid">
          <input className="input" placeholder="搜索名称、描述或类型" value={filters.keyword} onChange={e=>setFilters({...filters,keyword:e.target.value})}/>
          <select className="select" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
          <select className="select" value={filters.case_type} onChange={e=>setFilters({...filters,case_type:e.target.value})}>
            <option value="">全部类型</option>
            {caseTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <button className="btn btn-o" onClick={load}>刷新</button>
        </div>
        <div className="bulk-actions">
          <span style={{fontSize:12,color:'#86909c'}}>已选择 {selectedIds.length} 个案件</span>
          <button className="btn btn-o btn-sm" onClick={batchExport}>批量导出</button>
          <button className="btn btn-d btn-sm" onClick={batchDelete}>批量删除</button>
        </div>
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
                  已选择模板：{selectedTemplate.name}
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

      {editingCase && (
        <div className="modal-mask" onClick={()=>setEditingCase(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>编辑案件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <input className="input" placeholder="案件名称" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/>
              <input className="input" placeholder="案件类型" value={editForm.case_type} onChange={e=>setEditForm({...editForm,case_type:e.target.value})}/>
              <textarea className="textarea" style={{height:96}} placeholder="案件描述" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button className="btn btn-o" onClick={()=>setEditingCase(null)}>取消</button>
                <button className="btn btn-p" onClick={saveEdit}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width:44}}><input type="checkbox" checked={cases.length>0 && selectedIds.length===cases.length} onChange={toggleAll}/></th>
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
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={()=>toggleSelected(c.id)}/></td>
                  <td>
                    <div style={{fontWeight:500}}>{c.name}</div>
                    {c.description && <div style={{fontSize:12,color:'#86909c',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{c.description}</div>}
                  </td>
                  <td>{c.case_type ? <span className="tag t-blue">{c.case_type}</span> : <span style={{color:'#c9cdd4'}}>-</span>}</td>
                  <td>
                    <span className={`tag ${c.status==='completed'?'t-green':c.status==='in_progress'?'t-orange':'t-gray'}`}>
                      {statusText[c.status] || c.status}
                    </span>
                  </td>
                  <td style={{color:'#86909c',fontSize:12}}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</td>
                  <td style={{textAlign:'right'}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button className="btn btn-o btn-sm" onClick={()=>nav.detail(c.id)}>详情</button>
                      <button className="btn btn-p btn-sm" onClick={()=>nav.workflow(c.id)}>工作流</button>
                      <button className="btn btn-o btn-sm" onClick={()=>openEdit(c)}>编辑</button>
                      <button className="btn btn-d btn-sm" onClick={()=>deleteOne(c.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {cases.length===0 && (
                <tr><td colSpan={6}>
                  <div className="empty" style={{padding:'60px 0'}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    <p>暂无案件，点击「新建案件」开始</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
