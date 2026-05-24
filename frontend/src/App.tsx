import { useState } from 'react'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import WorkflowPage from './pages/WorkflowPage'
import ChannelManage from './pages/ChannelManage'
import ModelConfig from './pages/ModelConfig'

type Page =
  | { type: 'cases' }
  | { type: 'detail'; caseId: string }
  | { type: 'workflow'; caseId: string }
  | { type: 'channels' }
  | { type: 'config' }

export default function App() {
  const [page, setPage] = useState<Page>({ type: 'cases' })

  const nav = {
    cases: () => setPage({ type: 'cases' }),
    detail: (id: string) => setPage({ type: 'detail', caseId: id }),
    workflow: (id: string) => setPage({ type: 'workflow', caseId: id }),
    channels: () => setPage({ type: 'channels' }),
    config: () => setPage({ type: 'config' }),
  }

  const isCases = page.type === 'cases' || page.type === 'detail' || page.type === 'workflow'
  const isChannels = page.type === 'channels'
  const isConfig = page.type === 'config'

  const breadcrumb = () => {
    switch (page.type) {
      case 'cases': return null
      case 'detail': return (<><a onClick={nav.cases}>案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">案件详情</span></>)
      case 'workflow': return (<><a onClick={nav.cases}>案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">工作流</span></>)
      case 'channels': return null
      case 'config': return null
    }
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
            <div className={`nav-item ${isCases ? 'active' : ''}`} onClick={nav.cases}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              案件管理
            </div>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">系统</div>
            <div className={`nav-item ${isChannels ? 'active' : ''}`} onClick={nav.channels}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              渠道管理
            </div>
            <div className={`nav-item ${isConfig ? 'active' : ''}`} onClick={nav.config}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
              Prompt模板
            </div>
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
          {page.type === 'cases' && <CaseList nav={nav} />}
          {page.type === 'detail' && <CaseDetail caseId={page.caseId} nav={nav} />}
          {page.type === 'workflow' && <WorkflowPage caseId={page.caseId} onBack={() => nav.detail(page.caseId)} onCaseNav={nav.cases} />}
          {page.type === 'channels' && <ChannelManage onBack={nav.cases} />}
          {page.type === 'config' && <ModelConfig onNavChannels={nav.channels} />}
        </div>
      </div>
    </>
  )
}
