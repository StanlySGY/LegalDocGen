import { useNavigate } from 'react-router-dom'

const steps = [
  {
    icon: '📋',
    title: '第一步：新建案件',
    content: '点击左侧「案件工作台」→ 点击「新建案件」→ 输入案件名称 → 选择案件类型（如民间借贷、合同纠纷等）→ 点击「创建并上传材料」。',
    tip: '建议案件名称格式：「原告姓名 诉 被告姓名 + 案由」，例如「张三 诉 李四 民间借贷纠纷」。',
  },
  {
    icon: '📁',
    title: '第二步：上传材料',
    content: '在案件详情页，点击「+ 上传材料」按钮，选择 PDF、Word 或图片文件。系统会自动解析文件内容，识别文字。',
    tip: '支持格式：PDF、Word (.doc/.docx)、图片 (.jpg/.png)。扫描件会自动 OCR 识别文字。上传后请检查「材料齐备度」，确保必需材料已上传。',
  },
  {
    icon: '🔍',
    title: '第三步：检查材料',
    content: '上传完成后，查看「证据目录」确认材料解析正确。如果解析有误，可以点击「重解析」按钮重新处理。',
    tip: '点击材料名称可以在右侧抽屉中查看解析内容。确认关键事实、金额、日期等信息准确无误后再进入下一步。',
  },
  {
    icon: '🤖',
    title: '第四步：AI 生成文书',
    content: '点击「进入工作流」按钮，按顺序完成五个阶段：\n\n1️⃣ 案件梳理 — 提取当事人、事实经过、时间线\n2️⃣ 法律分析 — 分析法律关系、适用法律\n3️⃣ 争议归纳 — 梳理核心争议焦点\n4️⃣ 文书生成 — 生成起诉状/答辩状等初稿\n5️⃣ 审查优化 — 最终审查和修改建议\n\n每个阶段都可以编辑、重新生成、查看历史版本。',
    tip: '每个阶段生成后，务必点击「编辑」检查内容。AI 可能会遗漏关键事实或引用不准确的法条。标注有「⚠️ 防幻觉提醒」的部分需要特别注意。',
  },
  {
    icon: '✏️',
    title: '第五步：编辑文书',
    content: '生成完成后，点击「编辑」按钮进入文书编辑器。你可以：\n\n• 直接修改文字内容\n• 使用上方工具栏加粗、加标题\n• 点击 AI 工具按钮（润色、补充法条、改写、精简、对方挑刺）\n• 使用 Ctrl+Z 撤销、Ctrl+Y 重做\n• 使用 Ctrl+S 保存',
    tip: '「对方律师挑刺」功能会从对方视角审查文书漏洞，建议在提交前使用。',
  },
  {
    icon: '📄',
    title: '第六步：导出文书',
    content: '完成所有阶段并进行律师最终复核后，点击「导出为 Word」按钮。可以选择：\n\n• 标准文档 — 日常使用\n• 法院严格格式 — 标题方正小标宋，正文仿宋_GB2312\n• 仲裁委格式 — 仲裁申请书专用\n• 完整案件包 — 包含所有材料和分析',
    tip: '导出前系统会检查是否完成全部阶段。如果提示未完成，请先完成缺少的阶段。',
  },
]

const faq = [
  { q: '上传的材料解析失败怎么办？', a: '点击材料旁的「重解析」按钮。如果仍然失败，可能是文件格式问题，建议重新上传清晰的 PDF 或 Word 文件。' },
  { q: 'AI 生成的内容不准确怎么办？', a: '这是正常的。AI 生成的内容仅供参考，请务必人工复核法条引用、金额计算和诉讼策略。使用「编辑」功能直接修改不准确的内容。' },
  { q: '如何查看历史版本？', a: '在工作流页面点击「历史」按钮，可以查看每个阶段的版本历史。点击「回滚」可以恢复到之前的版本。' },
  { q: '案件已归档后还能搜索到吗？', a: '可以。在案件列表的筛选下拉框中选择「已归档」即可查看归档案件。' },
  { q: '如何使用过往文书库？', a: '进入「高级设置」→「Prompt模板」，在页面底部的「过往文书库」中添加参考文书。AI 生成时会参考您的写作风格。' },
]

export default function HelpPage() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>使用教程</h1>
          <p style={{ fontSize: 14, color: '#86909c' }}>6 步完成从立案到文书导出的完整流程</p>
        </div>
        <button className="btn btn-o" onClick={() => navigate('/cases')}>返回工作台</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {steps.map((step, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>{step.icon}</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{step.title}</h2>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
              {step.content}
            </div>
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
              💡 <strong>小贴士：</strong>{step.tip}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>常见问题</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faq.map((item, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#1d2129' }}>{item.q}</div>
              <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32, padding: 20, background: '#f0fdf4', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8 }}>遇到问题？</div>
        <div style={{ fontSize: 13, color: '#15803d' }}>联系管理员获取技术支持，或查看右上角的 AI 服务状态确认系统正常运行。</div>
      </div>
    </div>
  )
}
