import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { api } from '../services/api'
import MaterialChecklist from './MaterialChecklist'
import { getMaterialCompletion, type ChecklistItem } from '../services/materialMatcher'
import type { Case, Material, MaterialCatalogItem } from '../types'

interface Props { caseId: string; nav: { cases: () => void; workflow: (id: string) => void } }

const fileLabel = (type: string) => type === '.pdf' ? 'PDF' : type.startsWith('.doc') ? 'DOC' : 'IMG'
const statusLabel = (status: string) => status === 'completed' ? '已解析' : '解析失败'

export default function CaseDetail({ caseId, nav }: Props) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialInsights, setMaterialInsights] = useState<{catalog:MaterialCatalogItem[];timeline:any[]}>({ catalog: [], timeline: [] })
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const load = async () => {
    const [c, m, insights] = await Promise.all([api.cases.get(caseId), api.materials.list(caseId), api.materials.catalog(caseId)])
    const tpl = c.template_id ? await api.templates.get(c.template_id) : null
    setChecklist(tpl?.materials_checklist || [])
    setCaseData(c)
    setMaterials(m)
    setMaterialInsights({ catalog: insights.catalog || [], timeline: insights.timeline || [] })
  }
  useEffect(() => { load() }, [caseId])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const f of files) await api.materials.upload(caseId, f)
      await load()
      showToast(`已上传并解析 ${files.length} 个文件`)
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
    const w = window.open('', '', 'width=760,height=640')
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
  const parsedCount = materials.filter(m=>m.parse_status==='completed').length
  const failedCount = materials.filter(m=>m.parse_status!=='completed').length
  const hasTemplateGate = Boolean(caseData?.template_id && checklist.length > 0)

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
      <div className="case-detail-hero">
        <div>
          <div className="eyebrow">CASE MATERIAL CENTER</div>
          <div className="flex items-center gap-3" style={{flexWrap:'wrap'}}>
            <h2>{caseData.name}</h2>
            <span className={`tag ${caseData.status==='completed'?'t-green':caseData.status==='in_progress'?'t-orange':'t-gray'}`}>
              {caseData.status==='completed'?'已完成':caseData.status==='in_progress'?'进行中':'草稿'}
            </span>
            {caseData.case_type && <span className="tag t-blue">{caseData.case_type}</span>}
          </div>
          {caseData.description && <p style={{fontSize:13,color:'#64748b',marginTop:8,lineHeight:1.8}}>{caseData.description}</p>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
            <span className="tag t-gray">团队：{caseData.team_id ? caseData.team_id.slice(0, 8) : '未绑定'}</span>
            <span className="tag t-gray">创建人：{caseData.owner_id ? caseData.owner_id.slice(0, 8) : '兼容模式'}</span>
          </div>
        </div>
        <div className="case-detail-actions">
          <button className="btn btn-o" onClick={nav.cases}>返回列表</button>
          <button className="btn btn-p" onClick={handleEnterWorkflow}>进入工作流</button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card s-purple"><div className="s-label">材料数量</div><div className="s-value">{materials.length}</div><div className="s-hint">已上传证据材料</div></div>
        <div className="stat-card s-green"><div className="s-label">已解析</div><div className="s-value">{parsedCount}</div><div className="s-hint">可用于 AI 上下文</div></div>
        <div className="stat-card s-orange"><div className="s-label">解析失败</div><div className="s-value">{failedCount}</div><div className="s-hint">需重新上传或人工处理</div></div>
        <div className="stat-card s-blue"><div className="s-label">齐备度</div><div className="s-value">{hasTemplateGate ? `${materialCompletion.completionPercent}%` : '-'}</div><div className="s-hint">模板必需材料匹配</div></div>
      </div>

      {hasTemplateGate && (
        <div className={`notice-card ${materialCompletion.missingRequired > 0 ? 'notice-warn' : 'notice-success'}`}>
          <div>
            <strong>材料齐备度：{materialCompletion.completedRequired}/{materialCompletion.requiredItems.length}</strong>
            <span>{materialCompletion.missingRequired > 0 ? `进入工作流前建议补齐 ${materialCompletion.missingRequired} 项必需材料。` : '必需材料已齐备，可以进入工作流。'}</span>
          </div>
        </div>
      )}

      {caseData.template_id && <MaterialChecklist caseId={caseId} templateId={caseData.template_id} />}

      <div className="evidence-grid">
        <div className="card">
          <div className="card-hd"><span className="card-title">证据材料目录</span><span className="tag t-purple">页码级引用</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:310,overflow:'auto'}}>
            {materialInsights.catalog.map((item, index) => (
              <div key={item.id || index} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:12,background:'#fafbfc'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <strong style={{fontSize:13}}>{index + 1}. {item.filename}</strong>
                  <span className={`tag ${item.parse_status==='completed'?'t-green':'t-red'}`}>{statusLabel(item.parse_status)}</span>
                </div>
                <div style={{fontSize:11,color:'#4f46e5',marginTop:7,fontWeight:600}}>{item.citation || '页码未识别'}</div>
                <div style={{fontSize:12,color:'#64748b',marginTop:6,lineHeight:1.7}}>{item.excerpt || '暂无可解析内容'}</div>
              </div>
            ))}
            {materialInsights.catalog.length===0 && <div className="empty refined-empty" style={{padding:'36px 0'}}><p>暂无证据目录，上传材料后自动生成</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><span className="card-title">材料事实时间线</span><span className="tag t-blue">自动识别</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:310,overflow:'auto'}}>
            {materialInsights.timeline.slice(0, 20).map((item, index) => (
              <div key={`${item.date}-${index}`} style={{borderLeft:'3px solid #6366f1',padding:'8px 0 8px 12px',background:'#f8fafc',borderRadius:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'#4f46e5'}}>{item.date}</div>
                <div style={{fontSize:12,lineHeight:1.7,marginTop:3}}>{item.event}</div>
                <div style={{fontSize:11,color:'#86909c',marginTop:3}}>来源：{item.source}</div>
              </div>
            ))}
            {materialInsights.timeline.length===0 && <div className="empty refined-empty" style={{padding:'36px 0'}}><p>未识别到明确日期事实</p></div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div>
            <span className="card-title">案件材料</span>
            <p style={{fontSize:12,color:'#86909c',marginTop:4}}>支持 PDF、Word、图片；上传后自动解析并写入证据目录。</p>
          </div>
        </div>
        <div className="material-upload-zone">
          <div>
            <strong>{uploading ? '正在上传并解析材料...' : '拖拽区暂不启用，请点击右侧上传材料'}</strong>
            <p>建议文件名包含材料类型，例如“劳动合同”“工资流水”“解除通知书”，便于自动匹配清单。</p>
          </div>
          <label className={`btn ${uploading?'btn-o':'btn-p'} btn-sm`} style={{cursor:'pointer'}}>
            {uploading ? '处理中...' : '+ 上传材料'}
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" hidden onChange={handleUpload} disabled={uploading}/>
          </label>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {materials.map(m => (
            <div key={m.id} className={`material-card ${m.parse_status==='completed' ? '' : 'failed'}`}>
              <div className="material-card-main">
                <span className="file-icon">{fileLabel(m.file_type)}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.filename}</div>
                  <div className="flex items-center gap-2" style={{marginTop:5,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:'#86909c'}}>{(m.file_size/1024).toFixed(1)} KB</span>
                    <span className={`tag ${m.parse_status==='completed'?'t-green':'t-red'}`}>{statusLabel(m.parse_status)}</span>
                    {m.parse_task_id && <span className="tag t-gray">任务 {m.parse_task_id.slice(0, 8)}</span>}
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
            <div className="empty refined-empty" style={{padding:'50px 0'}}>
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
