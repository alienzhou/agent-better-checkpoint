# agent-better-checkpoint

将 AI Agent 的编辑转化为**透明、可操作的 Git commit**，取代平台黑盒 checkpoint。

## 痛点

AI 编码平台（Cursor、Claude Code 等）的 checkpoint 机制是黑盒的——不可读、不可查询、不可操作。`agent-better-checkpoint` 通过 Skill + 脚本 + Hook 的组合，让 Agent 的每次有意义编辑都变成一条规范的 Git commit。

## 架构

```
┌─────────────────────────────────────┐
│ Skill (SKILL.md)                    │
│ 指导 AI: 何时 commit、消息格式       │
│         │                           │
│         ▼                           │
│ AI 生成 message → 调用脚本           │
└────────────┬────────────────────────┘
             │ checkpoint.sh "msg" "prompt"
             ▼
┌─────────────────────────────────────┐
│ Commit Script (checkpoint.sh)       │
│ 截断 prompt、追加 Trailer、          │
│ git add + git commit                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Stop Hook (check_uncommitted.py)    │
│ 会话结束 → git status →              │
│ 有未提交? → 提醒 Agent fallback      │
└─────────────────────────────────────┘
```

## Commit 格式

```
checkpoint(<scope>): <AI 生成的描述>

<AI 生成的详细说明>

Agent: cursor
Checkpoint-Type: auto
User-Prompt: <截断后的用户提示>
```

- **Title**: Conventional Commits 格式，`checkpoint` 类型
- **Body**: AI 生成的变更说明和意图
- **Trailers**: 脚本自动追加的结构化元数据，支持 `git log --format="%(trailers)"` 查询

## 项目结构

```
.cursor/
├── scripts/
│   └── checkpoint.sh              # Commit 脚本
├── skills/
│   └── agent-checkpoint/
│       └── SKILL.md               # Skill 文件（指导 Agent 行为）
├── hooks/
│   ├── stop/
│   │   ├── check_uncommitted.py   # Checkpoint fallback hook
│   │   └── check_precipitation.py # 讨论沉淀 hook（独立功能）
│   └── common/                    # 共享工具模块
└── hooks.json                     # Hook 注册配置
```

## 快速开始

1. 将本仓库 clone 到你的项目中（或将 `.cursor/` 目录复制过去）
2. Cursor 会自动加载 Skill 和 Hook
3. Agent 在编码时会自主创建 checkpoint commit
4. 会话结束时 Stop Hook 兜底检查

## 查询 Checkpoint

```bash
# 查看所有 checkpoint commit
git log --grep="^checkpoint("

# 按 Agent 过滤
git log --format="%(trailers:key=Agent,valueonly)" | sort | uniq -c

# 查看特定用户请求相关的 commit
git log --grep="User-Prompt:.*关键词"

# 只看 fallback commit
git log --grep="Checkpoint-Type: fallback"
```

## 设计决策

详见 `.discuss/2026-02-21/agent-better-checkpoint/` 目录：

| 决策 | 文档 |
|------|------|
| 触发策略: Agent 自主 + Stop Hook 兜底 | `decisions/D01-trigger-strategy.md` |
| AI/脚本职责切分 | `decisions/D02-ai-script-responsibility.md` |
| Commit message 格式 | `decisions/D03-commit-message-format.md` |
| MVP 范围 | `decisions/D06-mvp-scope.md` |

## License

MIT