const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

async function* streamSSE(url: string, body: any): AsyncGenerator<any> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  const reader = res.body!.getReader()
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
        try { yield JSON.parse(line.slice(6)) } catch {}
      }
    }
  }
}

export const api = {
  cases: {
    list: (params?: {status?:string;search?:string;case_type?:string}) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.search) qs.set('search', params.search)
      if (params?.case_type) qs.set('case_type', params.case_type)
      const query = qs.toString()
      return request<any[]>(`/cases${query ? `?${query}` : ''}`)
    },
    get: (id: string) => request<any>(`/cases/${id}`),
    create: (data: any) => request<any>('/cases', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/cases/${id}`, { method: 'DELETE' }),
    batchDelete: (ids: string[]) => request<any>('/cases/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  },
  materials: {
    list: (caseId: string) => request<any[]>(`/materials/case/${caseId}`),
    upload: async (caseId: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/materials/upload/${caseId}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    delete: (id: string) => request<any>(`/materials/${id}`, { method: 'DELETE' }),
  },
  workflow: {
    progress: (caseId: string) => request<any[]>(`/workflow/progress/${caseId}`),
    getNode: (caseId: string, stage: string) => request<any>(`/workflow/node/${caseId}/${stage}`),
    generate: (caseId: string, data: any) => request<any>(`/workflow/generate/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
    generateStream: (caseId: string, data: any) => streamSSE(`/workflow/generate-stream/${caseId}`, data),
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
  },
  config: {
    getModels: () => request<any>('/config/models'),
    getPrompts: (stage?: string) => request<any[]>(`/config/prompts${stage ? `?stage=${stage}` : ''}`),
    createPrompt: (data: any) => request<any>('/config/prompts', { method: 'POST', body: JSON.stringify(data) }),
    updatePrompt: (id: string, data: any) => request<any>(`/config/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getStages: () => request<any[]>('/config/stages'),
    getStageVariables: (stage: string) => request<{ variables: { name: string; description: string }[] }>(`/config/stage-variables/${stage}`),
    getDocumentTypes: () => request<{ types: { key: string; name: string }[] }>('/config/document-types'),
    optimizePrompt: (data: { prompt: string; instruction: string; provider?: string; model?: string }) =>
      request<{ result: string }>('/config/optimize-prompt', { method: 'POST', body: JSON.stringify(data) }),
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
  parties: {
    list: (caseId: string) => request<any[]>(`/parties/case/${caseId}`),
    create: (data: any) => request<any>('/parties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/parties/${id}`, { method: 'DELETE' }),
    extract: (caseId: string) => request<any[]>(`/parties/extract/${caseId}`, { method: 'POST' }),
  },
}
