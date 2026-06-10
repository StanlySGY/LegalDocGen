export interface UsageItem {
  metric: 'cases' | 'materials' | 'ai_tasks' | 'members'
  label: string
  used: number
  limit: number
  percent: number
  period: string
}

export interface Plan {
  id: string
  code: string
  name: string
  case_limit: number
  material_limit: number
  ai_task_limit_monthly: number
  member_limit: number
  is_active: boolean
}

export interface BillingStatus {
  team: { id: string; name: string }
  subscription: {
    id: string
    plan_code: string
    status: 'trialing' | 'active' | 'past_due' | 'cancelled'
    current_period_start?: string | null
    current_period_end?: string | null
  }
  plan: Plan
  usage: UsageItem[]
  period: string
}

export type BillingOrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export interface BillingOrder {
  id: string
  team: { id: string; name: string }
  plan_code: string
  plan_name: string
  billing_period: string
  amount_cents: number
  currency: string
  status: BillingOrderStatus
  paid_at?: string | null
  operator_id?: string | null
  external_reference: string
  notes: string
  created_at?: string | null
  updated_at?: string | null
}

export interface OperationsSummary {
  team_count: number
  paid_team_count: number
  trialing_subscription_count: number
  pending_order_count: number
  paid_amount_cents: number
  currency: string
  recent_orders: BillingOrder[]
  near_limit_teams: Array<{
    team_id: string
    team_name: string
    usage: UsageItem[]
  }>
}

export interface QuotaExceededDetail {
  code: 'quota_exceeded'
  metric: string
  label: string
  used: number
  limit: number
  upgrade_required: boolean
  message: string
}

export interface Case {
  id: string
  name: string
  description: string
  case_type: string
  document_type?: string
  template_id?: string | null
  owner_id?: string | null
  team_id?: string | null
  status: string
  archived_at?: string | null
  archive_note?: string
  created_at: string
  updated_at: string
}

export interface CaseDeadline {
  id: string
  case_id: string
  case_name?: string
  title: string
  due_date: string
  reminder_days: number
  note: string
  is_completed: boolean
  days_left?: number
  created_at?: string
}

export interface CaseNote {
  id: string
  case_id: string
  title: string
  content: string
  pinned: boolean
  created_at?: string
  updated_at?: string
}

export const DOCUMENT_TYPES: Record<string, string> = {
  complaint: '起诉状',
  defense: '答辩状/反驳意见',
  representation: '代理词',
  lawyer_letter: '律师函/催告函',
}

export interface Material {
  category?: string
  id: string
  case_id: string
  filename: string
  file_type: string
  file_size: number
  parsed_content: string
  parse_status: string
  parse_task_id?: string | null
  created_at: string
}

export interface MaterialCatalogItem {
  id: string
  filename: string
  file_type: string
  file_size: number
  parse_status: string
  excerpt: string
  citation?: string
  page_refs?: string[]
  word_count: number
}

export interface Team {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
  created_at?: string
  updated_at?: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  username: string
  display_name: string
  role: 'owner' | 'admin' | 'member'
  created_at?: string
}

export interface BackgroundTask {
  id: string
  case_id?: string | null
  task_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message: string
  result: string
  error: string
  created_at?: string
  started_at?: string
  completed_at?: string
}

export interface LegalArticle {
  id: string
  law_name: string
  article_no: string
  title: string
  content: string
  created_at?: string
  updated_at?: string
}

export interface WorkflowNode {
  id?: string
  stage: string
  output: string
  prompt: string
  model_used: string
  version: number
  status: string
  created_at?: string
}

export interface StageProgress {
  stage: string
  name: string
  status: string
  has_output: boolean
  version: number
}

export interface PromptTemplate {
  id: string
  stage: string
  name: string
  content: string
  is_default: boolean
  version: number
}

export type StageType =
  | 'fact_extraction'
  | 'legal_analysis'
  | 'dispute_focus'
  | 'draft_generation'
  | 'review_optimization'

export const STAGE_NAMES: Record<StageType, string> = {
  fact_extraction: '案件要素提取',
  legal_analysis: '法律关系分析',
  dispute_focus: '争议焦点整理',
  draft_generation: '文书初稿生成',
  review_optimization: '审查与优化',
}

export const STAGE_ORDER: StageType[] = [
  'fact_extraction',
  'legal_analysis',
  'dispute_focus',
  'draft_generation',
  'review_optimization',
]
