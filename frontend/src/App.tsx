import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import WorkflowPage from './pages/WorkflowPage'
import DocumentEditor from './pages/DocumentEditor'
import ChannelManage from './pages/ChannelManage'
import ModelConfig from './pages/ModelConfig'

export default function App() {
  const location = useLocation()
  const isCases = location.pathname === '/' || location.pathname.startsWith('/cases')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
  }

  const breadcrumb = () => {
    const m = location.pathname.match(/^\/cases\/([^/]+)(\/(workflow|editor))?/)
    if (!m) return null
    if (m[3] === 'workflow') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">工作流</span></>)
    if (m[3] === 'editor') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">文书编辑</span></>)
    return (<><span className="current">案件详情</span></>)
  }

  return (
    <>
      <div className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1><span>⚖️</span> 法律文书助手</h1>
          <p>智能文书生成系统</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">业务</div>
            <NavLink to="/" end className={`nav-item ${isCases ? 'active' : ''}`}
              style={({ isActive }) => isActive ? {} : { textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              案件管理
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-footer">法律文书助手 v1.2.0</div>
      </div>

      <div className="main-wrap">
        <div className="top-bar">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div className="breadcrumb">{breadcrumb()}</div>
          </div>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>法律文书助手</span>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>
        </div>
        <div className="page-body">
          <Routes>
            <Route path="/" element={<CaseList />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/cases/:id/workflow" element={<WorkflowPage />} />
            <Route path="/cases/:id/editor" element={<DocumentEditor />} />
            <Route path="/channels" element={<ChannelManage />} />
            <Route path="/config" element={<ModelConfig />} />
          </Routes>
        </div>
      </div>
    </>
  )
}
