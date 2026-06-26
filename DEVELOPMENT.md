# 开发者文档

本文档面向开发者，包含技术架构、部署配置、二次开发等信息。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Tailwind CSS · Vite · React Router 6 · React Markdown |
| 后端 | FastAPI · SQLAlchemy · Pydantic · Uvicorn |
| 文件解析 | pdfplumber · python-docx · pytesseract / easyocr |
| AI 集成 | OpenAI SDK · Anthropic SDK · httpx（通用 OpenAI 兼容接口） |
| 数据库 | SQLite（默认）· 可切换 PostgreSQL |
| 导出 | python-docx（Word 文档生成） |

## 系统架构

```mermaid
graph TB
    subgraph Frontend["前端 · React 18 + TypeScript + Tailwind CSS"]
        direction LR
        P1["案件管理"] --- P2["工作流"]
        P3["文书编辑"] --- P4["助手配置"]
    end

    subgraph Backend["后端 · FastAPI + Uvicorn"]
        direction LR
        S1["工作流引擎<br/>阶段编排 · 版本管理 · 锁定控制"]
        S2["模型调度器<br/>多渠道路由 · 流式输出"]
        S3["文件解析器<br/>PDF · Word · OCR"]
        S4["审查编排器<br/>链式审查 · 多版本对比"]
        S5["证据提取器<br/>智能识别 · 证明目的推导"]
    end

    subgraph Database["数据层 · SQLAlchemy + SQLite"]
        direction LR
        DB[("数据库")]
        T1["cases"] --> DB
        T2["materials"] --> DB
        T3["workflow_nodes"] --> DB
        T4["channels"] --> DB
        T5["parties"] --> DB
    end

    Frontend -->|"REST API + SSE"| Backend
    Backend --> Database
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite:///./legaldocgen.db` |
| `UPLOAD_DIR` | 文件上传目录 | `uploads` |
| `MAX_FILE_SIZE` | 最大文件大小 | `50MB` |

> 模型 API Key 通过前端「助手配置」页面在线管理，无需配置环境变量。

## 项目结构

```
LegalDocGen/
├── backend/
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置管理
│   ├── database.py             # 数据库初始化
│   ├── seed.py                 # 示例数据
│   ├── models/                 # SQLAlchemy 模型
│   │   ├── case.py             #   案件
│   │   ├── material.py         #   材料
│   │   ├── workflow.py         #   工作流节点
│   │   ├── channel.py          #   API 渠道
│   │   ├── party.py            #   当事人
│   │   ├── prompt.py           #   Prompt 模板
│   │   ├── review.py           #   审查结果
│   │   └── template.py         #   文书模板
│   ├── routers/                # API 路由
│   ├── services/               # 业务服务
│   │   ├── workflow_engine/    #   工作流引擎
│   │   ├── model_dispatcher/   #   模型调度器
│   │   ├── file_parser/        #   文件解析
│   │   ├── prompt_manager/     #   Prompt 管理
│   │   ├── review_orchestrator/#   审查编排
│   │   ├── structurer/         #   结构化器
│   │   └── anonymizer/         #   脱敏服务
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx             # 路由与布局
│       ├── pages/              # 页面组件
│       ├── components/         # 通用组件
│       ├── services/api.ts     # API 客户端
│       └── types/              # TypeScript 类型
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── start.sh
└── start-docker.sh
```

## API 端点

| 模块 | 端点 | 说明 |
|------|------|------|
| 案件 | `POST /api/cases` | 创建案件 |
| 案件 | `GET /api/cases` | 列表（支持搜索/筛选） |
| 材料 | `POST /api/materials/upload/{id}` | 上传材料 |
| 材料 | `POST /api/materials/anonymize/{id}` | 一键脱敏 |
| 工作流 | `POST /api/workflow/generate-stream/{id}` | 流式生成 |
| 工作流 | `POST /api/workflow/review-chain/{id}` | 链式审查 |
| 工作流 | `POST /api/workflow/multi-compare/{id}` | 多版本对比 |
| 工作流 | `POST /api/workflow/export/{id}` | 导出 Word |
| 工作流 | `POST /api/workflow/verify-citation` | 核查法条 |
| 工作流 | `POST /api/workflow/extract-evidence/{id}` | 证据智能提取 |
| 工作流 | `POST /api/workflow/export-evidence-cover/{id}` | 证据封面页 |
| 渠道 | `POST /api/channel` | 添加 AI 助手 |
| 渠道 | `GET /api/channel/fetch_models/{id}` | 发现可用模型 |
| 当事人 | `POST /api/parties/extract/{id}` | AI 提取当事人 |

## 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8002

# 前端
cd frontend
npm install
npm run dev
```

## 数据库

默认使用 SQLite，数据库文件为 `legaldocgen.db`。如需切换 PostgreSQL：

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/legaldocgen
```

## Docker 部署

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

数据持久化：`./data` 目录存储数据库，`./uploads` 目录存储上传文件。
