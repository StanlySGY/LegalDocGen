import { useEffect, useState } from 'react'
import { api, type AuthUser } from '../services/api'
import type { BillingOrder, BillingOrderStatus, OperationsSummary, Plan, Team } from '../types'

interface Props { currentUser: AuthUser | null }

const statusText: Record<BillingOrderStatus, string> = {
  pending: '待确认',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款',
}

const statusTone: Record<BillingOrderStatus, string> = {
  pending: 't-orange',
  paid: 't-green',
  cancelled: 't-gray',
  refunded: 't-red',
}

const formatMoney = (amount: number, currency: string) => `${currency || 'CNY'} ${(amount / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

export default function OperationsPage({ currentUser }: Props) {
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({ team_id: '', plan_code: 'team', billing_period: 'monthly', amount: '299.00', external_reference: '', notes: '' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [loading, setLoading] = useState(true)

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }
  const isAdmin = currentUser?.role === 'admin'

  const load = async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const [nextSummary, nextOrders, nextTeams, nextPlans] = await Promise.all([
        api.billing.operationsSummary(),
        api.billing.orders({ status: statusFilter, limit: 80 }),
        api.teams.list(),
        api.billing.plans(),
      ])
      setSummary(nextSummary)
      setOrders(nextOrders)
      setTeams(nextTeams)
      setPlans(nextPlans)
      setForm(prev => ({ ...prev, team_id: prev.team_id || nextTeams[0]?.id || '', plan_code: prev.plan_code || nextPlans[0]?.code || 'team' }))
    } catch (e: any) {
      showToast(e.message || '运营数据加载失败', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, isAdmin])

  const createOrder = async () => {
    if (!form.team_id) return showToast('请选择团队', 'err')
    const amount = Math.round(Number(form.amount || '0') * 100)
    if (Number.isNaN(amount) || amount < 0) return showToast('请输入有效金额', 'err')
    try {
      await api.billing.createOrder({
        team_id: form.team_id,
        plan_code: form.plan_code,
        billing_period: form.billing_period,
        amount_cents: amount,
        currency: 'CNY',
        external_reference: form.external_reference,
        notes: form.notes,
      })
      setForm(prev => ({ ...prev, external_reference: '', notes: '' }))
      await load()
      showToast('订单已创建')
    } catch (e: any) {
      showToast(e.message || '订单创建失败', 'err')
    }
  }

  const updateOrder = async (order: BillingOrder, status: BillingOrderStatus) => {
    try {
      await api.billing.updateOrder(order.id, { status })
      await load()
      showToast(`订单已更新为${statusText[status]}`)
    } catch (e: any) {
      showToast(e.message || '订单更新失败', 'err')
    }
  }

  if (!isAdmin) {
    return (
      <div className="card auth-loading">
        <strong>需要管理员权限</strong>
        <p style={{fontSize:12,color:'#86909c',marginTop:8}}>运营后台包含团队订阅、线下订单和模拟收入信息，仅管理员账号可访问。</p>
      </div>
    )
  }

  if (loading && !summary) return <div className="card auth-loading">正在加载运营后台...</div>

  return (
    <div>
      <div className="dashboard-hero billing-hero">
        <div>
          <div className="eyebrow">SAAS OPERATIONS</div>
          <h2>运营后台</h2>
          <p>面向试运营阶段的线下订单、订阅开通、团队用量和模拟收入看板，先支持人工收款后的商业闭环。</p>
        </div>
        <div className="billing-cta-card">
          <strong>线下收款模式</strong>
          <span>创建待确认订单，确认到账后标记已支付并自动开通目标团队套餐。</span>
        </div>
      </div>

      <div className="task-stat-row">
        <div className="stat-card s-purple"><div className="s-label">团队总数</div><div className="s-value">{summary?.team_count || 0}</div><div className="s-hint">SaaS 租户</div></div>
        <div className="stat-card s-green"><div className="s-label">付费团队</div><div className="s-value">{summary?.paid_team_count || 0}</div><div className="s-hint">非免费 active</div></div>
        <div className="stat-card s-orange"><div className="s-label">待确认订单</div><div className="s-value">{summary?.pending_order_count || 0}</div><div className="s-hint">线下收款待处理</div></div>
        <div className="stat-card s-blue"><div className="s-label">模拟收入</div><div className="s-value">{formatMoney(summary?.paid_amount_cents || 0, summary?.currency || 'CNY')}</div><div className="s-hint">已支付订单汇总</div></div>
      </div>

      <div className="billing-grid">
        <div className="card">
          <div className="card-hd"><span className="card-title">创建线下订单</span><span className="tag t-orange">试运营</span></div>
          <div className="create-team-box" style={{marginBottom:12}}>
            <select className="input" value={form.team_id} onChange={e=>setForm({...form,team_id:e.target.value})}>
              <option value="">选择团队</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select className="input" value={form.plan_code} onChange={e=>setForm({...form,plan_code:e.target.value})}>
              {plans.map(plan => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
            </select>
          </div>
          <div className="create-team-box" style={{marginBottom:12}}>
            <select className="input" value={form.billing_period} onChange={e=>setForm({...form,billing_period:e.target.value})}>
              <option value="monthly">月付</option>
              <option value="yearly">年付</option>
              <option value="contract">合同期</option>
            </select>
            <input className="input" placeholder="金额，例如 299.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
          </div>
          <input className="input" style={{marginBottom:12}} placeholder="外部参考号（可选）" value={form.external_reference} onChange={e=>setForm({...form,external_reference:e.target.value})} />
          <textarea className="textarea" style={{height:96}} placeholder="备注（可选）" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
          <button className="btn btn-p" style={{width:'100%',marginTop:12}} onClick={createOrder}>创建待确认订单</button>
        </div>

        <div className="card">
          <div className="card-hd"><span className="card-title">接近配额上限团队</span><span className="tag t-purple">{summary?.near_limit_teams.length || 0}</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {summary?.near_limit_teams.map(team => (
              <div key={team.team_id} className="usage-card warn">
                <div className="usage-card-head"><strong>{team.team_name}</strong><span className="tag t-orange">需关注</span></div>
                <div className="plan-quota-list">{team.usage.map(item => <span key={item.metric}>{item.label}：{item.used}/{item.limit}（{item.percent}%）</span>)}</div>
              </div>
            ))}
            {summary?.near_limit_teams.length === 0 && <div className="empty refined-empty" style={{padding:'42px 0'}}><p>暂无接近上限的团队</p></div>}
          </div>
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="panel-head">
          <div>
            <span className="card-title">订单列表</span>
            <p>待确认订单标记为已支付后，会同步切换目标团队套餐。</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value="pending">待确认</option>
              <option value="paid">已支付</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
            <button className="btn btn-o btn-sm" onClick={load}>刷新</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>创建时间</th><th>团队</th><th>套餐</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{fontSize:12,color:'#86909c'}}>{order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '-'}</td>
                  <td>{order.team.name}</td>
                  <td>{order.plan_name} · {order.billing_period}</td>
                  <td>{formatMoney(order.amount_cents, order.currency)}</td>
                  <td><span className={`tag ${statusTone[order.status]}`}>{statusText[order.status]}</span></td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {order.status === 'pending' && <button className="btn btn-p btn-sm" onClick={()=>updateOrder(order, 'paid')}>确认支付</button>}
                      {order.status === 'pending' && <button className="btn btn-o btn-sm" onClick={()=>updateOrder(order, 'cancelled')}>取消</button>}
                      {order.status === 'paid' && <button className="btn btn-d btn-sm" onClick={()=>updateOrder(order, 'refunded')}>退款</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6}><div className="empty refined-empty" style={{padding:'50px 0'}}><p>暂无订单</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
