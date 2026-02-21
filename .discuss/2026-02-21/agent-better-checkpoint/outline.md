# Discussion: Agent Better Checkpoint

> Status: In Progress | Round: R6 | Date: 2026-02-21

## 🔵 Current Focus

- **Trailer 具体字段清单：哪些元数据需要包含？**
- **Commit 脚本的接口设计：AI 如何把 message 传给脚本？**

## ⚪ Pending

- [ ] Trailer 字段清单确认
- [ ] 脚本接口设计（CLI 参数 / 环境变量 / 临时文件）
- [ ] Session ID 等 meta 信息的具体来源
- [ ] 分支策略：并行任务是否用独立分支？
- [ ] MVP 范围界定
- [ ] 用户工作流详细设计

## ✅ Confirmed

| Decision | Description | Document |
|----------|-------------|----------|
| 触发策略 | 方案 2（Agent 自主）+ 方案 3（stop hook 兜底） | [D01](./decisions/D01-trigger-strategy.md) |
| AI / 脚本职责切分 | AI 只生成描述性内容（标题 + body）；脚本负责拼接结构化元信息 | [D02](./decisions/D02-ai-script-responsibility.md) |
| Commit message 格式 | Conventional Commits 标题 + Git Trailer 元数据 | [D03](./decisions/D03-commit-message-format.md) |

## ❌ Rejected

- 现有黑盒 checkpoint 模式 — R2
- 方案 1（hook 强制每次 edit 触发）— R4
- AI 生成元信息 — R5
- 自定义 JSON 块 / Git Notes 等替代格式 — R5

## 📁 Archive

| Question | Conclusion | Details |
|----------|-----------|---------|
| 现有 Checkpoint 痛点 | (1) 黑盒化/可见性差 (2) 操作性不足 | R2 |
| 底层实现 | 基于 Git commit，非自研快照 | R2 |
| Hook 能力边界 | Hook 不能调 AI；Skill 驱动 AI，Hook 做兜底检查 | R3 |
| 格式替代方案 | 比较了 Trailer / Conventional Commits / JSON / Git Notes，选择前两者组合 | R5 |

### 整体架构

```
Skill（指导 AI 行为）
  → AI 自主判断 commit 时机
  → AI 生成语义化 message：checkpoint(scope): 描述 + body
  → AI 调用 commit 脚本，传入 message

Commit 脚本
  → 接收 AI 传入的 message
  → 用 git interpret-trailers 追加元数据
  → git add + git commit -F -

Stop Hook（兜底）
  → git status 检测 uncommitted 变更
  → 输出提醒 → AI 补做 commit
```

### Commit Message 格式示例

```
checkpoint(auth): Refactor to use JWT tokens

Replaced session-based auth with JWT. Updated middleware
chain and added token refresh logic.

Session-Id: abc123-def456
Agent: cursor
Checkpoint-Type: auto
```
