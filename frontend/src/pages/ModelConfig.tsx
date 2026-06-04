import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Props { onNavChannels: () => void }

export default function ModelConfig({ onNavChannels }: Props) {
  const [prompts, setPrompts] = useState<any[]>([])
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    api.config.getPrompts().then(setPrompts).catch((e: any) => showToast(e.message || '模板加载失败', { type: 'err' }))
    api.config.getStages().then(setStages).catch(() => setStages([]))
  }, [])
  const savePrompt = async () => { if(!editingPrompt)return; if(editingPrompt.id) await api.config.updatePrompt(editingPrompt.id,editingPrompt); else await api.config.createPrompt(editingPrompt); setEditingPrompt(null); api.config.getPrompts().then(setPrompts); showToast('模板已保存') }

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
          <button className="btn btn-p" onClick={onNavChannels}>配置模型渠道</button>
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

      <div className="card prompt-channel-card" onClick={onNavChannels}>
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
            <p style={{fontSize:12,color:'#86909c',marginTop:4}}>建议仅在确认业务口径后修改模板，避免影响后续文书生成结果。</p>
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
              <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>模板名称</label><input className="input" value={editingPrompt.name} onChange={e=>setEditingPrompt({...editingPrompt,name:e.target.value})}/></div>
              <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>Prompt 内容</label><textarea className="textarea" style={{height:380}} value={editingPrompt.content} onChange={e=>setEditingPrompt({...editingPrompt,content:e.target.value})}/></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>setEditingPrompt(null)}>取消</button>
                <button className="btn btn-p" onClick={savePrompt}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
