import { useToast } from '../hooks/useToast'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import Toaster from '../components/Toaster'
import ConfirmDialog from '../components/ConfirmDialog'
import ExportOptionsModal from '../components/ExportOptionsModal'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api, quotaUpgradeMessage } from '../services/api'
import type { StageProgress, WorkflowNode, StageType, Case } from '../types'
import { STAGE_NAMES, STAGE_ORDER, DOCUMENT_TYPES } from '../types'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

const stageGuides: Record<StageType, { input: string; output: string; action: string; review: string; risk: string }> = {
  fact_extraction: { input: '上传材料与案件基本信息', output: '当事人、关键事实、证据清单', action: '先确认合同、流水、通知、聊天记录等核心材料已经解析，再抽取事实。', review: '逐条核对主体、时间、金额和证据来源，缺依据的事实不要直接进入后续阶段。', risk: '核对事实是否均可追溯到材料' },
  legal_analysis: { input: '案件要素与证据目录', output: '法律关系、适用规则、权利义务', action: '基于已确认事实分析法律关系，不要让模型补写材料中没有的情节。', review: '重点复核法律关系定性、请求权基础、时效和管辖等关键判断。', risk: '法条与诉讼策略必须人工复核' },
  dispute_focus: { input: '事实提取与法律关系分析', output: '事实争议、法律争议、证据关键点', action: '把对方可能抗辩点和己方证据短板列清楚，再进入文书起草。', review: '检查是否遗漏付款、履行、通知、违约责任等常见争点。', risk: '避免遗漏对方可能抗辩点' },
  draft_generation: { input: '前三阶段分析结论', output: '诉状、仲裁申请书等初稿', action: '先确认诉请结构和金额口径，再生成可编辑初稿。', review: '逐项核对当事人信息、请求事项、事实理由、金额和证据引用。', risk: '金额、主体、请求事项逐项核验' },
  review_optimization: { input: '文书初稿与全部阶段输出', output: '逻辑、依据、完整性和表达审查', action: '对照前四阶段输出做最终审查，标出仍需人工核验事项。', review: '检查法条、金额、证据链、诉请表达和提交前风险提示。', risk: '最终提交前仍需律师确认' },
}

const statusLabel = (item?: StageProgress) => item?.has_output ? '已完成' : item?.status === 'running' ? '生成中' : '待处理'
const statusClass = (item?: StageProgress) => item?.has_output ? 't-green' : item?.status === 'running' ? 't-orange' : 't-gray'
const finalReviewItems = [
  { id: 'parties', label: '当事人身份信息已核对', hint: '姓名、主体资格、联系方式、代理关系与送达信息无误。' },
  { id: 'claims', label: '诉请、金额和计算依据已核对', hint: '本金、利息、违约金、期间和计算口径已人工确认。' },
  { id: 'evidence', label: '证据引用和页码来源已核对', hint: '关键事实均能追溯到材料、证据目录或事实时间线。' },
  { id: 'law', label: '法条依据和诉讼策略已核对', hint: '引用法条现行有效，管辖、时效和风险提示已复核。' },
  { id: 'wording', label: '文书表达和提交风险已核对', hint: '最终措辞、遗漏事项和需当事人确认内容已检查。' },
]

