# Agent Better Checkpoint

> Turn opaque AI agent checkpoints into transparent, semantic Git commits.

When AI coding assistants (Cursor, Claude Code, etc.) edit your code, their built-in checkpoint mechanisms are often black-box snapshots — hard to read, hard to navigate, and impossible to query. **Agent Better Checkpoint** replaces them with real Git commits that follow [Conventional Commits](https://www.conventionalcommits.org/) and carry structured metadata via [Git Trailers](https://git-scm.com/docs/git-interpret-trailers).

## How It Works

```
┌──────────────────────────────────────┐
│  Skill (SKILL.md)                    │
│  Instructs AI: when to commit,       │
│  how to format the message           │
│         │                            │
│         ▼                            │
│  AI generates message + calls script │
└───────────┬──────────────────────────┘
            │  checkpoint.sh "msg" "prompt"
            ▼
┌──────────────────────────────────────┐
│  Commit Script (checkpoint.sh)       │
│  Truncate prompt, append trailers,   │
│  git add -A && git commit            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Stop Hook (check_uncommitted.py)    │
│  On conversation end:                │
│  git status → uncommitted? → remind  │
└──────────────────────────────────────┘
```

**Three components working together:**

| Component | Role | Trigger |
|-----------|------|---------|
| **Skill** (`SKILL.md`) | Guides the AI agent to commit autonomously after each meaningful edit | AI reads it at session start |
| **Commit Script** (`checkpoint.sh`) | Appends Git Trailers (Agent, Checkpoint-Type, User-Prompt) and runs `git commit` | Called by AI after composing a message |
| **Stop Hook** (`check_uncommitted.py`) | Safety net — detects uncommitted changes when conversation ends | Platform stop hook |

## Commit Message Example

```
checkpoint(api): add user registration endpoint

Implement POST /api/users with email/password validation.
Includes bcrypt hashing and duplicate email check.

Agent: cursor
Checkpoint-Type: auto
User-Prompt: 帮我实现用户注册接口，需要邮...要密码加密
```

**Queryable with standard Git tools:**

```bash
# List all checkpoint commits
git log --grep="^checkpoint("

# Filter by agent
git log --format="%(trailers:key=Agent,valueonly)" | sort -u

# Find commits from a specific prompt
git log --grep="User-Prompt:.*registration"
```

## Installation

### Prerequisites

- Git ≥ 2.0
- Python ≥ 3.8
- One of: [Cursor](https://cursor.com) or [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

### Quick Install

```bash
git clone https://github.com/alienzhou/agent-better-checkpoint.git
cd agent-better-checkpoint
python src/install.py
```

The installer auto-detects your platform. To specify explicitly:

```bash
# For Cursor
python src/install.py --platform cursor

# For Claude Code
python src/install.py --platform claude
```

### What Gets Installed

| Destination | Content |
|-------------|---------|
| `~/.agent-better-checkpoint/scripts/` | `checkpoint.sh` — the commit script |
| `~/.agent-better-checkpoint/hooks/stop/` | `check_uncommitted.py` — the stop hook |
| `~/.cursor/skills/agent-better-checkpoint/` | `SKILL.md` (Cursor only) |
| `~/.cursor/hooks.json` | Stop hook registration (Cursor only) |
| `~/.claude/commands/` | `agent-better-checkpoint.md` (Claude Code only) |
| `~/.claude/settings.json` | Stop hook registration (Claude Code only) |

### Uninstall

```bash
python src/install.py --uninstall
```

## Project Structure

```
src/
├── skill/
│   └── SKILL.md                  # AI agent instructions
├── scripts/
│   └── checkpoint.sh             # Commit script (trailer injection)
├── hooks/
│   └── stop/
│       └── check_uncommitted.py  # Stop hook (uncommitted change detection)
└── install.py                    # Cross-platform installer
```

## Design Decisions

This project went through a structured discussion process. Key decisions are documented in `.discuss/`:

| Decision | Summary |
|----------|---------|
| [D01 — Trigger Strategy](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D01-trigger-strategy.md) | Agent autonomous + stop hook fallback |
| [D02 — AI/Script Split](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D02-ai-script-responsibility.md) | AI generates descriptions; script appends metadata |
| [D03 — Commit Format](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D03-commit-message-format.md) | Conventional Commits + Git Trailers |
| [D06 — MVP Scope](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D06-mvp-scope.md) | Skill + Commit Script + Stop Hook |

## Platform Support

| Platform | Skill | Stop Hook | Status |
|----------|-------|-----------|--------|
| Cursor | `.cursor/skills/` | `stop` hook | ✅ Supported |
| Claude Code | `.claude/commands/` | `Stop` hook | ✅ Supported |

## Roadmap

- [ ] Session ID tracking (link commits from same conversation)
- [ ] Branch isolation for parallel agent sessions
- [ ] `afterFileEdit` / `PostToolUse` hook integration for finer-grained commits
- [ ] Checkpoint browsing UI / CLI tool

## License

[MIT](LICENSE)
