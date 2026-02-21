# Discussion: Agent Better Checkpoint

> Status: In Progress | Round: R10 | Date: 2026-02-21

## 🔵 Current Focus

- **Session ID 来源方案确认**
- **Trailer 字段最终清单确认**

## ⚪ Pending

- [ ] Session ID 来源方案确认
- [ ] Trailer 字段最终清单定稿
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
| User-Prompt 存储 | 仅 Trailer，头尾截断 ≤60 字符 | R9 |

## ❌ Rejected

- 现有黑盒 checkpoint 模式 — R2
- 方案 1（hook 强制每次 edit 触发）— R4
- AI 生成元信息 — R5
- 自定义 JSON 块 / Git Notes — R5, R9

## 📁 Archive

| Question | Conclusion | Details |
|----------|-----------|---------|
| 现有 Checkpoint 痛点 | (1) 黑盒化/可见性差 (2) 操作性不足 | R2 |
| 底层实现 | 基于 Git commit，非自研快照 | R2 |
| Hook 能力边界 | Hook 不能调 AI；Skill 驱动 AI，Hook 做兜底检查 | R3 |
| 格式替代方案 | Conventional Commits + Git Trailer 组合 | R5 |
| User-Prompt 方案 | 单层 Trailer 头尾截断 | R8→R9 |

### R10 Session ID 来源调研

**Cursor**：
- `stop` hook 的 stdin JSON 包含 `conversation_id` 和 `generation_id`
- `afterFileEdit` hook（beta）的 stdin 包含 `file_path`
- `conversation_id` 本质就是 Session ID，可直接使用
- 但注意：只有 hook 脚本能从 stdin 拿到，Skill 调用的 commit 脚本拿不到

**Claude Code**：
- Hook stdin JSON 包含 `tool_name`、`tool_input`、`hook_event_name`
- 文档中未明确暴露 `session_id` 字段给 hook
- CLI 支持 `-r "session-id"` 恢复会话，说明 session ID 存在
- 可能需要通过 SessionStart hook 捕获并缓存

### 整体架构

```
Skill（指导 AI 行为）
  → AI 自主判断 commit 时机
  → AI 生成：checkpoint(scope): 描述 + body
  → AI 调用：./checkpoint.sh "message" "user_prompt"

Commit 脚本
  → $1 = AI message, $2 = user prompt
  → 从缓存/环境变量读取 Session ID
  → git interpret-trailers 追加 meta
  → git add + git commit -F -

Stop Hook（兜底）
  → 从 stdin 解析 conversation_id（Cursor）
  → 写入缓存供 commit 脚本读取
  → git status 检测 uncommitted 变更
  → 输出提醒 → AI 补做 commit
```
