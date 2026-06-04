import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import { useEffect, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import { api, quotaUpgradeMessage, type AuthUser } from '../services/api'
import type { BillingStatus, Plan, UsageItem } from '../types'

interface Props { currentUser: AuthUser | null }

const statusText: Record<string, string> = { trialing: '试用中', active: '已启用', past_due: '待处理', cancelled: '已取消' }
const planTone = (code: string) => code === 'business' ? 's-purple' : code === 'team' ? 's-blue' : 's-orange'
const formatLimit = (value: number) => value >= 3000 ? '不限量级' : `${value}`

function UsageCard({ item }: { item: UsageItem }) {
  const nearLimit = item.limit > 0 && item.percent >= 80
  return (
    <div className={`usage-card ${nearLimit ? 'warn' : ''}`}>
      <div className="usage-card-head">
        <div>
          <strong>{item.label}</strong>
          <span>{item.period === 'all' ? '累计用量' : `${item.period} 周期`}</span>
        </div>
        <span className="tag t-purple">{item.used}/{item.limit}</span>
      </div>
      <div className="usage-bar"><span style={{ width: `${Math.min(item.percent, 100)}%` }} /></div>
      <div className="usage-card-foot">
        <span>{item.percent}% 已使用</span>
        <span>{nearLimit ? '建议升级套餐' : '当前可用'}</span>
      </div>
    </div>
  )
}

function PlanCard({ plan, current, admin, onSwitch }: { plan: Plan; current: boolean; admin: boolean; onSwitch: (code: string) => void }) {
  return (
    <div className={`plan-card ${current ? 'current' : ''}`}>
      <div className="plan-card-head">
        <span className={`stat-card-mini ${planTone(plan.code)}`}>{plan.name}</span>
        {current && <span className="tag t-green">当前套餐</span>}
      </div>
      <div className="plan-quota-list">
        <span>案件：{formatLimit(plan.case_limit)}</span>
        <span>材料：{formatLimit(plan.material_limit)}</span>
        <span>AI 生成/月：{formatLimit(plan.ai_task_limit_monthly)}</span>
        <span>成员：{formatLimit(plan.member_limit)}</span>
      </div>
      <button className={current ? 'btn btn-o btn-sm' : 'btn btn-p btn-sm'} disabled={current || !admin} onClick={() => onSwitch(plan.code)}>
        {current ? '已启用' : admin ? '切换到此套餐' : '联系管理员升级'}
      </button>
    </div>
  )
}

export default function BillingUsagePage({ currentUser }: Props) {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const { toasts, showToast, removeToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [nextPlans, nextStatus] = await Promise.all([api.billing.plans(), api.billing.status()])
      setPlans(nextPlans)
      setStatus(nextStatus)
    } catch (e: any) {
      showToast(quotaUpgradeMessage(e) || e.message || '套餐信息加载失败', { type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const switchPlan = async (planCode: string) => {
    if (!status) return
    try {
      const next = await api.billing.updateSubscription(status.team.id, { plan_code: planCode, status: 'active' })
      setStatus(next)
      showToast('套餐已切换')
    } catch (e: any) {
      showToast(e.message || '套餐切换失败', { type: 'err' })
    }
  }

  const isAdmin = currentUser?.role === 'admin'
  const currentPlan = status?.plan
  const usage = status?.usage || []
  const highUsage = usage.filter(item => item.limit > 0 && item.percent >= 80).length

  if (loading) return <LoadingSpinner text="正在加载套餐与用量..." />

  return (
    <div>
      <div className="dashboard-hero billing-hero">
        <div>
          <div className="eyebrow">SAAS BILLING</div>
          <h2>用量与套餐</h2>
          <p>用套餐、订阅状态和用量配额定义商业化边界，先完成本地可验证的 SaaS 计量闭环。</p>
          {status && (
            <div className="hero-action-card">
              <div>
                <span className="tag t-purple">{status.team.name}</span>
                <strong>{currentPlan?.name}</strong>
                <span>{statusText[status.subscription.status] || status.subscription.status} · 当前周期 {status.period}</span>
              </div>
              <button className="btn btn-p btn-sm" onClick={load}>刷新用量</button>
            </div>
          )}
        </div>
        <div className="billing-cta-card">
          <strong>{isAdmin ? '管理员可手动切换套餐' : '需要更高额度？'}</strong>
          <span>{isAdmin ? '当前为本地计费模拟，后续可接 Stripe、支付宝或企业合同订阅。' : '请联系管理员升级团队套餐，解除案件、材料和 AI 生成限制。'}</span>
        </div>
      </div>

      {status && (
        <div className="stat-row dashboard-stats">
          <div className="stat-card s-purple"><div className="s-label">当前套餐</div><div className="s-value">{currentPlan?.name}</div><div className="s-hint">{statusText[status.subscription.status] || status.subscription.status}</div></div>
          <div className="stat-card s-blue"><div className="s-label">用量周期</div><div className="s-value">{status.period}</div><div className="s-hint">AI 生成按月计量</div></div>
          <div className="stat-card s-orange"><div className="s-label">接近上限</div><div className="s-value">{highUsage}</div><div className="s-hint">超过 80% 的指标</div></div>
          <div className="stat-card s-green"><div className="s-label">团队租户</div><div className="s-value">{usage.find(item => item.metric === 'members')?.used || 0}</div><div className="s-hint">当前成员数</div></div>
        </div>
      )}

      <div className="billing-grid">
        <div className="card">
          <div className="card-hd"><span className="card-title">用量配额</span><span className="tag t-blue">实时计算</span></div>
          <div className="usage-grid">
            {usage.map(item => <UsageCard key={item.metric} item={item} />)}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><span className="card-title">商业化说明</span><span className="tag t-orange">模拟计费</span></div>
          <div className="process-hint" style={{marginTop:0}}>
            <strong>第一批先做 SaaS 基础层</strong>
            <span>当前不会发起真实扣费，只提供套餐、订阅、用量和配额限制。后续接入支付时可复用这些数据结构。</span>
          </div>
          <div className="process-hint">
            <strong>超限后的产品行为</strong>
            <span>创建案件、上传材料、执行 AI 生成和添加成员达到上限时，会显示升级提示，不再只是通用错误。</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><span className="card-title">套餐权益</span><span className="tag t-purple">本地可切换</span></div>
        <div className="plan-grid">
          {plans.map(plan => <PlanCard key={plan.code} plan={plan} current={plan.code === status?.subscription.plan_code} admin={isAdmin} onSwitch={switchPlan} />)}
        </div>
      </div>
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
