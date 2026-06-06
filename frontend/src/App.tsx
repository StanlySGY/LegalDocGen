import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import BillingUsagePage from './pages/BillingUsagePage'
import OperationsPage from './pages/OperationsPage'
import { api, apiBaseUrl, type AuthUser, getAdminToken, getAuthToken, setAdminToken, setAuthToken } from './services/api'
import ErrorBoundary from './components/ErrorBoundary'
import { useNetworkStatus } from './hooks/useNetworkStatus'

type HealthState = {
  status: 'checking' | 'ok' | 'degraded' | 'offline'
  message: string
}

type AuthMode = 'login' | 'register'

const productMode = import.meta.env.VITE_PRODUCT_MODE || 'personal_lawyer'
const isPersonalLawyerMode = productMode === 'personal_lawyer'

export default function App() {
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
    } catch (err: any) {
      setAuthError(err.message || '认证失败')
    }
  }

  const logout = () => {
    setAuthToken('')
    setCurrentUser(null)
    setShowAuthPanel(false)
  }

  const needsLogin = authRequired && !currentUser

  const authPanel = (
    <div className="auth-panel card">
      <div className="auth-copy">
        <div className="tag t-purple">AUTH</div>
        <h2>{authMode === 'login' ? '登录律师工作台' : '创建律师工作台账号'}</h2>
        <p>登录后进入个人案件工作台，集中管理材料、AI 分析、文书草稿和导出归档。</p>
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

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (authLoading) return <div className="card auth-loading">正在检查登录状态...</div>
    if (needsLogin) return authPanel
    if (showAuthPanel) return authPanel
    return <>{children}</>
  }

  return (
    <BrowserRouter>
      <AppLayout
        health={health}
        checkHealth={checkHealth}
        currentUser={currentUser}
        adminToken={adminToken}
        saveAdminToken={saveAdminToken}
        authLoading={authLoading}
        authRequired={authRequired}
        showAuthPanel={showAuthPanel}
        setShowAuthPanel={setShowAuthPanel}
        logout={logout}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/cases" replace />} />
          <Route path="/cases" element={<ProtectedRoute><CaseList /></ProtectedRoute>} />
          <Route path="/cases/:caseId" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
          <Route path="/cases/:caseId/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
          <Route path="/channels" element={<ProtectedRoute><ChannelManage /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute><ModelConfig /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><TeamManagePage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingUsagePage currentUser={currentUser} /></ProtectedRoute>} />
          <Route path="/operations" element={<ProtectedRoute><OperationsPage currentUser={currentUser} /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TaskMonitorPage /></ProtectedRoute>} />
          <Route path="/legal-articles" element={<ProtectedRoute><LegalArticlePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/cases" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

import { NavLink, useLocation } from 'react-router-dom'

interface AppLayoutProps {
  children: React.ReactNode
  health: HealthState
  checkHealth: () => void
  currentUser: AuthUser | null
  adminToken: string
  saveAdminToken: (token: string) => void
  authLoading: boolean
  authRequired: boolean
  showAuthPanel: boolean
  setShowAuthPanel: (show: boolean) => void
  logout: () => void
}

function AppLayout({
  children,
  health,
  checkHealth,
  currentUser,
  adminToken,
  saveAdminToken,
  authLoading,
  authRequired,
  showAuthPanel,
  setShowAuthPanel,
  logout
}: AppLayoutProps) {
  const location = useLocation()
  const isOnline = useNetworkStatus()
  const isCases = location.pathname.startsWith('/cases')
  const isChannels = location.pathname === '/channels'
  const isConfig = location.pathname === '/config'
  const isAudit = location.pathname === '/audit'
  const isTeams = location.pathname === '/teams'
  const isBilling = location.pathname === '/billing'
  const isOperations = location.pathname === '/operations'
  const isTasks = location.pathname === '/tasks'
  const isLegalArticles = location.pathname === '/legal-articles'
  const isAdvancedRoute = isChannels || isConfig || isAudit || isTeams || isBilling || isOperations

  const breadcrumb = () => {
    const pathParts = location.pathname.split('/').filter(Boolean)
    if (pathParts.length === 0 || pathParts[0] === 'cases') {
      if (pathParts.length === 1) return null
      if (pathParts.length === 2) {
        return (
          <>
            <NavLink to="/cases">案件工作台</NavLink>
            <span className="breadcrumb-sep">/</span>
            <span className="current">案件详情</span>
          </>
        )
      }
      if (pathParts[2] === 'workflow') {
        return (
          <>
            <NavLink to="/cases">案件工作台</NavLink>
            <span className="breadcrumb-sep">/</span>
            <NavLink to={`/cases/${pathParts[1]}`}>案件详情</NavLink>
            <span className="breadcrumb-sep">/</span>
            <span className="current">工作流</span>
          </>
        )
      }
    }
    return null
  }

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1><span>⚖️</span> LegalDocGen</h1>
          <p>{isPersonalLawyerMode ? '个人律师办案工作台' : '法律文书智能生成系统'}</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">{isPersonalLawyerMode ? '日常办案' : '业务'}</div>
            <NavLink to="/cases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              案件工作台
            </NavLink>
            <NavLink to="/legal-articles" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              法条核验
            </NavLink>
            <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h6M8 17h4"/></svg>
              后台任务
            </NavLink>
            {!isPersonalLawyerMode && (
              <NavLink to="/teams" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                可选协作
              </NavLink>
            )}
          </div>
          {!isPersonalLawyerMode && currentUser && (
            <div className="nav-section">
              <div className="nav-section-title">商业</div>
              <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v10H4z"/><path d="M8 11h4"/><path d="M16 11h.01"/><path d="M8 15h8"/></svg>
                用量与套餐
              </NavLink>
              {currentUser.role === 'admin' && (
                <NavLink to="/operations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/><path d="M7 19v-4"/><path d="M11 19v-8"/><path d="M15 19v-5"/><path d="M19 19V7"/></svg>
                  运营后台
                </NavLink>
              )}
            </div>
          )}
          <div className="nav-section">
            <div className="nav-section-title">{isPersonalLawyerMode ? '高级设置' : '系统'}</div>
            <NavLink to="/channels" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              AI 服务设置
            </NavLink>
            <NavLink to="/config" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
              Prompt模板
            </NavLink>
            <NavLink to="/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              审计日志
            </NavLink>
            {isPersonalLawyerMode && (
              <NavLink to="/teams" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                可选协作
              </NavLink>
            )}
            {isPersonalLawyerMode && currentUser && (
              <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v10H4z"/><path d="M8 11h4"/><path d="M16 11h.01"/><path d="M8 15h8"/></svg>
                用量限制
              </NavLink>
            )}
            {isPersonalLawyerMode && currentUser?.role === 'admin' && (
              <NavLink to="/operations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/><path d="M7 19v-4"/><path d="M11 19v-8"/><path d="M15 19v-5"/><path d="M19 19V7"/></svg>
                运营后台
              </NavLink>
            )}
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
              {health.status === 'checking'
                ? '检测中'
                : health.status === 'offline'
                  ? (isPersonalLawyerMode ? 'AI 服务未连接' : '后端未连接')
                  : health.status === 'degraded'
                    ? (isPersonalLawyerMode ? 'AI 服务异常' : '诊断异常')
                    : (isPersonalLawyerMode ? 'AI 服务正常' : '后端已连接')}
            </button>
            {!isOnline && (
              <span className="network-offline-badge">
                <span className="offline-dot"></span>
                网络已断开
              </span>
            )}
            {currentUser && (
              <span className="user-chip" title={currentUser.username}>
                {currentUser.display_name || currentUser.username} · {currentUser.role === 'admin' ? '管理员' : '成员'}
              </span>
            )}
            {(!isPersonalLawyerMode || isAdvancedRoute) && (
              <input
                className="input admin-token-input"
                type="password"
                placeholder={isPersonalLawyerMode ? '高级管理 Token' : '管理 Token（可选）'}
                value={adminToken}
                onChange={e=>saveAdminToken(e.target.value)}
              />
            )}
            {currentUser ? (
              <button className="btn btn-o btn-sm" onClick={logout}>退出</button>
            ) : !authLoading && !authRequired ? (
              <button className="btn btn-o btn-sm" onClick={() => setShowAuthPanel(!showAuthPanel)}>{showAuthPanel ? '关闭登录' : '登录'}</button>
            ) : null}
            <span style={{fontSize:12,color:'#c9cdd4'}}>{isPersonalLawyerMode ? '个人律师办案工作台' : '法律文书智能生成系统'}</span>
          </div>
        </div>
        <div className="page-body">
          {health.status !== 'ok' && (
            <div className={`connection-banner connection-${health.status}`}>
              <strong>{health.status === 'offline' ? (isPersonalLawyerMode ? 'AI 服务暂未连接' : '当前为前端预览模式') : health.message}</strong>
              <div className="connection-copy">
                <span>{health.status === 'offline' ? '材料解析、AI 生成、导出和登录等能力需要连接后端服务。' : '后端已响应，但部分诊断项需要检查。'}</span>
                <span>开发者配置：当前 API 为 <code>{apiBaseUrl}</code>，Vercel 部署请设置 <code>VITE_API_BASE_URL=https://你的后端域名/api</code>。</span>
              </div>
            </div>
          )}
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}
