import type { BillingOrder, BillingOrderStatus, BillingStatus, DocumentTypeOption, OperationsSummary, Plan, QuotaExceededDetail } from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const ADMIN_TOKEN_KEY = 'legaldocgen_admin_token'
const AUTH_TOKEN_KEY = 'legaldocgen_auth_token'

export const apiBaseUrl = BASE

export type AuthUser = {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'member'
  is_active: boolean
  created_at?: string
}

export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConnectionError'
  }
}

export class QuotaExceededError extends Error {
  detail: QuotaExceededDetail

  constructor(detail: QuotaExceededDetail) {
    super(detail.message || `${detail.label}已达到当前套餐上限`)
    this.name = 'QuotaExceededError'
    this.detail = detail
  }
}

export const isQuotaExceededError = (error: unknown): error is QuotaExceededError => error instanceof QuotaExceededError
export const quotaUpgradeMessage = (error: unknown) => isQuotaExceededError(error) ? `${error.detail.message} 当前用量 ${error.detail.used}/${error.detail.limit}。` : ''

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || ''
export const setAdminToken = (token: string) => {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token)
  else localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || ''
export const setAuthToken = (token: string) => {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
  else localStorage.removeItem(AUTH_TOKEN_KEY)
}

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  const adminToken = getAdminToken()
  const authToken = getAuthToken()
  if (adminToken) headers['X-Admin-Token'] = adminToken
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  return headers
}

const jsonHeaders = (headers?: HeadersInit): HeadersInit => ({
  'Content-Type': 'application/json',
  ...authHeaders(),
  ...(headers as Record<string, string> | undefined),
})

async function parseJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    if (text.trim().startsWith('<')) {
      throw new ApiConnectionError('后端 API 未连接或地址配置错误：当前请求返回了网页而不是 JSON。请配置 VITE_API_BASE_URL 指向真实 FastAPI 后端。')
    }
    throw new Error(res.statusText || fallback)
  }
  return res.json()
}

async function createApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const err = await parseJsonResponse<any>(res, fallback)
    const detail = err.detail
    if (detail?.code === 'quota_exceeded') return new QuotaExceededError(detail)
    if (typeof detail === 'string') return new Error(detail)
    return new Error(detail?.message || err.message || res.statusText || fallback)
  } catch (e) {
    if (e instanceof ApiConnectionError) return e
    return new Error(res.statusText || fallback)
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers, ...rest } = options || {}
  const res = await fetch(`${BASE}${url}`, {
    ...rest,
    headers: jsonHeaders(headers),
  })
  if (!res.ok) throw await createApiError(res, '请求失败')
  return parseJsonResponse<T>(res, '请求失败')
}

async function* streamSSE(url: string, body: any): AsyncGenerator<any> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await createApiError(res, '生成失败')
  if (!res.body) throw new Error('生成响应为空')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6))
        } catch {}
      }
    }
  }
}

