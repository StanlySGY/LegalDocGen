# 法律文书智能生成与审查系统

一个为法律专业人士设计的AI驱动的法律文书生成和审查平台。支持多模型协同、版本管理、材料检查清单等功能。

## 🔗 在线预览

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?framework=other&hasTrialAvailable=1&id=1225314281&name=LegalDocGen&owner=StanlySGY&project-name=legal-doc-gen&provider=github&remainingProjects=1&s=https%3A%2F%2Fgithub.com%2FStanlySGY%2FLegalDocGen&teamSlug=stanlysgys-projects&totalProjects=1)

> **注意**: 本项目是全栈应用（React 前端 + FastAPI 后端）。Vercel 可以部署前端，后端需要单独部署到支持 Python 的平台（如 Railway、Render、Heroku 等）。

## ✨ 核心特性

### 🎯 分阶段工作流
系统将法律文书生成分为5个关键阶段，每个阶段都可独立操作：

1. **案件要素提取** - 从上传的材料中自动提取当事人、事实、时间线等核心信息
2. **法律关系分析** - 分析法律关系、适用法律条款、潜在风险点
3. **争议焦点整理** - 梳理和整理核心争议点
4. **文书初稿生成** - 基于前面阶段的分析生成完整法律文书初稿
5. **审查与优化** - 多模型交叉审查和优化最终文书

### 📋 案件模板系统
预置5种常见法律案件类型的模板，每个模板包含：
- 所需材料清单（必需/可选）
- 各阶段预配置Prompt
- 材料上传进度追踪

支持的案件类型：
- 合同纠纷案件
- 劳动争议案件
- 婚姻家庭案件
- 知识产权案件
- 房产纠纷案件

### 🔄 版本管理与回溯
- 每个工作流阶段支持版本历史
- 一键回滚到任意历史版本
- 完整的修改记录和时间戳

### 📥 导出功能
- 支持导出为Word文档（.docx）
- 自动生成包含所有阶段输出的完整文档
- 包含案件信息、模型信息、生成时间等元数据

### 🤖 多模型支持
- **OpenAI** - GPT-4o等最新模型
- **Claude** - Anthropic的Claude系列
- **自定义API** - 支持兼容OpenAI格式的任何API

### 📄 文件处理
支持多种文件格式：
- PDF文档
- Word文档 (.doc, .docx)
- 图片 (.jpg, .jpeg, .png)

自动解析文件内容并用于工作流上下文。

### 💬 流式输出
实时流式输出生成结果，提供更好的用户体验。

### ✏️ 灵活编辑
- 每个阶段都可以手动编辑生成的内容
- 修改Prompt后重新生成
- 支持复制输出内容

## 🚀 快速开始

### 前置要求
- Python 3.8+
- Node.js 16+
- 至少一个AI模型API Key（OpenAI、Claude等）

### 方式一：本地运行（推荐用于开发）

#### 1. 克隆项目
```bash
git clone https://github.com/yourusername/LegalDocGen.git
cd LegalDocGen
```

#### 2. 配置环境变量
```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env` 文件，填入你的API配置：
```env
# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4o

# Claude配置（可选）
CLAUDE_API_KEY=your_claude_api_key

# 自定义API（可选）
CUSTOM_API_KEY=your_custom_api_key
CUSTOM_BASE_URL=https://your-api-endpoint.com
CUSTOM_MODEL_NAME=your-model-name

# 数据库配置
DATABASE_URL=sqlite:///./legaldocgen.db

# 文件上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50MB
```

#### 3. 安装依赖

**后端：**
```bash
cd backend
pip install -r requirements.txt
```

**前端：**
```bash
cd frontend
npm install
```

#### 4. 启动应用

**方式一：使用启动脚本（推荐）**
```bash
chmod +x start.sh
./start.sh
```

**方式二：手动启动**

后端：
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

前端：
```bash
cd frontend
npm run dev
```

### 5. 访问应用
- **前端UI**: http://localhost:5173
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs (Swagger UI)

### 方式二：云部署（Vercel + Railway/Render）

#### 前端部署到 Vercel

