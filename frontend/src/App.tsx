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
  // Feature 1: Dark mode persistence
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  // Persist theme selection and apply on change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const breadcrumb = () => {
    const m = location.pathname.match(/^\/cases\/([^/]+)(\/(workflow|editor))?/)
    if (!m) return null
    if (m[3] === 'workflow') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">工作流</span></>)
    if (m[3] === 'editor') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">文书编辑</span></>)
    return (<><span className="current">案件详情</span></>)
  }

  // Feature 2: Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

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
          <div className="nav-section" style={{marginTop:8}}>
            <div className="nav-section-title">设置</div>
            <NavLink to="/channels" className="nav-item"
              style={({ isActive }) => isActive ? {} : { textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              渠道管理
            </NavLink>
            <NavLink to="/config" className="nav-item"
              style={({ isActive }) => isActive ? {} : { textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              模型配置
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-footer">法律文书助手 v1.2.0</div>
      </div>

      <div className="main-wrap">
          <div className="top-bar">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: 'fixed', top: 10, left: 10, zIndex: 101 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div className="breadcrumb">{breadcrumb()}</div>
          </div>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>法律文书助手</span>
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}>
              {theme === 'light' ? (
                <span> 🌙 </span>
              ) : (
                <span> ☀️ </span>
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
