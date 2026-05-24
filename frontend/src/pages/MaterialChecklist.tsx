import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getMaterialCompletion, type ChecklistItem, type MaterialRecord } from '../services/materialMatcher'

interface Props {
  caseId: string
  templateId?: string
}

export default function MaterialChecklist({ caseId, templateId }: Props) {
  const [template, setTemplate] = useState<any>(null)
  const [materials, setMaterials] = useState<MaterialRecord[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
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

  const { items, requiredItems, completedRequired, missingRequired, completionPercent } = getMaterialCompletion(checklist, materials)

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid #6366f1' }}>
      <div className="card-hd">
        <span className="card-title">材料检查清单</span>
        <span style={{ fontSize: 12, color: '#86909c' }}>
          {completedRequired}/{requiredItems.length} 必需材料已识别
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#86909c' }}>
          <span>{missingRequired > 0 ? `仍缺少 ${missingRequired} 项必需材料` : '必需材料已齐备'}</span>
          <span>{completionPercent}% 完成</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(({ item, keywords, matchedMaterial }, i) => {
          const isUploaded = Boolean(matchedMaterial)
          const isRequired = item.required !== false
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                background: isUploaded ? '#f0fdf4' : isRequired ? '#fffbeb' : '#fafafa',
                borderRadius: 8,
                border: `1px solid ${isUploaded ? '#d1fae5' : isRequired ? '#fde68a' : '#e5e7eb'}`
              }}
            >
              <div style={{
                fontSize: 16,
                marginTop: 2,
                color: isUploaded ? '#10b981' : isRequired ? '#f59e0b' : '#d1d5db'
              }}>
                {isUploaded ? '✓' : isRequired ? '●' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: isUploaded ? '#10b981' : '#1d2129' }}>
                    {item.name}{isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                  </span>
                  <span className={`tag ${isUploaded ? 't-green' : isRequired ? 't-orange' : 't-gray'}`}>
                    {isUploaded ? '已匹配' : isRequired ? '待上传' : '选填'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                  {matchedMaterial ? `匹配文件：${matchedMaterial.filename}` : item.description}
                </div>
                {!matchedMaterial && keywords.length > 0 && (
                  <div style={{ fontSize: 11, color: '#c97706', marginTop: 4 }}>
                    建议文件名或正文包含：{keywords.slice(0, 3).join('、')}
                  </div>
                )}
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
          所有必需材料已上传，可以开始工作流
        </div>
      )}
    </div>
  )
}
