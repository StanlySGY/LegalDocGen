import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Case, Material, DocumentTypeOption, Party, StageProgress } from '../types'
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

  // Party state
  const [parties, setParties] = useState<Party[]>([])
  const [extracting, setExtracting] = useState(false)
  const [showPartyForm, setShowPartyForm] = useState(false)
  const [partyForm, setPartyForm] = useState({name:'',role:'',id_number:'',address:'',phone:'',legal_representative:'',notes:''})
  const [editingPartyId, setEditingPartyId] = useState('')
  const [stageProgress, setStageProgress] = useState<StageProgress[]>([])

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = async () => {
    if(!caseId)return
    const [c,m,p,sp] = await Promise.all([api.cases.get(caseId), api.materials.list(caseId), api.parties.list(caseId), api.workflow.progress(caseId)])
    setCaseData(c); setMaterials(m); setParties(p); setStageProgress(sp)
  }
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

  const handleExtractParties = async () => {
    if (!caseId) return
    if (materials.length === 0) { showToast('请先上传案件材料', 'err'); return }
    setExtracting(true)
    try {
      const result = await api.parties.extract(caseId)
      setParties(result)
      showToast(`已提取 ${result.length} 位当事人`)
    } catch(e:any) { showToast(e.message||'提取失败','err') }
    setExtracting(false)
  }

  const handleSaveParty = async () => {
    if (!caseId || !partyForm.name.trim()) { showToast('请填写姓名', 'err'); return }
    try {
      if (editingPartyId) {
        await api.parties.update(editingPartyId, partyForm)
        showToast('已更新')
      } else {
        await api.parties.create({ ...partyForm, case_id: caseId })
        showToast('已添加')
      }
      setShowPartyForm(false); setEditingPartyId(''); setPartyForm({name:'',role:'',id_number:'',address:'',phone:'',legal_representative:'',notes:''})
      load()
    } catch(e:any) { showToast(e.message||'操作失败','err') }
  }

  const handleEditParty = (p: Party) => {
    setPartyForm({name:p.name,role:p.role,id_number:p.id_number,address:p.address,phone:p.phone,legal_representative:p.legal_representative,notes:p.notes})
    setEditingPartyId(p.id)
    setShowPartyForm(true)
  }

  const handleDeleteParty = async (id: string) => {
    await api.parties.delete(id)
    load()
    showToast('已删除')
  }

  if (!caseData) return <div style={{textAlign:'center',padding:80,color:'#86909c'}}>加载中...</div>

  const roleColors: Record<string,string> = {原告:'t-blue',被告:'t-red',申请人:'t-purple',被申请人:'t-orange',第三人:'t-gray',上诉人:'t-blue',被上诉人:'t-red',代理人:'t-green'}

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

      {/* Case overview summary */}
      <div className="card" style={{marginBottom:24,padding:'16px 20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:20,alignItems:'center'}}>
          {/* Parties preview */}
          <div style={{display:'flex',gap:-6}}>
            {parties.slice(0,4).map((p,i) => (
              <div key={p.id} style={{
                width:36,height:36,borderRadius:'50%',background:'#eef2ff',
                border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:13,fontWeight:600,color:'#6366f1',marginLeft:i>0?-8:0,position:'relative',zIndex:i,
              }} title={`${p.name} (${p.role})`}>{p.name[0]}</div>
            ))}
            {parties.length === 0 && <div style={{fontSize:12,color:'#c9cdd4'}}>暂无当事人</div>}
          </div>
          {/* Stage progress bar */}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            {stageProgress.map((sp,i) => (
              <div key={sp.stage} style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{
                  padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:500,
                  background: sp.status==='completed'?'#d1fae5':sp.status==='in_progress'?'#eef2ff':'#f5f5f5',
                  color: sp.status==='completed'?'#059669':sp.status==='in_progress'?'#6366f1':'#86909c',
                }}>
                  {sp.name}
                </div>
                {i < stageProgress.length - 1 && <div style={{width:12,height:2,background:'#e5e7eb'}}/>}
              </div>
            ))}
            {stageProgress.length===0 && <div style={{fontSize:12,color:'#c9cdd4'}}>尚未开始工作流</div>}
          </div>
          {/* Quick stats */}
          <div style={{display:'flex',gap:16,fontSize:12,color:'#86909c'}}>
            <span>{materials.length} 份材料</span>
            <span>{parties.length} 位当事人</span>
          </div>
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
              onClick={()=>setSelectedDocType(dt.key)}
              title={`${dt.desc}\n适用：${dt.scenario}`}>
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

      {/* Party Information Section */}
      <div className="card" style={{marginBottom:24}}>
        <div className="card-hd">
          <span className="card-title">当事人信息</span>
          <div className="flex gap-2">
            <button className="btn btn-o btn-sm" onClick={handleExtractParties} disabled={extracting || materials.length===0}>
              {extracting ? '提取中...' : '从材料提取'}
            </button>
            <button className="btn btn-p btn-sm" onClick={()=>{setShowPartyForm(true);setEditingPartyId('');setPartyForm({name:'',role:'',id_number:'',address:'',phone:'',legal_representative:'',notes:''})}}>手动添加</button>
          </div>
        </div>
        <p style={{fontSize:12,color:'#86909c',marginBottom:12}}>AI自动提取或手动录入当事人信息，生成文书时自动填入</p>

        {showPartyForm && (
          <div style={{background:'#f7f8fa',border:'1px solid #e5e7eb',borderRadius:10,padding:16,marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>姓名/名称 *</label><input className="input" value={partyForm.name} onChange={e=>setPartyForm({...partyForm,name:e.target.value})}/></div>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>角色</label>
                <select className="select" value={partyForm.role} onChange={e=>setPartyForm({...partyForm,role:e.target.value})}>
                  <option value="">选择角色</option>
                  <option value="原告">原告</option><option value="被告">被告</option>
                  <option value="申请人">申请人</option><option value="被申请人">被申请人</option>
                  <option value="第三人">第三人</option><option value="上诉人">上诉人</option>
                  <option value="被上诉人">被上诉人</option><option value="代理人">代理人</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>身份证/统一社会信用代码</label><input className="input" value={partyForm.id_number} onChange={e=>setPartyForm({...partyForm,id_number:e.target.value})}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>住址</label><input className="input" value={partyForm.address} onChange={e=>setPartyForm({...partyForm,address:e.target.value})}/></div>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>电话</label><input className="input" value={partyForm.phone} onChange={e=>setPartyForm({...partyForm,phone:e.target.value})}/></div>
              <div><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>法定代表人</label><input className="input" value={partyForm.legal_representative} onChange={e=>setPartyForm({...partyForm,legal_representative:e.target.value})}/></div>
            </div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,color:'#86909c',display:'block',marginBottom:3}}>备注</label><input className="input" value={partyForm.notes} onChange={e=>setPartyForm({...partyForm,notes:e.target.value})}/></div>
            <div className="flex gap-2">
              <button className="btn btn-p btn-sm" onClick={handleSaveParty}>{editingPartyId?'更新':'添加'}</button>
              <button className="btn btn-o btn-sm" onClick={()=>{setShowPartyForm(false);setEditingPartyId('')}}>取消</button>
            </div>
          </div>
        )}

        {parties.length > 0 ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
            {parties.map(p => (
              <div key={p.id} style={{background:'#f7f8fa',border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 16px'}}>
                <div className="flex items-center justify-between" style={{marginBottom:6}}>
                  <div className="flex items-center gap-2">
                    <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
                    {p.role && <span className={`tag ${roleColors[p.role]||'t-gray'}`}>{p.role}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button style={{fontSize:11,color:'#6366f1',cursor:'pointer',background:'none',border:'none'}} onClick={()=>handleEditParty(p)}>编辑</button>
                    <button style={{fontSize:11,color:'#ef4444',cursor:'pointer',background:'none',border:'none'}} onClick={()=>handleDeleteParty(p.id)}>删除</button>
                  </div>
                </div>
                <div style={{fontSize:12,color:'#86909c',display:'flex',flexDirection:'column',gap:2}}>
                  {p.id_number && <div>证件号：{p.id_number}</div>}
                  {p.address && <div>住址：{p.address}</div>}
                  {p.phone && <div>电话：{p.phone}</div>}
                  {p.legal_representative && <div>法定代表人：{p.legal_representative}</div>}
                  {p.notes && <div>备注：{p.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{padding:'30px 0'}}>
            <p>暂无当事人信息，可从材料中提取或手动添加</p>
          </div>
        )}
      </div>

      {/* Timeline visualization from materials */}
      {materials.some(m => { try { const s = JSON.parse(m.structured_data||'{}'); return !!s.timeline } catch { return false } }) && (
        <div className="card" style={{marginBottom:24}}>
          <div className="card-hd">
            <span className="card-title">案件时间线</span>
          </div>
          <div style={{paddingLeft:20}}>
            {materials.filter(m => { try { return !!JSON.parse(m.structured_data||'{}').timeline } catch { return false } }).map(m => {
              const sd = JSON.parse(m.structured_data)
              const events = sd.timeline.split('\\n').filter((s:string)=>s.trim())
              return events.map((ev:string, i:number) => {
                const match = ev.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*(.*)/)
                return (
                  <div key={`${m.id}-${i}`} style={{display:'flex',gap:12,marginBottom:0,position:'relative'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:12}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:i===events.length-1?'#6366f1':'#c9cdd4',flexShrink:0,marginTop:4}}/>
                      {i<events.length-1 && <div style={{width:2,flex:1,background:'#e5e7eb'}}/>}
                    </div>
                    <div style={{paddingBottom:14}}>
                      {match ? <>
                        <span style={{fontSize:12,fontWeight:600,color:'#6366f1'}}>{match[1]}</span>
                        <span style={{fontSize:13,marginLeft:8,color:'#4e5969'}}>{match[2]}</span>
                      </> : <span style={{fontSize:13,color:'#4e5969'}}>{ev}</span>}
                    </div>
                  </div>
                )
              })
            }).flat()}
          </div>
        </div>
      )}

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
