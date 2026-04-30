import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Case, Material, DocumentTypeOption } from '../types'
import { STAGE_NAMES_LAWYER } from '../types'

export default function CaseDetail() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [docTypes, setDocTypes] = useState<DocumentTypeOption[]>([])
  const [selectedDocType, setSelectedDocType] = useState('')
  const [quickGenerating, setQuickGenerating] = useState(false)
  const [quickProgress, setQuickProgress] = useState(0)
  const [quickStage, setQuickStage] = useState('')
  const [quickDone, setQuickDone] = useState(false)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = async () => { if(!caseId)return; const [c,m] = await Promise.all([api.cases.get(caseId), api.materials.list(caseId)]); setCaseData(c); setMaterials(m) }
  useEffect(() => { load() }, [caseId])
  useEffect(() => { api.config.getDocumentTypes().then(d => { setDocTypes(d.types); if(d.types.length) setSelectedDocType(d.types[0].key) }) }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || !caseId) return
    setUploading(true)
    for (const f of files) await api.materials.upload(caseId, f)
    setUploading(false); load(); showToast('上传成功')
    if (fileRef.current) fileRef.current.value = ''
  }

  const del = async (id: string) => { await api.materials.delete(id); load(); showToast('已删除') }

  const handleQuickGenerate = async () => {
    if (!caseId || !selectedDocType) return
    if (materials.length === 0) { showToast('请先上传案件材料', 'err'); return }
    setQuickGenerating(true); setQuickProgress(0); setQuickStage('准备中...'); setQuickDone(false)
    try {
      for await (const event of api.workflow.quickGenerate(caseId, { document_type: selectedDocType })) {
        if (event.error) { showToast(event.error, 'err'); setQuickGenerating(false); return }
        if (event.status === 'running') { setQuickStage(event.name || STAGE_NAMES_LAWYER[event.stage] || event.stage); setQuickProgress(event.progress) }
        if (event.status === 'done') { setQuickProgress(event.progress) }
        if (event.done) { setQuickProgress(100); setQuickDone(true); showToast('文书生成完成') }
      }
    } catch(e:any) { showToast(e.message||'生成失败','err') }
    setQuickGenerating(false)
  }

  if (!caseData) return <div style={{textAlign:'center',padding:80,color:'#86909c'}}>加载中...</div>

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 style={{fontSize:20,fontWeight:700}}>{caseData.name}</h2>
            <span className={`tag ${caseData.status==='completed'?'t-green':caseData.status==='in_progress'?'t-orange':'t-gray'}`}>
              {caseData.status==='completed'?'已完成':caseData.status==='in_progress'?'进行中':'草稿'}
            </span>
            {caseData.case_type && <span className="tag t-blue">{caseData.case_type}</span>}
          </div>
          {caseData.description && <p style={{fontSize:13,color:'#86909c',marginTop:6}}>{caseData.description}</p>}
        </div>
        <div className="flex gap-2">
          {quickDone && <button className="btn btn-p" onClick={()=>navigate(`/cases/${caseId}/editor`)}>查看文书 →</button>}
          <button className="btn btn-o" style={{fontSize:12}} onClick={()=>navigate(`/cases/${caseId}/workflow`)}>分步模式</button>
        </div>
      </div>

      <div className="quick-gen-section card" style={{marginBottom:24,background:'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)',borderColor:'#ddd6fe'}}>
        <div className="card-hd" style={{marginBottom:12}}>
          <span className="card-title" style={{fontSize:16}}>快速生成文书</span>
        </div>
        <p className="guide-text" style={{marginBottom:16}}>选择需要的文书类型，系统将自动梳理案件、分析法律关系、生成文书并审查优化。</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,marginBottom:16}}>
          {docTypes.map(dt => (
            <div key={dt.key} className={`doc-type-card ${selectedDocType===dt.key?'selected':''}`}
              onClick={()=>setSelectedDocType(dt.key)}>
              {dt.name}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button className="btn btn-p btn-lg" style={{minWidth:160}} onClick={handleQuickGenerate} disabled={quickGenerating || !selectedDocType}>
            {quickGenerating ? '生成中...' : '一键生成'}
          </button>
          {quickGenerating && (
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:'#6366f1',marginBottom:4}}>{quickStage}</div>
              <div style={{height:6,background:'#e5e7eb',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${quickProgress}%`,background:'linear-gradient(90deg,#6366f1,#a78bfa)',borderRadius:3,transition:'width 0.3s'}}/>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">材料数量</div><div className="s-value">{materials.length}</div></div>
        <div className="stat-card s-green"><div className="s-label">已解析</div><div className="s-value">{materials.filter(m=>m.parse_status==='completed').length}</div></div>
      </div>

      <div className="card">
        <div className="card-hd">
          <span className="card-title">案件材料</span>
          <label className={`btn ${uploading?'btn-o':'btn-p'} btn-sm`} style={{cursor:'pointer'}}>
            {uploading ? '上传中...' : '+ 上传材料'}
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" hidden onChange={handleUpload} disabled={uploading}/>
          </label>
        </div>
        <p style={{fontSize:12,color:'#86909c',marginBottom:12}}>支持 PDF、Word、图片格式，上传后系统自动解析内容</p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {materials.map(m => (
            <div key={m.id} className="flex items-center justify-between" style={{background:'#f7f8fa',border:'1px solid #e5e7eb',borderRadius:10,padding:'14px 16px'}}>
              <div className="flex items-center gap-3">
                <span style={{fontSize:24}}>{m.file_type==='.pdf'?'📄':m.file_type.startsWith('.doc')?'📝':'🖼️'}</span>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{m.filename}</div>
                  <div className="flex items-center gap-2" style={{marginTop:3}}>
                    <span style={{fontSize:11,color:'#86909c'}}>{(m.file_size/1024).toFixed(1)} KB</span>
                    <span className={`tag ${m.parse_status==='completed'?'t-green':'t-red'}`}>{m.parse_status==='completed'?'已解析':'失败'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-o btn-sm" onClick={()=>{
                  const w = window.open('','','width=800,height=600')
                  if(!w) return
                  let html = `<style>body{font-family:sans-serif;padding:20px;max-width:720px}h2{color:#4e5969;border-bottom:1px solid #e5e7eb;padding-bottom:6px}pre{white-space:pre-wrap;font-size:13px}</style>`
                  const sd = m.structured_data ? (() => { try { return JSON.parse(m.structured_data) } catch { return null } })() : null
                  if (sd && (sd.parties || sd.case_facts || sd.timeline || sd.evidence)) {
                    html += `<h2>当事人信息</h2><pre>${sd.parties||'无'}</pre><h2>关键事实</h2><pre>${sd.case_facts||'无'}</pre><h2>时间线</h2><pre>${sd.timeline||'无'}</pre><h2>证据清单</h2><pre>${sd.evidence||'无'}</pre>`
                  } else {
                    html += `<pre style="padding:20px;font-size:13px;white-space:pre-wrap">${m.parsed_content||'暂无内容'}</pre>`
                  }
                  w.document.write(html)
                }}>查看</button>
                <button className="btn btn-d btn-sm" onClick={()=>del(m.id)}>删除</button>
              </div>
            </div>
          ))}
          {materials.length===0 && (
            <div className="empty" style={{padding:'40px 0'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:40,height:40}}><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p>上传案件材料（PDF/Word/图片），选择文书类型后一键生成</p>
            </div>
          )}
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
