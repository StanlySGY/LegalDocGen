import { useState, useEffect } from 'react'

interface Document {
  id: string
  name: string
  doc_type: string
  status: string
  has_final_file: boolean
  final_file_name?: string
  created_at?: string
}

interface DocumentListProps {
  caseId: string
  onSelectDocument: (documentId: string) => void
  selectedDocumentId?: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  complaint: '起诉状/仲裁申请书',
  evidence_list: '证据清单',
  opinion: '代理词/法律意见书',
  defense: '答辩状',
  other: '其他文书',
}

const DOC_TYPE_ICONS: Record<string, string> = {
  complaint: '📜',
  evidence_list: '📋',
  opinion: '📝',
  defense: '🛡️',
  other: '📄',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  exported: '已导出',
  finalized: '已定稿',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 't-gray',
  exported: 't-orange',
  finalized: 't-green',
}

export default function DocumentList({ caseId, onSelectDocument, selectedDocumentId }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocType, setNewDocType] = useState('complaint')

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/case/${caseId}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (e) {
      console.error('Failed to load documents:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [caseId])

  const handleCreate = async () => {
    if (!newDocName.trim()) return

    try {
      const res = await fetch(`/api/documents/case/${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDocName, doc_type: newDocType }),
      })
      if (res.ok) {
        const doc = await res.json()
        setDocuments(prev => [doc, ...prev])
        setNewDocName('')
        setShowCreate(false)
        onSelectDocument(doc.id)
      }
    } catch (e) {
      console.error('Failed to create document:', e)
    }
  }

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确认删除该文书？')) return

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId))
        if (selectedDocumentId === docId) {
          onSelectDocument('')
        }
      }
    } catch (e) {
      console.error('Failed to delete document:', e)
    }
  }

  if (loading) {
    return <div className="document-list-loading">加载文书中...</div>
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <h4>案件文书</h4>
        <button className="btn btn-p btn-sm" onClick={() => setShowCreate(true)}>
          + 新建文书
        </button>
      </div>

      {showCreate && (
        <div className="document-create-form">
          <input
            className="input"
            placeholder="文书名称"
            value={newDocName}
            onChange={e => setNewDocName(e.target.value)}
          />
          <select
            className="select"
            value={newDocType}
            onChange={e => setNewDocType(e.target.value)}
          >
            {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="document-create-actions">
            <button className="btn btn-o btn-sm" onClick={() => setShowCreate(false)}>取消</button>
            <button className="btn btn-p btn-sm" onClick={handleCreate}>创建</button>
          </div>
        </div>
      )}

      <div className="document-items">
        {documents.length === 0 ? (
          <div className="document-empty">
            <span>暂无文书，点击上方按钮创建</span>
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              className={`document-item ${selectedDocumentId === doc.id ? 'selected' : ''}`}
              onClick={() => onSelectDocument(doc.id)}
            >
              <div className="document-icon">
                {DOC_TYPE_ICONS[doc.doc_type] || '📄'}
              </div>
              <div className="document-info">
                <div className="document-name">{doc.name}</div>
                <div className="document-meta">
                  <span className={`tag ${STATUS_COLORS[doc.status] || 't-gray'}`}>
                    {STATUS_LABELS[doc.status] || doc.status}
                  </span>
                  {doc.has_final_file && (
                    <span className="document-final-badge">已定稿</span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-d btn-xs document-delete"
                onClick={(e) => handleDelete(doc.id, e)}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}