import { useState } from 'react'

interface ExportOption {
  id: string
  label: string
  description: string
  defaultEnabled: boolean
}

interface ExportOptionsModalProps {
  open: boolean
  onConfirm: (selectedOptions: string[]) => void
  onCancel: () => void
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'fact_extraction',
    label: '第一阶段：案件要素提取',
    description: '当事人信息、关键事实、证据清单与时间线',
    defaultEnabled: true
  },
  {
    id: 'legal_analysis',
    label: '第二阶段：法律关系分析',
    description: '法律关系、适用规则、权利义务分析',
    defaultEnabled: true
  },
  {
    id: 'dispute_focus',
    label: '第三阶段：争议焦点整理',
    description: '事实争议、法律争议、证据关键点',
    defaultEnabled: true
  },
  {
    id: 'draft_generation',
    label: '第四阶段：文书初稿',
    description: '诉状、仲裁申请书等法律文书初稿',
    defaultEnabled: true
  },
  {
    id: 'review_optimization',
    label: '第五阶段：审查与优化',
    description: '逻辑、依据、完整性和表达审查意见',
    defaultEnabled: true
  },
  {
    id: 'evidence_catalog',
    label: '附录：证据目录',
    description: '证据材料清单与页码引用',
    defaultEnabled: true
  },
  {
    id: 'timeline',
    label: '附录：事实时间线',
    description: '从材料中提取的日期事实时间线',
    defaultEnabled: true
  },
  {
    id: 'legal_articles',
    label: '附录：法条核验报告',
    description: '引用法条核验结果与明细',
    defaultEnabled: false
  }
]

export default function ExportOptionsModal({ open, onConfirm, onCancel }: ExportOptionsModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    EXPORT_OPTIONS.filter(opt => opt.defaultEnabled).map(opt => opt.id)
  )

  const toggleOption = (id: string) => {
    setSelectedOptions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedOptions.length === EXPORT_OPTIONS.length) {
      setSelectedOptions([])
    } else {
      setSelectedOptions(EXPORT_OPTIONS.map(opt => opt.id))
    }
  }

  if (!open) return null

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-box export-options-modal" onClick={e => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>导出 Word 文档</h3>
          <p>选择需要包含在导出文档中的内容模块</p>
        </div>

        <div className="export-options-list">
          <div className="export-option-toggle-all">
            <label className="export-option-item">
              <input
                type="checkbox"
                checked={selectedOptions.length === EXPORT_OPTIONS.length}
                onChange={toggleAll}
              />
              <span className="export-option-label font-semibold">全选/取消全选</span>
            </label>
          </div>
          
          {EXPORT_OPTIONS.map(option => (
            <label key={option.id} className="export-option-item">
              <input
                type="checkbox"
                checked={selectedOptions.includes(option.id)}
                onChange={() => toggleOption(option.id)}
              />
              <div className="export-option-content">
                <span className="export-option-label">{option.label}</span>
                <span className="export-option-desc">{option.description}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="export-modal-footer">
          <div className="text-xs-muted">已选择 {selectedOptions.length} 个模块</div>
          <div className="export-modal-actions">
            <button className="btn btn-o" onClick={onCancel}>取消</button>
            <button
              className="btn btn-p"
              onClick={() => onConfirm(selectedOptions)}
              disabled={selectedOptions.length === 0}
            >
              确认导出
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}