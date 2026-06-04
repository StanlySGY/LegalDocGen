import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

const actionTone = (action: string) => {
  if (/delete|remove|fail|删除|移除|失败/i.test(action)) return 't-red'
  if (/create|upload|generate|export|创建|上传|生成|导出/i.test(action)) return 't-green'
  if (/update|save|rollback|更新|保存|回滚/i.test(action)) return 't-orange'
  return 't-purple'
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const { toasts, showToast, removeToast } = useToast()

  const load = () => {
    api.audit.list().then(setLogs).catch((e: any) => showToast(e.message || '审计日志加载失败', { type: 'err' }))
  }

  useEffect(() => { load() }, [])

  const visibleLogs = logs.filter(log => {
    const actionMatched = !actionFilter || log.action === actionFilter
    const resourceMatched = !resourceFilter || log.resource_type === resourceFilter
    return actionMatched && resourceMatched
  })
  const actions = Array.from(new Set(logs.map(log => log.action).filter(Boolean)))
  const resources = Array.from(new Set(logs.map(log => log.resource_type).filter(Boolean)))
  const todayCount = logs.filter(log => log.created_at && new Date(log.created_at).toDateString() === new Date().toDateString()).length
  const resourceCount = resources.length
  const latestLog = logs[0]

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">AUDIT TRAIL</div>
          <h2>审计日志</h2>
          <p>记录案件、材料、工作流和系统配置关键操作，帮助团队追踪交付过程、定位问题并满足内部合规复核要求。</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新日志</button>
      </div>

      <div className="task-stat-row">
        <div className="stat-card s-purple"><div className="s-label">日志总数</div><div className="s-value">{logs.length}</div><div className="s-hint">最近审计记录</div></div>
        <div className="stat-card s-green"><div className="s-label">今日操作</div><div className="s-value">{todayCount}</div><div className="s-hint">当天活跃记录</div></div>
        <div className="stat-card s-blue"><div className="s-label">资源类型</div><div className="s-value">{resourceCount}</div><div className="s-hint">涉及业务对象</div></div>
        <div className="stat-card s-orange"><div className="s-label">筛选结果</div><div className="s-value">{visibleLogs.length}</div><div className="s-hint">当前条件命中</div></div>
      </div>

      <div className="notice-card notice-info">
        <div><strong>最近操作</strong><span>{latestLog ? `${latestLog.created_at ? new Date(latestLog.created_at).toLocaleString('zh-CN') : '时间未知'} · ${latestLog.summary || latestLog.action}` : '暂无审计记录，关键操作发生后会自动写入。'}</span></div>
      </div>

      <div className="card p-0">
        <div className="panel-head">
          <div>
            <span className="card-title">审计明细</span>
            <p>可按操作和资源类型筛选，资源 ID 仅展示前 8 位便于快速定位。</p>
          </div>
          <span className="tag t-purple">{visibleLogs.length} 条</span>
        </div>
        <div className="audit-filter-row">
          <select className="select" value={actionFilter} onChange={e=>setActionFilter(e.target.value)}>
            <option value="">全部操作</option>
            {actions.map(action => <option key={action} value={action}>{action}</option>)}
          </select>
          <select className="select" value={resourceFilter} onChange={e=>setResourceFilter(e.target.value)}>
            <option value="">全部资源</option>
            {resources.map(resource => <option key={resource} value={resource}>{resource}</option>)}
          </select>
          <button className="btn btn-o" onClick={()=>{setActionFilter('');setResourceFilter('')}}>清除筛选</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>资源</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs-muted">{log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}</td>
                  <td><span className={`tag ${actionTone(log.action)}`}>{log.action}</span></td>
                  <td className="text-sm-muted">{log.resource_type || '-'}{log.resource_id ? ` / ${log.resource_id.slice(0, 8)}` : ''}</td>
                  <td>{log.summary || '-'}</td>
                </tr>
              ))}
              {visibleLogs.length === 0 && (
                <tr><td colSpan={4}><div className="empty refined-empty p-lg"><p>{logs.length === 0 ? '暂无审计日志' : '当前筛选条件下暂无审计日志'}</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
