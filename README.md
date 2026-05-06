<div align="center">

# ⚖️ LegalDocGen

**AI 驱动的法律文书智能生成与审查系统**

一套面向律师的全流程法律文书工作台——从案件材料解析、法律关系分析到文书生成、多模型审查，以「分阶段可控」为核心设计哲学。

<!-- 🎬 录制 GIF 演示：上传 PDF → 一键生成 → 红线对比 → 导出 Word -->
<!-- 推荐工具：https://www.cockos.com/licecap/ 或 macOS 自带录屏 -->

```mermaid
graph LR
    subgraph 核心工作流
        A["📂 上传材料<br/>PDF/Word/图片"] --> B["🪜 五阶段生成<br/>梳理→分析→归纳→起草→审查"]
        B --> C["✏️ 红线对比<br/>类Word修订模式"]
        C --> D["📄 导出Word<br/>法院标准排版"]
    end
    style A fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style B fill:#eef2ff,stroke:#6366f1,color:#1e1b4b
    style C fill:#fef3c7,stroke:#f59e0b,color:#78350f
    style D fill:#dcfce7,stroke:#22c55e,color:#14532d
```

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br/>

[快速开始](#-快速开始) · [核心功能](#-核心功能) · [系统架构](#-系统架构) · [API 文档](#-api-文档) · [配置说明](#-配置说明)

</div>

---

## 👨‍⚖️ 给律师/终端用户

## 设计理念

> 律师的工作不是「一键生成文书」，而是**阅读 → 梳理 → 分析 → 起草 → 审查**的渐进过程。
> 每一步都需要人工判断与干预。

LegalDocGen 的核心设计原则：

- **分阶段可控** — 五阶段工作流，每步可独立执行、回滚、重新生成
- **人机协同** — AI 生成初稿，律师审核修改，不替代专业判断
- **多模型交叉** — 支持多模型审查链与版本对比，降低单一模型偏差
- **上下文感知** — 前序阶段输出自动注入后续 Prompt，保持案件连贯性

---

## 核心功能

### 📂 案件管理

| 功能 | 说明 |
|------|------|
| 案件 CRUD | 名称、案号、案由、管辖法院、立案日期等专业字段 |
| 材料上传 | PDF / Word / 图片，自动解析提取文本 |
| 当事人管理 | 手动录入或 AI 从材料中自动提取 |
| 案例检索 | 按名称、案号、案由、状态多维筛选 |
| 批量操作 | 批量删除、状态筛选 |

### 🪜 五阶段工作流

```mermaid
graph LR
    A["📋 案件梳理"] --> B["⚖️ 法律分析"]
    B --> C["🎯 争议归纳"]
    C --> D["📝 文书生成"]
    D --> E["🔍 审查优化"]

    A -.- A1["当事人 · 事实经过\n时间线 · 证据清单"]
    B -.- B1["法律关系 · 适用法律\n风险评估 · 有利/不利"]
    C -.- C1["核心焦点 · 各方主张\n胜诉评估"]
    D -.- D1["起诉状 · 答辩状\n代理词 · 律师函"]
    E -.- E1["形式审查 · 实体审查\n链式审查 · 多版本对比"]

    style A fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b
    style B fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b
    style C fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b
    style D fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b
    style E fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b
    style A1 fill:#f8fafc,stroke:#cbd5e1,color:#475569
    style B1 fill:#f8fafc,stroke:#cbd5e1,color:#475569
    style C1 fill:#f8fafc,stroke:#cbd5e1,color:#475569
    style D1 fill:#f8fafc,stroke:#cbd5e1,color:#475569
    style E1 fill:#f8fafc,stroke:#cbd5e1,color:#475569
```

```mermaid
graph LR
    subgraph 每阶段能力
        direction LR
        E["✏️ 编辑 Prompt"] --> R["🔄 重新生成"]
        R --> V["📜 版本回滚"]
        V --> S["⚡ 流式输出"]
        S --> L["🔒 阶段锁定"]
    end

    style E fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style R fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style V fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style S fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style L fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
```

### 🤖 多模型审查

```mermaid
graph TB
    subgraph 单模型
        A1["Prompt"] --> A2["模型 A"] --> A3["输出"]
    end

    subgraph 链式审查
        B1["Prompt"] --> B2["模型 A<br/>生成初稿"]
        B2 --> B3["模型 B<br/>审查问题"]
        B3 --> B4["模型 C<br/>优化定稿"]
    end

    subgraph 多版本对比
        C1["Prompt"] --> C2["模型 A"]
        C1 --> C3["模型 B"]
        C1 --> C4["模型 C"]
        C2 --> C5["对比面板<br/>择优采纳"]
        C3 --> C5
        C4 --> C5
    end

    style A1 fill:#f8fafc,stroke:#94a3b8,color:#475569
    style A2 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style A3 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style B1 fill:#f8fafc,stroke:#94a3b8,color:#475569
    style B2 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style B3 fill:#fef3c7,stroke:#f59e0b,color:#78350f
    style B4 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style C1 fill:#f8fafc,stroke:#94a3b8,color:#475569
    style C2 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style C3 fill:#fef3c7,stroke:#f59e0b,color:#78350f
    style C4 fill:#ede9fe,stroke:#8b5cf6,color:#4c1d95
    style C5 fill:#dcfce7,stroke:#22c55e,color:#14532d
```

| 模式 | 说明 |
|------|------|
| **单模型** | 传统单次生成 |
| **链式审查** | 模型 A 生成 → 模型 B 审查 → 模型 C 优化，三步流水线 |
| **多版本对比** | N 个模型并行生成，左右对比后择优采纳 |

### 📝 文书编辑器

- 三栏布局：参考面板 · 编辑区 · 实时预览
- AI 辅助编辑：选中文字后浮动工具栏（润色 / 补充法律依据 / 改写 / 精简 / 展开论述 / 对方律师挑刺 / 法官风险评估 / 自定义指令）
- **红线对比**：类 Word 修订模式，红色删除线 + 绿色下划线，律师一目了然
- 防幻觉警告：提醒用户核实 AI 引用的法条和案例
- 撤销栈：Ctrl+Z 多级撤销
- 模板保存/加载：复用常用文书格式
- 导出 Word：标准排版 / **法院标准排版**（方正小标宋 + 仿宋_GB2312 + 28磅行距）

### 📊 案件画像

- 步骤向导：上传材料 → 确认当事人 → 选择文书类型 → 一键生成
- 时间线可视化：自动从材料中提取事件并图形化展示
- 当事人卡片：角色标签、证件号、住址、电话
- 进度概览：五阶段完成状态一目了然

### 🌐 渠道管理

- 多渠道配置：OpenAI / Claude / 自定义 API（兼容 OpenAI 格式）
- 模型自动发现：调用 `/v1/models` 获取可用模型列表
- 连接测试：一键验证渠道可用性
- 优先级调度：多渠道按优先级自动路由

---

## 👨‍💻 给开发者

## 系统架构

```mermaid
graph TB
    subgraph Frontend["🖥️ 前端 · React 18 + TypeScript + Tailwind CSS"]
        direction LR
        P1["📂 案件管理"] --- P2["🪜 工作流"]
        P3["📝 文书编辑"] --- P4["🌐 渠道管理"]
        P5["👥 当事人"] --- P6["📋 Prompt 模板"]
    end

    subgraph Backend["⚙️ 后端 · FastAPI + Uvicorn"]
        direction LR
        S1["🔄 工作流引擎<br/>阶段编排 · 版本管理 · 锁定控制"]
        S2["🤖 模型调度器<br/>多渠道路由 · 流式输出 · 连接池"]
        S3["📄 文件解析器<br/>PDF · Word · OCR"]
        S4["🔍 审查编排器<br/>链式审查 · 多版本对比"]
        S5["📝 Prompt 管理<br/>模板 CRUD · 文书类型"]
        S6["🏗️ 结构化器<br/>要素提取 · 时间线解析"]
    end

    subgraph Database["💾 数据层 · SQLAlchemy + SQLite / PostgreSQL"]
        direction LR
        DB[("数据库")]
        T1["cases"] --> DB
        T2["materials"] --> DB
        T3["workflow_nodes"] --> DB
        T4["channels"] --> DB
        T5["parties"] --> DB
        T6["review_results"] --> DB
    end

    Frontend -->|"REST API + SSE 流式"| Backend
    Backend --> Database

    style Frontend fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    style Backend fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#14532d
    style Database fill:#fefce8,stroke:#eab308,stroke-width:2px,color:#422006
    style P1 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style P2 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style P3 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style P4 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style P5 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style P6 fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style S1 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style S2 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style S3 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style S4 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style S5 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style S6 fill:#dcfce7,stroke:#22c55e,color:#14532d
    style DB fill:#fef9c3,stroke:#eab308,color:#422006
    style T1 fill:#fef9c3,stroke:#eab308,color:#422006
    style T2 fill:#fef9c3,stroke:#eab308,color:#422006
    style T3 fill:#fef9c3,stroke:#eab308,color:#422006
    style T4 fill:#fef9c3,stroke:#eab308,color:#422006
    style T5 fill:#fef9c3,stroke:#eab308,color:#422006
    style T6 fill:#fef9c3,stroke:#eab308,color:#422006
```

```mermaid
graph LR
    subgraph 数据流
        direction LR
        A["📂 上传材料"] -->|"PDF/Word/图片"| B["📄 解析提取"]
        B -->|"结构化文本"| C["🪜 工作流引擎"]
        C -->|"Prompt + 上下文"| D["🤖 模型调用"]
        D -->|"流式输出"| E["📝 人工审核"]
        E -->|"确认/修改"| F["💾 保存版本"]
        F -->|"导出"| G["📄 Word 文档"]
    end

    style A fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style B fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style C fill:#eef2ff,stroke:#6366f1,color:#1e1b4b
    style D fill:#eef2ff,stroke:#6366f1,color:#1e1b4b
    style E fill:#fef3c7,stroke:#f59e0b,color:#78350f
    style F fill:#dcfce7,stroke:#22c55e,color:#14532d
    style G fill:#dcfce7,stroke:#22c55e,color:#14532d
```

---

## 🐳 Docker 一键部署（推荐）

```bash
git clone https://github.com/StanlySGY/LegalDocGen.git
cd LegalDocGen
docker-compose up -d
```

访问 http://localhost:3000 即可使用。

## 快速开始
> 💡 推荐使用 Docker 部署，无需安装 Python/Node 环境。见上方「Docker 一键部署」。

### 前置条件

- Python 3.11+
- Node.js 18+
- 至少一个 AI 模型 API Key

### 1. 克隆项目

```bash
git clone https://github.com/StanlySGY/LegalDocGen.git
cd LegalDocGen
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 .env，填入你的 API Key（可在系统界面中配置，也可在此预设）
```

### 3. 启动服务

```bash
chmod +x start.sh
./start.sh
```

### 4. 访问系统

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:5173 |
| 后端 API | http://localhost:8002 |
| API 文档 (Swagger) | http://localhost:8002/docs |
| API 文档 (ReDoc) | http://localhost:8002/redoc |

---

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite:///./legaldocgen.db` |
| `UPLOAD_DIR` | 文件上传目录 | `uploads` |
| `MAX_FILE_SIZE` | 最大文件大小 | `50MB` |

> 💡 模型 API Key 无需在 `.env` 中配置，可通过前端「渠道管理」页面在线添加。

### 支持的文书类型

| 文书类型 | 适用场景 |
|----------|----------|
| 民事起诉状 | 原告提起民事诉讼 |
| 民事答辩状 | 被告回应诉讼 |
| 代理词 | 代理人发表代理意见 |
| 辩护词 | 刑事辩护律师辩护 |
| 律师函 | 向对方发送法律告知 |
| 法律意见书 | 出具专业法律分析 |
| 证据目录 | 编制证据清单 |
| 质证意见 | 对对方证据发表质证 |
| 合同审查意见书 | 合同条款审查分析 |

---

## API 文档

启动后访问 http://localhost:8002/docs 查看完整的 Swagger API 文档。

核心 API 端点：

| 模块 | 端点 | 说明 |
|------|------|------|
| 案件 | `POST /api/cases` | 创建案件 |
| 材料 | `POST /api/materials/upload/{id}` | 上传材料 |
| 工作流 | `POST /api/workflow/generate-stream/{id}` | 流式生成 |
| 工作流 | `POST /api/workflow/review-chain/{id}` | 链式审查 |
| 工作流 | `POST /api/workflow/export/{id}` | 导出 Word |
| 渠道 | `GET /api/channel/fetch_models/{id}` | 发现模型 |
| 当事人 | `POST /api/parties/extract/{id}` | AI 提取当事人 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Tailwind CSS · Vite · React Router 6 · React Markdown |
| 后端 | FastAPI · SQLAlchemy · Pydantic · Uvicorn |
| 文件解析 | pdfplumber · python-docx · pytesseract / easyocr |
| AI 集成 | OpenAI SDK · Anthropic SDK · httpx（通用 OpenAI 兼容接口） |
| 数据库 | SQLite（默认）· 可切换 PostgreSQL |
| 导出 | python-docx（Word 文档生成） |

---

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
│   │   └── structurer/         #   结构化器
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx             # 路由与布局
│       ├── pages/              # 页面组件
│       ├── components/         # 通用组件
│       ├── services/api.ts     # API 客户端
│       └── types/              # TypeScript 类型
├── start.sh                    # 一键启动脚本
└── README.md
```

---

## 🔒 安全与隐私

- **本地部署**：系统完全开源，所有数据存储在您本地的 SQLite 数据库中
- **不收集数据**：本系统不收集、不上传任何用户数据
- **API 数据流向**：调用 AI 模型时，案件内容会直接发送至您配置的大模型服务商（如 OpenAI、Claude），不经过任何中间服务器
- **一键脱敏**：支持自动替换身份证号、手机号、姓名等敏感信息
- **建议**：处理涉密案件时，请使用自建的大模型服务或本地模型

---

## 许可证

MIT License

---

<div align="center">

**Built with ⚖️ for legal professionals**

</div>
