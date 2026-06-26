# Git 工作流指南

## 当前状态

### 分支情况
- **main 分支**：当前在本地，与 origin/main 同步
- **dev 分支**：有 34 个新提交，包含大量 UI/UX 改进和新功能

### 未提交的更改
- 20 个文件已修改（主要是时区处理改进）
- 1 个未跟踪目录：`.mimocode/`

## 推送步骤

### 1. 提交当前更改

```bash
# 查看具体更改
git diff backend/models/

# 添加所有更改
git add backend/database.py backend/models/ backend/routers/ backend/services/

# 提交
git commit -m "refactor: 统一使用 utcnow 函数处理时区"

# 推送到远程
git push origin main
```

### 2. 处理 dev 分支

dev 分支包含大量新功能，建议合并到 main：

```bash
# 切换到 main
git checkout main

# 合并 dev 分支
git merge origin/dev

# 解决冲突（如有）
# 查看冲突文件
git status

# 解决后添加
git add .

# 完成合并
git commit -m "merge: 合并 dev 分支的 UI/UX 改进"

# 推送
git push origin main
```

### 3. 清理 dev 分支（可选）

合并后可以删除远程 dev 分支：

```bash
# 删除远程 dev 分支
git push origin --delete dev

# 删除本地 dev 分支
git branch -d dev
```

## 分支策略建议

### 推荐工作流

```
main (生产) ← dev (开发) ← feature branches
```

1. **main 分支**：保持稳定，只接受已测试的合并
2. **dev 分支**：日常开发，集成新功能
3. **feature 分支**：单个功能开发，完成后合并到 dev

### 版本标签

```bash
# 发布新版本时打标签
git tag -a v1.1.0 -m "Release v1.1.0: UI/UX improvements"
git push origin v1.1.0
```

## dev 分支包含的新功能

| 功能 | 说明 |
|------|------|
| UI交互优化 | 侧边抽屉/Markdown工具栏/版本Diff/响应式 |
| 深色模式 | 骨架屏加载 + CSS变量主题系统 |
| 响应式适配 | 状态切换 + 统一确认弹窗 |
| 文书编辑器 | 三栏布局 + 撤销系统 + 快捷键 + 打印预览 |
| AI辅助编辑 | 选中文本可润色/补充法律依据/改写/精简/展开 |
| 法院标准格式 | Word文档导出 |
| 多模型交叉审查 | 链式审查 + 多版本对比 |
| 去技术化界面 | 隐藏开发者概念，更适合律师使用 |

## 部署建议

### 开发环境
```bash
# 使用 dev 分支进行开发测试
git checkout dev
./start.sh
```

### 生产环境
```bash
# 使用 main 分支部署
git checkout main
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 常见问题

### Q1: 合并冲突如何解决？
```bash
# 查看冲突文件
git status

# 手动编辑冲突文件，选择保留哪个版本
# 然后
git add <冲突文件>
git commit
```

### Q2: 如何撤销错误的提交？
```bash
# 撤销最近一次提交（保留更改）
git reset --soft HEAD~1

# 撤销最近一次提交（丢弃更改）
git reset --hard HEAD~1
```

### Q3: 如何查看分支差异？
```bash
# 查看 main 和 dev 的差异
git diff main..origin/dev

# 查看 dev 比 main 多的提交
git log --oneline main..origin/dev
```
