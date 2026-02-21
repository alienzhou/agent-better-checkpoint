#!/usr/bin/env python3
"""
Hook: Check Uncommitted Changes (Checkpoint Fallback)

会话结束时检查是否有未提交的变更，如果有则通过 followup_message
提醒 Agent 执行 fallback commit。

触发:
- Cursor: stop hook
- Claude Code: Stop hook

参见: D01 (触发策略), D06 (MVP 范围)
"""

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from common.logging_utils import (  # noqa: E402
    log_action,
    log_debug,
    log_error,
    log_hook_end,
    log_hook_start,
    log_info,
    log_skip,
)
from common.platform_utils import (  # noqa: E402
    Platform,
    allow_and_exit,
    block_and_exit,
    detect_platform,
    is_stop_hook_active,
    read_stdin_json,
)

HOOK_NAME = "check_uncommitted"


def get_workspace_root(input_data: dict | None = None) -> Path:
    """从 stdin / 环境变量 / cwd 推断 workspace root。"""
    if input_data:
        for key in ("workspace_roots", "workspaceRoots"):
            roots = input_data.get(key)
            if isinstance(roots, list) and roots:
                return Path(roots[0])

    for env in ("CURSOR_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "WORKSPACE_ROOT", "PROJECT_ROOT", "PWD"):
        val = os.environ.get(env)
        if val:
            return Path(val)

    return Path.cwd()


def is_git_repo(path: Path) -> bool:
    """检查目录是否为 git 仓库。"""
    try:
        subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=str(path),
            capture_output=True,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def has_uncommitted_changes(path: Path) -> tuple[bool, str]:
    """
    检查工作区是否有未提交的变更。

    Returns:
        (has_changes, summary_text)
    """
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(path),
            capture_output=True,
            text=True,
            check=True,
        )
        lines = [l for l in result.stdout.strip().splitlines() if l.strip()]
        if not lines:
            return False, ""

        summary_parts = []
        staged = sum(1 for l in lines if l[0] != " " and l[0] != "?")
        untracked = sum(1 for l in lines if l.startswith("??"))
        modified = sum(1 for l in lines if l[0] == " " or (l[0] == "?" and not l.startswith("??")))
        unstaged_modified = sum(1 for l in lines if len(l) > 1 and l[1] == "M")

        if staged:
            summary_parts.append(f"{staged} staged")
        if unstaged_modified:
            summary_parts.append(f"{unstaged_modified} modified")
        if untracked:
            summary_parts.append(f"{untracked} untracked")
        if not summary_parts:
            summary_parts.append(f"{len(lines)} changed")

        return True, ", ".join(summary_parts)

    except (subprocess.CalledProcessError, FileNotFoundError):
        return False, ""


def format_reminder(workspace: Path, summary: str) -> str:
    """构造提醒消息，让 Agent 执行 fallback commit。"""
    script_path = workspace / ".cursor" / "scripts" / "checkpoint.sh"

    msg = (
        "## Uncommitted Changes Detected\n\n"
        f"There are uncommitted changes in the workspace ({summary}).\n\n"
        "Please perform a **fallback checkpoint commit** before ending:\n\n"
        "```bash\n"
        f'bash {script_path} "<commit-message>" "<user-prompt>" fallback\n'
        "```\n\n"
        "Generate a proper `checkpoint(<scope>): <description>` message that describes "
        "the changes, then call the script above."
    )
    return msg


def main():
    input_data = None
    platform = Platform.UNKNOWN

    try:
        input_data = read_stdin_json()
        log_hook_start(HOOK_NAME, input_data)

        platform = detect_platform(input_data) if input_data else Platform.UNKNOWN
        log_info(f"Detected platform: {platform.value}")

        if input_data and is_stop_hook_active(input_data):
            log_skip("stop_hook_active is True, bypassing check")
            log_hook_end(HOOK_NAME, {}, success=True)
            allow_and_exit()

        workspace = get_workspace_root(input_data)
        log_debug(f"Workspace root: {workspace}")

        if not is_git_repo(workspace):
            log_skip("Not a git repository")
            log_hook_end(HOOK_NAME, {}, success=True)
            allow_and_exit()

        has_changes, summary = has_uncommitted_changes(workspace)

        if not has_changes:
            log_info("Working tree clean, nothing to remind")
            log_hook_end(HOOK_NAME, {}, success=True)
            allow_and_exit()

        log_action(f"Uncommitted changes detected: {summary}")
        reminder = format_reminder(workspace, summary)
        log_hook_end(HOOK_NAME, {"action": "remind"}, success=True)
        block_and_exit(reminder, platform)

    except Exception as e:
        log_error(f"Unexpected error in {HOOK_NAME}", e)
        log_hook_end(HOOK_NAME, {}, success=False)
        allow_and_exit()


if __name__ == "__main__":
    main()
