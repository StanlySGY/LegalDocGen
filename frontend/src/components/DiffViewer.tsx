import { useState, useEffect } from 'react'

interface DiffChange {
  type: 'insert' | 'delete' | 'equal'
  text: string
}

interface DiffViewerProps {
  caseId: string
  stage: string
  versions: Array<{ id: string; version: number; created_at?: string }>
  onClose: () => void
}

export default function DiffViewer({ caseId, stage, versions, onClose }: DiffViewerProps) {
  const [version1, setVersion1] = useState<number | null>(null)
  const [version2, setVersion2] = useState<number | null>(null)
  const [changes, setChanges] = useState<DiffChange[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (versions.length >= 2) {
      setVersion1(versions[versions.length - 2].version)
      setVersion2(versions[versions.length - 1].version)
    }
  }, [versions])

  useEffect(() => {
    if (version1 !== null && version2 !== null) {
      fetchDiff()
    }
  }, [version1, version2])

  const fetchDiff = async () => {
    if (version1 === null || version2 === null) return
    
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/workflow/diff/${caseId}/${stage}?version1=${version1}&version2=${version2}`)
      if (res.ok) {
        const data = await res.json()
        setChanges(data.changes || [])
      } else {
        setError('获取差异失败')
      }
    } catch (e) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const insertCount = changes.filter(c => c.type === 'insert').length
  const deleteCount = changes.filter(c => c.type === 'delete').length

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box diff-viewer-modal" onClick={e => e.stopPropagation()}>
        <div className="diff-header">
          <h3>版本差异对比</h3>
          <button className="btn btn-o btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="diff-controls">
          <div className="diff-select">
            <label>版本 A</label>
            <select
              className="select"
              value={version1 ?? ''}
              onChange={e => setVersion1(Number(e.target.value))}
            >
              {versions.map(v => (
                <option key={v.version} value={v.version}>
                  v{v.version} {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="diff-arrow">→</div>
          <div className="diff-select">
            <label>版本 B</label>
            <select
              className="select"
              value={version2 ?? ''}
              onChange={e => setVersion2(Number(e.target.value))}
            >
              {versions.map(v => (
                <option key={v.version} value={v.version}>
                  v{v.version} {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="diff-stats">
          <span className="diff-stat-insert">+{insertCount} 新增</span>
          <span className="diff-stat-delete">-{deleteCount} 删除</span>
        </div>

        <div className="diff-content">
          {loading && <div className="diff-loading">加载中...</div>}
          {error && <div className="diff-error">{error}</div>}
          {!loading && !error && changes.length === 0 && (
            <div className="diff-empty">两个版本内容相同</div>
          )}
          {!loading && !error && changes.map((change, idx) => (
            <div key={idx} className={`diff-line diff-${change.type}`}>
              <span className="diff-marker">
                {change.type === 'insert' ? '+' : change.type === 'delete' ? '-' : ' '}
              </span>
              <span className="diff-text">{change.text || '\u00A0'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}