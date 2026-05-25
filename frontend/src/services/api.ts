const BASE = '/api'

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const err = await res.json()
    return err.detail || err.message || res.statusText || fallback
  } catch {
    return res.statusText || fallback
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(await parseError(res, '请求失败'))
  return res.json()
}

export const api = {
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
  },
  materials: {
    list: (caseId: string) => request<any[]>(`/materials/case/${caseId}`),
    upload: async (caseId: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/materials/upload/${caseId}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await parseError(res, '上传失败'))
      return res.json()
    },
    delete: (id: string) => request<any>(`/materials/${id}`, { method: 'DELETE' }),
  },
  workflow: {
    progress: (caseId: string) => request<any[]>(`/workflow/progress/${caseId}`),
    getNode: (caseId: string, stage: string) => request<any>(`/workflow/node/${caseId}/${stage}`),
    generate: (caseId: string, data: any) => request<any>(`/workflow/generate/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
    generateStream: async function* (caseId: string, data: any) {
      const res = await fetch(`${BASE}/workflow/generate-stream/${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await parseError(res, '生成失败'))
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
    export: async (caseId: string) => {
      const res = await fetch(`${BASE}/workflow/export/${caseId}`)
      if (!res.ok) throw new Error(await parseError(res, '导出失败'))
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `case_${caseId}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    exportBatch: async (caseIds: string[]) => {
      const res = await fetch(`${BASE}/workflow/export-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_ids: caseIds }),
      })
      if (!res.ok) throw new Error(await parseError(res, '批量导出失败'))
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
}
