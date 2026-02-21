# Discussion: Agent Better Checkpoint

> Status: In Progress | Round: R9 | Date: 2026-02-21

## 🔵 Current Focus

- **Trailer 字段最终清单确认**
- **Session ID 的来源与生成方式**

## ⚪ Pending

- [ ] Trailer 字段最终清单确认
- [ ] Session ID 的具体来源与生成方式
- [ ] 分支策略：并行任务是否用独立分支？
- [ ] MVP 范围界定
- [ ] 用户工作流详细设计

## ✅ Confirmed

| Decision | Description | Document |
|----------|-------------|----------|
| 触发策略 | 方案 2（Agent 自主）+ 方案 3（stop hook 兜底） | [D01](./decisions/D01-trigger-strategy.md) |
| AI / 脚本职责切分 | AI 只生成描述性内容；脚本拼接元信息 | [D02](./decisions/D02-ai-script-responsibility.md) |
| Commit message 格式 | Conventional Commits 标题 + Git Trailer 元数据 | [D03](./decisions/D03-commit-message-format.md) |
| 脚本接口 | 命令行参数方式传递 AI 生成的 message | R7 |
| User-Prompt 存储 | 仅 Trailer，头尾截断 ≤60 字符，不用 Git Notes | R9 |

## ❌ Rejected

- 现有黑盒 checkpoint 模式 — R2
- 方案 1（hook 强制每次 edit 触发）— R4
- AI 生成元信息 — R5
- 自定义 JSON 块作为格式 — R5
- Git Notes 存储 User-Prompt — R9（过于复杂，push 问题多）
- User-Prompt 双层存储方案 — R9（简化）

## 📁 Archive

| Question | Conclusion | Details |
|----------|-----------|---------|
| 现有 Checkpoint 痛点 | (1) 黑盒化/可见性差 (2) 操作性不足 | R2 |
| 底层实现 | 基于 Git commit，非自研快照 | R2 |
| Hook 能力边界 | Hook 不能调 AI；Skill 驱动 AI，Hook 做兜底检查 | R3 |
| 格式替代方案 | Conventional Commits + Git Trailer 组合 | R5 |
| User-Prompt 方案演变 | 双层(Trailer+Notes) → 简化为单层 Trailer 截断 | R8→R9 |

### 整体架构

```
Skill（指导 AI 行为）
  → AI 自主判断 commit 时机
  → AI 生成：checkpoint(scope): 描述 + body
  → AI 调用：./checkpoint.sh "message" "user_prompt"

Commit 脚本
  → $1 = AI message, $2 = user prompt
  → Trailer: Session-Id, Agent, Checkpoint-Type, User-Prompt（头尾≤60字符）
  → git add + git commit -F -

Stop Hook（兜底）
  → git status 检测 uncommitted 变更
  → 输出提醒 → AI 补做 commit
```

### Commit Message 完整示例

```
checkpoint(auth): Refactor to use JWT tokens

Replaced session-based auth with JWT. Updated middleware
chain and added token refresh logic.

Session-Id: abc123-def456
Agent: cursor
Checkpoint-Type: auto
User-Prompt: 帮我把认证模块从 session 改成...支持 token 刷新
```
