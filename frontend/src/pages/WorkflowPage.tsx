import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'
import type { StageProgress, WorkflowNode, StageType } from '../types'
import { STAGE_NAMES, STAGE_ORDER } from '../types'

interface Props { caseId: string; onBack: () => void; onCaseNav: () => void }

export default function WorkflowPage({ caseId, onBack, onCaseNav }: Props) {
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

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const loadProgress = useCallback(async () => { const [p,c] = await Promise.all([api.workflow.progress(caseId), api.cases.get(caseId)]); setProgress(p); setCaseName(c.name) }, [caseId])
  const loadNode = useCallback(async (s: StageType) => { const n = await api.workflow.getNode(caseId, s); setNode(n); setPrompt(n.prompt||''); setOutput(n.output||''); setEditingOutput(false); setStreamingText('') }, [caseId])
  const loadHistory = useCallback(async (s: StageType) => { setHistory(await api.workflow.history(caseId, s)) }, [caseId])

  useEffect(() => { loadProgress() }, [loadProgress])
  useEffect(() => { loadNode(activeStage) }, [activeStage, loadNode])
  useEffect(() => { api.config.getModels().then(d => { setModels(d.available); if(d.available.length){setSelChannelId(d.available[0].channel_id);setSelModel(d.available[0].model)} }) }, [])

  const handleGenerate = async () => {
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

  const handleSave = async () => { await api.workflow.saveOutput(caseId,activeStage,outputDraft); setOutput(outputDraft); setEditingOutput(false); showToast('已保存') }
  const handleRollback = async (id:string) => { const r=await api.workflow.rollback(caseId,id); setOutput(r.output); setNode({...node!,output:r.output,version:r.version}); await loadProgress(); await loadHistory(activeStage); showToast('已回滚') }

  const idx = STAGE_ORDER.indexOf(activeStage)
  const icons:Record<StageType,string> = {fact_extraction:'📋',legal_analysis:'⚖️',dispute_focus:'🎯',draft_generation:'📝',review_optimization:'🔍'}

  return (
    <div>
      <div className="breadcrumb mb-5">
        <a onClick={onCaseNav}>案件管理</a><span style={{color:'#d1d5db'}}>/</span>
        <a onClick={onBack}>{caseName||'案件'}</a><span style={{color:'#d1d5db'}}>/</span>
        <span className="current">工作流</span>
      </div>

      <div className="stepper-bar">
        {STAGE_ORDER.map((stage,i) => {
          const p = progress.find(x=>x.stage===stage)
          const isDone = p?.status==='completed', isOn = stage===activeStage
          return (
            <div key={stage} className="flex items-center">
              <div className={`step ${isOn?'on':isDone?'done':'pending'}`} onClick={()=>setActiveStage(stage)}>
                <div className="step-dot">{isDone?'✓':icons[stage]}</div>
                <span className="step-name">{STAGE_NAMES[stage]}</span>
                {p&&p.version>0 && <span className="step-ver">v{p.version}</span>}
              </div>
              {i<STAGE_ORDER.length-1 && <div className={`step-line ${isDone?'done':''}`}/>}
            </div>
          )
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Prompt */}
        <div className="card">
          <div className="card-hd">
            <span className="card-title">Prompt 配置</span>
            <div className="flex gap-2 items-center">
              <select className="select" style={{width:'auto',fontSize:12,padding:'5px 10px',maxWidth:200}} value={`${selChannelId}|${selModel}`} onChange={e=>{
                const [cid,mid] = e.target.value.split('|');
                setSelChannelId(cid); setSelModel(mid);
              }}>
                {models.length===0 && <option>未配置渠道</option>}
                {models.map((m,i)=><option key={i} value={`${m.channel_id}|${m.model}`}>{m.channel_name} / {m.model}</option>)}
              </select>
              <button className="btn btn-o btn-sm" onClick={()=>{loadHistory(activeStage);setShowHistory(!showHistory)}}>{showHistory?'关闭':'历史'}</button>
            </div>
          </div>
          <textarea className="textarea" style={{height:260}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="编辑 Prompt..."/>
          <button className="btn btn-p btn-lg" style={{width:'100%',marginTop:12}} onClick={handleGenerate} disabled={generating}>
            {generating ? <span className="flex items-center justify-center gap-2"><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0110 10"/></svg>生成中...</span> : node?.output?'重新生成':'开始生成'}
          </button>
          {showHistory && history.length>0 && (
            <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid #e5e7eb'}}>
              <div style={{fontSize:12,color:'#86909c',marginBottom:8,fontWeight:600}}>版本历史</div>
              <div style={{maxHeight:150,overflow:'auto',display:'flex',flexDirection:'column',gap:6}}>
                {history.map(h=>(
                  <div key={h.id} className="flex items-center justify-between" style={{background:'#f7f8fa',borderRadius:8,padding:'8px 12px'}}>
                    <div className="flex items-center gap-2">
                      <span className="tag t-purple">v{h.version}</span>
                      <span style={{fontSize:11,color:'#86909c'}}>{new Date(h.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <button className="btn btn-o btn-sm" onClick={()=>handleRollback(h.id)}>回滚</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Output */}
        <div className="card">
          <div className="card-hd">
            <span className="card-title">生成结果</span>
            <div className="flex gap-2">
              {output&&!editingOutput && <>
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
          ) : generating && streamingText ? (
            <div style={{height:500,overflow:'auto',border:'1px solid #e5e7eb',borderRadius:8,padding:20}}>
              <div className="md"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
              <span className="cursor-blink"/>
            </div>
          ) : output ? (
            <div style={{height:500,overflow:'auto',border:'1px solid #e5e7eb',borderRadius:8,padding:20}}>
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
