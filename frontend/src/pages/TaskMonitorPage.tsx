import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { BackgroundTask } from '../types'

const statusText: Record<string, string> = {
  pending: '待处理',
  running: '处理中',
  completed: '已完成',
  failed: '失败',
}

const typeText = (type: string) => type === 'material.parse' ? '材料解析' : type
const statusTag = (status: string) => status === 'completed' ? 't-green' : status === 'failed' ? 't-red' : status === 'running' ? 't-orange' : 't-gray'

export default function TaskMonitorPage() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }

  const load = async () => {
    try {
      setTasks(await api.tasks.list({ limit: 100 }))
    } catch (e: any) {
      showToast(e.message || '任务加载失败', 'err')
    }
  }

  useEffect(() => { load() }, [])

  const runningCount = tasks.filter(task => task.status === 'running' || task.status === 'pending').length
  const completedCount = tasks.filter(task => task.status === 'completed').length
  const failedCount = tasks.filter(task => task.status === 'failed').length

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">PROCESS CENTER</div>
          <h2>后台任务处理中心</h2>
          <p>集中查看材料解析等后台任务状态，快速识别失败任务并回到对应案件处理。</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新任务</button>
      </div>

      <div className="task-stat-row">
        <div className="stat-card s-purple"><div className="s-label">任务总数</div><div className="s-value">{tasks.length}</div><div className="s-hint">最近 100 条</div></div>
        <div className="stat-card s-orange"><div className="s-label">处理中</div><div className="s-value">{runningCount}</div><div className="s-hint">等待或运行中</div></div>
        <div className="stat-card s-green"><div className="s-label">已完成</div><div className="s-value">{completedCount}</div><div className="s-hint">可进入后续流程</div></div>
        <div className="stat-card s-red"><div className="s-label">失败</div><div className="s-value">{failedCount}</div><div className="s-hint">需排查材料或服务</div></div>
      </div>

      {failedCount > 0 && (
        <div className="notice-card notice-warn">
          <div><strong>存在失败任务</strong><span>请查看错误信息，必要时重新上传材料或检查后端解析依赖。</span></div>
        </div>
      )}

      <div className="card" style={{padding:0}}>
        <div className="panel-head">
          <div>
            <span className="card-title">任务列表</span>
            <p>材料解析任务会在上传后自动创建，失败原因会记录在错误列。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>时间</th><th>类型</th><th>状态</th><th>案件</th><th>处理说明</th><th>错误</th></tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td style={{fontSize:12,color:'#86909c'}}>{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</td>
                  <td><span className="tag t-purple">{typeText(task.task_type)}</span></td>
                  <td><span className={`tag ${statusTag(task.status)}`}>{statusText[task.status] || task.status}</span></td>
                  <td style={{fontSize:12,color:'#4b5563'}}>{task.case_id ? task.case_id.slice(0, 8) : '-'}</td>
                  <td style={{fontSize:12,color:'#475569'}}>{task.message || '-'}</td>
                  <td style={{color:'#dc2626',fontSize:12,maxWidth:300}}>{task.error || '-'}</td>
                </tr>
              ))}
              {tasks.length === 0 && <tr><td colSpan={6}><div className="empty refined-empty" style={{padding:'50px 0'}}><p>暂无后台任务，上传材料后会自动记录解析任务</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
