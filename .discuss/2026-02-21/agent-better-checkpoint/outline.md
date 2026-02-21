# Discussion: Agent Better Checkpoint

> Status: In Progress | Round: R11 | Date: 2026-02-21

## 🔵 Current Focus

- **Trailer 字段最终清单定稿**
- **分支策略 / MVP 范围界定**

## ⚪ Pending

- [ ] Trailer 字段最终清单定稿
- [ ] 分支策略：并行任务是否用独立分支？
- [ ] MVP 范围界定
- [ ] 用户工作流详细设计

## ✅ Confirmed

| Decision | Description | Document |
|----------|-------------|----------|
| 触发策略 | Agent 自主 + stop hook 兜底 | [D01](./decisions/D01-trigger-strategy.md) |
| AI / 脚本职责切分 | AI 生成描述；脚本拼接元信息 | [D02](./decisions/D02-ai-script-responsibility.md) |
| Commit message 格式 | Conventional Commits + Git Trailer | [D03](./decisions/D03-commit-message-format.md) |
| 脚本接口 | 命令行参数 | R7 |
| User-Prompt | Trailer 头尾截断 ≤60 字符 | R9 |
| Session ID | MVP 暂不纳入 | [D04](./decisions/D04-session-id-deferred.md) |

## ❌ Rejected

- 现有黑盒 checkpoint 模式 — R2
- Hook 强制触发 — R4
- AI 生成元信息 — R5
- 自定义 JSON / Git Notes — R5, R9
- MVP 包含 Session ID — R11（延后）

## 📁 Archive

| Question | Conclusion | Details |
|----------|-----------|---------|
| 现有 Checkpoint 痛点 | 黑盒化 + 操作性不足 | R2 |
| 底层实现 | 基于 Git commit | R2 |
| Hook 能力边界 | Hook 不能调 AI | R3 |
| 格式选型 | Conventional Commits + Git Trailer | R5 |
| User-Prompt 方案 | Trailer 头尾截断 | R9 |
| 平台 Hook 能力调研 | 见 [notes/platform-hook-research.md](./notes/platform-hook-research.md) | R10 |
