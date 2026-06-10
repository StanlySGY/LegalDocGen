import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, quotaUpgradeMessage } from '../services/api'
import TemplateSelector from './TemplateSelector'
import { useToast } from '../hooks/useToast'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { validateCaseForm } from '../utils/validation'
import Toaster from '../components/Toaster'
import ConfirmDialog from '../components/ConfirmDialog'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import type { Case, CaseDeadline } from '../types'
import { DOCUMENT_TYPES } from '../types'

type CaseForm = { name: string; description: string; case_type: string; document_type: string }

const emptyForm: CaseForm = { name: '', description: '', case_type: '', document_type: '' }
const statusText: Record<string, string> = { draft: '草稿', in_progress: '进行中', completed: '已完成', archived: '已归档' }
const caseTypePresets = ['民间借贷', '合同纠纷', '劳动争议', '婚姻家事', '侵权纠纷']
const onboardingSteps = [
  { title: '1. 建立案件', text: '先写清案由、委托目标和目标文书，避免后续分析发散。' },
  { title: '2. 上传材料', text: '合同、流水、聊天记录、通知书等材料建议按类型命名。' },
  { title: '3. 生成并复核', text: '按阶段生成事实、法律关系、争议焦点、初稿和审查意见。' },
]

const statusTag = (status: string) => status === 'completed' ? 't-green' : status === 'in_progress' ? 't-orange' : 't-gray'
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN')
const nextAction = (item: Case) => item.status === 'completed' ? '复核并导出 Word' : item.status === 'in_progress' ? '继续生成文书' : '补材料并启动工作流'
const caseFocus = (item: Case) => item.status === 'completed' ? '交付前复核法条、金额和证据引用' : item.status === 'in_progress' ? '优先完成剩余阶段，形成可编辑初稿' : '先上传合同、流水、通知等关键材料'

