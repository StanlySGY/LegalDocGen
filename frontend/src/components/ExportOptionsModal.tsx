import { useState } from 'react'

interface ExportOptionsModalProps {
  open: boolean
  onConfirm: (exportType: 'standard' | 'package') => void
  onCancel: () => void
}

const formatTemplates = [
  { key: 'standard', label: '标准文档 (Word)', desc: '包含五个阶段输出、证据目录和时间线，适合打印和提交' },
  { key: 'court', label: '法院严格格式', desc: '标题方正小标宋简体二号，正文仿宋_GB2312 三号，固定值 28 磅行距' },
  { key: 'arbitration', label: '仲裁委格式', desc: '适用于仲裁申请书，按仲裁委排版规范' },
  { key: 'package', label: '完整案件包 (ZIP)', desc: '包含原始材料、各阶段分析、终稿、证据目录、时间线、法条清单' },
]

export default function ExportOptionsModal({ open, onConfirm, onCancel }: ExportOptionsModalProps) {
  const [selected, setSelected] = useState('standard')

  if (!open) return null

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-box export-options-modal" onClick={e => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>导出选项</h3>
          <p>选择导出格式和排版模板</p>
        </div>

        <div className="export-options-list">
          {formatTemplates.map(t => (
            <label key={t.key} className="export-option-item" style={{cursor:'pointer'}}>
              <input type="radio" checked={selected === t.key} onChange={() => setSelected(t.key)} />
              <div className="export-option-content">
                <span className="export-option-label">{t.label}</span>
                <span className="export-option-desc">{t.desc}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="export-modal-footer">
          <div className="text-xs-muted">{selected === 'package' ? '将导出 ZIP 压缩包' : '将导出 Word 文档'}</div>
          <div className="export-modal-actions">
            <button className="btn btn-o" onClick={onCancel}>取消</button>
            <button className="btn btn-p" onClick={() => onConfirm(selected as any)}>确认导出</button>
          </div>
        </div>
      </div>
    </div>
  )
}
