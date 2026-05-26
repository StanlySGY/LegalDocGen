import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import TemplateSelector from './TemplateSelector'
import type { Case } from '../types'

interface Props { nav: { detail: (id: string) => void; workflow: (id: string) => void } }

type CaseForm = { name: string; description: string; case_type: string }

const emptyForm: CaseForm = { name: '', description: '', case_type: '' }
const statusText: Record<string, string> = { draft: '草稿', in_progress: '进行中', completed: '已完成' }

const statusTag = (status: string) => status === 'completed' ? 't-green' : status === 'in_progress' ? 't-orange' : 't-gray'
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN')
const nextAction = (item: Case) => item.status === 'completed' ? '复核并导出 Word' : item.status === 'in_progress' ? '继续生成文书' : '补材料并启动工作流'
const caseFocus = (item: Case) => item.status === 'completed' ? '交付前复核法条、金额和证据引用' : item.status === 'in_progress' ? '优先完成剩余阶段，形成可编辑初稿' : '先上传合同、流水、通知等关键材料'

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
  const total = cases.length
  const draftCount = cases.filter(c => c.status === 'draft').length
  const activeCount = cases.filter(c => c.status === 'in_progress').length
  const completedCount = cases.filter(c => c.status === 'completed').length
  const deliveryRate = total ? Math.round(completedCount / total * 100) : 0
  const recentCases = [...cases].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).slice(0, 3)
  const primaryCase = cases.find(c => c.status === 'in_progress') || cases.find(c => c.status === 'draft') || cases[0]

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} onBack={() => setShowTemplateSelector(false)} />
  }

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">CASE WORKBENCH</div>
          <h2>案件工作台</h2>
          <p>聚合个人案件进度、材料状态和下一步写作动作，帮助你快速从材料进入可复核的法律文书初稿。</p>
          {primaryCase && (
            <div className="hero-action-card">
              <div>
                <span className={`tag ${statusTag(primaryCase.status)}`}>{statusText[primaryCase.status] || primaryCase.status}</span>
                <strong>{primaryCase.name}</strong>
                <span>{nextAction(primaryCase)}</span>
              </div>
              <button className="btn btn-p btn-sm" onClick={() => primaryCase.status === 'draft' ? nav.detail(primaryCase.id) : nav.workflow(primaryCase.id)}>继续处理</button>
            </div>
          )}
        </div>
        <button className="btn btn-p" onClick={() => setShowCreate(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建案件
        </button>
      </div>

      <div className="stat-row dashboard-stats">
        <div className="stat-card s-purple"><div className="s-label">我的案件</div><div className="s-value">{total}</div><div className="s-hint">当前筛选结果</div></div>
        <div className="stat-card s-orange"><div className="s-label">待补材料</div><div className="s-value">{draftCount}</div><div className="s-hint">先上传关键证据</div></div>
        <div className="stat-card s-blue"><div className="s-label">写作中</div><div className="s-value">{activeCount}</div><div className="s-hint">继续生成或编辑</div></div>
        <div className="stat-card s-green"><div className="s-label">可交付</div><div className="s-value">{deliveryRate}%</div><div className="s-hint">已完成复核阶段占比</div></div>
      </div>

      {cases.length === 0 && !toast && (
        <div className="notice-card notice-info">
          <div>
            <strong>当前为前端预览模式时，案件数据、材料解析和 AI 生成需要连接独立 FastAPI 后端。</strong>
            <span>如果只是体验界面，可以先新建示例案件；如需完整能力，请在部署环境配置后端 API。</span>
          </div>
        </div>
      )}

      <div className="workbench-grid">
        <div className="card" style={{padding:0}}>
          <div className="panel-head">
            <div>
              <span className="card-title">案件列表</span>
              <p>按状态、类型和关键词快速定位案件</p>
            </div>
            <div className="bulk-actions compact">
              <span>已选择 {selectedIds.length} 个案件</span>
              <button className="btn btn-o btn-sm" onClick={batchExport}>批量导出</button>
              <button className="btn btn-d btn-sm" onClick={batchDelete}>批量删除</button>
            </div>
          </div>
          <div className="filters-grid" style={{padding:'0 16px 16px'}}>
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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width:44}}><input type="checkbox" checked={cases.length>0 && selectedIds.length===cases.length} onChange={toggleAll}/></th>
                  <th>案件名称</th>
                  <th>状态</th>
                  <th>下一步</th>
                  <th>更新时间</th>
                  <th style={{textAlign:'right'}}>操作</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>nav.detail(c.id)}>
                    <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={()=>toggleSelected(c.id)}/></td>
                    <td>
                      <div style={{fontWeight:600}}>{c.name}</div>
                      <div className="case-meta-line">
                        {c.case_type ? <span>{c.case_type}</span> : <span>未设置类型</span>}
                        {c.description && <span>{c.description}</span>}
                      </div>
                    </td>
                    <td><span className={`tag ${statusTag(c.status)}`}>{statusText[c.status] || c.status}</span></td>
                    <td style={{fontSize:12,color:'#4b5563'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        <strong style={{fontSize:12,color:'#334155'}}>{nextAction(c)}</strong>
                        <span style={{color:'#86909c'}}>{caseFocus(c)}</span>
                      </div>
                    </td>
                    <td style={{color:'#86909c',fontSize:12}}>{formatDate(c.updated_at || c.created_at)}</td>
                    <td style={{textAlign:'right'}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                        <button className="btn btn-o btn-sm" onClick={()=>nav.detail(c.id)}>详情</button>
                        <button className="btn btn-p btn-sm" onClick={()=>nav.workflow(c.id)}>{c.status === 'completed' ? '复核' : '继续'}</button>
                        <button className="btn btn-o btn-sm" onClick={()=>openEdit(c)}>编辑</button>
                        <button className="btn btn-d btn-sm" onClick={()=>deleteOne(c.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cases.length===0 && (
                  <tr><td colSpan={6}>
                    <div className="empty refined-empty" style={{padding:'60px 0'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                      <p>暂无案件，点击「新建案件」开始</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card side-insight">
          <div className="card-hd"><span className="card-title">最近更新</span></div>
          <div className="recent-list">
            {recentCases.map(item => (
              <div key={item.id} className="recent-item" onClick={() => nav.detail(item.id)}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatDate(item.updated_at || item.created_at)} · {nextAction(item)}</span>
                </div>
                <span className={`tag ${statusTag(item.status)}`}>{statusText[item.status] || item.status}</span>
              </div>
            ))}
            {recentCases.length === 0 && <div className="empty" style={{padding:'38px 0'}}><p>暂无最近案件</p></div>}
          </div>
          <div className="process-hint">
            <strong>推荐办案顺序</strong>
            <span>先补齐关键材料，再完成五阶段生成，最后核验法条、金额、证据引用并导出 Word。</span>
          </div>
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
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
