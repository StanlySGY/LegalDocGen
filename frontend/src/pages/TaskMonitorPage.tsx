import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { BackgroundTask } from '../types'

const statusText: Record<string, string> = {
  pending: '待处理',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
}

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6 page-title-row">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>后台任务</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>查看材料解析等长任务状态，便于排查失败原因</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新</button>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>时间</th><th>类型</th><th>状态</th><th>案件</th><th>消息</th><th>错误</th></tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td style={{fontSize:12,color:'#86909c'}}>{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</td>
                  <td><span className="tag t-purple">{task.task_type}</span></td>
                  <td><span className={`tag ${task.status === 'completed' ? 't-green' : task.status === 'failed' ? 't-red' : 't-orange'}`}>{statusText[task.status] || task.status}</span></td>
                  <td style={{fontSize:12,color:'#4b5563'}}>{task.case_id ? task.case_id.slice(0, 8) : '-'}</td>
                  <td>{task.message || '-'}</td>
                  <td style={{color:'#dc2626'}}>{task.error || '-'}</td>
                </tr>
              ))}
              {tasks.length === 0 && <tr><td colSpan={6}><div className="empty" style={{padding:'50px 0'}}><p>暂无后台任务</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