export default function CaseList() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [form, setForm] = useState<CaseForm>(emptyForm)
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [filters, setFilters] = useState({ keyword: '', status: '', case_type: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingCase, setEditingCase] = useState<Case | null>(null)
  const [editForm, setEditForm] = useState<CaseForm>(emptyForm)
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<CaseDeadline[]>([])
  const { toasts, showToast, removeToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, keyword: searchTerm }))
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchTerm])

  useKeyboardShortcut({ key: '/' }, () => {
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) return
    searchInputRef.current?.focus()
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.cases.list(filters)
      setCases(data)
      setSelectedIds([])
    } catch (e: any) {
      showToast(e.message || '案件加载失败', { type: 'err' })
    } finally {
      setLoading(false)
    }
  }, [filters])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.cases.upcomingDeadlines().then(setUpcomingDeadlines).catch(() => {})
  }, [])

  const create = async () => {
    const validation = validateCaseForm(form)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      showToast(Object.values(validation.errors)[0], { type: 'err' })
      return
    }
    setFormErrors({})
    try {
      const c = await api.cases.create({ ...form, template_id: selectedTemplate?.id || '' })
      setForm(emptyForm)
      setShowCreate(false)
      setSelectedTemplate(null)
      navigate(`/cases/${c.id}`)
    } catch (e: any) {
      showToast(quotaUpgradeMessage(e) || e.message || '创建失败', { type: 'err' })
    }
  }

  const openEdit = (item: Case) => {
    setEditingCase(item)
    setEditForm({ name: item.name, description: item.description || '', case_type: item.case_type || '', document_type: item.document_type || '' })
  }

  const saveEdit = async () => {
    if (!editingCase || !editForm.name.trim()) return
    try {
      await api.cases.update(editingCase.id, editForm)
      setEditingCase(null)
      load()
      showToast('已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', { type: 'err' })
    }
  }

  const deleteOne = async (id: string) => {
    const confirmed = await confirm({
      title: '删除案件',
      message: '确认删除该案件及其材料和工作流记录？',
      variant: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    try {
      await api.cases.delete(id)
      load()
      showToast('已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', { type: 'err' })
    }
  }

  const batchDelete = async () => {
    if (loading) return showToast('案件加载中，请稍后操作', { type: 'err' })
    if (!selectedIds.length) return showToast('请先选择案件', { type: 'err' })
    const confirmed = await confirm({
      title: '批量删除',
      message: `确认删除选中的 ${selectedIds.length} 个案件？删除后将同时移除相关材料和工作流记录。`,
      variant: 'danger',
      confirmText: '批量删除'
    })
    if (!confirmed) return
    try {
      await api.cases.batchDelete(selectedIds)
      load()
      showToast('批量删除完成')
    } catch (e: any) {
      showToast(e.message || '批量删除失败', { type: 'err' })
    }
  }

  const batchExport = async () => {
    if (loading) return showToast('案件加载中，请稍后操作', { type: 'err' })
    if (!selectedIds.length) return showToast('请先选择案件', { type: 'err' })
    try {
      await api.workflow.exportBatch(selectedIds)
      showToast('批量导出成功')
    } catch (e: any) {
      showToast(e.message || '批量导出失败', { type: 'err' })
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
  const hasActiveFilters = Boolean(filters.keyword || filters.status || filters.case_type)

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} onBack={() => setShowTemplateSelector(false)} />
  }

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">LAWYER DESK</div>
          <h2>个人律师办案工作台</h2>
          <p>聚合最近案件、材料缺口和下一步写作动作，让你从案件信息、证据材料一路推进到可复核的文书初稿。</p>
          {primaryCase && (
            <div className="hero-action-card">
              <div>
                <span className={`tag ${statusTag(primaryCase.status)}`}>{statusText[primaryCase.status] || primaryCase.status}</span>
                <strong>{primaryCase.name}</strong>
                <span>{nextAction(primaryCase)}</span>
              </div>
              <button className="btn btn-p btn-sm" onClick={() => primaryCase.status === 'draft' ? navigate(`/cases/${primaryCase.id}`) : navigate(`/cases/${primaryCase.id}/workflow`)}>继续处理</button>
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
        <div className="stat-card s-orange"><div className="s-label">待补材料</div><div className="s-value">{draftCount}</div><div className="s-hint">先补齐关键证据</div></div>
        <div className="stat-card s-blue"><div className="s-label">写作中</div><div className="s-value">{activeCount}</div><div className="s-hint">继续生成或编辑</div></div>
        <div className="stat-card s-green"><div className="s-label">已完成</div><div className="s-value">{deliveryRate}%</div><div className="s-hint">完成审查阶段占比</div></div>
      </div>

      {upcomingDeadlines.length > 0 && (
        <div className="notice-card notice-warn" style={{marginBottom:16}}>
          <div>
            <strong>即将到期 ({upcomingDeadlines.length})</strong>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
              {upcomingDeadlines.slice(0, 5).map(d => (
                <span key={d.id} style={{fontSize:13,cursor:'pointer'}} onClick={()=>navigate(`/cases/${d.case_id}`)}>
                  {d.days_left !== undefined && d.days_left <= 0 ? '⚠ 已逾期' : `剩余 ${d.days_left} 天`} — {d.case_name} · {d.title}（{d.due_date}）
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && cases.length === 0 && toasts.length === 0 && (
        <div className="notice-card notice-info">
          <div>
            <strong>还没有案件，从第一个真实案件开始。</strong>
            <span>建议先选择常见案由模板，填写目标文书和委托目标，再上传关键材料进入 AI 分析。</span>
          </div>
        </div>
      )}

      <div className="workbench-grid">
        <div className="card p-0">
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
            <input ref={searchInputRef} className="input" placeholder="搜索名称、描述或类型 (按 / 聚焦)" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
            <select className="select" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="archived">已归档</option>
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
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`loading-${i}`} className="loading-row"><td colSpan={6}>
                    <div className="table-skeleton-row">
                      <span className="skeleton-line wide"/>
                      <span className="skeleton-line short"/>
                      <span className="skeleton-line medium"/>
                      <span className="skeleton-line short"/>
                    </div>
                  </td></tr>
                ))}
                {!loading && cases.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/cases/${c.id}`)}>
                    <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={()=>toggleSelected(c.id)}/></td>
                    <td>
                      <div className="font-semibold">{c.name}</div>
                      <div className="case-meta-line">
                        {c.case_type ? <span>{c.case_type}</span> : <span>未设置类型</span>}
                        {c.description && <span>{c.description}</span>}
                      </div>
                    </td>
                    <td><span className={`tag ${statusTag(c.status)}`}>{statusText[c.status] || c.status}</span></td>
                    <td className="text-sm-muted">
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        <strong style={{fontSize:12,color:'#334155'}}>{nextAction(c)}</strong>
                        <span style={{color:'#86909c'}}>{caseFocus(c)}</span>
                      </div>
                    </td>
                    <td style={{color:'#86909c',fontSize:12}}>{formatDate(c.updated_at || c.created_at)}</td>
                    <td className="text-right" onClick={e=>e.stopPropagation()}>
                      <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                        <button className="btn btn-o btn-sm" onClick={()=>navigate(`/cases/${c.id}`)}>详情</button>
                        <button className="btn btn-p btn-sm" onClick={()=>navigate(`/cases/${c.id}/workflow`)}>{c.status === 'completed' ? '复核' : '继续'}</button>
                        <button className="btn btn-o btn-sm" onClick={()=>openEdit(c)}>编辑</button>
                        <button className="btn btn-d btn-sm" onClick={()=>deleteOne(c.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && cases.length===0 && (
                  <tr><td colSpan={6}>
                    <div className="empty refined-empty case-empty-state" style={{padding:'56px 16px'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                      <p>{hasActiveFilters ? '没有匹配当前筛选条件的案件' : '还没有案件，先建立一个办案档案'}</p>
                      <span>{hasActiveFilters ? '可以调整关键词、状态或案件类型后再试。' : '填写案由和目标文书后，上传材料即可进入证据整理和文书生成。'}</span>
                      {!hasActiveFilters && (
                        <div className="onboarding-grid compact">
                          {onboardingSteps.map(step => (
                            <div key={step.title} className="onboarding-step">
                              <strong>{step.title}</strong>
                              <span>{step.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="btn btn-p btn-sm" onClick={() => setShowCreate(true)}>{hasActiveFilters ? '新建案件' : '开始新建案件'}</button>
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
              <div key={item.id} className="recent-item" onClick={() => navigate(`/cases/${item.id}`)}>
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
            <strong>个人办案顺序</strong>
            <span>先确认委托目标和目标文书，再补齐关键材料；生成后逐项核验法条、金额、证据引用并导出 Word。</span>
          </div>
          <div className="onboarding-grid vertical">
            {onboardingSteps.map(step => (
              <div key={step.title} className="onboarding-step">
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="modal-mask" onClick={()=>setShowCreate(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>新建案件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label className="text-xs-label">案件名称 *</label>
                <input className={`input${formErrors.name ? ' input-error' : ''}`} placeholder="输入案件名称" value={form.name} onChange={e=>{setForm({...form,name:e.target.value});setFormErrors(prev=>({...prev,name:''}))}}/>
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>
              <div>
                <label className="text-xs-label">案件类型</label>
                <input className="input" placeholder="如：民间借贷、合同纠纷、劳动争议" value={form.case_type} onChange={e=>setForm({...form,case_type:e.target.value})}/>
                <div className="quick-type-row">
                  {caseTypePresets.map(type => (
                    <button key={type} type="button" className={`chip-btn ${form.case_type === type ? 'on' : ''}`} onClick={() => setForm({...form, case_type: type})}>{type}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs-label">目标文书</label>
                <div className="quick-type-row">
                  {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                    <button key={key} type="button" className={`chip-btn ${form.document_type === key ? 'on' : ''}`} onClick={() => setForm({...form, document_type: form.document_type === key ? '' : key})}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs-label">办案目标与目标文书</label>
                <textarea className="textarea" style={{height:96}} placeholder="例如：为原告起草民间借贷起诉状；争议金额、关键事实、已掌握证据和待补材料可以一并写入。" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
              </div>
              {selectedTemplate && (
                <div style={{padding:10,background:'#f0fdf4',borderRadius:8,border:'1px solid #d1fae5',fontSize:12,color:'#10b981'}}>
                  已选择模板：{selectedTemplate.name}
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setShowTemplateSelector(true)}>选择案由模板</button>
                <button className="btn btn-o" onClick={()=>setShowCreate(false)}>取消</button>
                <button className="btn btn-p" onClick={create}>创建并上传材料</button>
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
      <Toaster toasts={toasts} onRemove={removeToast} />
      {dialogProps && <ConfirmDialog {...dialogProps} />}
    </div>
  )
}
