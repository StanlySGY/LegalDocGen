# 前端改进计划

基于 dev 分支的 34 个提交，按**风险从低到高、依赖从少到多**排序，分 6 个阶段逐步合入 main 分支。每个阶段独立提交、独立测试，不通过不进入下一阶段。

---

## 阶段一：类型与 API 扩展（无 UI 变更，零风险）

**目标**：补齐后端/前端缺失的 API 端点和类型定义，为后续功能做准备。

| 改动 | 文件 | 说明 |
|------|------|------|
| 添加文书类型枚举 | `types/index.ts` | `DOCUMENT_TYPES` 扩展为 9 种文书 |
| 添加 ReviewMode 类型 | `types/index.ts` | `'single' | 'chain' | 'compare'` |
| 添加 Party 接口 | `types/index.ts` | 当事人信息结构化 |
| 添加 DocumentTypeOption | `types/index.ts` | 文书类型选项 |
| API 添加 reviewChain | `services/api.ts` | 链式审查接口 |
| API 添加 multiCompare | `services/api.ts` | 多版本对比接口 |
| API 添加 aiEdit | `services/api.ts` | AI 辅助编辑接口 |
| API 添加 quickGenerate | `services/api.ts` | 极速生成接口 |
| 后端添加对应路由 | `routers/workflow.py` | 3 个新端点 |

**验证**：`npm run build` + `pytest` 通过即可。

---

## 阶段二：深色模式 + CSS 变量主题系统

**目标**：统一 CSS 变量命名，支持 dark/light 切换。

| 改动 | 文件 | 说明 |
|------|------|------|
| CSS 变量统一 | `index.css` | `--bg-app`, `--bg-card`, `--text-primary` 等 |
| 深色模式变量 | `index.css` | `@media (prefers-color-scheme: dark)` |
| 主题切换按钮 | `App.tsx` | 顶栏添加 ☀/🌙 切换 |
| 持久化主题选择 | `App.tsx` | `localStorage` 存储 |

**验证**：页面在 light/dark 模式下均正常显示。

---

## 阶段三：响应式适配 + 交互优化

**目标**：移动端可用，交互细节提升。

| 改动 | 文件 | 说明 |
|------|------|------|
| 侧边栏响应式 | `index.css` + `App.tsx` | 移动端汉堡菜单 |
| 案件列表搜索优化 | `CaseList.tsx` | 搜索防抖 + 键盘快捷键 |
| 渠道管理响应式 | `ChannelManage.tsx` | 移动端适配 |
| 统一确认弹窗 | `ConfirmDialog.tsx` | 替换 `window.confirm` |

**验证**：手机端可正常操作主要流程。

---

## 阶段四：工作流页面增强

**目标**：提升文书生成体验。

| 改动 | 文件 | 说明 |
|------|------|------|
| 阶段引导卡片 | `WorkflowPage.tsx` | 每阶段显示输入/输出/风险提示 |
| 流式生成进度条 | `WorkflowPage.tsx` | 实时显示生成进度 |
| 版本 Diff 对比 | `WorkflowPage.tsx` | 新旧版本并排对比 |
| Markdown 工具栏 | `WorkflowPage.tsx` | 编辑区添加格式按钮 |
| 导出选项弹窗 | `WorkflowPage.tsx` | 标准排版/法院严格格式 |

**验证**：走完五阶段工作流，导出 Word 文档。

---

## 阶段五：AI 辅助编辑 + 交叉审查

**目标**：律师可选中文本进行 AI 润色/审查。

| 改动 | 文件 | 说明 |
|------|------|------|
| 选中文本菜单 | `WorkflowPage.tsx` | 弹出：润色/补充法条/改写/精简 |
| 链式审查模式 | `WorkflowPage.tsx` | 多模型依次审查 |
| 多版本对比 | `WorkflowPage.tsx` | 同一问题多模型回答并排 |
| 防幻觉标记 | `WorkflowPage.tsx` | AI 编造内容标红警告 |

**验证**：选中文本触发 AI 编辑，结果正确显示。

---

## 阶段六：文书编辑器（独立模块）

**目标**：三栏编辑器，支持撤销/重做/快捷键。

| 改动 | 文件 | 说明 |
|------|------|------|
| DocumentEditor 组件 | `pages/DocumentEditor.tsx` | 三栏布局 |
| 撤销/重做系统 | `DocumentEditor.tsx` | Ctrl+Z / Ctrl+Y |
| 打印预览 | `DocumentEditor.tsx` | 打印前预览排版 |
| 时间轴编辑器 | `components/TimelineEditor.tsx` | 可编辑事实时间线 |
| 路由注册 | `App.tsx` | `/cases/:id/editor` |

**验证**：创建案件 → 生成文书 → 进入编辑器 → 编辑 → 导出。

---

## 执行原则

1. **每个阶段一个 PR/commit**，不混入其他改动
2. **每个阶段完成后**：`npm run build` + `pytest` + 手动验证核心流程
3. **发现问题立即回滚**该阶段，不继续前进
4. **后端 API 先行**：阶段一先把接口补好，前端再逐步对接
5. **保持 main 分支始终可部署**：任何时候 `git pull && docker-compose up -d --build` 都能正常工作
