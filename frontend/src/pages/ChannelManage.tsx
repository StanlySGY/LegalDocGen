import { useToast } from '../hooks/useToast'
import { validateChannelForm } from '../utils/validation'
import Toaster from '../components/Toaster'
import ConfirmDialog from '../components/ConfirmDialog'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

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

const testStatusText: Record<string, string> = { success: '连接正常', failed: '测试失败' }
const testStatusClass = (status: string) => status === 'success' ? 't-green' : status === 'failed' ? 't-red' : 't-gray'
const channelRiskTip = (channel: Channel) => {
  if (!channel.api_key_set) return '未保存密钥，生成前需补齐 API Key'
  if (channel.test_status === 'failed') return '连接测试失败，建议检查地址、密钥和网络'
  if ((channel.models || []).length === 0) return '尚未配置模型，建议获取模型后勾选可用项'
  return '可用于工作流生成，建议定期测试连接'
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
  const { toasts, showToast, removeToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '', type: 'openai', base_url: '', api_key: '', priority: 0
  })

  const load = () => api.channel.list().then(setChannels).catch((e: any) => showToast(e.message || '渠道加载失败', { type: 'err' }))
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
    const validation = validateChannelForm(form)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      showToast(Object.values(validation.errors)[0], { type: 'err' })
      return
    }
    setFormErrors({})
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
    } catch (e: any) { showToast(e.message, { type: 'err' }) }
  }

  const deleteChannel = async (id: string) => {
    const channel = channels.find(item => item.id === id)
    const confirmed = await confirm({
      title: '删除渠道',
      message: `确定删除${channel ? `「${channel.name}」` : '该渠道'}？删除后工作流将无法再使用该模型渠道。`,
      variant: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    try {
      await api.channel.delete(id)
      showToast('已删除')
      load()
    } catch (e: any) {
      showToast(e.message || '删除失败', { type: 'err' })
    }
  }

  const testChannel = async (id: string) => {
    setLoading('test-' + id)
    try {
      const r = await api.channel.test(id)
      showToast(r.success ? '连接成功' : `连接失败: ${r.message}`, { type: r.success ? 'ok' : 'err' })
      load()
    } catch (e: any) { showToast(e.message, { type: 'err' }) }
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
        showToast(`获取失败: ${r.message}`, { type: 'err' })
      }
    } catch (e: any) { showToast(e.message, { type: 'err' }); setDiscoveredModels([]) }
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

  const enabledCount = channels.filter(ch => ch.status === 1).length
  const testedCount = channels.filter(ch => ch.test_status === 'success').length
  const modelCount = channels.reduce((total, ch) => total + (ch.models?.length || 0), 0)
  const riskyCount = channels.filter(ch => !ch.api_key_set || ch.test_status === 'failed' || (ch.models || []).length === 0).length

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">MODEL OPERATIONS</div>
          <h2>渠道管理</h2>
          <p>集中管理模型 API 渠道、连接测试和可用模型，确保法律文书生成链路具备稳定、可切换的模型供应能力。</p>
        </div>
        <div className="hero-action-card">
          <div><strong>配置建议</strong><span>先测试连接，再获取模型并保留至少一个可用渠道。</span></div>
          <button className="btn btn-p" onClick={openAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            添加渠道
          </button>
        </div>
      </div>

      <div className="task-stat-row">
        <div className="stat-card s-purple"><div className="s-label">渠道总数</div><div className="s-value">{channels.length}</div><div className="s-hint">已接入 API 渠道</div></div>
        <div className="stat-card s-green"><div className="s-label">启用渠道</div><div className="s-value">{enabledCount}</div><div className="s-hint">可参与调度</div></div>
        <div className="stat-card s-blue"><div className="s-label">可用模型</div><div className="s-value">{modelCount}</div><div className="s-hint">已保存模型数量</div></div>
        <div className="stat-card s-orange"><div className="s-label">需处理</div><div className="s-value">{riskyCount}</div><div className="s-hint">密钥、测试或模型待完善</div></div>
      </div>

      {channels.length > 0 && testedCount === 0 && (
        <div className="notice-card notice-warn">
          <div><strong>暂无已验证渠道</strong><span>建议至少完成一个渠道的连接测试，避免生成阶段才暴露模型不可用问题。</span></div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="panel-head">
          <div>
            <span className="card-title">渠道列表</span>
            <p>优先级越高越靠前；测试状态和模型数量会影响生成链路可用性。</p>
          </div>
          <span className="tag t-purple">{testedCount} 个已验证</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>Base URL</th>
                <th>状态</th>
                <th>模型数</th>
                <th>优先级</th>
                <th>处理建议</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(ch => (
                <tr key={ch.id}>
                  <td><span style={{ fontWeight: 600 }}>{ch.name}</span></td>
                  <td><span className="tag t-blue">{ch.type}</span></td>
                  <td><span className="mono-cell">{ch.base_url}</span></td>
                  <td>
                    <div className="cell-tags">
                      <span className={`tag ${ch.status === 1 ? 't-green' : 't-gray'}`}>{ch.status === 1 ? '启用' : '禁用'}</span>
                      <span className={`tag ${testStatusClass(ch.test_status)}`}>{testStatusText[ch.test_status] || '未测试'}</span>
                    </div>
                  </td>
                  <td><span style={{ fontWeight: 600 }}>{ch.models.length}</span></td>
                  <td>{ch.priority}</td>
                  <td style={{fontSize:12,color:ch.test_status === 'failed' ? '#b45309' : '#64748b'}}>{channelRiskTip(ch)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row-actions">
                      <button className="btn btn-o btn-sm" onClick={() => testChannel(ch.id)} disabled={loading === 'test-' + ch.id}>
                        {loading === 'test-' + ch.id ? '测试中...' : '测试'}
                      </button>
                      <button className="btn btn-o btn-sm" onClick={() => openFetchModels(ch)} disabled={loading === 'fetch'}>获取模型</button>
                      <button className="btn btn-o btn-sm" onClick={() => openEdit(ch)}>编辑</button>
                      <button className="btn btn-d btn-sm" onClick={() => deleteChannel(ch.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty refined-empty" style={{ padding: '54px 0' }}>
                    <p>暂无渠道，添加并测试渠道后才能在工作流中生成内容</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDrawer && (
        <div className="modal-mask" onClick={() => setShowDrawer(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>{editingChannel ? '编辑渠道' : '添加渠道'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="text-xs-label">渠道名称 *</label>
                <input className="input" placeholder="如：OpenAI主渠道" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs-label">渠道类型</label>
                <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="openai">OpenAI 兼容</option>
                  <option value="claude">Claude</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="text-xs-label">Base URL *</label>
                <input className="input" placeholder="https://api.openai.com/v1" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} />
              </div>
              <div>
                <label className="text-xs-label">API Key {editingChannel ? '(留空不修改)' : ''}</label>
                <input type="password" className="input" placeholder="sk-..." value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} />
              </div>
              <div>
                <label className="text-xs-label">优先级 (越高越优先)</label>
                <input type="number" className="input" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 8 }}>
                <button className="btn btn-o" onClick={() => navigate('/cases')}>返回案件</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-o" onClick={() => setShowDrawer(false)}>取消</button>
                  <button className="btn btn-p" onClick={saveChannel}>{editingChannel ? '保存' : '创建'}</button>
                </div>
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
                  <label key={m} className="model-option">
                    <input type="checkbox" checked={selectedModels.includes(m)} onChange={() => toggleModel(m)} style={{ width: 16, height: 16 }} />
                    <span>{m}</span>
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

      <Toaster toasts={toasts} onRemove={removeToast} />
      {dialogProps && <ConfirmDialog {...dialogProps} />}
    </div>
  )
}
