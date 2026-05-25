# 法律文书智能生成与审查系统

面向法律专业人士的 AI 辅助办案与法律文书生成平台。系统围绕“材料上传 → 证据整理 → 分阶段分析 → 文书生成 → 审查导出”的完整链路设计，支持案件模板、材料齐备度检查、多模型渠道、版本回滚、证据目录、事实时间线和 Word 批量导出。

## 在线预览

[点击打开在线预览：法律文书智能生成系统](https://legal-doc-gen-wine.vercel.app/)

> 说明：当前在线预览部署的是前端体验入口；完整 AI 生成、文件解析和导出能力依赖后端 API 与模型渠道配置。

## 核心能力

### 案件工作台
- 案件搜索、状态筛选、类型筛选
- 案件新建、编辑、删除、批量删除
- 多案件批量导出 Word 压缩包
- 草稿、进行中、已完成状态自动同步

### 案件模板与材料齐备度
- 内置合同纠纷、劳动争议、房产纠纷、侵权纠纷等案件模板
- 每类模板包含必需/可选材料清单和阶段 Prompt
- 上传材料后自动计算齐备度
- 必需材料缺失时阻止进入工作流，降低空材料生成风险

### 证据材料与事实时间线
- 自动解析 PDF、Word、图片材料
- 生成证据材料目录，展示材料摘要和解析状态
- 从材料正文识别日期事实，形成事实时间线
- Word 导出中自动包含证据目录和事实时间线

### 五阶段工作流
1. 案件要素提取：提取当事人、关键事实、时间线、证据清单
2. 法律关系分析：分析法律关系、适用规则、权利义务和风险点
3. 争议焦点整理：梳理事实争议、法律争议和证据关键点
4. 文书初稿生成：生成诉状、仲裁申请书等法律文书初稿
5. 审查与优化：检查逻辑、法律依据、完整性和表达质量

### 可信输出约束
- 生成内容默认附加可信度要求
- 要求基于材料和前序阶段输出，不得编造事实或证据
- 要求标注依据材料或来源
- 要求列出“需人工核验事项”
- 法条、金额和诉讼策略必须提示律师复核

### 版本管理与导出
- 每个工作流阶段保留版本历史
- 支持回滚到任意历史版本
- 支持手动编辑生成结果并保存
- 单案导出 Word 文档
- 多案批量导出 zip
- 导出前校验全部阶段是否完成

### 模型渠道管理
- 支持 OpenAI 兼容接口
- 支持多渠道配置、连通性测试和模型拉取
- 工作流生成时可选择不同渠道和模型
- 支持流式输出生成结果

## 系统架构

![LegalDocGen 系统架构](https://raw.githubusercontent.com/StanlySGY/LegalDocGen/main/docs/architecture.svg)

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- React Markdown
- 原生 CSS 响应式布局

### 后端
- FastAPI
- SQLAlchemy
- Pydantic
- python-docx
- pdfplumber
- Pillow

### 数据与存储
- SQLite 默认数据库
- 本地文件系统存储上传材料
- 可扩展至 PostgreSQL 与对象存储

## 快速开始

### 前置要求
- Python 3.8+
- Node.js 16+
- 至少一个 OpenAI 兼容模型 API Key

### 1. 克隆项目

```bash
git clone https://github.com/StanlySGY/LegalDocGen.git
cd LegalDocGen
```

### 2. 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

按需编辑 `backend/.env`：

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4o
DATABASE_URL=sqlite:///./legaldocgen.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
```

### 3. 安装依赖

后端：

```bash
cd backend
pip install -r requirements.txt
```

前端：

```bash
cd frontend
npm install
```

### 4. 启动应用

推荐使用启动脚本：

```bash
chmod +x start.sh
./start.sh
```

也可以手动启动：

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
npm run dev
```

访问地址：
- 前端：http://localhost:5173
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs

## 部署说明

本项目是 React 前端 + FastAPI 后端的全栈应用。

### 前端
可部署到 Vercel、Netlify 等静态托管平台。当前线上预览地址：

https://legal-doc-gen-wine.vercel.app/

如需连接真实后端，请在前端部署平台配置后端 API 地址，并确保代理或环境变量与实际部署方式一致。

### 后端
后端需要部署到支持 Python Web 服务的平台，例如 Railway、Render、Fly.io 或自有服务器。

生产环境建议：
- 使用 PostgreSQL 替代 SQLite
- 使用对象存储保存上传材料
- 使用 HTTPS
- 配置反向代理与 CORS 白名单
- 对 API Key 进行加密存储

## 使用流程

### 创建案件
1. 进入案件管理页
2. 点击“新建案件”
3. 填写案件名称、类型、描述
4. 选择案件模板
5. 创建后进入案件详情

### 上传和整理材料
1. 在案件详情页上传 PDF、Word 或图片
2. 查看材料解析状态
3. 查看材料齐备度
4. 查看证据材料目录和事实时间线

### 执行工作流
1. 点击“进入工作流”
2. 按顺序完成五个阶段
3. 每个阶段可编辑 Prompt 并选择模型
4. 生成结果可编辑、复制、回滚
5. 后续阶段会自动引用前序阶段输出

### 导出文档
1. 完成全部工作流阶段
2. 点击“导出为 Word”
3. 下载包含案件信息、证据目录、事实时间线、阶段输出和元数据的文档

## API 概览

### 案件管理
- `GET /api/cases`：案件列表，支持状态、关键词、类型、模板筛选
- `POST /api/cases`：创建案件
- `GET /api/cases/{case_id}`：案件详情
- `PUT /api/cases/{case_id}`：更新案件
- `DELETE /api/cases/{case_id}`：删除案件
- `POST /api/cases/batch-delete`：批量删除案件

### 材料管理
- `POST /api/materials/upload/{case_id}`：上传材料
- `GET /api/materials/case/{case_id}`：案件材料列表
- `GET /api/materials/case/{case_id}/catalog`：证据目录与事实时间线
- `DELETE /api/materials/{material_id}`：删除材料

### 工作流
- `GET /api/workflow/progress/{case_id}`：工作流进度
- `GET /api/workflow/node/{case_id}/{stage}`：阶段节点
- `POST /api/workflow/generate/{case_id}`：普通生成
- `POST /api/workflow/generate-stream/{case_id}`：流式生成
- `GET /api/workflow/history/{case_id}/{stage}`：版本历史
- `POST /api/workflow/rollback/{case_id}`：回滚版本
- `POST /api/workflow/save-output/{case_id}/{stage}`：保存编辑结果
- `GET /api/workflow/export/{case_id}`：导出单案 Word
- `POST /api/workflow/export-batch`：批量导出 zip

- `GET /api/audit`：审计日志列表

### 模板与渠道
- `GET /api/templates/list`：模板列表
- `GET /api/templates/{template_id}`：模板详情
- `POST /api/templates/create`：创建模板
- `GET /api/channel`：渠道列表
- `POST /api/channel`：创建渠道
- `POST /api/channel/test/{channel_id}`：测试渠道
- `GET /api/channel/fetch_models/{channel_id}`：拉取渠道模型

## 项目结构

```text
LegalDocGen/
├── backend/
│   ├── models/              # 数据模型
│   ├── routers/             # API 路由
│   ├── services/            # 业务服务
│   │   ├── file_parser/     # 文件解析
│   │   ├── model_dispatcher/# 模型调度
│   │   ├── prompt_manager/  # Prompt 管理
│   │   ├── workflow_engine/ # 工作流引擎
│   │   └── export_service.py
│   ├── main.py
│   ├── database.py
│   └── config.py
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 与前端服务
│   │   ├── types/           # 类型定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── docs/
│   └── architecture.svg
├── start.sh
├── vercel.json
└── README.md
```

## 已完成优化

- 案件模板绑定和模板 Prompt 优先级
- 材料清单齐备度检查
- 工作流前序阶段校验
- 工作流状态自动同步
- 生成结果保存、复制、历史和回滚
- Word 导出与批量 zip 导出
- 证据目录和事实时间线
- 基础审计日志和审计日志页面
- 上传文件名安全处理
- 材料预览 XSS 风险修复
- 统一错误提示
- 基础响应式布局

## 后续优化方向

仍可继续推进的长期优化包括：
- 用户登录、角色权限和团队协作
- 更完整的操作审计日志检索与导出
- API Key 加密存储
- PostgreSQL 迁移与正式数据库迁移工具
- 对象存储接入
- 后台任务队列和长任务进度
- 文书模板库与法院/仲裁场景模板细分
- 更严格的证据引用定位和页码级来源标注
- 自动化测试覆盖率提升

## 安全建议

- 不要提交 `.env` 或真实 API Key
- 生产环境使用 HTTPS
- 限制上传文件大小和格式
- 上传目录应与代码目录隔离
- 生产环境建议启用用户认证和权限控制
- 生产环境建议使用 PostgreSQL 与对象存储

## 故障排除

### 无法连接模型 API
- 检查渠道配置和 API Key
- 检查 Base URL 是否为 OpenAI 兼容格式
- 使用渠道管理中的测试功能确认连通性

### 上传材料失败
- 检查文件格式是否受支持
- 检查文件大小是否超过限制
- 检查后端上传目录权限

### 生成失败或结果为空
- 确认已上传可解析材料
- 确认前序阶段已完成
- 检查模型渠道是否可用
- 查看后端日志和浏览器控制台

### 无法导出
- 确认五个工作流阶段均已完成
- 确认后端安装 `python-docx`
- 批量导出时确认选中案件均已完成全部阶段

## 许可证

MIT License
