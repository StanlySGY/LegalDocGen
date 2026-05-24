import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import MaterialChecklist from './MaterialChecklist'
import { getMaterialCompletion, type ChecklistItem } from '../services/materialMatcher'
import type { Case, Material } from '../types'

interface Props { caseId: string; nav: { cases: () => void; workflow: (id: string) => void } }

export default function CaseDetail({ caseId, nav }: Props) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = async () => {
    const [c, m] = await Promise.all([api.cases.get(caseId), api.materials.list(caseId)])
    const tpl = c.template_id ? await api.templates.get(c.template_id) : null
    setChecklist(tpl?.materials_checklist || [])
    setCaseData(c)
    setMaterials(m)
  }
  useEffect(() => { load() }, [caseId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const f of files) await api.materials.upload(caseId, f)
      await load()
      showToast(`已上传 ${files.length} 个文件`)
    } catch (e) {
      await load()
      showToast(e instanceof Error ? e.message : '上传失败', 'err')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const del = async (id: string) => {
    try {
      await api.materials.delete(id)
      await load()
      showToast('已删除')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'err')
    }
  }
  const previewMaterial = (content: string) => {
    const w = window.open('', '', 'width=700,height=600')
    if (!w) {
      showToast('浏览器阻止了预览窗口', 'err')
      return
    }
    w.document.title = '材料内容预览'
    w.document.body.style.margin = '0'
    const pre = w.document.createElement('pre')
    pre.textContent = content || '暂无内容'
    pre.style.padding = '20px'
    pre.style.fontSize = '13px'
    pre.style.whiteSpace = 'pre-wrap'
    pre.style.fontFamily = 'sans-serif'
    w.document.body.appendChild(pre)
  }
  const materialCompletion = getMaterialCompletion(checklist, materials)
  const handleEnterWorkflow = () => {
    if (caseData?.template_id && materialCompletion.missingRequired > 0) {
      const missingNames = materialCompletion.missingRequiredItems.slice(0, 3).map(({ item }) => item.name).join('、')
      showToast(`仍缺少 ${materialCompletion.missingRequired} 项必需材料：${missingNames}`, 'err')
      return
    }
    nav.workflow(caseId)
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
        <button className="btn btn-p" onClick={handleEnterWorkflow}>进入工作流 →</button>
      </div>

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">材料数量</div><div className="s-value">{materials.length}</div></div>
        <div className="stat-card s-green"><div className="s-label">已解析</div><div className="s-value">{materials.filter(m=>m.parse_status==='completed').length}</div></div>
        <div className="stat-card s-orange"><div className="s-label">解析失败</div><div className="s-value">{materials.filter(m=>m.parse_status!=='completed').length}</div></div>
      </div>

      {caseData.template_id && checklist.length > 0 && (
        <div className="card" style={{marginBottom:20,border:`1px solid ${materialCompletion.missingRequired > 0 ? '#fde68a' : '#d1fae5'}`,background:materialCompletion.missingRequired > 0 ? '#fffbeb' : '#f0fdf4'}}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{fontWeight:600,fontSize:13,color:'#1d2129'}}>材料齐备度：{materialCompletion.completedRequired}/{materialCompletion.requiredItems.length}</div>
              <div style={{fontSize:12,color:materialCompletion.missingRequired > 0 ? '#c97706' : '#10b981',marginTop:4}}>
                {materialCompletion.missingRequired > 0 ? `进入工作流前建议补齐 ${materialCompletion.missingRequired} 项必需材料` : '必需材料已齐备，可以进入工作流'}
              </div>
            </div>
            <span className={`tag ${materialCompletion.missingRequired > 0 ? 't-orange' : 't-green'}`}>{materialCompletion.completionPercent}%</span>
          </div>
        </div>
      )}

      {caseData.template_id && <MaterialChecklist caseId={caseId} templateId={caseData.template_id} />}

      <div className="card">
        <div className="card-hd">
          <span className="card-title">案件材料</span>
          <label className={`btn ${uploading?'btn-o':'btn-p'} btn-sm`} style={{cursor:'pointer'}}>
            {uploading ? '上传中...' : '+ 上传材料'}
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" hidden onChange={handleUpload} disabled={uploading}/>
          </label>
        </div>
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
                <button className="btn btn-o btn-sm" onClick={()=>previewMaterial(m.parsed_content)}>查看</button>
                <button className="btn btn-d btn-sm" onClick={()=>del(m.id)}>删除</button>
              </div>
            </div>
          ))}
          {materials.length===0 && (
            <div className="empty" style={{padding:'50px 0'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p>暂无材料，上传 PDF / Word / 图片文件</p>
            </div>
          )}
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
