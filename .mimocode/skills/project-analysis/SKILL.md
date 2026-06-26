---
name: project-analysis
description: '读取并分析项目：结构探索、关键文件阅读、多角度分析（完整性/设计/UX/改进方向），输出结构化报告'
---

# Project Analysis - 项目读取与分析

对当前项目进行全面读取和分析，根据用户指定的角度输出结构化报告。

## 使用场景

用户要求"读取并分析这个项目"、"分析项目设计缺陷"、"分析功能完整度"、"分析用户体验"等。

## 工作流

### Step 1: 项目结构探索 [required]

1. `git status` — 获取分支和变更状态
2. `ls` 或 `find . -maxdepth 2 -type f | head -40` — 了解项目规模和技术栈
3. 读取 `README.md`、`package.json`/`pyproject.toml`/`go.mod`（取存在的第一个）— 确认技术栈和依赖
4. 读取 `docker-compose.yml`（如存在）— 了解部署架构

### Step 2: 核心代码阅读 [required]

根据项目类型选择阅读路径：

**Python 后端项目**：
- `backend/main.py` 或 `app/main.py` — 入口和路由注册
- `backend/config.py` 或 `app/config.py` — 配置
- `backend/database.py` — 数据库模型
- `backend/routers/` 或 `app/api/` — 所有路由文件
- `backend/services/` — 业务逻辑
- `backend/models/` — 数据模型
- `backend/requirements.txt` — 依赖

**前端项目**：
- `frontend/src/App.tsx` 或 `src/App.vue` — 路由和布局
- `frontend/src/pages/` — 页面组件
- `frontend/src/services/` 或 `src/api/` — API 调用层
- `frontend/src/components/` — 共享组件
- `frontend/package.json` — 依赖

**全栈项目**：两组都读。

### Step 3: 角度分析 [required]

根据用户的分析角度，重点审查相关代码：

| 角度 | 重点关注 |
|------|---------|
| 功能完整度 | 路由覆盖率、功能模块是否齐全、TODO/FIXME |
| 设计缺陷 | 代码重复、耦合度、错误处理、安全性 |
| 用户体验 | 前端交互流程、响应时间、错误提示 |
| 个人律师适用性 | 法律术语准确性、工作流匹配度、数据安全 |
| 商业竞品角度 | 功能差异化、可扩展性、部署方案 |

### Step 4: 输出报告 [required]

结构化输出：

```markdown
## 项目概览
- 技术栈：...
- 项目规模：X 个文件，Y 行代码
- 当前状态：...

## 分析结果（{角度}）

### 优点
1. ...

### 问题
1. ...

### 改进建议
1. ...（按优先级排序）
```

## 注意事项

- 仅分析，不修改代码（除非用户明确要求）
- 基于实际代码判断，不用一般知识猜测
- 如发现不确定性，明确标注
- 读取文件时避免一次性读取过多，按需分批
