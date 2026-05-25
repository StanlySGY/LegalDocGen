import { useEffect, useState } from 'react'
import { api, type AuthUser } from '../services/api'
import type { Team, TeamMember } from '../types'

export default function TeamManagePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [users, setUsers] = useState<AuthUser[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'member' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }

  const loadTeams = async () => {
    try {
      const data = await api.teams.list()
      setTeams(data)
      const activeTeamId = selectedTeamId || data[0]?.id || ''
      setSelectedTeamId(activeTeamId)
      if (activeTeamId) await loadMembers(activeTeamId)
    } catch (e: any) {
      showToast(e.message || '团队加载失败', 'err')
    }
  }

  const loadMembers = async (teamId: string) => {
    try {
      setMembers(await api.teams.members(teamId))
    } catch (e: any) {
      showToast(e.message || '成员加载失败', 'err')
    }
  }

  const loadUsers = async () => {
    try {
      setUsers(await api.auth.users())
    } catch {
      setUsers([])
    }
  }

  useEffect(() => { loadTeams(); loadUsers() }, [])

  const selectTeam = async (teamId: string) => {
    setSelectedTeamId(teamId)
    await loadMembers(teamId)
  }

  const createTeam = async () => {
    const name = newTeamName.trim()
    if (!name) return showToast('请输入团队名称', 'err')
    try {
      await api.teams.create({ name })
      setNewTeamName('')
      await loadTeams()
      showToast('团队已创建')
    } catch (e: any) {
      showToast(e.message || '团队创建失败', 'err')
    }
  }

  const addMember = async () => {
    if (!selectedTeamId) return
    if (!memberForm.user_id) return showToast('请选择成员', 'err')
    try {
      await api.teams.addMember(selectedTeamId, memberForm)
      setMemberForm({ user_id: '', role: 'member' })
      await loadMembers(selectedTeamId)
      showToast('成员已添加')
    } catch (e: any) {
      showToast(e.message || '添加成员失败', 'err')
    }
  }

  const updateRole = async (userId: string, role: string) => {
    if (!selectedTeamId) return
    try {
      await api.teams.updateMember(selectedTeamId, userId, { role })
      await loadMembers(selectedTeamId)
      showToast('角色已更新')
    } catch (e: any) {
      showToast(e.message || '角色更新失败', 'err')
    }
  }

  const removeMember = async (userId: string) => {
    if (!selectedTeamId) return
    try {
      await api.teams.removeMember(selectedTeamId, userId)
      await loadMembers(selectedTeamId)
      showToast('成员已移除')
    } catch (e: any) {
      showToast(e.message || '移除失败', 'err')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 page-title-row">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>团队协作</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>管理团队和成员，团队成员可访问同团队案件</p>
        </div>
        <button className="btn btn-o" onClick={loadTeams}>刷新</button>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="card-title" style={{marginBottom:12}}>创建团队</div>
        <div className="flex gap-2">
          <input className="input" placeholder="团队名称" value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} />
          <button className="btn btn-p" onClick={createTeam}>创建</button>
        </div>
      </div>

      <div className="evidence-grid">
        <div className="card">
          <div className="card-hd"><span className="card-title">我的团队</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {teams.map(team => (
              <div key={team.id} onClick={()=>selectTeam(team.id)} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 14px',cursor:'pointer',background:selectedTeamId===team.id?'#eef2ff':'#fff'}}>
                <div className="flex items-center justify-between">
                  <strong style={{fontSize:13}}>{team.name}</strong>
                  <span className="tag t-purple">{team.role}</span>
                </div>
                <div style={{fontSize:11,color:'#86909c',marginTop:6}}>{team.created_at ? new Date(team.created_at).toLocaleString('zh-CN') : '-'}</div>
              </div>
            ))}
            {teams.length === 0 && <div className="empty" style={{padding:'40px 0'}}><p>暂无团队</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-hd"><span className="card-title">团队成员</span></div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <select className="input" value={memberForm.user_id} onChange={e=>setMemberForm({...memberForm,user_id:e.target.value})}>
              <option value="">选择用户</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.display_name || user.username} · {user.username}</option>)}
            </select>
            <select className="input" style={{width:120}} value={memberForm.role} onChange={e=>setMemberForm({...memberForm,role:e.target.value})}>
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
            <button className="btn btn-p" onClick={addMember}>添加</button>
          </div>
          {users.length === 0 && <div style={{fontSize:12,color:'#86909c',marginBottom:12}}>只有管理员可读取用户列表并添加成员。</div>}
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>成员</th><th>角色</th><th>加入时间</th><th>操作</th></tr></thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id}>
                    <td>{member.display_name || member.username}<div style={{fontSize:11,color:'#86909c'}}>{member.username}</div></td>
                    <td>
                      <select className="input" style={{width:120}} value={member.role} onChange={e=>updateRole(member.user_id, e.target.value)}>
                        <option value="owner">所有者</option>
                        <option value="admin">管理员</option>
                        <option value="member">成员</option>
                      </select>
                    </td>
                    <td style={{fontSize:12,color:'#86909c'}}>{member.created_at ? new Date(member.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td><button className="btn btn-d btn-sm" onClick={()=>removeMember(member.user_id)}>移除</button></td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={4}><div className="empty" style={{padding:'40px 0'}}><p>暂无成员</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
