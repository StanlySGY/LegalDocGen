import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import WorkflowPage from './pages/WorkflowPage'
import ChannelManage from './pages/ChannelManage'
import ModelConfig from './pages/ModelConfig'

export default function App() {
  const location = useLocation()
  const isCases = location.pathname === '/' || location.pathname.startsWith('/cases')
  const isChannels = location.pathname === '/channels'
  const isConfig = location.pathname === '/config'

  const breadcrumb = () => {
    const m = location.pathname.match(/^\/cases\/([^/]+)(\/(workflow|editor))?/)
    if (!m) return null
    if (m[3] === 'workflow') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">工作流</span></>)
    if (m[3] === 'editor') return (<><a href="/cases">案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">文书编辑</span></>)
    return (<><span className="current">案件详情</span></>)
  }

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1><span>⚖️</span> LegalDocGen</h1>
          <p>法律文书智能生成系统</p>
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
          <div className="nav-section">
            <div className="nav-section-title">系统</div>
            <NavLink to="/channels" className={`nav-item ${isChannels ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              渠道管理
            </NavLink>
            <NavLink to="/config" className={`nav-item ${isConfig ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
              Prompt模板
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-footer">v1.0.0</div>
      </div>

      <div className="main-wrap">
        <div className="top-bar">
          <div className="breadcrumb">{breadcrumb()}</div>
          <span style={{fontSize:12,color:'#c9cdd4'}}>法律文书智能生成系统</span>
        </div>
        <div className="page-body">
          <Routes>
            <Route path="/" element={<CaseList />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/cases/:id/workflow" element={<WorkflowPage />} />
            <Route path="/channels" element={<ChannelManage />} />
            <Route path="/config" element={<ModelConfig />} />
          </Routes>
        </div>
      </div>
    </>
  )
}
