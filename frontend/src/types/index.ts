export interface Case {
  id: string
  name: string
  description: string
  case_type: string
  case_number: string
  court: string
  cause: string
  filing_date: string
  status: string
  created_at: string
  updated_at: string
}

export interface Material {
  id: string
  case_id: string
  filename: string
  file_type: string
  file_size: number
  parsed_content: string
  structured_data: string
  parse_status: string
  created_at: string
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
  locked: boolean
  locked_reason: string
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

export type ReviewMode = 'single' | 'chain' | 'compare'

export interface DocumentTypeOption {
  key: string
  name: string
}

export const STAGE_NAMES_LAWYER: Record<string, string> = {
  fact_extraction: '案件梳理',
  legal_analysis: '法律分析',
  dispute_focus: '争议归纳',
  draft_generation: '文书生成',
  review_optimization: '审查优化',
}

export interface Party {
  id: string
  name: string
  role: string
  id_number: string
  address: string
  phone: string
  legal_representative: string
  notes: string
  created_at?: string
}
