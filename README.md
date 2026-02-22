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
│  Commit Script                       │
│  Truncate prompt, append trailers,   │
│  git add -A && git commit            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Stop Hook                           │
│  On conversation end:                │
│  git status → uncommitted? → remind  │
└──────────────────────────────────────┘
```

**Three components working together:**

| Component | Role | Trigger |
|-----------|------|---------|
| **Skill** (`SKILL.md`) | Guides the AI agent to commit autonomously after each meaningful edit | AI reads it at session start |
| **Commit Script** (`checkpoint.sh` / `.ps1`) | Appends Git Trailers (Agent, Checkpoint-Type, User-Prompt) and runs `git commit` | Called by AI after composing a message |
| **Stop Hook** (`check_uncommitted.sh` / `.ps1`) | Safety net — detects uncommitted changes when conversation ends | Platform stop hook |

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
- Node.js ≥ 18 (only needed for installation)
- One of: [Cursor](https://cursor.com) or [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

### Quick Install

```bash
npx @vibe-x/agent-better-checkpoint
```

The installer auto-detects your OS and AI platform. To specify explicitly:

```bash
# For Cursor
npx @vibe-x/agent-better-checkpoint --platform cursor

# For Claude Code
npx @vibe-x/agent-better-checkpoint --platform claude
```

### Install via skills.sh

If you use [skills.sh](https://skills.sh):

```bash
npx skills add alienzhou/agent-better-checkpoint
```

After skills.sh installs the SKILL.md, the AI agent will detect that runtime scripts are missing and auto-bootstrap via `npx @vibe-x/agent-better-checkpoint`.

### What Gets Installed

| Destination | Content |
|-------------|---------|
| `~/.agent-better-checkpoint/scripts/` | `checkpoint.sh` / `.ps1` — the commit script |
| `~/.agent-better-checkpoint/hooks/stop/` | `check_uncommitted.sh` / `.ps1` — the stop hook |
| `~/.cursor/skills/agent-better-checkpoint/` | `SKILL.md` (Cursor only) |
| `~/.cursor/hooks.json` | Stop hook registration (Cursor only) |
| `~/.claude/commands/` | `agent-better-checkpoint.md` (Claude Code only) |
| `~/.claude/settings.json` | Stop hook registration (Claude Code only) |

### Uninstall

```bash
npx @vibe-x/agent-better-checkpoint --uninstall
```

## Project Structure

```
├── package.json                        # npm package config
├── bin/
│   └── cli.mjs                         # npx entry point (installer)
├── platform/
│   ├── unix/
│   │   ├── checkpoint.sh               # Bash: checkpoint commit
│   │   └── check_uncommitted.sh        # Bash: stop hook
│   └── win/
│       ├── checkpoint.ps1              # PowerShell: checkpoint commit
│       └── check_uncommitted.ps1       # PowerShell: stop hook
├── skill/
│   └── SKILL.md                        # AI agent instructions
├── LICENSE
├── README.md
└── README_zh.md
```

## Design Decisions

This project went through a structured discussion process. Key decisions are documented in `.discuss/`:

| Decision | Summary |
|----------|---------|
| [D01 — Trigger Strategy](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D01-trigger-strategy.md) | Agent autonomous + stop hook fallback |
| [D02 — AI/Script Split](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D02-ai-script-responsibility.md) | AI generates descriptions; script appends metadata |
| [D03 — Commit Format](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D03-commit-message-format.md) | Conventional Commits + Git Trailers |
| [D06 — MVP Scope](/.discuss/2026-02-21/agent-better-checkpoint/decisions/D06-mvp-scope.md) | Skill + Commit Script + Stop Hook |
| [D01 — Publish Strategy](/.discuss/2026-02-22/publish-to-skills-sh/decisions/D01-publish-strategy.md) | npm + skills.sh, Node.js installer + native shell scripts |

## Platform Support

| Platform | Skill | Stop Hook | OS |
|----------|-------|-----------|-----|
| Cursor | `.cursor/skills/` | `stop` hook | macOS, Linux, Windows |
| Claude Code | `.claude/commands/` | `Stop` hook | macOS, Linux, Windows |

## Roadmap

- [ ] Session ID tracking (link commits from same conversation)
- [ ] Branch isolation for parallel agent sessions
- [ ] `afterFileEdit` / `PostToolUse` hook integration for finer-grained commits
- [ ] Checkpoint browsing UI / CLI tool

## License

[MIT](LICENSE)
