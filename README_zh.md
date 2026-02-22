# Agent Better Checkpoint

> 将 AI Agent 的黑盒 checkpoint 变为透明、可查询的语义化 Git commit。

当 AI 编程助手（Cursor、Claude Code 等）编辑你的代码时，它们内置的 checkpoint 机制往往是黑盒快照——难以阅读、难以导航、无法查询。**Agent Better Checkpoint** 用真正的 Git commit 替代它们，遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，并通过 [Git Trailers](https://git-scm.com/docs/git-interpret-trailers) 携带结构化元信息。

## 工作原理

```
┌──────────────────────────────────────┐
│  Skill (SKILL.md)                    │
│  指导 AI：何时 commit、              │
│  如何格式化 commit message           │
│         │                            │
│         ▼                            │
│  AI 生成描述信息 + 调用脚本          │
└───────────┬──────────────────────────┘
            │  checkpoint.sh "msg" "prompt"
            ▼
┌──────────────────────────────────────┐
│  Commit 脚本                         │
│  截断 prompt、追加 trailers、        │
│  git add -A && git commit            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Stop Hook                           │
│  对话结束时：                        │
│  git status → 有未提交？→ 提醒       │
└──────────────────────────────────────┘
```

**三个组件协同工作：**

| 组件 | 职责 | 触发方式 |
|------|------|----------|
| **Skill** (`SKILL.md`) | 引导 AI Agent 在每次有意义的编辑后自主 commit | AI 在会话开始时读取 |
| **Commit 脚本** (`checkpoint.sh` / `.ps1`) | 追加 Git Trailers（Agent、Checkpoint-Type、User-Prompt）并执行 `git commit` | 由 AI 编写消息后调用 |
| **Stop Hook** (`check_uncommitted.sh` / `.ps1`) | 安全网——对话结束时检测未提交的变更 | 平台 stop hook 触发 |

## Commit Message 示例

```
checkpoint(api): add user registration endpoint

Implement POST /api/users with email/password validation.
Includes bcrypt hashing and duplicate email check.

Agent: cursor
Checkpoint-Type: auto
User-Prompt: 帮我实现用户注册接口，需要邮...要密码加密
```

**可用标准 Git 工具查询：**

```bash
# 列出所有 checkpoint commit
git log --grep="^checkpoint("

# 按 agent 过滤
git log --format="%(trailers:key=Agent,valueonly)" | sort -u

# 搜索特定 prompt 相关的 commit
git log --grep="User-Prompt:.*registration"
```

## 安装

### 前置条件

- Git ≥ 2.0
- Node.js ≥ 18（仅安装时需要）
- 已安装 [Cursor](https://cursor.com) 或 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

### 快速安装

```bash
npx @vibe-x/agent-better-checkpoint
```

安装器会自动检测 OS 和 AI 平台，也可以手动指定：

```bash
# Cursor
npx @vibe-x/agent-better-checkpoint --platform cursor

# Claude Code
npx @vibe-x/agent-better-checkpoint --platform claude
```

### 通过 skills.sh 安装

如果你使用 [skills.sh](https://skills.sh)：

```bash
npx skills add alienzhou/agent-better-checkpoint
```

skills.sh 安装 SKILL.md 后，AI Agent 会检测到运行时脚本缺失并自动通过 `npx @vibe-x/agent-better-checkpoint` 完成引导安装。

### 安装内容

| 目标位置 | 内容 |
|----------|------|
| `~/.agent-better-checkpoint/scripts/` | `checkpoint.sh` / `.ps1` — commit 脚本 |
| `~/.agent-better-checkpoint/hooks/stop/` | `check_uncommitted.sh` / `.ps1` — stop hook |
| `~/.cursor/skills/agent-better-checkpoint/` | `SKILL.md`（仅 Cursor） |
| `~/.cursor/hooks.json` | Stop hook 注册（仅 Cursor） |
| `~/.claude/commands/` | `agent-better-checkpoint.md`（仅 Claude Code） |
| `~/.claude/settings.json` | Stop hook 注册（仅 Claude Code） |

### 卸载

```bash
npx @vibe-x/agent-better-checkpoint --uninstall
```

## 项目结构

```
├── package.json                        # npm 包配置
├── bin/
│   └── cli.mjs                         # npx 入口（安装器）
├── platform/
│   ├── unix/
│   │   ├── checkpoint.sh               # Bash: checkpoint commit
│   │   └── check_uncommitted.sh        # Bash: stop hook
│   └── win/
│       ├── checkpoint.ps1              # PowerShell: checkpoint commit
│       └── check_uncommitted.ps1       # PowerShell: stop hook
├── skill/
│   └── SKILL.md                        # AI Agent 指令
├── LICENSE
├── README.md
└── README_zh.md
```

## 设计决策

本项目经过结构化讨论流程，关键决策记录在 `.discuss/` 中：

| 决策 | 摘要 |
|------|------|
| [D01 — 触发策略](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D01-trigger-strategy.md) | Agent 自主 + stop hook 兜底 |
| [D02 — AI/脚本职责划分](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D02-ai-script-responsibility.md) | AI 生成描述；脚本追加元信息 |
| [D03 — Commit 格式](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D03-commit-message-format.md) | Conventional Commits + Git Trailers |
| [D06 — MVP 范围](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D06-mvp-scope.md) | Skill + Commit 脚本 + Stop Hook |
| [D01 — 发布策略](/.discuss/2026-02-22/publish-to-skills-sh/decisions/D01-publish-strategy.md) | npm + skills.sh，Node.js 安装器 + 原生 shell 脚本 |

## 平台支持

| 平台 | Skill | Stop Hook | 操作系统 |
|------|-------|-----------|----------|
| Cursor | `.cursor/skills/` | `stop` hook | macOS、Linux、Windows |
| Claude Code | `.claude/commands/` | `Stop` hook | macOS、Linux、Windows |

## 路线图

- [ ] Session ID 跟踪（关联同一对话中的 commit）
- [ ] 分支隔离（支持并行 Agent 会话）
- [ ] `afterFileEdit` / `PostToolUse` hook 集成（更细粒度的 commit）
- [ ] Checkpoint 浏览 UI / CLI 工具

## 许可证

[MIT](LICENSE)
