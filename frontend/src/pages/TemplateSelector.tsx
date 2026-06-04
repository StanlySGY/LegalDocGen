import { useState, useEffect } from 'react'
import { api } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

interface Props {
  onSelectTemplate: (templateId: string, templateName: string) => void
  onBack: () => void
}

export default function TemplateSelector({ onSelectTemplate, onBack }: Props) {
  const [templates, setTemplates] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [tpl, cat] = await Promise.all([
          api.templates.list(),
          api.templates.getCategories()
        ])
        setTemplates(tpl)
        setCategories(cat.categories || [])
        if (cat.categories && cat.categories.length > 0) {
          setSelectedCategory(cat.categories[0].value)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredTemplates = selectedCategory
    ? templates.filter(t => t.category === selectedCategory)
    : templates

  const handleSelect = (template: any) => {
    onSelectTemplate(template.id, template.name)
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="正在加载案件模板..." />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>选择案件模板</h2>
          <p style={{ fontSize: 13, color: '#86909c', marginTop: 4 }}>选择合适的模板快速开始，系统会自动配置所需材料和Prompt</p>
        </div>
        <button className="btn btn-o" onClick={onBack}>← 返回</button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`btn ${selectedCategory === cat.value ? 'btn-p' : 'btn-o'} btn-sm`}
            onClick={() => setSelectedCategory(cat.value)}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className={`card hover:shadow-md transition-all duration-200 cursor-pointer ${
              selectedTemplate?.id === template.id ? 'border-2 border-indigo-600' : 'border border-gray-200'
            }`}
            onClick={() => setSelectedTemplate(template)}
          >
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{template.name}</h3>
              <p style={{ fontSize: 12, color: '#86909c', lineHeight: 1.5 }}>{template.description}</p>
            </div>

            <div style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#86909c', marginBottom: 6 }}>
                <strong>所需材料：</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {template.materials_checklist.slice(0, 3).map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: '#86909c', display: 'flex', gap: 4 }}>
                    <span>{item.required ? '✓' : '○'}</span>
                    <span>{item.name}</span>
                  </div>
                ))}
                {template.materials_checklist.length > 3 && (
                  <div style={{ fontSize: 11, color: '#86909c' }}>
                    + {template.materials_checklist.length - 3} 项
                  </div>
                )}
              </div>
            </div>

            {selectedTemplate?.id === template.id && (
              <button
                className="btn btn-p btn-sm"
                style={{ width: '100%' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(template)
                }}
              >
                使用此模板
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="empty" style={{ padding: '60px 0' }}>
          <p>此分类暂无模板</p>
        </div>
      )}
    </div>
  )
}