export const api = {
  health: () => request<any>('/health'),
  auth: {
    me: () => request<{ user: AuthUser | null; auth_required: boolean }>('/auth/me'),
    login: (data: { username: string; password: string }) =>
      request<{ token: string; user: AuthUser; auth_required: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: { username: string; password: string; display_name?: string }) =>
      request<{ token: string; user: AuthUser; auth_required: boolean }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    users: () => request<AuthUser[]>('/auth/users'),
    updateUser: (id: string, data: { role?: string; is_active?: boolean }) =>
      request<AuthUser>(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  billing: {
    plans: () => request<Plan[]>('/billing/plans'),
    status: () => request<BillingStatus>('/billing/status'),
    updateSubscription: (teamId: string, data: { plan_code: string; status?: string }) =>
      request<BillingStatus>(`/billing/teams/${teamId}/subscription`, { method: 'PUT', body: JSON.stringify(data) }),
    operationsSummary: () => request<OperationsSummary>('/billing/operations/summary'),
    orders: (params?: { status?: string; limit?: number }) => {
      const query = new URLSearchParams()
      if (params?.status) query.set('status', params.status)
      if (params?.limit) query.set('limit', String(params.limit))
      const suffix = query.toString() ? `?${query}` : ''
      return request<BillingOrder[]>(`/billing/operations/orders${suffix}`)
    },
    createOrder: (data: { team_id: string; plan_code: string; billing_period: string; amount_cents: number; currency: string; external_reference?: string; notes?: string }) =>
      request<BillingOrder>('/billing/operations/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateOrder: (id: string, data: { status: BillingOrderStatus; notes?: string }) =>
      request<BillingOrder>(`/billing/operations/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  teams: {
    list: () => request<any[]>('/teams'),
    create: (data: { name: string }) => request<any>('/teams', { method: 'POST', body: JSON.stringify(data) }),
    members: (teamId: string) => request<any[]>(`/teams/${teamId}/members`),
    addMember: (teamId: string, data: { user_id: string; role: string }) =>
      request<any>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),
    updateMember: (teamId: string, userId: string, data: { role: string }) =>
      request<any>(`/teams/${teamId}/members/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeMember: (teamId: string, userId: string) => request<any>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (params?: { limit?: number; case_id?: string }) => {
      const query = new URLSearchParams()
      if (params?.limit) query.set('limit', String(params.limit))
      if (params?.case_id) query.set('case_id', params.case_id)
      const suffix = query.toString() ? `?${query}` : ''
      return request<any[]>(`/tasks${suffix}`)
    },
    get: (id: string) => request<any>(`/tasks/${id}`),
  },
  legalArticles: {
    list: (keyword?: string) => request<any[]>(`/legal-articles${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
    create: (data: { law_name: string; article_no: string; title?: string; content?: string }) =>
      request<any>('/legal-articles', { method: 'POST', body: JSON.stringify(data) }),
    verify: (text: string) => request<any>('/legal-articles/verify', { method: 'POST', body: JSON.stringify({ text }) }),
    delete: (id: string) => request<any>(`/legal-articles/${id}`, { method: 'DELETE' }),
  },
  cases: {
    list: (params?: { status?: string; keyword?: string; case_type?: string; template_id?: string }) => {
      const query = new URLSearchParams()
      if (params?.status) query.set('status', params.status)
      if (params?.keyword) query.set('keyword', params.keyword)
      if (params?.case_type) query.set('case_type', params.case_type)
      if (params?.template_id) query.set('template_id', params.template_id)
      const suffix = query.toString() ? `?${query}` : ''
      return request<any[]>(`/cases${suffix}`)
    },
    get: (id: string) => request<any>(`/cases/${id}`),
    create: (data: any) => request<any>('/cases', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/cases/${id}`, { method: 'DELETE' }),
    batchDelete: (caseIds: string[]) => request<any>('/cases/batch-delete', { method: 'POST', body: JSON.stringify({ case_ids: caseIds }) }),
    archive: (id: string, note?: string) => request<any>(`/cases/${id}/archive`, { method: 'POST', body: JSON.stringify({ note: note || '' }) }),
    unarchive: (id: string) => request<any>(`/cases/${id}/unarchive`, { method: 'POST' }),
    upcomingDeadlines: () => request<any[]>('/cases/upcoming-deadlines'),
    deadlines: (caseId: string) => request<any[]>(`/cases/${caseId}/deadlines`),
    createDeadline: (caseId: string, data: { title: string; due_date: string; reminder_days?: number; note?: string }) =>
      request<any>(`/cases/${caseId}/deadlines`, { method: 'POST', body: JSON.stringify(data) }),
    updateDeadline: (caseId: string, deadlineId: string, data: any) =>
      request<any>(`/cases/${caseId}/deadlines/${deadlineId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDeadline: (caseId: string, deadlineId: string) =>
      request<any>(`/cases/${caseId}/deadlines/${deadlineId}`, { method: 'DELETE' }),
    notes: (caseId: string) => request<any[]>(`/cases/${caseId}/notes`),
    createNote: (caseId: string, data: { title?: string; content?: string; pinned?: boolean }) =>
      request<any>(`/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    updateNote: (caseId: string, noteId: string, data: any) =>
      request<any>(`/cases/${caseId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNote: (caseId: string, noteId: string) =>
      request<any>(`/cases/${caseId}/notes/${noteId}`, { method: 'DELETE' }),
  },
  materials: {
    list: (caseId: string) => request<any[]>(`/materials/case/${caseId}`),
    catalog: (caseId: string) => request<any>(`/materials/case/${caseId}/catalog`),
    upload: async (caseId: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/materials/upload/${caseId}`, { method: 'POST', headers: authHeaders(), body: form })
      if (!res.ok) throw await createApiError(res, '上传失败')
      return res.json()
    },
    delete: (id: string) => request<any>(`/materials/${id}`, { method: 'DELETE' }),
    updateCategory: (id: string, category: string) => request<any>(`/materials/${id}/category`, { method: 'PUT', body: JSON.stringify({ category }) }),
    search: (caseId: string, query: string) => request<any>(`/materials/case/${caseId}/search?q=${encodeURIComponent(query)}`),
    anonymize: (caseId: string) => request<any>(`/materials/anonymize/${caseId}`, { method: 'POST' }),
  },
  workflow: {
    progress: (caseId: string) => request<any[]>(`/workflow/progress/${caseId}`),
    getNode: (caseId: string, stage: string) => request<any>(`/workflow/node/${caseId}/${stage}`),
    generate: (caseId: string, data: any) => request<any>(`/workflow/generate/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
    generateStream: async function* (caseId: string, data: any) {
      const res = await fetch(`${BASE}/workflow/generate-stream/${caseId}`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(data),
      })
      if (!res.ok) throw await createApiError(res, '生成失败')
      if (!res.body) throw new Error('生成响应为空')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              yield JSON.parse(line.slice(6))
            } catch {}
          }
        }
      }
    },
    rollback: (caseId: string, nodeId: string) =>
      request<any>(`/workflow/rollback/${caseId}`, { method: 'POST', body: JSON.stringify({ node_id: nodeId }) }),
    history: (caseId: string, stage: string) => request<any[]>(`/workflow/history/${caseId}/${stage}`),
    saveOutput: (caseId: string, stage: string, output: string) =>
      request<any>(`/workflow/save-output/${caseId}/${stage}`, { method: 'POST', body: JSON.stringify({ output }) }),
    reviewChain: (caseId: string, data: any) => streamSSE(`/workflow/review-chain/${caseId}`, data),
    multiCompare: (caseId: string, data: any) => streamSSE(`/workflow/multi-compare/${caseId}`, data),
    reviewSelect: (caseId: string, data: any) =>
      request<any>(`/workflow/review-select/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
    aiEdit: (data: { text: string; instruction?: string; provider?: string; model?: string }) =>
      request<{ result: string }>('/workflow/ai-edit', { method: 'POST', body: JSON.stringify(data) }),
    quickGenerate: (caseId: string, data: any) => streamSSE(`/workflow/quick-generate/${caseId}`, data),
    export: async (caseId: string, modules?: string[]) => {
      const exportUrl = modules && modules.length > 0
        ? `${BASE}/workflow/export/${caseId}?modules=${modules.map(encodeURIComponent).join(',')}`
        : `${BASE}/workflow/export/${caseId}`
      const res = await fetch(exportUrl, { headers: authHeaders() })
      if (!res.ok) throw await createApiError(res, '导出失败')
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `case_${caseId}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    },
    exportPackage: async (caseId: string) => {
      const res = await fetch(`${BASE}/workflow/export-package/${caseId}`, { headers: authHeaders() })
      if (!res.ok) throw await createApiError(res, '导出案件包失败')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `case_package_${caseId}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    exportBatch: async (caseIds: string[]) => {
      const res = await fetch(`${BASE}/workflow/export-batch`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ case_ids: caseIds }),
      })
      if (!res.ok) throw await createApiError(res, '批量导出失败')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cases_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
  },
  config: {
    getModels: () => request<any>('/config/models'),
    getPrompts: (stage?: string) => request<any[]>(`/config/prompts${stage ? `?stage=${stage}` : ''}`),
    createPrompt: (data: any) => request<any>('/config/prompts', { method: 'POST', body: JSON.stringify(data) }),
    updatePrompt: (id: string, data: any) => request<any>(`/config/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getStages: () => request<any[]>('/config/stages'),
    getDocumentTypes: () => request<{ types: DocumentTypeOption[] }>('/config/document-types'),
    getStageVariables: (stage: string) => request<{ variables: any[] }>(`/config/stage-variables/${stage}`),
    optimizePrompt: (data: { prompt: string; instruction: string }) =>
      request<{ result: string }>('/config/optimize-prompt', { method: 'POST', body: JSON.stringify(data) }),
  },
  audit: {
    list: (params?: { limit?: number; resource_type?: string; resource_id?: string }) => {
      const query = new URLSearchParams()
      if (params?.limit) query.set('limit', String(params.limit))
      if (params?.resource_type) query.set('resource_type', params.resource_type)
      if (params?.resource_id) query.set('resource_id', params.resource_id)
      const suffix = query.toString() ? `?${query}` : ''
      return request<any[]>(`/audit${suffix}`)
    },
  },
  channel: {
    list: () => request<any[]>('/channel'),
    get: (id: string) => request<any>(`/channel/${id}`),
    create: (data: any) => request<any>('/channel', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/channel/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/channel/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<any>(`/channel/test/${id}`),
    testDirect: (data: any) => request<any>('/channel/test', { method: 'POST', body: JSON.stringify(data) }),
    fetchModels: (id: string) => request<any>(`/channel/fetch_models/${id}`),
    fetchModelsDirect: (data: any) => request<any>('/channel/fetch_models', { method: 'POST', body: JSON.stringify(data) }),
    getAllModels: () => request<any[]>('/channel/models/all'),
  },
  templates: {
    list: () => request<any[]>('/templates/list'),
    get: (id: string) => request<any>(`/templates/${id}`),
    getCategories: () => request<any>('/templates/categories'),
    create: (data: any) => request<any>('/templates/create', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/templates/${id}`, { method: 'DELETE' }),
  },
  documents: {
    list: (caseId: string) => request<any[]>(`/documents/case/${caseId}`),
    get: (id: string) => request<any>(`/documents/${id}`),
    create: (caseId: string, data: { name: string; doc_type?: string }) =>
      request<any>(`/documents/case/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; doc_type?: string }) =>
      request<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/documents/${id}`, { method: 'DELETE' }),
    getTypes: () => request<any>('/documents/types'),
  },
  parties: {
    list: (caseId: string) => request<any[]>(`/parties/case/${caseId}`),
    create: (data: any) => request<any>('/parties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/parties/${id}`, { method: 'DELETE' }),
    extract: (caseId: string) => request<any[]>(`/parties/extract/${caseId}`, { method: 'POST' }),
  },
  referenceDocs: {
    list: () => request<any[]>('/reference-docs'),
    create: (data: { name: string; doc_type: string; content: string }) =>
      request<any>('/reference-docs', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<any>(`/reference-docs/${id}`),
    upload: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/reference-docs/upload`, { method: 'POST', headers: authHeaders(), body: form })
      if (!res.ok) throw await createApiError(res, '上传失败')
      return res.json()
    },
    delete: (id: string) => request<any>(`/reference-docs/${id}`, { method: 'DELETE' }),
  },
}

// ===== Prefetch Cache =====
const prefetchCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30000

export const prefetchCaseDetail = async (caseId: string) => {
  const now = Date.now()
  const cached = prefetchCache.get(caseId)
  if (cached && now - cached.timestamp < CACHE_TTL) return cached.data

  try {
    const data = await api.cases.get(caseId)
    prefetchCache.set(caseId, { data, timestamp: now })
    return data
  } catch (e) {
    console.error('Prefetch failed:', e)
  }
}

export const getCachedCaseDetail = (caseId: string) => {
  const cached = prefetchCache.get(caseId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

export const clearPrefetchCache = () => {
  prefetchCache.clear()
}
