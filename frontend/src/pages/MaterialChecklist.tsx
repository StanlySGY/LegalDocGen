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
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-hd">
        <div>
          <span className="card-title">材料齐备度 checklist</span>
          <p className="text-xs-desc">基于案件模板自动匹配已上传材料，缺失项会阻止直接进入工作流。</p>
        </div>
        <span className={`tag ${missingRequired > 0 ? 't-orange' : 't-green'}`}>
          {completedRequired}/{requiredItems.length} 必需材料
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', background: completionPercent === 100 ? '#10b981' : '#f59e0b', width: `${completionPercent}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#86909c' }}>
          <span>{missingRequired > 0 ? `仍缺少 ${missingRequired} 项必需材料` : '必需材料已齐备'}</span>
          <span>{completionPercent}% 完成</span>
        </div>
      </div>

      <div className="checklist-items">
        {items.map(({ item, keywords, matchedMaterial }, i) => {
          const isUploaded = Boolean(matchedMaterial)
          const isRequired = item.required !== false
          return (
            <div key={i} className={`checklist-item ${isUploaded ? 'done' : isRequired ? 'required' : ''}`}>
              <span className="check-dot">{isUploaded ? '✓' : isRequired ? '!' : '·'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isUploaded ? '#047857' : '#1d2129' }}>
                    {item.name}{isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                  </span>
                  <span className={`tag ${isUploaded ? 't-green' : isRequired ? 't-orange' : 't-gray'}`}>
                    {isUploaded ? '已匹配' : isRequired ? '待上传' : '选填'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#86909c', marginTop: 4, lineHeight: 1.6 }}>
                  {matchedMaterial ? `匹配文件：${matchedMaterial.filename}` : item.description || '未配置说明'}
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

      <div className={`notice-card ${completionPercent === 100 ? 'notice-success' : 'notice-warn'}`} style={{marginTop:16,marginBottom:0}}>
        <div>
          <strong>{completionPercent === 100 ? '所有必需材料已上传，可以开始工作流' : '仍有必需材料缺失'}</strong>
          <span>{completionPercent === 100 ? '建议继续检查页码引用和事实时间线，再进入五阶段生成。' : '请优先补齐缺失材料，降低空材料生成和事实编造风险。'}</span>
        </div>
      </div>
    </div>
  )
}
