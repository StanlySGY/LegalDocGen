import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Props {
  caseId: string
  templateId?: string
}

export default function MaterialChecklist({ caseId, templateId }: Props) {
  const [template, setTemplate] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        if (templateId) {
          const tpl = await api.templates.get(templateId)
          setTemplate(tpl)
          setChecklist(tpl.materials_checklist || [])
        }
        const mats = await api.materials.list(caseId)
        setMaterials(mats)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [caseId, templateId])

  if (loading || !template) {
    return null
  }

  const getCompletionStatus = () => {
    const required = checklist.filter(item => item.required)
    const completed = required.filter(item => {
      const keyword = item.name.toLowerCase()
      return materials.some(m => m.filename.toLowerCase().includes(keyword))
    })
    return { completed: completed.length, total: required.length }
  }

  const status = getCompletionStatus()
  const completionPercent = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid #6366f1' }}>
      <div className="card-hd">
        <span className="card-title">材料检查清单</span>
        <span style={{ fontSize: 12, color: '#86909c' }}>
          {status.completed}/{status.total} 必需材料已上传
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          height: 8,
          background: '#f0f0f0',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 8
        }}>
          <div style={{
            height: '100%',
            background: completionPercent === 100 ? '#10b981' : '#f59e0b',
            width: `${completionPercent}%`,
            transition: 'width 0.3s'
          }} />
        </div>
        <div style={{ fontSize: 12, color: '#86909c', textAlign: 'right' }}>
          {completionPercent}% 完成
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((item, i) => {
          const isUploaded = materials.some(m =>
            m.filename.toLowerCase().includes(item.name.toLowerCase())
          )
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                background: isUploaded ? '#f0fdf4' : '#fafafa',
                borderRadius: 8,
                border: `1px solid ${isUploaded ? '#d1fae5' : '#e5e7eb'}`
              }}
            >
              <div style={{
                fontSize: 16,
                marginTop: 2,
                color: isUploaded ? '#10b981' : '#d1d5db'
              }}>
                {isUploaded ? '✓' : item.required ? '●' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isUploaded ? '#10b981' : '#1d2129'
                }}>
                  {item.name}
                  {item.required && <span style={{ color: '#ef4444' }}>*</span>}
                </div>
                <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                  {item.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {completionPercent === 100 && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #d1fae5',
          borderRadius: 8,
          color: '#10b981',
          fontSize: 12,
          textAlign: 'center'
        }}>
          ✓ 所有必需材料已上传，可以开始工作流
        </div>
      )}
    </div>
  )
}