export default function WorkflowPage() {
  const { caseId: caseIdParam } = useParams<{ caseId: string }>()
  const caseId = caseIdParam!
  const navigate = useNavigate()
  const [progress, setProgress] = useState<StageProgress[]>([])
  const [activeStage, setActiveStage] = useState<StageType>('fact_extraction')
  const [node, setNode] = useState<WorkflowNode | null>(null)
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [editingOutput, setEditingOutput] = useState(false)
  const [outputDraft, setOutputDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [progressLoading, setProgressLoading] = useState(true)
  const [nodeLoading, setNodeLoading] = useState(true)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [streamingText, setStreamingText] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [selChannelId, setSelChannelId] = useState('')
  const [selModel, setSelModel] = useState('')
  const [caseName, setCaseName] = useState('')
  const [caseData, setCaseData] = useState<Case | null>(null)
  const { toasts, showToast, removeToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()
  const [showExportModal, setShowExportModal] = useState(false)
  const reviewStorageKey = `legaldocgen_final_review_${caseId}`
  const [finalReviewChecked, setFinalReviewChecked] = useState<string[]>([])
  const [finalReviewedAt, setFinalReviewedAt] = useState('')
  const [verifyingLegal, setVerifyingLegal] = useState(false)
  const [legalVerifyResult, setLegalVerifyResult] = useState<any>(null)

  const loadProgress = useCallback(async () => {
    setProgressLoading(true)
    try {
      const [p,c] = await Promise.all([api.workflow.progress(caseId), api.cases.get(caseId)])
      setProgress(p)
      setCaseName(c.name)
      setCaseData(c)
    } finally {
      setProgressLoading(false)
    }
  }, [caseId])
  const loadNode = useCallback(async (s: StageType) => {
    setNodeLoading(true)
    try {
      const n = await api.workflow.getNode(caseId, s)
      setNode(n)
      setPrompt(n.prompt||'')
      setOutput(n.output||'')
      setEditingOutput(false)
      setStreamingText('')
      setGenerationError('')
    } finally {
      setNodeLoading(false)
    }
  }, [caseId])
  const loadHistory = useCallback(async (s: StageType) => { setHistory(await api.workflow.history(caseId, s)) }, [caseId])

  useEffect(() => { loadProgress().catch((e: any) => showToast(e.message || '工作流加载失败', { type: 'err' })) }, [loadProgress])
  useEffect(() => { loadNode(activeStage).catch((e: any) => showToast(e.message || '阶段加载失败', { type: 'err' })) }, [activeStage, loadNode])
  useEffect(() => {
    setModelsLoading(true)
    api.config.getModels()
      .then(d => { setModels(d.available); if(d.available.length){setSelChannelId(d.available[0].channel_id);setSelModel(d.available[0].model)} })
      .catch((e: any) => showToast(e.message || '模型加载失败', { type: 'err' }))
      .finally(() => setModelsLoading(false))
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(reviewStorageKey)
    if (!stored) return
    try {
      const data = JSON.parse(stored)
      setFinalReviewChecked(Array.isArray(data.checked) ? data.checked : [])
      setFinalReviewedAt(typeof data.reviewedAt === 'string' ? data.reviewedAt : '')
    } catch {
      localStorage.removeItem(reviewStorageKey)
    }
  }, [reviewStorageKey])

  const idx = STAGE_ORDER.indexOf(activeStage)
  const previousStage = idx > 0 ? STAGE_ORDER[idx - 1] : null
  const nextStage = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null
  const previousDone = !previousStage || Boolean(progress.find(item => item.stage === previousStage)?.has_output)
  const activeProgress = progress.find(item => item.stage === activeStage)
  const completedCount = progress.filter(item => item.has_output).length
  const missingStages = progress.filter(item => !item.has_output).map(item => item.name)
  const canExport = progress.length === STAGE_ORDER.length && missingStages.length === 0
  const finalReviewComplete = finalReviewItems.every(item => finalReviewChecked.includes(item.id))
  const guide = stageGuides[activeStage]
  const isArchived = caseData?.status === 'archived'
  const canGenerate = Boolean(selChannelId) && previousDone && !generating && !nodeLoading && !modelsLoading && !isArchived

  const resetFinalReview = () => {
    setFinalReviewChecked([])
    setFinalReviewedAt('')
    localStorage.removeItem(reviewStorageKey)
  }

  const toggleFinalReviewItem = (id: string) => {
    setFinalReviewChecked(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      setFinalReviewedAt('')
      localStorage.removeItem(reviewStorageKey)
      return next
    })
  }

  const confirmFinalReview = () => {
    if (!canExport) {
      showToast('请先完成全部五个阶段，再进行律师最终复核', { type: 'err' })
      return
    }
    if (!finalReviewComplete) {
      showToast('请逐项勾选最终复核清单', { type: 'err' })
      return
    }
    const reviewedAt = new Date().toISOString()
    setFinalReviewedAt(reviewedAt)
    localStorage.setItem(reviewStorageKey, JSON.stringify({ checked: finalReviewChecked, reviewedAt }))
    showToast('已确认律师最终复核')
  }

  useKeyboardShortcut({ key: 'Enter', ctrlKey: true }, () => {
    // 忽略 textarea 中的 Ctrl+Enter，避免编辑内容时误触发生成
    const activeEl = document.activeElement
    if (activeEl && activeEl.tagName === 'TEXTAREA') return
    if (canGenerate && !generating) {
      handleGenerate()
    }
  }, [canGenerate, generating])

  const workflowLoading = progressLoading || nodeLoading
  const deliveryChecks = [
    { label: '五阶段内容齐备', done: canExport, hint: canExport ? '可进入最终导出' : '仍需完成剩余阶段' },
    { label: '证据引用复核', done: completedCount >= 1, hint: '检查事实是否能追溯到材料页码' },
    { label: '法条金额复核', done: completedCount >= 4, hint: '导出前人工核对法条、金额与诉请' },
    { label: '律师最终定稿', done: Boolean(finalReviewedAt), hint: finalReviewedAt ? '已完成导出前人工确认' : '导出前需逐项确认最终复核清单' },
  ]

  const handleGenerate = async () => {
    if (!previousDone && previousStage) {
      showToast(`请先完成「${STAGE_NAMES[previousStage]}」`, { type: 'err' })
      return
    }
    if(!selChannelId){showToast('请先在「渠道管理」中添加 API 渠道', { type: 'err' });return}
    if (output && !generating) {
      const confirmed = await confirm({
        title: '重新生成当前阶段',
        message: '当前阶段已有结果。重新生成会替换当前页面显示内容，但历史版本仍可在版本历史中查看。',
        confirmText: '重新生成',
        variant: 'danger'
      })
      if (!confirmed) return
    }
    const previousOutput = output
    resetFinalReview()
    setGenerating(true); setGenerationError(''); setStreamingText(''); setOutput('')
    let full = ''
    try {
      for await (const chunk of api.workflow.generateStream(caseId,{stage:activeStage,prompt,provider:selChannelId,model:selModel})) {
        if(chunk.error) throw new Error(chunk.error)
        if(chunk.chunk){full+=chunk.chunk;setStreamingText(full)}
        if(chunk.done) break
      }
      setOutput(full); setStreamingText('')
      await loadProgress(); await loadNode(activeStage); await loadHistory(activeStage)
      showToast('生成完成')
    } catch(e:any){
      const msg = quotaUpgradeMessage(e) || e.message || '生成失败'
      setOutput(full || previousOutput)
      setGenerationError(msg)
      showToast(full ? '生成中断，已保留部分内容' : previousOutput ? '生成失败，已保留原结果' : msg, { type: 'err' })
    }
    finally { setGenerating(false); setStreamingText('') }
  }

  const toggleHistory = async () => {
    const next = !showHistory
    setShowHistory(next)
    if (!next) return
    try {
      await loadHistory(activeStage)
    } catch (e: any) {
      showToast(e.message || '历史加载失败', { type: 'err' })
    }
  }

  const handleExportClick = () => {
    if (!canExport) {
      showToast(`请先完成全部阶段，仍缺少：${missingStages.join('、')}`, { type: 'err' })
      return
    }
    if (!finalReviewComplete || !finalReviewedAt) {
      showToast('导出前请完成律师最终复核清单并确认定稿', { type: 'err' })
      return
    }
    setShowExportModal(true)
  }

  const handleExportConfirm = async (exportType: 'standard' | 'package') => {
    setShowExportModal(false)
    try {
      if (exportType === 'package') {
        await api.workflow.exportPackage(caseId)
        showToast('案件包导出成功')
      } else {
        await api.workflow.export(caseId)
        showToast('文档导出成功')
      }
    } catch(e:any){showToast(e.message||'导出失败', { type: 'err' })}
  }

  const handleSave = async () => {
    try {
      await api.workflow.saveOutput(caseId, activeStage, outputDraft)
      resetFinalReview()
      setOutput(outputDraft)
      setEditingOutput(false)
      showToast('已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', { type: 'err' })
    }
  }

  const cancelEditing = async () => {
    if (outputDraft !== output) {
      const confirmed = await confirm({
        title: '放弃未保存修改',
        message: '当前编辑内容尚未保存，取消后将丢失本次修改。',
        confirmText: '放弃修改',
        variant: 'danger'
      })
      if (!confirmed) return
    }
    setEditingOutput(false)
  }

  const handleRollback = async (id:string) => {
    const target = history.find(h => h.id === id)
    const confirmed = await confirm({
      title: '回滚版本',
      message: `确认回滚到 ${target ? `v${target.version}` : '所选版本'}？当前结果会被替换，回滚前请确认已保存需要保留的内容。`,
      confirmText: '确认回滚',
      variant: 'danger'
    })
    if (!confirmed) return
    try {
      const r = await api.workflow.rollback(caseId, id)
      resetFinalReview()
      setOutput(r.output)
      setNode({...node!, output: r.output, version: r.version})
      await loadProgress()
      await loadHistory(activeStage)
      showToast('已回滚')
    } catch (e: any) {
      showToast(e.message || '回滚失败', { type: 'err' })
    }
  }

  const handleVerifyLegal = async () => {
    if (!output) return
    setVerifyingLegal(true)
    try {
      const result = await api.legalArticles.verify(output)
      setLegalVerifyResult(result)
      showToast('法条核验完成')
    } catch (e: any) {
      showToast(e.message || '核验失败', { type: 'err' })
    } finally {
      setVerifyingLegal(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb mb-5">
        <a onClick={() => navigate('/cases')}>案件工作台</a><span style={{color:'#d1d5db'}}>/</span>
        <a onClick={() => navigate(`/cases/${caseId}`)}>{caseName||'案件'}</a><span style={{color:'#d1d5db'}}>/</span>
        <span className="current">工作流</span>
      </div>

      {caseData?.status === 'archived' && (
        <div className="notice-card notice-warn" style={{marginBottom:16}}>
          <div>
            <strong>案件已归档，工作流处于只读模式</strong>
            <span>归档案件无法生成、编辑或回滚。如需继续编辑，请返回案件详情页解除归档。</span>
          </div>
        </div>
      )}

      {workflowLoading && (
        <div className="notice-card notice-info workflow-loading-notice">
          <div><strong>正在加载工作流数据...</strong><span>阶段进度、Prompt 和历史结果加载完成后即可继续处理。</span></div>
        </div>
      )}

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
        {activeStage === 'draft_generation' && caseData?.document_type && (
          <div className="trust-card success"><strong>目标文书</strong><span>{DOCUMENT_TYPES[caseData.document_type] || caseData.document_type}</span></div>
        )}
        <div className="trust-card"><strong>输入来源</strong><span>{guide.input}</span></div>
        <div className={`trust-card ${previousDone ? 'success' : 'warn'}`}><strong>前置条件</strong><span>{previousDone ? '可生成当前阶段内容' : `需先完成 ${previousStage ? STAGE_NAMES[previousStage] : ''}`}</span></div>
      </div>

      <div className="workflow-next-action">
        <div><strong>本阶段建议操作</strong><span>{guide.action}</span></div>
        <div><strong>人工复核重点</strong><span>{guide.review}</span></div>
      </div>

      <div className="card workflow-summary">
        <div>
          <div className="font-semibold">交付完成度：{completedCount}/{STAGE_ORDER.length}</div>
          <div className="text-xs-desc">
            {canExport ? '全部阶段已完成，可导出正式 Word 文档。' : `导出前需补齐：${missingStages.join('、') || '加载中'}`}
          </div>
        </div>
        <span className={`tag ${canExport ? 't-green' : 't-orange'}`}>{canExport ? '可导出' : '待完善'}</span>
      </div>

      <div className="delivery-check-grid">
        {deliveryChecks.map(check => (
          <div key={check.label} className={`trust-card ${check.done ? 'success' : 'warn'}`}>
            <strong>{check.label}</strong>
            <span>{check.hint}</span>
          </div>
        ))}
      </div>

      <div className={`card final-review-card ${finalReviewedAt ? 'confirmed' : ''}`}>
        <div className="final-review-head">
          <div>
            <span className={`tag ${finalReviewedAt ? 't-green' : 't-orange'}`}>律师最终复核</span>
            <h3>导出前定稿确认</h3>
            <p>AI 输出只能作为草稿和审查辅助。导出正式 Word 前，请律师逐项核对主体、诉请、证据、法条和提交风险。</p>
          </div>
          <div className="final-review-status">
            <strong>{finalReviewedAt ? '已确认定稿' : `${finalReviewChecked.length}/${finalReviewItems.length} 已核对`}</strong>
            <span>{finalReviewedAt ? new Date(finalReviewedAt).toLocaleString('zh-CN') : '内容变化后需重新确认'}</span>
          </div>
        </div>
        <div className="final-review-list">
          {finalReviewItems.map(item => {
            const checked = finalReviewChecked.includes(item.id)
            return (
              <label key={item.id} className={`final-review-item ${checked ? 'checked' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleFinalReviewItem(item.id)} disabled={!canExport} />
                <span className="final-review-check">{checked ? '✓' : ''}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </label>
            )
          })}
        </div>
        <div className="final-review-actions">
          <span>{canExport ? '确认后才允许打开导出选项。重新生成、编辑保存或回滚版本后，确认状态会自动撤销。' : '请先完成全部五个阶段，再进行最终复核。'}</span>
          <div>
            {finalReviewedAt && <button className="btn btn-o btn-sm" onClick={resetFinalReview}>撤销确认</button>}
            <button className="btn btn-p btn-sm" onClick={confirmFinalReview} disabled={!canExport || !finalReviewComplete}>
              {finalReviewedAt ? '重新确认定稿' : '确认已最终复核'}
            </button>
          </div>
        </div>
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
                {modelsLoading && <option>模型加载中...</option>}
                {!modelsLoading && models.length===0 && <option>未配置渠道</option>}
                {models.map((m,i)=><option key={i} value={`${m.channel_id}|${m.model}`}>{m.channel_name} / {m.model}</option>)}
              </select>
              <button className="btn btn-o btn-sm" onClick={toggleHistory}>{showHistory?'关闭':'历史'}</button>
            </div>
          </div>
          <div className="notice-card notice-info mb-3">
            <div><strong>本阶段目标：{guide.output}</strong><span>生成内容必须基于材料和前序阶段输出，不能补写未出现的事实。</span></div>
          </div>
          {!previousDone && previousStage && (
            <div className="notice-card notice-warn"><div><strong>暂不建议生成</strong><span>{`请先完成「${STAGE_NAMES[previousStage]}」，以保证当前阶段引用链完整。`}</span></div></div>
          )}
          {nodeLoading ? (
            <div className="prompt-skeleton">
              <span className="skeleton-line wide"/>
              <span className="skeleton-line medium"/>
              <span className="skeleton-block tall"/>
            </div>
          ) : (
            <textarea className="textarea" style={{height:246}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="编辑 Prompt..." disabled={isArchived}/>
          )}
          <div className="prompt-meta"><span>{prompt.length} 字</span><span>{modelsLoading ? '模型渠道加载中' : selChannelId ? '模型渠道已选择' : '未配置模型渠道'}</span></div>
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
                    <button className="btn btn-o btn-sm" onClick={()=>handleRollback(h.id)} disabled={isArchived}>回滚</button>
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
                <button className="btn btn-o btn-sm" onClick={()=>{setEditingOutput(true);setOutputDraft(output)}} disabled={isArchived}>编辑</button>
                <button className="btn btn-o btn-sm" onClick={async()=>{try{await navigator.clipboard.writeText(output);showToast('已复制')}catch{showToast('复制失败', { type: 'err' })}}}>复制</button>
              </>}
            </div>
          </div>
          <div className="output-trust-strip">
            <div>依据材料与前序阶段生成</div>
            <div>法条、金额、策略需人工复核</div>
            <div>{guide.risk}</div>
          </div>
          <div className={`workflow-output-action ${generationError ? 'blocked' : output ? 'ready' : previousDone ? 'pending' : 'blocked'}`}>
            <strong>{generationError ? '生成中断' : output ? '下一步建议' : previousDone ? '生成前检查' : '等待前置阶段'}</strong>
            <span>
              {generationError
                ? output ? '已保留可用内容，可检查后重试。' : '本次未收到有效输出，请检查模型渠道后重试。'
                : output
                  ? nextStage ? `先编辑保存当前结果，再进入「${STAGE_NAMES[nextStage]}」。` : '完成最终审查后，核对法条、金额和证据引用，再导出 Word。'
                  : previousDone ? '确认材料、Prompt 和模型渠道无误后，点击生成当前阶段。' : `请先完成「${previousStage ? STAGE_NAMES[previousStage] : ''}」。`}
            </span>
          </div>
          {generationError && !editingOutput && (
            <div className="notice-card notice-warn mb-3">
              <div>
                <strong>{generationError}</strong>
                <span>{output ? '重试生成会覆盖当前页面显示内容；保存前请先人工复核。' : '重试前建议确认 Prompt、模型渠道和网络状态。'}</span>
              </div>
              <button className="btn btn-o btn-sm" style={{marginTop:10,width:'fit-content'}} onClick={handleGenerate} disabled={!canGenerate}>重试生成</button>
            </div>
          )}
          {editingOutput ? (
            <div>
              <textarea className="textarea" style={{height:400}} value={outputDraft} onChange={e=>setOutputDraft(e.target.value)}/>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button className="btn btn-p btn-sm" onClick={handleSave}>保存</button>
                <button className="btn btn-o btn-sm" onClick={cancelEditing}>取消</button>
              </div>
            </div>
          ) : generating && streamingText ? (
            <div className="workflow-output-shell">
              <div className="md legal-prose"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
              <span className="cursor-blink"/>
            </div>
          ) : generating ? (
            <div className="workflow-output-shell output-skeleton">
              <span className="skeleton-line wide"/>
              <span className="skeleton-line medium"/>
              <span className="skeleton-line wide"/>
              <span className="skeleton-line short"/>
            </div>
          ) : output ? (
            <div>
              <div className="workflow-output-shell">
                <div className="md legal-prose"><ReactMarkdown>{output}</ReactMarkdown></div>
              </div>
              <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
                <button className="btn btn-o btn-sm" onClick={handleVerifyLegal} disabled={verifyingLegal}>
                  {verifyingLegal ? '核验中...' : '核验法条引用'}
                </button>
                {legalVerifyResult && (
                  <span style={{fontSize:12,color:'#64748b'}}>
                    发现 {legalVerifyResult.articles?.length || 0} 条法条引用
                  </span>
                )}
              </div>
              {legalVerifyResult && (
                <div style={{marginTop:12,padding:12,background:'#f8fafc',borderRadius:8,border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>法条核验结果</div>
                  {legalVerifyResult.articles && legalVerifyResult.articles.length > 0 ? (
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {legalVerifyResult.articles.map((art: any, i: number) => (
                        <div key={i} style={{fontSize:12,display:'flex',alignItems:'start',gap:8}}>
                          <span className={`tag ${art.exists ? 't-green' : 't-red'}`} style={{flexShrink:0}}>
                            {art.exists ? '✓ 通过' : '✗ 未收录'}
                          </span>
                          <span style={{color:'#334155'}}>{art.citation}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{fontSize:12,color:'#86909c'}}>未识别到法条引用</div>
                  )}
                </div>
              )}
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
        <button className="btn btn-p" onClick={handleExportClick} disabled={!canExport || !finalReviewedAt}>导出为 Word</button>
        <button className="btn btn-o" disabled={idx===STAGE_ORDER.length-1} onClick={()=>setActiveStage(STAGE_ORDER[idx+1])}>下一阶段</button>
      </div>
      <ExportOptionsModal
        open={showExportModal}
        onConfirm={handleExportConfirm}
        onCancel={() => setShowExportModal(false)}
      />
      <Toaster toasts={toasts} onRemove={removeToast} />
      {dialogProps && <ConfirmDialog {...dialogProps} />}
    </div>
  )
}
