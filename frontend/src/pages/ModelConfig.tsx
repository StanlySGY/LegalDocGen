import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ModelConfig() {
  const navigate = useNavigate()
  const [prompts, setPrompts] = useState<any[]>([])
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const { toasts, showToast, removeToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refDocs, setRefDocs] = useState<any[]>([])
  const [showRefDocForm, setShowRefDocForm] = useState(false)
  const [refDocForm, setRefDocForm] = useState({ name: '', doc_type: 'complaint', content: '' })
  const [refDocFile, setRefDocFile] = useState<File | null>(null)
  const [refDocSearch, setRefDocSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.config.getPrompts().then(setPrompts),
      api.config.getStages().then(setStages).catch(() => setStages([])),
      api.referenceDocs.list().then(setRefDocs).catch(() => setRefDocs([]))
    ]).catch((e: any) => {
      showToast(e.message || '模板加载失败', { type: 'err' })
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  const savePrompt = async () => { if(!editingPrompt)return; if(editingPrompt.id) await api.config.updatePrompt(editingPrompt.id,editingPrompt); else await api.config.createPrompt(editingPrompt); setEditingPrompt(null); api.config.getPrompts().then(setPrompts); showToast('模板已保存') }

  const saveRefDoc = async () => {
    if (!refDocForm.name.trim()) return showToast('请输入文书名称', { type: 'err' })
    try {
      if (refDocFile) { await api.referenceDocs.upload(refDocFile) }
      else { await api.referenceDocs.create(refDocForm) }
      setRefDocForm({ name: '', doc_type: 'complaint', content: '' }); setRefDocFile(null); setShowRefDocForm(false)
      api.referenceDocs.list().then(setRefDocs)
      showToast('文书已保存')
    } catch (e: any) { showToast(e.message || '保存失败', { type: 'err' }) }
  }

  const deleteRefDoc = async (id: string) => {
    try { await api.referenceDocs.delete(id); setRefDocs(refDocs.filter(d => d.id !== id)); showToast('已删除') }
    catch (e: any) { showToast(e.message || '删除失败', { type: 'err' }) }
  }

  if (loading) return <LoadingSpinner text="正在加载 Prompt 模板..." />

  const stageName = (stage: string) => stages.find(item => item.value === stage)?.name || stage
  const defaultCount = prompts.filter(prompt => prompt.is_default).length
  const customCount = prompts.length - defaultCount
  const coveredStages = new Set(prompts.map(prompt => prompt.stage)).size

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">PROMPT GOVERNANCE</div>
          <h2>Prompt 模板</h2>
          <p>集中治理五阶段生成模板，确保事实提取、法律分析、争议焦点、文书生成和审查优化都遵循可复核的统一口径。</p>
        </div>
        <div className="hero-action-card">
          <div><strong>模型入口</strong><span>生成质量同时依赖模板、渠道和模型可用性。</span></div>
          <button className="btn btn-p" onClick={() => navigate('/channels')}>配置模型渠道</button>
        </div>
      </div>

      <div className="task-stat-row">
        <div className="stat-card s-purple"><div className="s-label">模板总数</div><div className="s-value">{prompts.length}</div><div className="s-hint">系统默认与自定义模板</div></div>
        <div className="stat-card s-blue"><div className="s-label">覆盖阶段</div><div className="s-value">{coveredStages}</div><div className="s-hint">已有模板的流程阶段</div></div>
        <div className="stat-card s-green"><div className="s-label">默认模板</div><div className="s-value">{defaultCount}</div><div className="s-hint">可作为安全基线</div></div>
        <div className="stat-card s-orange"><div className="s-label">自定义模板</div><div className="s-value">{customCount}</div><div className="s-hint">适配团队办案风格</div></div>
      </div>

      <div className="role-guide-grid">
        <div className="trust-card accent"><strong>事实约束</strong><span>模板应要求生成内容仅基于材料与前序阶段，避免补写未出现事实。</span></div>
        <div className="trust-card"><strong>法律复核</strong><span>法条、金额和诉讼策略应保留人工复核提示，降低误用风险。</span></div>
        <div className="trust-card"><strong>交付一致</strong><span>统一各阶段输出结构，便于版本回滚、导出和团队协作审查。</span></div>
      </div>

      <div className="card prompt-channel-card" onClick={() => navigate('/channels')}>
        <div>
          <div style={{fontWeight:600,marginBottom:4}}>模型与渠道配置</div>
          <div style={{fontSize:13,color:'#86909c'}}>管理 API 渠道、测试连接、发现可用模型，保障模板可稳定执行。</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#86909c" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      <div className="card">
        <div className="card-hd">
          <div>
            <span className="card-title">Prompt 模板库</span>
            <p className="text-xs-desc">建议仅在确认业务口径后修改模板，避免影响后续文书生成结果。</p>
          </div>
          <span className="tag t-purple">{prompts.length} 个模板</span>
        </div>
        <div className="prompt-template-list">
          {prompts.map(prompt => (
            <div key={prompt.id} className="prompt-template-card">
              <div>
                <div className="cell-tags">
                  <span className="tag t-purple">{stageName(prompt.stage)}</span>
                  {prompt.is_default && <span className="tag t-gray">默认</span>}
                </div>
                <strong>{prompt.name}</strong>
                <span>{prompt.is_default ? '系统默认模板，建议作为修改前参考。' : '团队自定义模板，用于适配特定办案表达。'}</span>
              </div>
              <button className="btn btn-o btn-sm" onClick={()=>setEditingPrompt(prompt)}>编辑</button>
            </div>
          ))}
          {prompts.length===0 && <div className="empty refined-empty" style={{padding:48}}><p>暂无自定义模板，系统会使用后端默认模板生成内容</p></div>}
        </div>
      </div>

      {editingPrompt && (
        <div className="modal-mask" onClick={()=>setEditingPrompt(null)}>
          <div className="modal-box" style={{maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <h3>编辑 Prompt 模板</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label className="text-xs-label">模板名称</label><input className="input" value={editingPrompt.name} onChange={e=>setEditingPrompt({...editingPrompt,name:e.target.value})}/></div>
              <div><label className="text-xs-label">Prompt 内容</label><textarea className="textarea" style={{height:380}} value={editingPrompt.content} onChange={e=>setEditingPrompt({...editingPrompt,content:e.target.value})}/></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setEditingPrompt(null)}>取消</button>
                <button className="btn btn-p" onClick={savePrompt}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-hd">
          <div>
            <span className="card-title">过往文书库</span>
            <p className="text-xs-desc">上传参考文书，AI 生成时可学习写作风格和表达习惯。</p>
          </div>
          <button className="btn btn-p btn-sm" onClick={() => setShowRefDocForm(true)}>+ 添加文书</button>
        </div>
        {refDocs.length > 3 && (
          <div style={{ marginBottom: 12 }}>
            <input className="input" placeholder="搜索文书名称..." value={refDocSearch} onChange={e => setRefDocSearch(e.target.value)} style={{ fontSize: 12 }} />
          </div>
        )}
        {refDocs.length === 0 ? (
          <div className="empty refined-empty" style={{ padding: 32 }}><p>暂无参考文书，添加后 AI 可学习您的写作风格</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {refDocs.filter(d => !refDocSearch || d.name.toLowerCase().includes(refDocSearch.toLowerCase())).map(doc => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f7f8fa', borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{doc.name}</span>
                  <span className="tag t-purple" style={{ marginLeft: 8 }}>{doc.doc_type || '通用'}</span>
                  <span style={{ fontSize: 11, color: '#86909c', marginLeft: 8 }}>{doc.content ? doc.content.length + '字' : ''}</span>
                </div>
                <button className="btn btn-d btn-sm" onClick={() => deleteRefDoc(doc.id)}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRefDocForm && (
        <div className="modal-mask" onClick={() => setShowRefDocForm(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h3>添加参考文书</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="text-xs-label">文书名称</label><input className="input" value={refDocForm.name} onChange={e => setRefDocForm({ ...refDocForm, name: e.target.value })} placeholder="例如：民事起诉状范本" /></div>
              <div><label className="text-xs-label">文书类型</label>
                <select className="select" value={refDocForm.doc_type} onChange={e => setRefDocForm({ ...refDocForm, doc_type: e.target.value })}>
                  <option value="complaint">起诉状</option><option value="defense">答辩状</option><option value="representation">代理词</option><option value="lawyer_letter">律师函</option><option value="other">其他</option>
                </select>
              </div>
              <div><label className="text-xs-label">或上传文件</label><input type="file" accept=".txt,.md,.doc,.docx" onChange={e => setRefDocFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} /></div>
              {!refDocFile && <div><label className="text-xs-label">文书内容</label><textarea className="textarea" style={{ height: 200 }} value={refDocForm.content} onChange={e => setRefDocForm({ ...refDocForm, content: e.target.value })} placeholder="粘贴文书全文..." /></div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                <button className="btn btn-o" onClick={() => setShowRefDocForm(false)}>取消</button>
                <button className="btn btn-p" onClick={saveRefDoc}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
