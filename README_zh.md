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
│  Commit 脚本 (checkpoint.sh)         │
│  截断 prompt、追加 trailers、        │
│  git add -A && git commit            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Stop Hook (check_uncommitted.py)    │
│  对话结束时：                        │
│  git status → 有未提交？→ 提醒       │
└──────────────────────────────────────┘
```

**三个组件协同工作：**

| 组件 | 职责 | 触发方式 |
|------|------|----------|
| **Skill** (`SKILL.md`) | 引导 AI Agent 在每次有意义的编辑后自主 commit | AI 在会话开始时读取 |
| **Commit 脚本** (`checkpoint.sh`) | 追加 Git Trailers（Agent、Checkpoint-Type、User-Prompt）并执行 `git commit` | 由 AI 编写消息后调用 |
| **Stop Hook** (`check_uncommitted.py`) | 安全网——对话结束时检测未提交的变更 | 平台 stop hook 触发 |

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
- Python ≥ 3.8
- 已安装 [Cursor](https://cursor.com) 或 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

### 快速安装

```bash
git clone https://github.com/alienzhou/agent-better-checkpoint.git
cd agent-better-checkpoint
python src/install.py
```

安装器会自动检测平台，也可以手动指定：

```bash
# Cursor
python src/install.py --platform cursor

# Claude Code
python src/install.py --platform claude
```

### 安装内容

| 目标位置 | 内容 |
|----------|------|
| `~/.agent-better-checkpoint/scripts/` | `checkpoint.sh` — commit 脚本 |
| `~/.agent-better-checkpoint/hooks/stop/` | `check_uncommitted.py` — stop hook |
| `~/.cursor/skills/agent-better-checkpoint/` | `SKILL.md`（仅 Cursor） |
| `~/.cursor/hooks.json` | Stop hook 注册（仅 Cursor） |
| `~/.claude/commands/` | `agent-better-checkpoint.md`（仅 Claude Code） |
| `~/.claude/settings.json` | Stop hook 注册（仅 Claude Code） |

### 卸载

```bash
python src/install.py --uninstall
```

## 项目结构

```
src/
├── skill/
│   └── SKILL.md                  # AI Agent 指令
├── scripts/
│   └── checkpoint.sh             # Commit 脚本（trailer 注入）
├── hooks/
│   └── stop/
│       └── check_uncommitted.py  # Stop hook（未提交变更检测）
└── install.py                    # 跨平台安装器
```

## 设计决策

本项目经过结构化讨论流程，关键决策记录在 `.discuss/` 中：

| 决策 | 摘要 |
|------|------|
| [D01 — 触发策略](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D01-trigger-strategy.md) | Agent 自主 + stop hook 兜底 |
| [D02 — AI/脚本职责划分](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D02-ai-script-responsibility.md) | AI 生成描述；脚本追加元信息 |
| [D03 — Commit 格式](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D03-commit-message-format.md) | Conventional Commits + Git Trailers |
| [D06 — MVP 范围](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D06-mvp-scope.md) | Skill + Commit 脚本 + Stop Hook |

## 平台支持

| 平台 | Skill | Stop Hook | 状态 |
|------|-------|-----------|------|
| Cursor | `.cursor/skills/` | `stop` hook | ✅ 已支持 |
| Claude Code | `.claude/commands/` | `Stop` hook | ✅ 已支持 |

## 路线图

- [ ] Session ID 跟踪（关联同一对话中的 commit）
- [ ] 分支隔离（支持并行 Agent 会话）
- [ ] `afterFileEdit` / `PostToolUse` hook 集成（更细粒度的 commit）
- [ ] Checkpoint 浏览 UI / CLI 工具

## 许可证

[MIT](LICENSE)
