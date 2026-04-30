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
  const [prompts, setPrompts] = useState<any[]>([])
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  // AI optimize state
  const [showAI, setShowAI] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiHistory, setAiHistory] = useState<{role:string;content:string}[]>([])

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  useEffect(() => { api.config.getPrompts().then(setPrompts); api.config.getStages().then(setStages) }, [])
  const savePrompt = async () => {
    if(!editingPrompt) return
    if(editingPrompt.id) await api.config.updatePrompt(editingPrompt.id, editingPrompt)
    else await api.config.createPrompt(editingPrompt)
    setEditingPrompt(null); setShowAI(false); setAiHistory([]); setAiResult('')
    api.config.getPrompts().then(setPrompts); showToast('模板已保存')
  }

  const handleAIOptimize = async () => {
    if (!editingPrompt || !aiInput.trim()) return
    const userMsg = aiInput.trim()
    setAiInput('')
    setAiHistory(prev => [...prev, {role:'user', content: userMsg}])
    setAiLoading(true)
    setAiResult('')
    try {
      const res = await api.workflow.aiEdit?.({ text: editingPrompt.content, instruction: `作为Prompt工程专家，优化以下Prompt模板。用户需求：${userMsg}\n\n当前Prompt：\n${editingPrompt.content}\n\n请返回优化后的完整Prompt（保留变量占位符如{materials}和{previous_context}），不要添加任何解释。` })
      // Fallback to dedicated endpoint
      let result = res?.result
      if (!result) {
        const r = await api.config.optimizePrompt({ prompt: editingPrompt.content, instruction: userMsg })
        result = r.result
      }
      setAiResult(result)
      setAiHistory(prev => [...prev, {role:'ai', content: result}])
    } catch(e:any) {
      showToast(e.message||'AI优化失败','err')
    }
    setAiLoading(false)
  }

  const handleAcceptAI = () => {
    if (!aiResult || !editingPrompt) return
    setEditingPrompt({...editingPrompt, content: aiResult})
    setAiResult('')
    showToast('已采纳AI建议')
  }

  return (
    <div>
      <div className="mb-6">
        <h2 style={{fontSize:20,fontWeight:700}}>Prompt 模板管理</h2>
        <p style={{fontSize:13,color:'#86909c',marginTop:4}}>编辑和管理各阶段的Prompt模板，支持AI对话优化</p>
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
              <button className="btn btn-o btn-sm" onClick={()=>{setEditingPrompt(p);setShowAI(false);setAiHistory([]);setAiResult('')}}>编辑</button>
            </div>
          ))}
          {prompts.length===0 && <div style={{textAlign:'center',padding:40,color:'#c9cdd4'}}>暂无自定义模板</div>}
        </div>
      </div>

      {editingPrompt && (
        <div className="modal-mask" onClick={()=>{setEditingPrompt(null);setShowAI(false);setAiHistory([])}}>
          <div className="modal-box" style={{maxWidth:800,maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:16}}>编辑 Prompt 模板</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10,flex:1,minHeight:0}}>
              <div><label style={{fontSize:12,color:'#86909c',marginBottom:4,display:'block'}}>模板名称</label><input className="input" value={editingPrompt.name} onChange={e=>setEditingPrompt({...editingPrompt,name:e.target.value})}/></div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <label style={{fontSize:12,color:'#86909c'}}>Prompt 内容</label>
                <button className="btn btn-sm" style={{background:showAI?'#eef2ff':'#f3f4f6',color:'#4f46e5',fontSize:12}} onClick={()=>setShowAI(!showAI)}>
                  ✨ AI 对话优化
                </button>
              </div>
              <PromptVariablePills stage={editingPrompt.stage} onInsert={v=>setEditingPrompt({...editingPrompt,content:editingPrompt.content+`{${v}}`})}/>
              <textarea className="textarea" style={{height:showAI?180:350,minHeight:120}} value={editingPrompt.content} onChange={e=>setEditingPrompt({...editingPrompt,content:e.target.value})}/>

              {/* AI Chat Panel */}
              {showAI && (
                <div style={{border:'1px solid #ddd6fe',borderRadius:10,marginTop:4,background:'#faf5ff',display:'flex',flexDirection:'column',maxHeight:300}}>
                  <div style={{padding:'8px 12px',fontSize:12,fontWeight:600,color:'#6366f1',borderBottom:'1px solid #e5e7eb'}}>
                    AI 对话优化 — 用自然语言描述你想要的改进
                  </div>
                  {/* Chat history */}
                  {aiHistory.length > 0 && (
                    <div style={{flex:1,overflow:'auto',padding:10,maxHeight:160,display:'flex',flexDirection:'column',gap:8}}>
                      {aiHistory.map((msg,i) => (
                        <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
                          <div style={{
                            maxWidth:'85%',padding:'8px 12px',borderRadius:8,fontSize:12,
                            background:msg.role==='user'?'#6366f1':'#fff',color:msg.role==='user'?'#fff':'#1d2129',
                            border:msg.role==='user'?'none':'1px solid #e5e7eb',
                          }}>
                            <pre style={{whiteSpace:'pre-wrap',margin:0,fontFamily:'inherit',lineHeight:1.6}}>{msg.content.length > 500 ? msg.content.slice(0,500)+'...' : msg.content}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* AI result accept */}
                  {aiResult && (
                    <div style={{padding:'8px 12px',borderTop:'1px solid #e5e7eb',display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:11,color:'#86909c'}}>AI已生成优化结果</span>
                      <button className="btn btn-p btn-sm" onClick={handleAcceptAI}>采纳</button>
                      <button className="btn btn-o btn-sm" onClick={()=>setAiResult('')}>放弃</button>
                    </div>
                  )}
                  {/* Input */}
                  <div style={{padding:'8px 12px',borderTop:'1px solid #e5e7eb',display:'flex',gap:8}}>
                    <input className="input" style={{flex:1,fontSize:12,padding:'6px 10px'}} placeholder="如：让生成的文书更注重证据链完整性..." value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleAIOptimize()}} disabled={aiLoading}/>
                    <button className="btn btn-p btn-sm" onClick={handleAIOptimize} disabled={aiLoading||!aiInput.trim()}>
                      {aiLoading ? '优化中...' : '发送'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
                <button className="btn btn-o" onClick={()=>{setEditingPrompt(null);setShowAI(false);setAiHistory([])}}>取消</button>
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
