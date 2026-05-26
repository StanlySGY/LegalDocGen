import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../services/api'
import type { StageProgress, WorkflowNode, StageType } from '../types'
import { STAGE_NAMES, STAGE_ORDER } from '../types'

interface Props { caseId: string; onBack: () => void; onCaseNav: () => void }

const stageGuides: Record<StageType, { input: string; output: string; risk: string }> = {
  fact_extraction: { input: '上传材料与案件基本信息', output: '当事人、关键事实、证据清单', risk: '核对事实是否均可追溯到材料' },
  legal_analysis: { input: '案件要素与证据目录', output: '法律关系、适用规则、权利义务', risk: '法条与诉讼策略必须人工复核' },
  dispute_focus: { input: '事实提取与法律关系分析', output: '事实争议、法律争议、证据关键点', risk: '避免遗漏对方可能抗辩点' },
  draft_generation: { input: '前三阶段分析结论', output: '诉状、仲裁申请书等初稿', risk: '金额、主体、请求事项逐项核验' },
  review_optimization: { input: '文书初稿与全部阶段输出', output: '逻辑、依据、完整性和表达审查', risk: '最终提交前仍需律师确认' },
}

const statusLabel = (item?: StageProgress) => item?.has_output ? '已完成' : item?.status === 'running' ? '生成中' : '待处理'
const statusClass = (item?: StageProgress) => item?.has_output ? 't-green' : item?.status === 'running' ? 't-orange' : 't-gray'

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

  useEffect(() => { loadProgress().catch((e: any) => showToast(e.message || '工作流加载失败', 'err')) }, [loadProgress])
  useEffect(() => { loadNode(activeStage).catch((e: any) => showToast(e.message || '阶段加载失败', 'err')) }, [activeStage, loadNode])
  useEffect(() => {
    api.config.getModels()
      .then(d => { setModels(d.available); if(d.available.length){setSelChannelId(d.available[0].channel_id);setSelModel(d.available[0].model)} })
      .catch((e: any) => showToast(e.message || '模型加载失败', 'err'))
  }, [])

  const idx = STAGE_ORDER.indexOf(activeStage)
  const previousStage = idx > 0 ? STAGE_ORDER[idx - 1] : null
  const previousDone = !previousStage || Boolean(progress.find(item => item.stage === previousStage)?.has_output)
  const activeProgress = progress.find(item => item.stage === activeStage)
  const completedCount = progress.filter(item => item.has_output).length
  const missingStages = progress.filter(item => !item.has_output).map(item => item.name)
  const canExport = progress.length === STAGE_ORDER.length && missingStages.length === 0
  const guide = stageGuides[activeStage]
  const canGenerate = Boolean(selChannelId) && previousDone && !generating

  const handleGenerate = async () => {
    if (!previousDone && previousStage) {
      showToast(`请先完成「${STAGE_NAMES[previousStage]}」`, 'err')
      return
    }
    if(!selChannelId){showToast('请先在「渠道管理」中添加 API 渠道','err');return}
    setGenerating(true); setStreamingText(''); setOutput('')
    try {
      let full = ''
      for await (const chunk of api.workflow.generateStream(caseId,{stage:activeStage,prompt,provider:selChannelId,model:selModel})) {
        if(chunk.error) throw new Error(chunk.error)
        if(chunk.chunk){full+=chunk.chunk;setStreamingText(full)}
        if(chunk.done) break
      }
      setOutput(full); setStreamingText('')
      await loadProgress(); await loadNode(activeStage); await loadHistory(activeStage)
      showToast('生成完成')
    } catch(e:any){showToast(e.message||'生成失败','err')}
    finally { setGenerating(false); setStreamingText('') }
  }

  const toggleHistory = async () => {
    const next = !showHistory
    setShowHistory(next)
    if (!next) return
    try {
      await loadHistory(activeStage)
    } catch (e: any) {
      showToast(e.message || '历史加载失败', 'err')
    }
  }

  const handleExport = async () => {
    if (!canExport) {
      showToast(`请先完成全部阶段，仍缺少：${missingStages.join('、')}`, 'err')
      return
    }
    try {
      await api.workflow.export(caseId)
      showToast('导出成功')
    } catch(e:any){showToast(e.message||'导出失败','err')}
  }

  const handleSave = async () => {
    try {
      await api.workflow.saveOutput(caseId, activeStage, outputDraft)
      setOutput(outputDraft)
      setEditingOutput(false)
      showToast('已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', 'err')
    }
  }

  const handleRollback = async (id:string) => {
    try {
      const r = await api.workflow.rollback(caseId, id)
      setOutput(r.output)
      setNode({...node!, output: r.output, version: r.version})
      await loadProgress()
      await loadHistory(activeStage)
      showToast('已回滚')
    } catch (e: any) {
      showToast(e.message || '回滚失败', 'err')
    }
  }

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
          const isDone = Boolean(p?.has_output)
          const isOn = stage===activeStage
          return (
            <div key={stage} className="flex items-center">
              <div className={`step ${isOn?'on':isDone?'done':'pending'}`} onClick={()=>setActiveStage(stage)}>
                <div className="step-dot">{isDone?'✓':i + 1}</div>
                <span className="step-name">{STAGE_NAMES[stage]}</span>
                {p&&p.version>0 && <span className="step-ver">v{p.version}</span>}
              </div>
              {i<STAGE_ORDER.length-1 && <div className={`step-line ${isDone?'done':''}`}/>}
            </div>
          )
        })}
      </div>

      <div className="stage-guide">
        <div className="trust-card accent"><strong>当前阶段</strong><span>{STAGE_NAMES[activeStage]} · {statusLabel(activeProgress)}</span></div>
        <div className="trust-card"><strong>输入来源</strong><span>{guide.input}</span></div>
        <div className={`trust-card ${previousDone ? 'success' : 'warn'}`}><strong>前置条件</strong><span>{previousDone ? '可生成当前阶段内容' : `需先完成 ${previousStage ? STAGE_NAMES[previousStage] : ''}`}</span></div>
      </div>

      <div className="card workflow-summary">
        <div>
          <div style={{fontWeight:600}}>交付完成度：{completedCount}/{STAGE_ORDER.length}</div>
          <div style={{fontSize:12,color:'#86909c',marginTop:4}}>
            {canExport ? '全部阶段已完成，可导出正式 Word 文档。' : `导出前需补齐：${missingStages.join('、') || '加载中'}`}
          </div>
        </div>
        <span className={`tag ${canExport ? 't-green' : 't-orange'}`}>{canExport ? '可导出' : '待完善'}</span>
      </div>

      <div className="workflow-grid">
        <div className="card">
          <div className="card-hd">
            <span className="card-title">Prompt 与模型</span>
            <div className="flex gap-2 items-center">
              <select className="select" style={{width:'auto',fontSize:12,padding:'5px 10px',maxWidth:220}} value={`${selChannelId}|${selModel}`} onChange={e=>{
                const [cid,mid] = e.target.value.split('|')
                setSelChannelId(cid); setSelModel(mid)
              }}>
                {models.length===0 && <option>未配置渠道</option>}
                {models.map((m,i)=><option key={i} value={`${m.channel_id}|${m.model}`}>{m.channel_name} / {m.model}</option>)}
              </select>
              <button className="btn btn-o btn-sm" onClick={toggleHistory}>{showHistory?'关闭':'历史'}</button>
            </div>
          </div>
          <div className="notice-card notice-info" style={{marginBottom:12}}>
            <div><strong>本阶段目标：{guide.output}</strong><span>生成内容必须基于材料和前序阶段输出，不能补写未出现的事实。</span></div>
          </div>
          {!previousDone && previousStage && (
            <div className="notice-card notice-warn"><div><strong>暂不建议生成</strong><span>请先完成「{STAGE_NAMES[previousStage]}」，以保证当前阶段引用链完整。</span></div></div>
          )}
          <textarea className="textarea" style={{height:246}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="编辑 Prompt..."/>
          <button className="btn btn-p btn-lg" style={{width:'100%',marginTop:12}} onClick={handleGenerate} disabled={!canGenerate}>
            {generating ? <span className="flex items-center justify-center gap-2"><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0110 10"/></svg>生成中...</span> : node?.output?'重新生成当前阶段':'生成当前阶段'}
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

        <div className="card">
          <div className="card-hd">
            <span className="card-title">生成结果</span>
            <div className="flex gap-2">
              <span className={`tag ${statusClass(activeProgress)}`}>{statusLabel(activeProgress)}</span>
              {output&&!editingOutput && <>
                <button className="btn btn-o btn-sm" onClick={()=>{setEditingOutput(true);setOutputDraft(output)}}>编辑</button>
                <button className="btn btn-o btn-sm" onClick={async()=>{try{await navigator.clipboard.writeText(output);showToast('已复制')}catch{showToast('复制失败','err')}}}>复制</button>
              </>}
            </div>
          </div>
          <div className="output-trust-strip">
            <div>依据材料与前序阶段生成</div>
            <div>法条、金额、策略需人工复核</div>
            <div>{guide.risk}</div>
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
            <div className="workflow-output-shell">
              <div className="md"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
              <span className="cursor-blink"/>
            </div>
          ) : output ? (
            <div className="workflow-output-shell">
              <div className="md"><ReactMarkdown>{output}</ReactMarkdown></div>
            </div>
          ) : (
            <div className="empty refined-empty" style={{height:500}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:48,height:48}}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p>{previousDone ? '点击「生成当前阶段」获取结果' : '完成前置阶段后再生成当前结果'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between" style={{marginTop:20}}>
        <button className="btn btn-o" disabled={idx===0} onClick={()=>setActiveStage(STAGE_ORDER[idx-1])}>上一阶段</button>
        <button className="btn btn-p" onClick={handleExport} disabled={!canExport}>导出为 Word</button>
        <button className="btn btn-o" disabled={idx===STAGE_ORDER.length-1} onClick={()=>setActiveStage(STAGE_ORDER[idx+1])}>下一阶段</button>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
