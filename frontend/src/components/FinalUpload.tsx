import { useState, useRef } from 'react'

interface FinalUploadProps {
  documentId: string
  documentName: string
  hasFinalFile: boolean
  finalFileName?: string
  onUploadSuccess: () => void
}

export default function FinalUpload({
  documentId,
  documentName,
  hasFinalFile,
  finalFileName,
  onUploadSuccess
}: FinalUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`/api/documents/${documentId}/upload-final`, {
        method: 'POST',
        body: form,
      })

      if (res.ok) {
        onUploadSuccess()
        if (fileRef.current) fileRef.current.value = ''
      } else {
        const data = await res.json()
        setError(data.detail || '上传失败')
      }
    } catch (e) {
      setError('网络错误')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/download?version=final`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = finalFileName || `${documentName}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Download failed:', e)
    }
  }

  return (
    <div className="final-upload">
      <div className="final-upload-header">
        <h4>终版文书管理</h4>
        <span className="text-xs-muted">
          在本地修改完成后，上传终版 Word 文档归档
        </span>
      </div>

      {hasFinalFile && (
        <div className="final-file-info">
          <div className="final-file-icon">📄</div>
          <div className="final-file-details">
            <div className="final-file-name">{finalFileName || '终版文档'}</div>
            <div className="text-xs-muted">已归档</div>
          </div>
          <button className="btn btn-o btn-sm" onClick={handleDownload}>
            下载终版
          </button>
        </div>
      )}

      <div className="final-upload-area">
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.doc"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        <button
          className="btn btn-p btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '上传中...' : hasFinalFile ? '更新终版' : '上传终版 Word'}
        </button>
        {error && <span className="final-upload-error">{error}</span>}
      </div>
    </div>
  )
}
