#!/usr/bin/env python3
"""
Stop Hook: 检查未提交的变更

在 AI 对话结束时触发，检查工作区是否存在未提交的变更。
如果存在，输出提醒信息让 AI Agent 执行 fallback checkpoint commit。

支持平台:
- Cursor: stop hook (stdin JSON 含 workspace_roots)
- Claude Code: Stop hook (stdin JSON 含 hook_event_name)

输出协议:
- 无问题: {} (空 JSON，允许通过)
- 有问题 (Cursor): {"followup_message": "..."}
- 有问题 (Claude Code): {"decision": "block", "reason": "..."}
"""

import json
import os
import subprocess
import sys
from pathlib import Path


# ============================================================
# Workspace Root 检测
# ============================================================

def get_workspace_root(input_data=None):
    """
    优先从 stdin JSON 获取 workspace root，否则回退到环境变量 / cwd。
    """
    if input_data:
        for key in ("workspace_roots", "workspaceRoots"):
            roots = input_data.get(key)
            if isinstance(roots, list) and roots:
                return Path(roots[0])

    for env in (
        "CURSOR_PROJECT_DIR",
        "CLAUDE_PROJECT_DIR",
        "WORKSPACE_ROOT",
        "PROJECT_ROOT",
    ):
        val = os.environ.get(env)
        if val:
            return Path(val)

    return Path(os.environ.get("PWD", os.getcwd()))


# ============================================================
# Git 操作
# ============================================================

def is_git_repo(path):
    """检查路径是否在 git 仓库中。"""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            capture_output=True,
            text=True,
            cwd=str(path),
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def has_uncommitted_changes(path):
    """检查是否存在未提交的变更（staged / unstaged / untracked）。"""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=str(path),
        )
        return bool(result.stdout.strip())
    except (FileNotFoundError, subprocess.SubprocessError):
        return False


def get_change_summary(path, max_lines=20):
    """获取变更文件摘要（限制行数）。"""
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            capture_output=True,
            text=True,
            cwd=str(path),
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) > max_lines:
            shown = lines[:max_lines]
            shown.append(f"  ... and {len(lines) - max_lines} more files")
            return shown
        return lines
    except (FileNotFoundError, subprocess.SubprocessError):
        return []


# ============================================================
# 平台检测与输出
# ============================================================

def detect_platform(input_data):
    """根据 stdin JSON 结构判断平台。"""
    if not input_data:
        return "unknown"
    if "hook_event_name" in input_data or "tool_name" in input_data:
        return "claude_code"
    return "cursor"


def output_allow():
    """输出允许通过的 JSON。"""
    print(json.dumps({}))


def output_block(message, platform):
    """输出阻塞/提醒的 JSON。"""
    if platform == "cursor":
        print(json.dumps({"followup_message": message}))
    elif platform == "claude_code":
        print(json.dumps({"decision": "block", "reason": message}))
    else:
        print(json.dumps({"message": message}))


# ============================================================
# 主逻辑
# ============================================================

def main():
    input_data = None
    try:
        raw = sys.stdin.read().strip()
        if raw:
            input_data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        pass

    # Claude Code 的 stop_hook_active 防止无限循环
    if input_data and input_data.get("stop_hook_active", False):
        output_allow()
        sys.exit(0)

    platform = detect_platform(input_data)
    workspace = get_workspace_root(input_data)

    if not is_git_repo(workspace):
        output_allow()
        sys.exit(0)

    if not has_uncommitted_changes(workspace):
        output_allow()
        sys.exit(0)

    changes = get_change_summary(workspace)
    changes_text = "\n".join(f"  {line}" for line in changes)

    reminder = (
        "## ⚠️ Uncommitted Changes Detected\n\n"
        "There are uncommitted changes in the workspace. "
        "Please create a checkpoint commit before ending the conversation.\n\n"
        f"**Changed files:**\n```\n{changes_text}\n```\n\n"
        "**Action Required**: Run the checkpoint script to commit these changes:\n"
        "```bash\n"
        '~/.agent-better-checkpoint/scripts/checkpoint.sh '
        '"checkpoint(<scope>): <description>" "<user-prompt>" --type fallback\n'
        "```\n"
    )

    output_block(reminder, platform)
    sys.exit(0)


if __name__ == "__main__":
    main()
