import { FormEvent, useEffect, useState } from 'react'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import WorkflowPage from './pages/WorkflowPage'
import ChannelManage from './pages/ChannelManage'
import ModelConfig from './pages/ModelConfig'
import AuditLogPage from './pages/AuditLogPage'
import TeamManagePage from './pages/TeamManagePage'
import TaskMonitorPage from './pages/TaskMonitorPage'
import LegalArticlePage from './pages/LegalArticlePage'
import { api, apiBaseUrl, type AuthUser, getAdminToken, getAuthToken, setAdminToken, setAuthToken } from './services/api'

type Page =
  | { type: 'cases' }
  | { type: 'detail'; caseId: string }
  | { type: 'workflow'; caseId: string }
  | { type: 'channels' }
  | { type: 'config' }
  | { type: 'audit' }
  | { type: 'teams' }
  | { type: 'tasks' }
  | { type: 'legalArticles' }

type HealthState = {
  status: 'checking' | 'ok' | 'degraded' | 'offline'
  message: string
}

type AuthMode = 'login' | 'register'

export default function App() {
  const [page, setPage] = useState<Page>({ type: 'cases' })
  const [adminToken, setAdminTokenState] = useState(getAdminToken())
  const [health, setHealth] = useState<HealthState>({ status: 'checking', message: '正在检测后端连接' })
  const [authLoading, setAuthLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [showAuthPanel, setShowAuthPanel] = useState(false)
  const [authForm, setAuthForm] = useState({ username: '', password: '', display_name: '' })
  const [authError, setAuthError] = useState('')

  const checkHealth = async () => {
    setHealth(prev => prev.status === 'ok' ? prev : { status: 'checking', message: '正在检测后端连接' })
    try {
      const data = await api.health()
      setHealth({
        status: data.status === 'ok' ? 'ok' : 'degraded',
        message: data.status === 'ok' ? '后端已连接' : '后端已连接，但部分诊断异常',
      })
    } catch (e: any) {
      setHealth({ status: 'offline', message: e.message || `后端未连接：${apiBaseUrl}` })
    }
  }

  const loadSession = async () => {
    setAuthLoading(true)
    try {
      const data = await api.auth.me()
      setAuthRequired(data.auth_required)
      setCurrentUser(data.user)
      if (!data.user && getAuthToken()) setAuthToken('')
    } catch {
      if (!getAuthToken()) setCurrentUser(null)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    loadSession()
    const timer = window.setInterval(checkHealth, 60000)
    return () => window.clearInterval(timer)
  }, [])

  const saveAdminToken = (token: string) => {
    setAdminToken(token)
    setAdminTokenState(token)
  }

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      const username = authForm.username.trim()
      if (!username || !authForm.password) throw new Error('请输入用户名和密码')
      const data = authMode === 'login'
        ? await api.auth.login({ username, password: authForm.password })
        : await api.auth.register({ username, password: authForm.password, display_name: authForm.display_name.trim() })
      setAuthToken(data.token)
      setAuthRequired(data.auth_required)
      setCurrentUser(data.user)
      setShowAuthPanel(false)
      setAuthForm({ username: '', password: '', display_name: '' })
      setPage({ type: 'cases' })
    } catch (err: any) {
      setAuthError(err.message || '认证失败')
    }
  }

  const logout = () => {
    setAuthToken('')
    setCurrentUser(null)
    setShowAuthPanel(false)
    setPage({ type: 'cases' })
  }

  const nav = {
    cases: () => setPage({ type: 'cases' }),
    detail: (id: string) => setPage({ type: 'detail', caseId: id }),
    workflow: (id: string) => setPage({ type: 'workflow', caseId: id }),
    channels: () => setPage({ type: 'channels' }),
    config: () => setPage({ type: 'config' }),
    audit: () => setPage({ type: 'audit' }),
    teams: () => setPage({ type: 'teams' }),
    tasks: () => setPage({ type: 'tasks' }),
    legalArticles: () => setPage({ type: 'legalArticles' }),
  }

  const isCases = page.type === 'cases' || page.type === 'detail' || page.type === 'workflow'
  const isChannels = page.type === 'channels'
  const isConfig = page.type === 'config'
  const isAudit = page.type === 'audit'
  const isTeams = page.type === 'teams'
  const isTasks = page.type === 'tasks'
  const isLegalArticles = page.type === 'legalArticles'
  const needsLogin = authRequired && !currentUser

  const breadcrumb = () => {
    switch (page.type) {
      case 'cases': return null
      case 'detail': return (<><a onClick={nav.cases}>案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">案件详情</span></>)
      case 'workflow': return (<><a onClick={nav.cases}>案件管理</a><span style={{color:'#d1d5db'}}>/</span><span className="current">工作流</span></>)
      case 'channels': return null
      case 'config': return null
      case 'audit': return null
      case 'teams': return null
      case 'tasks': return null
      case 'legalArticles': return null
    }
  }

  const authPanel = (
    <div className="auth-panel card">
      <div className="auth-copy">
        <div className="tag t-purple">AUTH</div>
        <h2>{authMode === 'login' ? '登录 LegalDocGen' : '创建团队账号'}</h2>
        <p>启用认证后，普通成员仅能访问自己创建的案件，管理员可管理渠道、模板、审计与用户。</p>
      </div>
      <form className="auth-form" onSubmit={handleAuthSubmit}>
        <input className="input" placeholder="用户名" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
        {authMode === 'register' && (
          <input className="input" placeholder="显示名称（可选）" value={authForm.display_name} onChange={e => setAuthForm({ ...authForm, display_name: e.target.value })} />
        )}
        <input className="input" type="password" placeholder="密码" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
        {authError && <div className="auth-error">{authError}</div>}
        <button className="btn btn-p" type="submit">{authMode === 'login' ? '登录' : '注册并登录'}</button>
        <button className="btn btn-o" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}>
          {authMode === 'login' ? '没有账号，去注册' : '已有账号，去登录'}
        </button>
      </form>
    </div>
  )

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
            <div className={`nav-item ${isTeams ? 'active' : ''}`} onClick={nav.teams}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              团队协作
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
            <div className={`nav-item ${isAudit ? 'active' : ''}`} onClick={nav.audit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              审计日志
            </div>
            <div className={`nav-item ${isTasks ? 'active' : ''}`} onClick={nav.tasks}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h6M8 17h4"/></svg>
              后台任务
            </div>
            <div className={`nav-item ${isLegalArticles ? 'active' : ''}`} onClick={nav.legalArticles}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              法条核验
            </div>
          </div>
        </nav>
        <div className="sidebar-footer">v1.0.0</div>
      </div>

      <div className="main-wrap">
        <div className="top-bar">
          <div className="breadcrumb">{breadcrumb()}</div>
          <div className="top-actions">
            <button
              className={`health-chip health-${health.status}`}
              onClick={checkHealth}
              title={`${health.message}；API：${apiBaseUrl}`}
            >
              <span className="health-dot" />
              {health.status === 'checking' ? '检测中' : health.status === 'offline' ? '后端未连接' : health.status === 'degraded' ? '诊断异常' : '后端已连接'}
            </button>
            {currentUser && (
              <span className="user-chip" title={currentUser.username}>
                {currentUser.display_name || currentUser.username} · {currentUser.role === 'admin' ? '管理员' : '成员'}
              </span>
            )}
            <input
              className="input admin-token-input"
              type="password"
              placeholder="管理 Token（可选）"
              value={adminToken}
              onChange={e=>saveAdminToken(e.target.value)}
            />
            {currentUser ? (
              <button className="btn btn-o btn-sm" onClick={logout}>退出</button>
            ) : !authLoading && !authRequired ? (
              <button className="btn btn-o btn-sm" onClick={() => setShowAuthPanel(!showAuthPanel)}>{showAuthPanel ? '关闭登录' : '登录'}</button>
            ) : null}
            <span style={{fontSize:12,color:'#c9cdd4'}}>法律文书智能生成系统</span>
          </div>
        </div>
        <div className="page-body">
          {health.status !== 'ok' && (
            <div className={`connection-banner connection-${health.status}`}>
              <strong>{health.message}</strong>
              <span>当前 API：{apiBaseUrl}。如果部署在 Vercel，请配置 VITE_API_BASE_URL 指向独立 FastAPI 后端。</span>
            </div>
          )}
          {authLoading && <div className="card auth-loading">正在检查登录状态...</div>}
          {!authLoading && needsLogin && authPanel}
          {!authLoading && !needsLogin && showAuthPanel && authPanel}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'cases' && <CaseList nav={nav} />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'detail' && <CaseDetail caseId={page.caseId} nav={nav} />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'workflow' && <WorkflowPage caseId={page.caseId} onBack={() => nav.detail(page.caseId)} onCaseNav={nav.cases} />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'channels' && <ChannelManage onBack={nav.cases} />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'config' && <ModelConfig onNavChannels={nav.channels} />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'audit' && <AuditLogPage />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'teams' && <TeamManagePage />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'tasks' && <TaskMonitorPage />}
          {!authLoading && !needsLogin && !showAuthPanel && page.type === 'legalArticles' && <LegalArticlePage />}
        </div>
      </div>
    </>
  )
}
