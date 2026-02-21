# Discussion: Agent Better Checkpoint

> Status: In Progress | Round: R4 | Date: 2026-02-21

## 🔵 Current Focus

- **Commit message 的格式规范设计：结构化字段、元数据、trailer 格式**
- **Commit 脚本的职责边界：AI 传入什么，脚本补充什么？**

## ⚪ Pending

- [ ] Commit message 格式规范具体定义
- [ ] 脚本如何接收 AI 传参（CLI 参数 / 环境变量 / 临时文件）
- [ ] Session ID 等 meta 信息的来源与注入方式
- [ ] 分支策略：并行任务是否用独立分支？
- [ ] MVP 范围界定
- [ ] 用户工作流详细设计

## ✅ Confirmed

| Decision | Description | Document |
|----------|-------------|----------|
| 触发策略 | 方案 2（Agent 自主）+ 方案 3（stop hook 兜底） | [D01](./decisions/D01-trigger-strategy.md) |
| Commit message 内容 | AI 生成意图 + 改动描述，可包含对话中可获取的更多上下文 | R4 |

## ❌ Rejected

- 现有黑盒 checkpoint 模式 — R2
- 方案 1（hook 强制每次 edit 触发）— R4，hook 无 edit 入口且无法调用 AI 生成语义

## 📁 Archive

| Question | Conclusion | Details |
|----------|-----------|---------|
| 现有 Checkpoint 痛点 | (1) 黑盒化/可见性差 (2) 操作性不足 | R2 |
| 底层实现 | 基于 Git commit，非自研快照 | R2 |
| Hook 能力边界 | Hook 不能调 AI；Skill 驱动 AI，Hook 做兜底检查 | R3 |

### 整体架构

```
Skill（指导 AI 行为）
  → AI 自主判断 commit 时机
  → AI 生成语义化 commit message（意图 + 改动描述 + 上下文信息）
  → AI 调用 commit 脚本

Commit 脚本（包装 + 执行）
  → 接收 AI 传入的 message
  → 补充 meta 信息（Session ID 等）
  → 格式化 → git add + git commit

Stop Hook（兜底）
  → 检测 uncommitted 变更
  → 输出提醒 → AI 补做 commit
```
