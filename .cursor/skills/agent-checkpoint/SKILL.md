---
name: agent-checkpoint
description: "Automatically creates transparent Git checkpoints during AI coding sessions. The Agent MUST follow this skill whenever it makes meaningful code changes. This skill replaces opaque platform checkpoints with readable, queryable Git commits using Conventional Commits format and Git Trailers."
license: MIT
metadata:
  version: "1.0.0"
  author: "alienzhou"
  category: "workflow-automation"
---

# Agent Checkpoint — Transparent Git Commits for AI Sessions

You are an AI coding agent. Every meaningful edit you make MUST be preserved as a **transparent Git checkpoint** — a real Git commit with a semantic message and structured metadata.

**This is not optional.** Checkpoints are how your work becomes visible, reviewable, and recoverable.

---

## When to Commit

You MUST create a checkpoint commit when:

1. **A logical unit of work is complete** — e.g., finished implementing a function, fixed a bug, added a test, refactored a module
2. **Before switching context** — e.g., moving from file A's feature to file B's unrelated change
3. **After a significant milestone** — e.g., all tests pass, a feature is wired up end-to-end
4. **Before ending the conversation** — if the stop hook reminds you of uncommitted changes, do a fallback commit immediately

You do NOT need to commit after every single file edit. Group related changes into one logical commit.

---

## Commit Message Format

Use **Conventional Commits** with `checkpoint` type:

```
checkpoint(<scope>): <short description>

<detailed description of what changed and why>
```

### Rules

- **Type**: Always `checkpoint`
- **Scope**: The module, feature, or area of change (e.g., `auth`, `api`, `ui`, `config`)
- **Short description**: Imperative mood, lowercase, no period, ≤72 chars
- **Body**: Explain *what* changed and *why*. Be specific. This is the most valuable part — future humans (and AIs) will read it to understand intent.

### Examples

Good:

```
checkpoint(auth): add JWT token refresh logic

Implement automatic token refresh when the access token expires.
The refresh is triggered 30 seconds before expiration to avoid
race conditions. Falls back to re-login if refresh token is also
expired.
```

```
checkpoint(db): fix N+1 query in user list endpoint

Replace individual user.posts queries with a single eager-loaded
query. Reduces database calls from O(n) to O(1) for the user
list page.
```

Bad:

```
checkpoint: update files           ← too vague, no scope
checkpoint(misc): changes          ← meaningless description
checkpoint(auth): Add JWT.         ← uppercase, period
```

---

## How to Commit

Call the checkpoint script with your message and the user's original prompt:

```bash
bash .cursor/scripts/checkpoint.sh "<commit-message>" "<user-prompt>" [auto|fallback]
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `$1` — commit message | Yes | Your `checkpoint(scope): ...` message with body |
| `$2` — user prompt | No | The user's original request that triggered this work |
| `$3` — checkpoint type | No | `auto` (default) or `fallback` (when triggered by stop hook) |

### What the Script Does (You Don't Need to Do These)

The script handles:
- `git add -A` to stage all changes
- Truncating the user prompt to ≤60 characters
- Appending Git Trailers (`Agent`, `Checkpoint-Type`, `User-Prompt`) via `git interpret-trailers`
- Executing `git commit -F -`

**You only need to generate the commit message and call the script.** Do not run `git add` or `git commit` yourself.

---

## Fallback Commits

If the **stop hook** detects uncommitted changes when the conversation ends, it will send you a reminder. When you receive this reminder:

1. Review the uncommitted changes
2. Generate a proper `checkpoint(scope): description` message
3. Call the script with `fallback` as the third argument:

```bash
bash .cursor/scripts/checkpoint.sh "<message>" "<user-prompt>" fallback
```

---

## What NOT to Do

- **Do not** skip commits because "it's a small change" — small changes add up
- **Do not** run `git add` or `git commit` directly — always use the checkpoint script
- **Do not** generate trailer metadata yourself — the script handles it
- **Do not** use types other than `checkpoint` — this is not a regular development workflow
- **Do not** squash multiple unrelated changes into one commit — each logical unit gets its own checkpoint

---

## Quick Reference

```
When:  After each logical unit of work
What:  checkpoint(<scope>): <description>\n\n<body>
How:   bash .cursor/scripts/checkpoint.sh "<msg>" "<prompt>" [auto|fallback]
```
