---
name: agent-better-checkpoint
description: "Automatically creates semantic Git checkpoint commits during AI coding sessions. Replaces opaque platform checkpoints with transparent, queryable Git commits using Conventional Commits format with Git Trailers. You MUST follow this skill whenever you make code changes — commit after each meaningful edit."
license: MIT
metadata:
  version: "0.1.0"
  author: "alienzhou"
  category: "version-control"
---

# Agent Better Checkpoint — Semantic Git Commits for AI Sessions

You are an AI coding assistant with **checkpoint awareness**. Every meaningful edit you make should be committed as a transparent Git checkpoint, so the user has a clear, operable history of all changes.

**Core Principle**: Replace opaque checkpoints with transparent Git commits. Every meaningful edit gets a semantic commit message that explains *what* changed and *why*.

---

## 🔧 Installation Check

Before your first commit, verify the checkpoint scripts are installed:

**macOS/Linux:** Check if `~/.agent-better-checkpoint/scripts/checkpoint.sh` exists.
**Windows:** Check if `$env:USERPROFILE/.agent-better-checkpoint/scripts/checkpoint.ps1` exists.

If the scripts are **not** installed, run:

```bash
npx @vibe-x/agent-better-checkpoint@0.1.0
```

This will install the checkpoint scripts and stop hook for your platform.

---

## 🔄 When to Commit

### MUST Commit After:
- Completing a logical unit of work (implementing a function, fixing a bug, adding a feature)
- Making a significant refactor or restructuring
- Adding or modifying configuration files
- Creating or updating documentation
- Before switching to a different task or file group
- Before ending the conversation (the stop hook will remind you if you forget)

### Do NOT Commit After:
- Trivial whitespace-only changes
- Incomplete changes with syntax errors
- Changes you're about to immediately undo

---

## 📝 Commit Message Format

Use **Conventional Commits** with `checkpoint` type:

```
checkpoint(<scope>): <short description>

<detailed description of changes, intent, and context>
```

### Rules:
1. **Subject line**: `checkpoint(<scope>): <description>`
   - `<scope>`: affected area (e.g., `auth`, `api`, `config`, `ui`, `docs`)
   - `<description>`: imperative mood, lowercase, ≤72 chars
2. **Body** (after blank line): Explain what changed and why. Include context about intent.
3. **Do NOT** include trailers or metadata — the checkpoint script appends those automatically.

### Good Examples:

```
checkpoint(api): add user registration endpoint

Implement POST /api/users with email/password validation.
Includes bcrypt hashing and duplicate email check.
```

```
checkpoint(config): enable TypeScript strict mode

Enable strict null checks and no-implicit-any rules.
Aligns with the team's TypeScript migration plan.
```

```
checkpoint(ui): fix responsive layout on mobile

Sidebar was overlapping main content on screens < 768px.
Switch to flex-column layout with collapsible sidebar.
```

---

## 🛠️ How to Commit

Call the checkpoint script after composing your message. Determine the OS and use the appropriate command:

**macOS/Linux:**

```bash
~/.agent-better-checkpoint/scripts/checkpoint.sh "<commit-message>" "<user-prompt>"
```

**Windows (PowerShell):**

```powershell
powershell -File "$env:USERPROFILE/.agent-better-checkpoint/scripts/checkpoint.ps1" "<commit-message>" "<user-prompt>"
```

### Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| message (1st arg) | Yes | Full commit message (subject + blank line + body) |
| user-prompt (2nd arg) | No | The user's original prompt/request |
| `--type` / `-Type` | No | `auto` (default) or `fallback` |

### Example (macOS/Linux):

```bash
~/.agent-better-checkpoint/scripts/checkpoint.sh \
  "checkpoint(auth): add JWT token refresh logic

Implement automatic token refresh when access token expires.
Uses refresh token rotation for security." \
  "帮我实现 token 刷新机制"
```

### Example (Windows):

```powershell
powershell -File "$env:USERPROFILE/.agent-better-checkpoint/scripts/checkpoint.ps1" `
  "checkpoint(auth): add JWT token refresh logic`n`nImplement automatic token refresh when access token expires.`nUses refresh token rotation for security." `
  "帮我实现 token 刷新机制"
```

### What the script does:
1. Truncates user prompt to ≤60 characters (head...tail)
2. Appends Git Trailers: `Agent`, `Checkpoint-Type`, `User-Prompt`
3. Runs `git add -A && git commit`
4. Exits gracefully if there are no changes

---

## ⚡ Workflow

```
1. User gives you a task
2. You make edits (code, config, docs, etc.)
3. When a logical unit is complete → compose checkpoint message → call script
4. Continue with next task → repeat step 2-3
5. Conversation ends → stop hook verifies nothing is left uncommitted
```

This should feel natural — commit as you go, like any good developer.

---

## 🚨 Important Rules

- **One commit per logical change** — don't batch unrelated changes into one commit
- **Always commit before ending** — the stop hook catches missed commits, but proactive is better
- **Be descriptive** — future humans (and AI) will read these messages
- **Don't force empty commits** — the script handles "no changes" gracefully
- **Scope matters** — choose a meaningful scope that helps categorize the change

---

**Version**: 0.1.0
