import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

interface Channel {
  id: string
  name: string
  type: string
  base_url: string
  api_key: string
  api_key_set: boolean
  models: string[]
  default_model: string
  status: number
  test_status: string
  balance: string
  priority: number
  created_at: string
}

export default function ChannelManage() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<Channel[]>([])
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [showModelsDialog, setShowModelsDialog] = useState<string | null>(null)
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [loading, setLoading] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', type: 'openai', base_url: '', api_key: '', priority: 0
  })

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500)
  }
  const load = () => api.channel.list().then(setChannels)
  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditingChannel(null)
    setForm({ name: '', type: 'openai', base_url: '', api_key: '', priority: 0 })
    setShowDrawer(true)
  }

  const openEdit = (ch: Channel) => {
    setEditingChannel(ch)
    setForm({ name: ch.name, type: ch.type, base_url: ch.base_url, api_key: '', priority: ch.priority })
    setShowDrawer(true)
  }

  const saveChannel = async () => {
    if (!form.name.trim() || !form.base_url.trim()) { showToast('名称和URL必填', 'err'); return }
    try {
      if (editingChannel) {
        const update: any = { ...form }
        if (!update.api_key) delete update.api_key
        await api.channel.update(editingChannel.id, update)
        showToast('已更新')
      } else {
        await api.channel.create(form)
        showToast('已创建')
      }
      setShowDrawer(false)
      load()
    } catch (e: any) { showToast(e.message, 'err') }
  }

  const deleteChannel = async (id: string) => {
    await api.channel.delete(id)
    setConfirmDelete(null)
    showToast('已删除')
    load()
  }

  const testChannel = async (id: string) => {
    setLoading('test-' + id)
    try {
      const r = await api.channel.test(id)
      showToast(r.success ? '连接成功' : `连接失败: ${r.message}`, r.success ? 'ok' : 'err')
      load()
    } catch (e: any) { showToast(e.message, 'err') }
    setLoading('')
  }

  const openFetchModels = async (ch: Channel) => {
    setShowModelsDialog(ch.id)
    setSelectedModels(ch.models || [])
    setLoading('fetch')
    try {
      const r = await api.channel.fetchModels(ch.id)
      if (r.success) {
        setDiscoveredModels(r.models)
        showToast(`发现 ${r.count} 个模型`)
      } else {
        setDiscoveredModels([])
        showToast(`获取失败: ${r.message}`, 'err')
      }
    } catch (e: any) { showToast(e.message, 'err'); setDiscoveredModels([]) }
    setLoading('')
  }

  const saveModels = async () => {
    if (!showModelsDialog) return
    await api.channel.update(showModelsDialog, { models: selectedModels })
    showToast('模型已保存')
    setShowModelsDialog(null)
    load()
  }

  const toggleModel = (m: string) => {
    setSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  const selectAll = () => setSelectedModels([...discoveredModels])
  const deselectAll = () => setSelectedModels([])

  return (
    <div>
        <div className="flex items-center justify-between mb-6">
        <div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>助手配置</h2>
          <p style={{ fontSize: 13, color: '#86909c', marginTop: 4 }}>管理AI助手，自动发现可用模型</p>
        </div>
        <button className="btn btn-p" onClick={openAdd}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          添加AI助手
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>服务地址</th>
                  <th>状态</th>
                  <th>可用模型</th>
                  <th>优先级</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch.id}>
                <td><span style={{ fontWeight: 600 }}>{ch.name}</span></td>
                <td><span className="tag t-blue">{ch.type}</span></td>
                    <td><span style={{ fontSize: 12, color: '#86909c', fontFamily: 'monospace' }}>{ch.base_url}</span></td>
                <td>
                  <span className={`tag ${ch.status === 1 ? 't-green' : 't-gray'}`}>
                    {ch.status === 1 ? '启用' : '禁用'}
                  </span>
                  {ch.test_status === 'success' && <span className="tag t-green" style={{ marginLeft: 4 }}>✓</span>}
                  {ch.test_status === 'failed' && <span className="tag t-red" style={{ marginLeft: 4 }}>✗</span>}
                </td>
                <td><span style={{ fontWeight: 600 }}>{ch.models.length}</span></td>
                <td>{ch.priority}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-o btn-sm" onClick={() => testChannel(ch.id)} disabled={loading === 'test-' + ch.id}>
                      {loading === 'test-' + ch.id ? '测试中...' : '测试'}
                    </button>
                    <button className="btn btn-o btn-sm" onClick={() => openFetchModels(ch)} disabled={loading === 'fetch'}>
                      发现AI助手
                    </button>
                    <button className="btn btn-o btn-sm" onClick={() => openEdit(ch)}>编辑</button>
                    <button className="btn btn-d btn-sm" onClick={() => setConfirmDelete(ch.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty" style={{ padding: '50px 0' }}>
                  <p>暂无AI助手</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

        {showDrawer && (
        <div className="modal-mask" onClick={() => setShowDrawer(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>{editingChannel ? '编辑渠道' : '添加渠道'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#86909c', marginBottom: 6, display: 'block' }}>助手名称 *</label>
                <input className="input" placeholder="如：OpenAI主渠道" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#86909c', marginBottom: 6, display: 'block' }}>助手类型</label>
                <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="openai">OpenAI 兼容</option>
                  <option value="claude">Claude</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#86909c', marginBottom: 6, display: 'block' }}>Base URL *</label>
                <input className="input" placeholder="https://api.openai.com/v1" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#86909c', marginBottom: 6, display: 'block' }}>API Key {editingChannel ? '(留空不修改)' : ''}</label>
                <input type="password" className="input" placeholder="sk-..." value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#86909c', marginBottom: 6, display: 'block' }}>优先级 (越高越优先)</label>
                <input type="number" className="input" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                <button className="btn btn-o" onClick={() => setShowDrawer(false)}>取消</button>
                <button className="btn btn-p" onClick={saveChannel}>{editingChannel ? '保存' : '创建'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModelsDialog && (
        <div className="modal-mask" onClick={() => setShowModelsDialog(null)}>
          <div className="modal-box" style={{ maxWidth: 640, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>可用模型</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-o btn-sm" onClick={selectAll}>全选</button>
                <button className="btn btn-o btn-sm" onClick={deselectAll}>全不选</button>
              </div>
            </div>
            {loading === 'fetch' ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#86909c' }}>正在获取模型列表...</div>
            ) : discoveredModels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#86909c' }}>未发现模型，请检查URL和Key</div>
            ) : (
              <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                {discoveredModels.map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <input type="checkbox" checked={selectedModels.includes(m)} onChange={() => toggleModel(m)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontFamily: 'monospace' }}>{m}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: '#86909c' }}>
              已选 {selectedModels.length} / {discoveredModels.length} 个模型
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12 }}>
              <button className="btn btn-o" onClick={() => setShowModelsDialog(null)}>取消</button>
              <button className="btn btn-p" onClick={saveModels} disabled={selectedModels.length === 0}>保存所选模型</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && <ConfirmDialog message="确定删除该渠道？" onConfirm={() => deleteChannel(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
