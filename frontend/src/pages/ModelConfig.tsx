import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Props { onNavChannels: () => void }

export default function ModelConfig({ onNavChannels }: Props) {
  const [prompts, setPrompts] = useState<any[]>([])
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  useEffect(() => { api.config.getPrompts().then(setPrompts); api.config.getStages().then(setStages) }, [])
  const savePrompt = async () => { if(!editingPrompt)return; if(editingPrompt.id) await api.config.updatePrompt(editingPrompt.id,editingPrompt); else await api.config.createPrompt(editingPrompt); setEditingPrompt(null); api.config.getPrompts().then(setPrompts); showToast('模板已保存') }

  return (
    <div>
      <div className="mb-6">
        <h2 style={{fontSize:20,fontWeight:700}}>Prompt 模板</h2>
        <p style={{fontSize:13,color:'#86909c',marginTop:4}}>管理各阶段生成模板</p>
      </div>

      <div className="card" style={{marginBottom:20,borderLeft:'3px solid #6366f1',cursor:'pointer'}} onClick={onNavChannels}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{fontWeight:600,marginBottom:4}}>模型与渠道配置</div>
            <div style={{fontSize:13,color:'#86909c'}}>管理 API 渠道、测试连接、发现可用模型 →</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#86909c" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{marginBottom:16}}>Prompt 模板</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {prompts.map(p=>(
              <div key={p.id} className="flex items-center justify-between" style={{border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 16px',transition:'background .15s'}} onMouseEnter={e=>(e.currentTarget.style.background='#f7f8fa')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                <div className="flex items-center gap-3">
                  <span className="tag t-purple">{stages.find(s=>s.value===p.stage)?.name||p.stage}</span>
                  <span style={{fontSize:13,fontWeight:500}}>{p.name}</span>
                  {p.is_default && <span className="tag t-gray">默认</span>}
                </div>
                <button className="btn btn-o btn-sm" onClick={()=>setEditingPrompt(p)}>编辑</button>
              </div>
            ))}
            {prompts.length===0 && <div style={{textAlign:'center',padding:40,color:'#c9cdd4'}}>暂无自定义模板</div>}
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
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