1. 点击下方按钮一键部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?framework=other&hasTrialAvailable=1&id=1225314281&name=LegalDocGen&owner=StanlySGY&project-name=legal-doc-gen&provider=github&remainingProjects=1&s=https%3A%2F%2Fgithub.com%2FStanlySGY%2FLegalDocGen&teamSlug=stanlysgys-projects&totalProjects=1)

2. 部署后配置环境变量：
   - 进入 Vercel 项目设置 → Environment Variables
   - 添加 `VITE_API_BASE_URL`，值为你的后端 API 地址（如 `https://your-backend.railway.app`）
   - 重新部署前端

3. 或手动部署：
   - 连接你的 GitHub 账户
   - 选择 LegalDocGen 仓库
   - 设置环境变量（如需要）
   - 点击 Deploy

#### 后端部署到 Railway/Render

后端需要部署到支持 Python 的平台。推荐使用 Railway 或 Render：

**Railway 部署步骤：**
1. 访问 https://railway.app
2. 连接 GitHub 账户
3. 创建新项目，选择 LegalDocGen 仓库
4. 配置环境变量（OPENAI_API_KEY 等）
5. 自动部署

**Render 部署步骤：**
1. 访问 https://render.com
2. 连接 GitHub 账户
3. 创建新的 Web Service
4. 选择 LegalDocGen 仓库
5. 设置启动命令：`cd backend && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000`
6. 配置环境变量
7. 部署

## 📖 使用指南

### 创建新案件
1. 点击「新建案件」按钮
2. 填写案件基本信息（名称、类型、描述）
3. 选择合适的案件模板（可选）
4. 点击「创建」

### 上传材料
1. 进入案件详情页
2. 在「案件材料」卡片中点击「+ 上传材料」
3. 选择PDF、Word或图片文件
4. 系统自动解析文件内容

### 执行工作流
1. 点击「进入工作流」按钮
2. 在左侧选择工作流阶段
3. 配置Prompt（可使用默认或自定义）
4. 选择AI模型和API渠道
5. 点击「开始生成」或「重新生成」
6. 查看实时流式输出结果

### 编辑和回滚
- **编辑**：点击「编辑」按钮修改生成的内容
- **回滚**：点击「历史」查看版本历史，选择版本后点击「回滚」
- **复制**：点击「复制」按钮复制输出内容到剪贴板

