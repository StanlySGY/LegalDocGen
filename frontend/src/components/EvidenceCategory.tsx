import { useState } from 'react'

interface EvidenceCategoryProps {
  materials: any[]
  onCategoryChange: (materialId: string, category: string) => void
  onPreview: (filename: string, content: string) => void
  onDelete: (id: string) => void
}

const CATEGORIES = [
  { id: 'identity', label: '诉讼主体材料', icon: '👤', desc: '身份证、营业执照、委托书等' },
  { id: 'contract', label: '核心法律依据', icon: '📋', desc: '合同、协议、催款函等' },
  { id: 'evidence', label: '履约与侵权事实', icon: '📎', desc: '流水、截图、凭证等' },
  { id: 'other', label: '辅助/其他程序材料', icon: '📁', desc: '快递单、邮寄凭证等' },
]

const statusLabel = (status: string) => status === 'completed' ? '已解析' : status === 'parsing' ? '解析中' : '解析失败'
const statusTag = (status: string) => status === 'completed' ? 't-green' : status === 'parsing' ? 't-orange' : 't-red'
const fileLabel = (type: string) => type === '.pdf' ? 'PDF' : type?.startsWith('.doc') ? 'DOC' : 'IMG'

export default function EvidenceCategory({ materials, onCategoryChange, onPreview, onDelete }: EvidenceCategoryProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null)

  const groupedMaterials = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = materials.filter(m => (m.category || 'other') === cat.id)
    return acc
  }, {} as Record<string, any[]>)

  const handleDragStart = (e: React.DragEvent, materialId: string) => {
    e.dataTransfer.setData('text/plain', materialId)
  }

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault()
    setDragOverCategory(categoryId)
  }

  const handleDragLeave = () => {
    setDragOverCategory(null)
  }

  const handleDrop = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault()
    setDragOverCategory(null)
    const materialId = e.dataTransfer.getData('text/plain')
    if (materialId) {
      onCategoryChange(materialId, categoryId)
    }
  }

  return (
    <div className="evidence-categories">
      {CATEGORIES.map(cat => {
        const count = groupedMaterials[cat.id].length
        const isExpanded = expandedCategory === cat.id
        const isDragOver = dragOverCategory === cat.id

        return (
          <div key={cat.id} className={`evidence-folder ${isDragOver ? 'drag-over' : ''}`}>
            <div
              className="folder-header"
              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              onDragOver={(e) => handleDragOver(e, cat.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cat.id)}
            >
              <div className="folder-icon">{cat.icon}</div>
              <div className="folder-info">
                <div className="folder-name">{cat.label}</div>
                <div className="folder-desc">{cat.desc}</div>
              </div>
              <div className="folder-count">
                <span className="count-number">{count}</span>
                <span className="count-label">份</span>
              </div>
              <svg
                className={`folder-arrow ${isExpanded ? 'expanded' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {isExpanded && (
              <div className="folder-content">
                {groupedMaterials[cat.id].length === 0 ? (
                  <div className="folder-empty">
                    <span>暂无材料，拖拽文件到此分类</span>
                  </div>
                ) : (
                  <div className="material-list">
                    {groupedMaterials[cat.id].map((mat: any) => (
                      <div
                        key={mat.id}
                        className="material-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, mat.id)}
                      >
                        <span className={`tag ${statusTag(mat.parse_status)}`}>
                          {fileLabel(mat.file_type)}
                        </span>
                        <span className="material-name">{mat.filename}</span>
                        <span className={`tag ${statusTag(mat.parse_status)}`}>
                          {statusLabel(mat.parse_status)}
                        </span>
                        <div className="material-actions">
                          {mat.parse_status === 'completed' && (
                            <button
                              className="btn btn-o btn-xs"
                              onClick={() => onPreview(mat.filename, mat.parsed_content)}
                            >
                              查看
                            </button>
                          )}
                          <button
                            className="btn btn-d btn-xs"
                            onClick={() => onDelete(mat.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}