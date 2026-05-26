import { useEffect, useState } from 'react'
import { api, quotaUpgradeMessage, type AuthUser } from '../services/api'
import type { Team, TeamMember } from '../types'

const roleText: Record<string, string> = { owner: '所有者', admin: '管理员', member: '成员' }
const roleClass = (role: string) => role === 'owner' ? 't-purple' : role === 'admin' ? 't-blue' : 't-gray'
const displayName = (member: TeamMember) => member.display_name || member.username

export default function TeamManagePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [users, setUsers] = useState<AuthUser[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'member' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }

  const loadMembers = async (teamId: string) => {
    try {
      setMembers(await api.teams.members(teamId))
    } catch (e: any) {
      showToast(e.message || '成员加载失败', 'err')
    }
  }

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
      showToast(quotaUpgradeMessage(e) || e.message || '添加成员失败', 'err')
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
    if (!window.confirm('确认移除该团队成员？')) return
    try {
      await api.teams.removeMember(selectedTeamId, userId)
      await loadMembers(selectedTeamId)
      showToast('成员已移除')
    } catch (e: any) {
      showToast(e.message || '移除失败', 'err')
    }
  }

  const selectedTeam = teams.find(team => team.id === selectedTeamId)
  const ownerCount = members.filter(member => member.role === 'owner').length
  const adminCount = members.filter(member => member.role === 'admin').length
  const memberCount = members.filter(member => member.role === 'member').length

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">TEAM COLLABORATION</div>
          <h2>团队协作</h2>
          <p>按团队组织案件访问范围，明确所有者、管理员和成员职责，降低多人协作中的权限误操作风险。</p>
        </div>
        <button className="btn btn-o" onClick={loadTeams}>刷新团队</button>
      </div>

      <div className="role-guide-grid">
        <div className="trust-card accent"><strong>所有者</strong><span>团队创建者，负责成员治理和关键权限边界。</span></div>
        <div className="trust-card"><strong>管理员</strong><span>可协助维护成员，适合法务主管或项目负责人。</span></div>
        <div className="trust-card"><strong>成员</strong><span>可访问同团队案件，适合协作律师和助理。</span></div>
      </div>

      <div className="team-layout">
        <div className="card team-sidebar">
          <div className="card-hd"><span className="card-title">团队列表</span><span className="tag t-purple">{teams.length}</span></div>
          <div className="create-team-box">
            <input className="input" placeholder="新团队名称" value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} />
            <button className="btn btn-p" onClick={createTeam}>创建</button>
          </div>
          <div className="team-list">
            {teams.map(team => (
              <div key={team.id} onClick={()=>selectTeam(team.id)} className={`team-card ${selectedTeamId===team.id ? 'active' : ''}`}>
                <div>
                  <strong>{team.name}</strong>
                  <span>{team.created_at ? new Date(team.created_at).toLocaleDateString('zh-CN') : '创建时间未知'}</span>
                </div>
                <span className={`tag ${roleClass(team.role)}`}>{roleText[team.role] || team.role}</span>
              </div>
            ))}
            {teams.length === 0 && <div className="empty refined-empty" style={{padding:'40px 0'}}><p>暂无团队，创建后可邀请成员协作</p></div>}
          </div>
        </div>

        <div className="card team-main">
          <div className="card-hd">
            <div>
              <span className="card-title">{selectedTeam?.name || '团队成员'}</span>
              <p style={{fontSize:12,color:'#86909c',marginTop:4}}>团队成员可访问该团队下的案件；角色调整会立即影响后续操作权限。</p>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <span className="tag t-purple">所有者 {ownerCount}</span>
              <span className="tag t-blue">管理员 {adminCount}</span>
              <span className="tag t-gray">成员 {memberCount}</span>
            </div>
          </div>

          <div className="add-member-row">
            <select className="input" value={memberForm.user_id} onChange={e=>setMemberForm({...memberForm,user_id:e.target.value})}>
              <option value="">选择用户</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.display_name || user.username} · {user.username}</option>)}
            </select>
            <select className="input" value={memberForm.role} onChange={e=>setMemberForm({...memberForm,role:e.target.value})}>
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
            <button className="btn btn-p" onClick={addMember}>添加成员</button>
          </div>
          {users.length === 0 && (
            <div className="notice-card notice-info" style={{marginBottom:14}}>
              <div><strong>用户列表不可用</strong><span>当前账号可能不是系统管理员；团队成员添加依赖管理员用户列表接口。</span></div>
            </div>
          )}

          <div className="member-grid">
            {members.map(member => (
              <div key={member.id} className="member-card">
                <div className="member-card-main">
                  <span className="avatar">{displayName(member).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{displayName(member)}</strong>
                    <span>{member.username}</span>
                    <span>{member.created_at ? `加入于 ${new Date(member.created_at).toLocaleDateString('zh-CN')}` : '加入时间未知'}</span>
                  </div>
                </div>
                <div className="member-actions">
                  <select className="input" value={member.role} onChange={e=>updateRole(member.user_id, e.target.value)}>
                    <option value="owner">所有者</option>
                    <option value="admin">管理员</option>
                    <option value="member">成员</option>
                  </select>
                  <button className="btn btn-d btn-sm" onClick={()=>removeMember(member.user_id)}>移除</button>
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="empty refined-empty" style={{padding:'48px 0'}}><p>暂无成员，选择用户后添加到团队</p></div>}
          </div>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
