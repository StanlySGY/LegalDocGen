import { useState, useEffect } from 'react'
import { api } from '../services/api'

function PromptVariablePills({ stage, onInsert }: { stage: string; onInsert: (name: string) => void }) {
  const [vars, setVars] = useState<{name:string;description:string}[]>([])
  useEffect(() => { if(stage) api.config.getStageVariables(stage).then(d => setVars(d.variables)).catch(() => setVars([])) }, [stage])
  if (!vars.length) return null
  return (
    <div className="flex flex-wrap gap-2" style={{marginBottom:6}}>
      {vars.map(v => (
        <span key={v.name} className="tag t-purple" style={{cursor:'pointer'}} title={v.description} onClick={() => onInsert(v.name)}>
          {`{${v.name}}`}
        </span>
      ))}
    </div>
  )
}

export default function ModelConfig() {
  const [models, setModels] = useState<any[]>([])
  const [form, setForm] = useState({ openai_api_key:'', openai_base_url:'https://api.openai.com/v1', claude_api_key:'', custom_api_key:'', custom_base_url:'', custom_model_name:'', default_model:'openai' })
  const [prompts, setPrompts] = useState<any[]>([])
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [tab, setTab] = useState<'models'|'prompts'>('models')

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  useEffect(() => { api.config.getModels().then(d=>setModels(d.available)); api.config.getPrompts().then(setPrompts); api.config.getStages().then(setStages) }, [])
  const saveConfig = async () => { await api.config.updateModels(form); showToast('配置已保存'); api.config.getModels().then(d=>setModels(d.available)) }
  const savePrompt = async () => { if(!editingPrompt)return; if(editingPrompt.id) await api.config.updatePrompt(editingPrompt.id,editingPrompt); else await api.config.createPrompt(editingPrompt); setEditingPrompt(null); api.config.getPrompts().then(setPrompts); showToast('模板已保存') }

  return (
    <div>
      <div className="mb-6">
        <h2 style={{fontSize:20,fontWeight:700}}>系统配置</h2>
        <p style={{fontSize:13,color:'#86909c',marginTop:4}}>管理模型API和Prompt模板</p>
      </div>

      <div className="flex gap-1 mb-6" style={{background:'#f0f0f0',borderRadius:10,padding:4}}>
        <button className="btn" style={{flex:1,background:tab==='models'?'#fff':'transparent',color:tab==='models'?'#6366f1':'#86909c',boxShadow:tab==='models'?'0 1px 3px rgba(0,0,0,.08)':'none',borderRadius:8,padding:'8px 0',fontWeight:600}} onClick={()=>setTab('models')}>模型配置</button>
        <button className="btn" style={{flex:1,background:tab==='prompts'?'#fff':'transparent',color:tab==='prompts'?'#6366f1':'#86909c',boxShadow:tab==='prompts'?'0 1px 3px rgba(0,0,0,.08)':'none',borderRadius:8,padding:'8px 0',fontWeight:600}} onClick={()=>setTab('prompts')}>Prompt 模板</button>
      </div>

      {tab==='models' && (
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <div className="card-title" style={{marginBottom:16}}>当前可用模型</div>
            <div className="flex flex-wrap gap-2">
              {models.map((m,i)=>(
                <div key={i} className="flex items-center gap-2" style={{background:'#e8f8ef',border:'1px solid #b7eb8f',borderRadius:8,padding:'8px 14px'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#00a854',display:'inline-block'}}/>
                  <span style={{fontSize:13,fontWeight:600,color:'#006d2e'}}>{m.name}</span>
                  <span style={{fontSize:11,color:'#00a854'}}>{m.model}</span>
                </div>
              ))}
              {models.length===0 && (
                <div className="flex items-center gap-2" style={{background:'#fff1f0',border:'1px solid #ffa39e',borderRadius:8,padding:'8px 14px'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#f5222d',display:'inline-block'}}/>
                  <span style={{fontSize:13,color:'#cf1322'}}>未配置任何模型，请填写 API Key</span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{marginBottom:16}}>API 配置</div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>默认模型</label>
                <select className="select" value={form.default_model} onChange={e=>setForm({...form,default_model:e.target.value})}>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>OpenAI API Key</label><input type="password" className="input" value={form.openai_api_key} onChange={e=>setForm({...form,openai_api_key:e.target.value})} placeholder="sk-..."/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>OpenAI Base URL</label><input className="input" value={form.openai_base_url} onChange={e=>setForm({...form,openai_base_url:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>Claude API Key</label><input type="password" className="input" value={form.claude_api_key} onChange={e=>setForm({...form,claude_api_key:e.target.value})} placeholder="sk-ant-..."/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>自定义 API Key</label><input type="password" className="input" value={form.custom_api_key} onChange={e=>setForm({...form,custom_api_key:e.target.value})}/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>自定义 Base URL</label><input className="input" value={form.custom_base_url} onChange={e=>setForm({...form,custom_base_url:e.target.value})} placeholder="https://..."/></div>
                <div><label style={{fontSize:12,color:'#86909c',marginBottom:6,display:'block'}}>自定义模型名称</label><input className="input" value={form.custom_model_name} onChange={e=>setForm({...form,custom_model_name:e.target.value})} placeholder="gpt-4o-mini"/></div>
              </div>
              <button className="btn btn-p" style={{alignSelf:'flex-start'}} onClick={saveConfig}>保存配置</button>
            </div>
          </div>
        </div>
      )}

      {tab==='prompts' && (
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
        </div>
      )}

      {editingPrompt && (
        <div className="modal-mask" onClick={()=>setEditingPrompt(null)}>
          <div className="modal-box" style={{maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <h3>编辑 Prompt 模板</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>模板名称</label><input className="input" value={editingPrompt.name} onChange={e=>setEditingPrompt({...editingPrompt,name:e.target.value})}/></div>
              <div>
                <label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>Prompt 内容</label>
                <PromptVariablePills stage={editingPrompt.stage} onInsert={v=>setEditingPrompt({...editingPrompt,content:editingPrompt.content+`{${v}}`})}/>
                <textarea className="textarea" style={{height:350}} value={editingPrompt.content} onChange={e=>setEditingPrompt({...editingPrompt,content:e.target.value})}/>
              </div>
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
