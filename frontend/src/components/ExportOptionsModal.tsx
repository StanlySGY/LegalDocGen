import { useState } from 'react'

interface ExportOptionsModalProps {
  open: boolean
  onConfirm: (exportType: 'standard' | 'package') => void
  onCancel: () => void
}

export default function ExportOptionsModal({ open, onConfirm, onCancel }: ExportOptionsModalProps) {
  const [exportType, setExportType] = useState<'standard' | 'package'>('standard')

  if (!open) return null

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-box export-options-modal" onClick={e => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>导出选项</h3>
          <p>选择导出格式</p>
        </div>

        <div className="export-options-list">
          <label className="export-option-item" style={{cursor:'pointer'}}>
            <input
              type="radio"
              checked={exportType === 'standard'}
              onChange={() => setExportType('standard')}
            />
            <div className="export-option-content">
              <span className="export-option-label">标准文档 (Word)</span>
              <span className="export-option-desc">包含五个阶段输出、证据目录和时间线，适合打印和提交</span>
            </div>
          </label>

          <label className="export-option-item" style={{cursor:'pointer'}}>
            <input
              type="radio"
              checked={exportType === 'package'}
              onChange={() => setExportType('package')}
            />
            <div className="export-option-content">
              <span className="export-option-label">完整案件包 (ZIP)</span>
              <span className="export-option-desc">包含原始材料、各阶段分析文档、终稿、证据目录、时间线、法条清单和元数据，适合归档</span>
            </div>
          </label>
        </div>

        <div className="export-modal-footer">
          <div className="text-xs-muted">{exportType === 'standard' ? '将导出单个 Word 文档' : '将导出 ZIP 压缩包'}</div>
          <div className="export-modal-actions">
            <button className="btn btn-o" onClick={onCancel}>取消</button>
            <button className="btn btn-p" onClick={() => onConfirm(exportType)}>确认导出</button>
          </div>
        </div>
      </div>
    </div>
  )
}