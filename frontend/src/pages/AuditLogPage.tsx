import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }

  const load = () => {
    api.audit.list().then(setLogs).catch((e: any) => showToast(e.message || '审计日志加载失败', 'err'))
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 page-title-row">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>审计日志</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>记录关键案件、材料和工作流操作，便于追踪交付过程</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新</button>
      </div>

      <div className="card" style={{padding:0}}>
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
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{fontSize:12,color:'#86909c'}}>{log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}</td>
                  <td><span className="tag t-purple">{log.action}</span></td>
                  <td style={{fontSize:12,color:'#4b5563'}}>{log.resource_type || '-'}{log.resource_id ? ` / ${log.resource_id.slice(0, 8)}` : ''}</td>
                  <td>{log.summary || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4}><div className="empty" style={{padding:'50px 0'}}><p>暂无审计日志</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
