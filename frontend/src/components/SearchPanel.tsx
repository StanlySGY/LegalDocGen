import { useState, useRef, useEffect } from 'react'

interface SearchResult {
  material_id: string
  filename: string
  file_type: string
  snippet: string
  page_num: number | null
  position: number
}

interface SearchPanelProps {
  caseId: string
  onResultClick: (materialId: string, filename: string, content: string) => void
}

export default function SearchPanel({ caseId, onResultClick }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/materials/case/${caseId}/search?q=${encodeURIComponent(searchQuery.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      }
    } catch (e) {
      console.error('Search failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      handleSearch(value)
    }, 400)
  }

  const highlightSnippet = (snippet: string, query: string) => {
    if (!query.trim()) return snippet
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return snippet.replace(regex, '<mark>$1</mark>')
  }

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="案卷内搜索..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>
            ×
          </button>
        )}
      </div>

      {searched && (
        <div className="search-results">
          <div className="search-results-header">
            {loading ? '搜索中...' : `找到 ${results.length} 条结果`}
          </div>
          {results.length === 0 && !loading && (
            <div className="search-empty">未找到匹配内容</div>
          )}
          {results.map((result, idx) => (
            <div
              key={idx}
              className="search-result-item"
              onClick={() => onResultClick(result.material_id, result.filename, result.snippet)}
            >
              <div className="search-result-filename">
                {result.file_type === '.pdf' ? '📄' : result.file_type?.startsWith('.doc') ? '📝' : '🖼️'} {result.filename}
              </div>
              <div
                className="search-result-snippet"
                dangerouslySetInnerHTML={{ __html: highlightSnippet(result.snippet, query) }}
              />
              <div className="search-result-meta">
                {result.page_num && <span>第 {result.page_num} 页</span>}
                <span>位置: {result.position}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}