### 导出文档
1. 完成所有工作流阶段
2. 点击「📥 导出为 Word」按钮
3. 自动下载包含所有阶段输出的Word文档

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                 React 18 + TypeScript 前端                │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ 案件管理 │ 材料上传 │ 工作流   │ 模型配置 │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────┐
│                    FastAPI 后端                           │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ 文件解析 │ 工作流   │ 模型调度 │ Prompt   │          │
│  │ 服务     │ 引擎     │ 器       │ 管理     │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
│  ┌──────────┬──────────┬──────────┐                     │
│  │ 案件模板 │ 错误处理 │ 导出服务 │                     │
│  └──────────┴──────────┴──────────┘                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│           SQLAlchemy + SQLite 数据库                      │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ 案件表   │ 材料表   │ 工作流表 │ 模板表   │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
└─────────────────────────────────────────────────────────┘
```

## 📊 数据库模型

### 主要表结构
- **cases** - 案件信息
- **materials** - 上传的材料文件
- **workflow_nodes** - 工作流各阶段的输出
- **case_templates** - 案件模板
- **channels** - AI模型API渠道配置
- **prompts** - Prompt模板

## 🔧 API端点

### 案件管理
- `GET /api/cases` - 获取案件列表
- `GET /api/cases/{id}` - 获取案件详情
- `POST /api/cases` - 创建案件
- `PUT /api/cases/{id}` - 更新案件
- `DELETE /api/cases/{id}` - 删除案件

### 材料管理
- `POST /api/materials/upload/{case_id}` - 上传材料
- `GET /api/materials/case/{case_id}` - 获取案件材料列表
- `DELETE /api/materials/{id}` - 删除材料

### 工作流
- `GET /api/workflow/progress/{case_id}` - 获取工作流进度
- `GET /api/workflow/node/{case_id}/{stage}` - 获取阶段输出
- `POST /api/workflow/generate/{case_id}` - 生成输出
- `POST /api/workflow/generate-stream/{case_id}` - 流式生成
- `POST /api/workflow/rollback/{case_id}` - 回滚版本
- `GET /api/workflow/history/{case_id}/{stage}` - 获取版本历史
- `POST /api/workflow/save-output/{case_id}/{stage}` - 保存输出
- `GET /api/workflow/export/{case_id}` - 导出为Word

### 模板管理
- `GET /api/templates/list` - 获取模板列表
- `GET /api/templates/{id}` - 获取模板详情
- `GET /api/templates/categories` - 获取模板分类
- `POST /api/templates/create` - 创建模板
- `PUT /api/templates/{id}` - 更新模板
- `DELETE /api/templates/{id}` - 删除模板

### 模型配置
- `GET /api/config/models` - 获取可用模型列表
- `GET /api/config/prompts` - 获取Prompt列表
- `POST /api/config/prompts` - 创建Prompt
- `PUT /api/config/prompts/{id}` - 更新Prompt
- `GET /api/config/stages` - 获取工作流阶段

### 渠道管理
- `GET /api/channel` - 获取渠道列表
- `GET /api/channel/{id}` - 获取渠道详情
- `POST /api/channel` - 创建渠道
- `PUT /api/channel/{id}` - 更新渠道
- `DELETE /api/channel/{id}` - 删除渠道
- `POST /api/channel/test/{id}` - 测试渠道连接
- `GET /api/channel/fetch_models/{id}` - 获取渠道可用模型

## 🛠️ 技术栈

### 前端
- **React 18** - UI框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Vite** - 构建工具

### 后端
- **FastAPI** - Web框架
- **SQLAlchemy** - ORM
- **Pydantic** - 数据验证
- **python-docx** - Word文档生成
- **pdfplumber** - PDF解析
- **Pillow** - 图片处理

### 数据库
- **SQLite** - 默认数据库（可配置为其他SQL数据库）

## 📝 项目结构

```
LegalDocGen/
├── backend/
│   ├── models/              # 数据库模型
│   ├── routers/             # API路由
│   ├── services/            # 业务逻辑服务
│   │   ├── workflow_engine/
│   │   ├── model_dispatcher/
│   │   ├── prompt_manager/
│   │   ├── file_parser/
│   │   ├── template_manager.py
│   │   └── export_service.py
│   ├── main.py              # 应用入口
│   ├── database.py          # 数据库配置
│   ├── config.py            # 配置管理
│   ├── exceptions.py        # 异常处理
│   └── requirements.txt     # 依赖列表
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API服务
│   │   ├── types/           # TypeScript类型定义
│   │   ├── App.tsx          # 主应用
│   │   └── main.tsx         # 入口文件
│   └── package.json
├── start.sh                 # 启动脚本
└── README.md
```

## 🔐 安全建议

1. **API Key管理**
   - 不要在代码中硬编码API Key
   - 使用环境变量存储敏感信息
   - 定期轮换API Key

2. **文件上传**
   - 系统限制文件大小为50MB
   - 仅支持特定文件格式
   - 文件存储在服务器本地

3. **数据库**
   - 定期备份数据库文件
   - 生产环境建议使用PostgreSQL等企业级数据库

## 🐛 故障排除

### 问题：无法连接API
**解决方案：**
- 检查API Key是否正确
- 检查网络连接
- 查看后端日志：`http://localhost:8000/docs`

### 问题：文件上传失败
**解决方案：**
- 检查文件格式是否支持
- 检查文件大小是否超过50MB
- 确保uploads目录有写入权限

### 问题：生成结果为空
**解决方案：**
- 确保已上传材料
- 检查Prompt是否正确
- 检查API配额是否充足

## 📞 支持

- 提交Issue：https://github.com/yourusername/LegalDocGen/issues
- 讨论：https://github.com/yourusername/LegalDocGen/discussions

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

**最后更新**: 2024年
**版本**: 1.0.0
