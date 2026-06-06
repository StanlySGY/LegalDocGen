# LegalDocGen：个人律师办案与文书生成工作台

面向个人律师和法律专业人士的 AI 辅助办案工作台。系统围绕“建立案件 → 上传材料 → 证据整理 → 分阶段分析 → 文书生成 → 律师复核 → Word 导出”的完整链路设计，默认以个人律师日常办案为中心，减少团队、套餐、运营等平台化功能对主流程的干扰。

当前默认产品模式为 `personal_lawyer`：一级导航优先展示案件工作台、法条核验和后台任务；团队协作、用量限制、运营后台、渠道与 Prompt 配置作为高级设置保留，适合个人部署后由一名律师专业用户长期使用。

## 在线预览

[点击打开在线预览：LegalDocGen 个人律师办案工作台](https://legal-doc-gen-wine.vercel.app/)

> 说明：当前在线预览部署的是前端体验入口；完整 AI 生成、文件解析和导出能力依赖后端 API 与模型渠道配置。

## 核心能力

### 个人律师办案工作台
- 默认首页展示最近案件、待补材料、写作中案件和下一步动作
- 支持案件搜索、状态筛选、类型筛选、编辑、删除和批量操作
- 新建案件时强调案由、委托目标、目标文书和关键材料
- 草稿、进行中、已完成状态自动同步，帮助律师判断下一步应补材料、生成文书还是复核导出

### 案件模板与材料齐备度
- 内置民间借贷、合同纠纷、劳动争议、房产纠纷、侵权纠纷等案件模板入口
- 每类模板包含必需/可选材料清单和阶段 Prompt
- 上传材料后自动计算齐备度
- 必需材料缺失时阻止进入工作流，降低空材料生成和事实缺漏风险

### 证据材料、后台任务与事实时间线
- 自动解析 PDF、Word、图片材料
- 上传材料时记录解析任务，支持后台任务列表和失败原因查看
- 生成证据材料目录，展示材料摘要、解析状态和页码级引用
- 从材料正文识别日期事实，形成事实时间线
- Word 导出中自动包含证据目录、引用页码和事实时间线

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

### 模型渠道与法条核验
- 支持 OpenAI 兼容接口
- “AI 服务设置”支持多渠道配置、连通性测试和模型拉取
- 工作流生成时可选择不同渠道和模型
- 支持流式输出生成结果
- 支持本地法条库维护和《法律名称》第X条引用核验

### 登录权限、团队协作与试运营能力（可选）
- `AUTH_REQUIRED=false` 时保持单用户兼容模式，适合个人本地写作文书
- `AUTH_REQUIRED=true` 时要求登录后访问业务接口
- 普通成员仅能访问自己创建或所属团队可访问的案件，管理员可查看全部案件并管理渠道、模板和审计日志
- 团队创建、成员添加、角色调整和成员移除作为可选协作能力保留
- SaaS 套餐、订阅、用量配额和线下订单试运营闭环仍保留，但在个人律师模式下默认收纳到高级设置中
- 兼容旧版 `ADMIN_TOKEN`，用于保护渠道、模板、审计和 Prompt 写入等高风险接口

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
- SQLite 默认数据库，支持 PostgreSQL 连接配置
- Alembic 基线迁移脚本
- 本地文件系统存储上传材料，已封装存储服务抽象
- 健康检查返回数据库、渠道和存储状态

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
STORAGE_BACKEND=local
MAX_FILE_SIZE=52428800
CORS_ORIGINS=http://localhost:5173
ADMIN_TOKEN=change-me-in-production
API_KEY_SECRET=replace-with-a-long-random-secret
AUTH_REQUIRED=false
AUTH_SECRET=replace-with-another-long-random-secret
ALLOW_USER_REGISTRATION=true
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=
```

前端默认使用个人律师模式，无需额外配置。如需切回平台/团队化展示，可在前端部署环境中设置：

```env
VITE_PRODUCT_MODE=platform
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
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8002
```

```bash
cd frontend
npm run dev
```

访问地址：
- 前端：http://localhost:5173
- 后端：http://localhost:8002
- API 文档：http://localhost:8002/docs
- 健康检查：http://localhost:8002/api/health

## 部署说明

本项目是 React 前端 + FastAPI 后端的全栈应用。

### 前端
可部署到 Vercel、Netlify 等静态托管平台。当前线上预览地址：

https://legal-doc-gen-wine.vercel.app/

如需连接真实后端，请在 Vercel 项目中配置 `VITE_API_BASE_URL`，值为后端 API 根地址，例如：

```env
VITE_API_BASE_URL=https://your-backend.example.com/api
VITE_PRODUCT_MODE=personal_lawyer
```

如果没有配置真实后端，在线预览只展示前端界面；涉及 `/api` 的请求不会返回 JSON，旧版本会出现 `Unexpected token '<'`，当前版本会显示更明确的“后端 API 未连接或地址配置错误”提示。

### 个人律师部署建议

适合只给一名律师或小范围内部用户使用的部署方式：

1. 保持 `VITE_PRODUCT_MODE=personal_lawyer`，默认进入个人律师办案工作台。
2. 若只在本机或内网使用，可保持 `AUTH_REQUIRED=false`；若部署到公网，建议设置 `AUTH_REQUIRED=true`。
3. 预先在“AI 服务设置”中配置模型渠道，避免律师用户直接处理 API Key 和模型参数。
4. 定期备份数据库与上传材料目录，防止案件材料和生成记录丢失。
5. 使用 HTTPS、强随机 `AUTH_SECRET`、`API_KEY_SECRET` 和 `ADMIN_TOKEN`。

### 后端
后端需要部署到支持 Python Web 服务的平台，例如 Railway、Render、Fly.io 或自有服务器。

生产环境建议：
- 使用 PostgreSQL 替代 SQLite
- 使用对象存储保存上传材料
- 使用 HTTPS
- 配置反向代理与 CORS 白名单
- 对 API Key 进行加密存储
- 设置 `AUTH_REQUIRED=true` 启用登录访问控制，并配置高强度 `AUTH_SECRET`
- 如需默认管理员，可配置 `DEFAULT_ADMIN_USERNAME` 与 `DEFAULT_ADMIN_PASSWORD`，首次启动后建议清空默认密码配置
- 配置 `ADMIN_TOKEN` 保护渠道、审计和高风险配置接口，也可使用管理员账号 Bearer Token
- 配置 `API_KEY_SECRET`，用于本地加密保存模型渠道 API Key

### 团队/试运营部署

本项目仍保留团队协作、套餐配额、线下订单和运营后台能力。需要做小规模团队试运营时，可使用 Docker 方式运行独立后端和 PostgreSQL：

```bash
cp backend/.env.example backend/.env
# 按需修改 backend/.env 中的数据库、CORS、认证密钥和模型渠道
```

使用 Docker Compose 启动后端和 PostgreSQL：

```bash
docker compose up --build
```

后端容器启动时会执行：

```bash
python -m alembic upgrade head
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

试运营检查清单：
1. `DATABASE_URL` 指向 PostgreSQL。
2. `AUTH_REQUIRED=true`，并设置高强度 `AUTH_SECRET`、`API_KEY_SECRET`、`ADMIN_TOKEN`。
3. `CORS_ORIGINS` 只包含真实前端域名。
4. Vercel/Netlify 配置 `VITE_API_BASE_URL=https://你的后端域名/api`。
5. 执行 `python -m alembic upgrade head` 后再开放后端访问。
6. 打开 `/api/health`，确认数据库和存储状态正常。
7. 如需验证商业化流程，使用管理员账号进入“运营后台”，创建线下订单并标记已支付，确认目标团队套餐生效。

### 数据库迁移

默认本地开发仍可直接使用自动建表；生产环境建议使用 Alembic 管理 PostgreSQL 迁移：

```bash
python -m alembic upgrade head
```

如需切换 PostgreSQL，将 `DATABASE_URL` 配置为 `postgresql+psycopg://user:password@host:5432/dbname`。

## 使用流程

### 创建案件
1. 进入“案件工作台”
2. 点击“新建案件”
3. 填写案件名称、案件类型、办案目标与目标文书
4. 选择案由模板
5. 创建后进入案件详情

### 上传和整理材料
1. 在案件详情页上传 PDF、Word 或图片
2. 查看材料解析状态和解析任务编号
3. 查看材料齐备度
4. 查看证据材料目录、引用页码和事实时间线

### 执行工作流
1. 点击“进入工作流”
2. 按顺序完成五个阶段
3. 每个阶段可编辑 Prompt 并选择模型
4. 生成结果可编辑、复制、回滚
5. 后续阶段会自动引用前序阶段输出

### 任务、法条与可选协作
1. 在“后台任务”中查看材料解析任务状态和失败原因
2. 在“法条核验”中维护本地法条库，并核验文书中的法条引用
3. 如需多人协作，可在“高级设置 / 可选协作”中创建团队、添加成员并分配角色

### 导出文档
1. 完成全部工作流阶段
2. 点击“导出为 Word”
3. 下载包含案件信息、证据目录、引用页码、事实时间线、阶段输出和元数据的文档

## API 概览

### 认证与用户
- `POST /api/auth/login`：用户登录，返回 Bearer Token
- `POST /api/auth/register`：用户注册，首个注册用户自动成为管理员
- `GET /api/auth/me`：当前登录用户与认证开关状态
- `GET /api/auth/users`：管理员查看用户列表
- `PUT /api/auth/users/{user_id}`：管理员更新用户角色或启停状态

### 团队协作
- `GET /api/teams`：当前用户可访问团队列表
- `POST /api/teams`：创建团队
- `GET /api/teams/{team_id}/members`：团队成员列表
- `POST /api/teams/{team_id}/members`：添加团队成员
- `PUT /api/teams/{team_id}/members/{user_id}`：更新成员角色
- `DELETE /api/teams/{team_id}/members/{user_id}`：移除团队成员

### 计费、用量与运营
- `GET /api/billing/plans`：查看启用套餐
- `GET /api/billing/status`：查看当前团队订阅、套餐和用量
- `PUT /api/billing/teams/{team_id}/subscription`：管理员切换目标团队套餐或订阅状态
- `GET /api/billing/operations/summary`：管理员查看团队、订阅、订单和模拟收入汇总
- `GET /api/billing/operations/orders`：管理员查看线下订单列表，支持状态筛选
- `POST /api/billing/operations/orders`：管理员创建线下订单
- `PUT /api/billing/operations/orders/{order_id}`：管理员更新订单状态，标记已支付后开通套餐

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
- `GET /api/materials/case/{case_id}/catalog`：证据目录、页码引用与事实时间线
- `GET /api/materials/tasks/{task_id}`：材料解析任务详情
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

### 任务、审计与法条
- `GET /api/tasks`：管理员查看后台任务列表
- `GET /api/tasks/{task_id}`：查看任务详情
- `GET /api/audit`：审计日志列表
- `GET /api/legal-articles`：查询本地法条库
- `POST /api/legal-articles`：管理员维护法条
- `POST /api/legal-articles/verify`：核验文本中的法条引用
- `DELETE /api/legal-articles/{article_id}`：管理员删除法条

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
│   ├── alembic/             # 数据库迁移
│   ├── models/              # 数据模型
│   ├── routers/             # API 路由
│   ├── services/            # 业务服务
│   │   ├── file_parser/     # 文件解析
│   │   ├── model_dispatcher/# 模型调度
│   │   ├── prompt_manager/  # Prompt 管理
│   │   ├── workflow_engine/ # 工作流引擎
│   │   └── export_service.py
│   ├── tests/               # 自动化测试
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
├── alembic.ini
├── pytest.ini
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
- 证据目录、页码级引用和事实时间线
- 团队协作、团队成员管理和团队案件访问
- 后台任务记录与任务监控页面
- 本地法条库维护和法条引用核验
- 个人律师模式导航、首页空状态和新建案件引导
- PostgreSQL 兼容配置与 Alembic 基线迁移
- 对象存储抽象和存储健康诊断
- pytest 自动化测试骨架与新增核心能力测试
- 基础审计日志和审计日志页面
- API Key 本地加密存储与脱敏展示
- CORS 环境化配置和可选管理 Token
- 上传文件名安全处理
- 材料预览 XSS 风险修复
- 统一错误提示
- SaaS 套餐、订阅、用量配额和线下订单试运营闭环
- 运营后台、订单状态流转和模拟收入汇总
- Docker Compose 试运营部署入口和 GitHub Actions CI
- 基础响应式布局

## 后续优化方向

仍可继续推进的长期优化包括：
- 更完整的操作审计日志检索与导出
- S3、OSS 等远端对象存储实现
- Celery、RQ 或云队列驱动的异步任务执行器
- 文书模板库与法院/仲裁场景模板细分
- 律师最终定稿确认、案件归档和案件包导出
- 诉讼时效、关键期限和材料缺口提醒
- 更高覆盖率的端到端测试和 CI 检查

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
- 使用“AI 服务设置”中的测试功能确认连通性

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
