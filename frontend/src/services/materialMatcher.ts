export type ChecklistItem = {
  name: string
  description?: string
  required?: boolean
}

export type MaterialRecord = {
  filename: string
  parsed_content?: string
}

export type MaterialMatch = {
  item: ChecklistItem
  keywords: string[]
  matchedMaterial?: MaterialRecord
}

const GENERIC_TERMS = ['原件', '复印件', '证明', '材料', '文件', '记录', '凭证', '报告', '相关', '其他', '完整', '双方', '签署', '文本', '员工', '公司', '当事人', '的']

const normalize = (value: string) => value.toLowerCase().replace(/[^一-龥a-z0-9]/g, '')

const removeGenericTerms = (value: string) => GENERIC_TERMS.reduce((text, term) => text.split(term).join(''), value)

export const getMaterialKeywords = (item: ChecklistItem) => {
  const source = `${item.name} ${item.description || ''}`
  const parts = source.split(/[、，,。；;：:\s/（）()【】\[\]-]+|或|和|及|与|等/g)
  const keywords = parts.flatMap(part => {
    const normalized = normalize(part)
    const simplified = removeGenericTerms(normalized)
    return [normalized, simplified, simplified.length >= 4 ? simplified.slice(0, 2) : '']
  })
  return Array.from(new Set(keywords.filter(keyword => keyword.length >= 2 && !GENERIC_TERMS.includes(keyword)))).slice(0, 6)
}

export const findMatchedMaterial = (materials: MaterialRecord[], keywords: string[]) => {
  return materials.find(material => {
    const target = normalize(`${material.filename} ${material.parsed_content || ''}`)
    return keywords.some(keyword => target.includes(keyword))
  })
}

export const getMaterialCompletion = (checklist: ChecklistItem[], materials: MaterialRecord[]) => {
  const items: MaterialMatch[] = checklist.map(item => {
    const keywords = getMaterialKeywords(item)
    return { item, keywords, matchedMaterial: findMatchedMaterial(materials, keywords) }
  })
  const requiredItems = items.filter(({ item }) => item.required !== false)
  const completedRequired = requiredItems.filter(({ matchedMaterial }) => matchedMaterial).length
  const missingRequiredItems = requiredItems.filter(({ matchedMaterial }) => !matchedMaterial)
  const completionPercent = requiredItems.length > 0 ? Math.round((completedRequired / requiredItems.length) * 100) : 0

  return {
    items,
    requiredItems,
    completedRequired,
    missingRequired: missingRequiredItems.length,
    missingRequiredItems,
    completionPercent,
  }
}
