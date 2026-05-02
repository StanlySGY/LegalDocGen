import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'
import type { StageProgress, WorkflowNode, StageType, ReviewMode } from '../types'
import { STAGE_NAMES, STAGE_ORDER, STAGE_NAMES_LAWYER } from '../types'

export default function WorkflowPage() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<StageProgress[]>([])
  const [activeStage, setActiveStage] = useState<StageType>('fact_extraction')
  const [node, setNode] = useState<WorkflowNode | null>(null)
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [editingOutput, setEditingOutput] = useState(false)
  const [outputDraft, setOutputDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [selChannelId, setSelChannelId] = useState('')
  const [selModel, setSelModel] = useState('')
  const [caseName, setCaseName] = useState('')
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [variables, setVariables] = useState<{name:string;description:string}[]>([])

  // Review mode state
  const [reviewMode, setReviewMode] = useState<ReviewMode>('single')
  const [chainModels, setChainModels] = useState<any[]>([{}, {}, {}])
  const [compareModels, setCompareModels] = useState<any[]>([])
  const [chainSteps, setChainSteps] = useState<Record<string, string>>({})
  const [compareOutputs, setCompareOutputs] = useState<Record<string, string>>({})
  const [activeChainStep, setActiveChainStep] = useState<string>('generate')
  const [reviewId, setReviewId] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const loadProgress = useCallback(async () => { if(!caseId)return; const [p,c] = await Promise.all([api.workflow.progress(caseId), api.cases.get(caseId)]); setProgress(p); setCaseName(c.name) }, [caseId])
  const loadNode = useCallback(async (s: StageType) => { if(!caseId)return; const n = await api.workflow.getNode(caseId, s); setNode(n); setPrompt(n.prompt||''); setOutput(n.output||''); setEditingOutput(false); setStreamingText('') }, [caseId])
  const loadHistory = useCallback(async (s: StageType) => { if(!caseId)return; setHistory(await api.workflow.history(caseId, s)) }, [caseId])

  useEffect(() => { loadProgress() }, [loadProgress])
  useEffect(() => { loadNode(activeStage) }, [activeStage, loadNode])
  useEffect(() => { api.config.getStageVariables(activeStage).then(d => setVariables(d.variables)).catch(() => setVariables([])) }, [activeStage])
  useEffect(() => { api.config.getModels().then(d => {
    setModels(d.available)
    if(d.available.length){
      setSelChannelId(d.available[0].channel_id); setSelModel(d.available[0].model)
      setChainModels(d.available.slice(0,3).map((m:any)=>({channel_id:m.channel_id,model:m.model})))
      setCompareModels(d.available.slice(0,2).map((m:any)=>({channel_id:m.channel_id,model:m.model,channel_name:m.channel_name})))
    }
  }) }, [])

  const handleGenerate = async () => {
    if(!caseId)return
    if(!selChannelId){showToast('请先在「渠道管理」中添加API渠道','err');return}
    setGenerating(true); setStreamingText(''); setOutput('')
    try {
      let full = ''
      for await (const chunk of api.workflow.generateStream(caseId,{stage:activeStage,prompt,provider:selChannelId,model:selModel})) {
        if(chunk.error){showToast(chunk.error,'err');setGenerating(false);setStreamingText('');return}
        if(chunk.chunk){full+=chunk.chunk;setStreamingText(full)}
        if(chunk.done) break
      }
      setOutput(full); setStreamingText('')
      await loadProgress(); await loadNode(activeStage); await loadHistory(activeStage)
      showToast('生成完成')
    } catch(e:any){showToast(e.message||'生成失败','err')}
    setGenerating(false)
  }

  const handleChainReview = async () => {
    if(!caseId) return
    setGenerating(true); setChainSteps({}); setActiveChainStep('generate')
    try {
      let currentStep = 'generate'
      let currentParts: Record<string, string[]> = {generate:[], review:[], optimize:[]}
      for await (const event of api.workflow.reviewChain(caseId, {models: chainModels, prompt})) {
        if(event.error){showToast(event.error,'err');break}
        if(event.step && event.status === 'running') {
          currentStep = event.step; setActiveChainStep(event.step)
        }
        if(event.chunk) {
          currentParts[currentStep] = [...(currentParts[currentStep]||[]), event.chunk]
          setChainSteps(prev => ({...prev, [currentStep]: (currentParts[currentStep]||[]).join('')}))
        }
        if(event.step && event.status === 'done') {
          setChainSteps(prev => ({...prev, [event.step]: event.output}))
        }
        if(event.all_done || event.final) {
          const finalOutput = event.output || chainSteps.optimize || ''
          setOutput(finalOutput)
          await loadProgress(); await loadNode(activeStage); await loadHistory(activeStage)
          showToast('链式审查完成')
        }
      }
    } catch(e:any){showToast(e.message||'链式审查失败','err')}
    setGenerating(false)
  }

  const handleMultiCompare = async () => {
    if(!caseId) return
    setGenerating(true); setCompareOutputs({})
    try {
      for await (const event of api.workflow.multiCompare(caseId, {models: compareModels, prompt})) {
        if(event.error){showToast(event.error,'err');break}
        if(event.status === 'done' && event.outputs) {
          setCompareOutputs(event.outputs)
          showToast('多版本对比完成')
        }
      }
    } catch(e:any){showToast(e.message||'多版本对比失败','err')}
    setGenerating(false)
  }

  const handleSelectModel = async (modelKey: string) => {
    if(!caseId || !reviewId) return
    try {
      await api.workflow.reviewSelect(caseId, {review_id: reviewId, selected_model: modelKey})
      setOutput(compareOutputs[modelKey] || '')
      await loadProgress(); await loadNode(activeStage)
      showToast('已选择该版本')
    } catch(e:any){showToast(e.message||'选择失败','err')}
  }

  const handleSave = async () => { if(!caseId)return; await api.workflow.saveOutput(caseId,activeStage,outputDraft); setOutput(outputDraft); setEditingOutput(false); showToast('已保存') }
  const handleRollback = async (id:string) => { if(!caseId)return; const r=await api.workflow.rollback(caseId,id); setOutput(r.output); setNode({...node!,output:r.output,version:r.version}); await loadProgress(); await loadHistory(activeStage); showToast('已回滚') }

  const idx = STAGE_ORDER.indexOf(activeStage)
  const icons:Record<StageType,string> = {fact_extraction:'📋',legal_analysis:'⚖️',dispute_focus:'🎯',draft_generation:'📝',review_optimization:'🔍'}

  return (
    <div>
      <div className="breadcrumb mb-5">
        <a onClick={()=>navigate('/cases')}>案件管理</a><span style={{color:'var(--border)'}}>/</span>
        <a onClick={()=>navigate(`/cases/${caseId}`)}>{caseName||'案件'}</a><span style={{color:'var(--border)'}}>/</span>
        <span className="current">逐步精调</span>
      </div>

      <div className="stepper-bar">
        {STAGE_ORDER.map((stage,i) => {
          const p = progress.find(x=>x.stage===stage)
          const isDone = p?.status==='completed', isOn = stage===activeStage
          const isLocked = p?.locked ?? false
          return (
            <div key={stage} className="flex items-center">
              <div className={`step ${isOn?'on':isDone?'done':isLocked?'locked':'pending'}`}
                onClick={()=>!isLocked && setActiveStage(stage)}
                title={isLocked ? p?.locked_reason : ''}
                style={isLocked ? {opacity:0.4,cursor:'not-allowed'} : undefined}>
                <div className="step-dot">{isDone?'✓':icons[stage]}</div>
                <span className="step-name">{STAGE_NAMES_LAWYER[stage] || STAGE_NAMES[stage]}</span>
                
              </div>
              {i<STAGE_ORDER.length-1 && <div className={`step-line ${isDone?'done':''}`}/>}
            </div>
          )
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card">
          <div className="card-hd">
            <span className="card-title">{STAGE_NAMES_LAWYER[activeStage] || STAGE_NAMES[activeStage]}</span>
            <div className="flex gap-2">
              <button className="btn btn-o btn-sm" onClick={()=>{loadHistory(activeStage);setShowHistory(!showHistory)}}>{showHistory?'关闭历史':'历史记录'}</button>
            </div>
          </div>
          <div className="collapse-toggle" onClick={()=>setShowAdvanced(!showAdvanced)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14,transform:showAdvanced?'rotate(90deg)':'',transition:'transform 0.2s'}}><path d="M9 18l6-6-6-6"/></svg>
            高级设置
          </div>
          {showAdvanced && (
            <div className="collapse-panel">
              <div style={{marginBottom:8}}>
                <label style={{fontSize:11,color:'var(--text-secondary)',display:'block',marginBottom:4}}>AI 模型</label>
                <select className="select" style={{width:'100%',fontSize:12,padding:'5px 10px'}} value={`${selChannelId}|${selModel}`} onChange={e=>{
                  const [cid,mid] = e.target.value.split('|');
                  setSelChannelId(cid); setSelModel(mid);
                }}>
                  {models.length===0 && <option>未配置模型（联系管理员）</option>}
                  {models.map((m,i)=><option key={i} value={`${m.channel_id}|${m.model}`}>{m.model}</option>)}
                </select>
              </div>
              <div style={{marginBottom:4}}>
                <label style={{fontSize:11,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Prompt 模板</label>
                <textarea className="textarea" style={{height:200}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="编辑 Prompt 模板..."/>
              </div>
            </div>
          )}

          {activeStage === 'review_optimization' && (
            <div style={{marginTop:12,marginBottom:12}}>
              <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:6,fontWeight:600}}>审查模式</div>
              <div className="flex gap-2">
                {(['single','chain','compare'] as ReviewMode[]).map(m => (
                  <button key={m} className={`btn btn-sm ${reviewMode===m?'btn-p':'btn-o'}`} onClick={()=>setReviewMode(m)}>
                    {m==='single'?'单模型':m==='chain'?'链式审查':'多版本对比'}
                  </button>
                ))}
              </div>

              {reviewMode === 'chain' && (
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                  {['生成模型','审查模型','优化模型'].map((label,i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{fontSize:12,color:'var(--text-secondary)',minWidth:65}}>{label}</span>
                      <select className="select" style={{flex:1,fontSize:12,padding:'4px 8px'}} value={`${chainModels[i]?.channel_id||''}|${chainModels[i]?.model||''}`}
                        onChange={e=>{const[cid,mid]=e.target.value.split('|');const nm=[...chainModels];nm[i]={channel_id:cid,model:mid};setChainModels(nm)}}>
                        {models.map((m,j)=><option key={j} value={`${m.channel_id}|${m.model}`}>{m.model}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {reviewMode === 'compare' && (
                <div style={{marginTop:8}}>
                  <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:4}}>勾选参与对比的模型（至少2个）：</div>
                  {models.map((m,i) => {
                    const key = `${m.channel_id}|${m.model}`
                    const checked = compareModels.some(c => c.channel_id===m.channel_id && c.model===m.model)
                    return (
                      <label key={i} className="flex items-center gap-2" style={{padding:'3px 0',fontSize:12,cursor:'pointer'}}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setCompareModels(prev => checked ? prev.filter(c=>!(c.channel_id===m.channel_id&&c.model===m.model)) : [...prev, {channel_id:m.channel_id,model:m.model,channel_name:m.channel_name}])
                        }}/>
                        {m.model}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeStage === 'review_optimization' && reviewMode !== 'single' ? (
            <button className="btn btn-p btn-lg" style={{width:'100%'}} onClick={reviewMode==='chain'?handleChainReview:handleMultiCompare} disabled={generating || (reviewMode==='chain'&&chainModels.length<3) || (reviewMode==='compare'&&compareModels.length<2)}>
              {generating ? '处理中...' : reviewMode==='chain'?'开始链式审查':'开始多版本对比'}
            </button>
          ) : (
          <button className="btn btn-p btn-lg" style={{width:'100%',marginTop:12}} onClick={handleGenerate} disabled={generating}>
            {generating ? <span className="flex items-center justify-center gap-2"><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0110 10"/></svg>生成中...</span> : node?.output?'重新生成':'开始生成'}
          </button>
          )}
          {showHistory && history.length>0 && (
            <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8,fontWeight:600}}>版本历史</div>
              <div style={{maxHeight:150,overflow:'auto',display:'flex',flexDirection:'column',gap:6}}>
                {history.map(h=>(
                  <div key={h.id} className="flex items-center justify-between" style={{background:'var(--bg-secondary)',borderRadius:8,padding:'8px 12px'}}>
                    <div className="flex items-center gap-2">
                      <span className="tag t-purple">{new Date(h.created_at).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      <span style={{fontSize:11,color:'var(--text-secondary)'}}>{new Date(h.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <button className="btn btn-o btn-sm" onClick={()=>handleRollback(h.id)}>恢复此版本</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-hd">
            <span className="card-title">生成结果</span>
            <div className="flex gap-2">
              {output&&!editingOutput && !(activeStage==='review_optimization'&&reviewMode!=='single') && <>
                <button className="btn btn-o btn-sm" onClick={()=>{setEditingOutput(true);setOutputDraft(output)}}>编辑</button>
                <button className="btn btn-o btn-sm" onClick={()=>{navigator.clipboard.writeText(output);showToast('已复制')}}>复制</button>
              </>}
            </div>
          </div>
          {editingOutput ? (
            <div>
              <textarea className="textarea" style={{height:400}} value={outputDraft} onChange={e=>setOutputDraft(e.target.value)}/>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button className="btn btn-p btn-sm" onClick={handleSave}>保存</button>
                <button className="btn btn-o btn-sm" onClick={()=>setEditingOutput(false)}>取消</button>
              </div>
            </div>
          ) : activeStage==='review_optimization' && reviewMode==='chain' && (generating || Object.keys(chainSteps).length>0) ? (
            <div>
              <div className="flex gap-2" style={{marginBottom:12,borderBottom:'1px solid var(--border)',paddingBottom:8}}>
                {[{key:'generate',label:'生成'},{key:'review',label:'审查'},{key:'optimize',label:'优化'}].map(s=>(
                  <button key={s.key} className={`btn btn-sm ${activeChainStep===s.key?'btn-p':'btn-o'}`}
                    onClick={()=>setActiveChainStep(s.key)}>
                    {s.label}{chainSteps[s.key]?' ✓':''}
                  </button>
                ))}
              </div>
              <div style={{height:420,overflow:'auto',border:'1px solid var(--border)',borderRadius:8,padding:20}}>
                {chainSteps[activeChainStep] ? (
                  <div className="md"><ReactMarkdown>{chainSteps[activeChainStep]}</ReactMarkdown></div>
                ) : generating ? (
                  <span className="cursor-blink"/>
                ) : (
                  <p style={{color:'var(--text-secondary)'}}>等待执行...</p>
                )}
                {generating && chainSteps[activeChainStep] && <span className="cursor-blink"/>}
              </div>
            </div>
          ) : activeStage==='review_optimization' && reviewMode==='compare' && Object.keys(compareOutputs).length>0 ? (
            <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(Object.keys(compareOutputs).length,3)},1fr)`,gap:12,height:520,overflow:'auto'}}>
              {Object.entries(compareOutputs).map(([key,text])=>(
                <div key={key} style={{border:'1px solid var(--border)',borderRadius:8,display:'flex',flexDirection:'column'}}>
                  <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--accent-hover)'}}>{key}</span>
                    <button className="btn btn-p btn-sm" onClick={()=>handleSelectModel(key)}>采用此版本</button>
                  </div>
                  <div style={{flex:1,overflow:'auto',padding:12}} className="md"><ReactMarkdown>{text}</ReactMarkdown></div>
                </div>
              ))}
            </div>
          ) : generating && streamingText ? (
            <div style={{height:500,overflow:'auto',border:'1px solid var(--border)',borderRadius:8,padding:20}}>
              <div className="md"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
              <span className="cursor-blink"/>
            </div>
          ) : output ? (
            <div style={{height:500,overflow:'auto',border:'1px solid var(--border)',borderRadius:8,padding:20}}>
              <div className="md"><ReactMarkdown>{output}</ReactMarkdown></div>
            </div>
          ) : (
            <div className="empty" style={{height:500}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:48,height:48}}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p>点击「开始生成」获取结果</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between" style={{marginTop:20}}>
        <button className="btn btn-o" disabled={idx===0} onClick={()=>setActiveStage(STAGE_ORDER[idx-1])}>← 上一阶段</button>
        <button className="btn btn-o" disabled={idx===STAGE_ORDER.length-1} onClick={()=>setActiveStage(STAGE_ORDER[idx+1])}>下一阶段 →</button>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
