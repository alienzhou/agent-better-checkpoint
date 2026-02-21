#!/usr/bin/env python3
"""
agent-better-checkpoint 安装脚本

支持平台: Cursor / Claude Code
安装内容:
  1. 脚本 → ~/.agent-better-checkpoint/scripts/
  2. Hook → ~/.agent-better-checkpoint/hooks/
  3. Skill → 平台 skill 目录
  4. Hook 配置 → 平台 hook 配置文件

Usage:
    python install.py [--platform cursor|claude] [--uninstall]
"""

import argparse
import json
import os
import shutil
import stat
import sys
from pathlib import Path
from typing import Optional

# ============================================================
# 路径常量
# ============================================================

SRC_DIR = Path(__file__).parent
INSTALL_BASE = Path.home() / ".agent-better-checkpoint"

SKILL_SRC = SRC_DIR / "skill" / "SKILL.md"
SCRIPT_SRC = SRC_DIR / "scripts" / "checkpoint.sh"
HOOK_SRC = SRC_DIR / "hooks" / "stop" / "check_uncommitted.py"

SKILL_NAME = "agent-better-checkpoint"


# ============================================================
# 平台检测
# ============================================================

def detect_platform() -> Optional[str]:
    """自动检测当前安装的 AI 平台。"""
    home = Path.home()
    if (home / ".claude").exists():
        return "claude"
    if (home / ".cursor").exists():
        return "cursor"
    return None


# ============================================================
# 通用安装逻辑
# ============================================================

def install_base_files():
    """将脚本和 hook 复制到 ~/.agent-better-checkpoint/"""
    scripts_dir = INSTALL_BASE / "scripts"
    hooks_dir = INSTALL_BASE / "hooks" / "stop"

    scripts_dir.mkdir(parents=True, exist_ok=True)
    hooks_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(SCRIPT_SRC, scripts_dir / "checkpoint.sh")
    shutil.copy2(HOOK_SRC, hooks_dir / "check_uncommitted.py")

    # 确保可执行权限
    (scripts_dir / "checkpoint.sh").chmod(
        (scripts_dir / "checkpoint.sh").stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    )
    (hooks_dir / "check_uncommitted.py").chmod(
        (hooks_dir / "check_uncommitted.py").stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    )

    print(f"  Scripts → {scripts_dir}")
    print(f"  Hooks   → {hooks_dir}")


def uninstall_base_files():
    """移除 ~/.agent-better-checkpoint/"""
    if INSTALL_BASE.exists():
        shutil.rmtree(INSTALL_BASE)
        print(f"  Removed {INSTALL_BASE}")
    else:
        print(f"  {INSTALL_BASE} not found, nothing to remove")


# ============================================================
# Cursor 平台
# ============================================================

def get_cursor_skills_dir() -> Path:
    return Path.home() / ".cursor" / "skills" / SKILL_NAME


def get_cursor_hooks_path() -> Path:
    return Path.home() / ".cursor" / "hooks.json"


def install_cursor():
    """安装到 Cursor 平台。"""
    print("\n[Cursor] Installing...")

    install_base_files()

    # 安装 Skill
    skill_dir = get_cursor_skills_dir()
    skill_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SKILL_SRC, skill_dir / "SKILL.md")
    print(f"  Skill   → {skill_dir / 'SKILL.md'}")

    # 配置 stop hook
    hooks_path = get_cursor_hooks_path()
    hook_cmd = f"python3 {INSTALL_BASE}/hooks/stop/check_uncommitted.py"

    if hooks_path.exists():
        with open(hooks_path, encoding="utf-8") as f:
            config = json.load(f)
    else:
        config = {"version": 1, "hooks": {}}

    hooks = config.setdefault("hooks", {})
    stop_hooks = hooks.setdefault("stop", [])

    already_installed = any(
        SKILL_NAME in h.get("command", "")
        for h in stop_hooks
        if isinstance(h, dict)
    )

    if not already_installed:
        stop_hooks.append({"command": hook_cmd})

    hooks_path.parent.mkdir(parents=True, exist_ok=True)
    with open(hooks_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"  Config  → {hooks_path}")

    print("\n✅ Cursor installation complete!")


def uninstall_cursor():
    """从 Cursor 平台卸载。"""
    print("\n[Cursor] Uninstalling...")

    # 移除 Skill
    skill_dir = get_cursor_skills_dir()
    if skill_dir.exists():
        shutil.rmtree(skill_dir)
        print(f"  Removed skill: {skill_dir}")

    # 移除 hook 配置
    hooks_path = get_cursor_hooks_path()
    if hooks_path.exists():
        with open(hooks_path, encoding="utf-8") as f:
            config = json.load(f)

        stop_hooks = config.get("hooks", {}).get("stop", [])
        config["hooks"]["stop"] = [
            h for h in stop_hooks
            if SKILL_NAME not in h.get("command", "")
        ]

        with open(hooks_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        print(f"  Cleaned config: {hooks_path}")

    uninstall_base_files()
    print("\n✅ Cursor uninstallation complete!")


# ============================================================
# Claude Code 平台
# ============================================================

def get_claude_settings_path() -> Path:
    return Path.home() / ".claude" / "settings.json"


def get_claude_commands_dir() -> Path:
    return Path.home() / ".claude" / "commands"


def install_claude():
    """安装到 Claude Code 平台。"""
    print("\n[Claude Code] Installing...")

    install_base_files()

    # Claude Code 使用 CLAUDE.md 或 commands 目录来注入 skill
    # 将 SKILL.md 复制为 slash command
    commands_dir = get_claude_commands_dir()
    commands_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SKILL_SRC, commands_dir / f"{SKILL_NAME}.md")
    print(f"  Command → {commands_dir / f'{SKILL_NAME}.md'}")

    # 配置 Stop hook
    settings_path = get_claude_settings_path()
    hook_cmd = f"python3 {INSTALL_BASE}/hooks/stop/check_uncommitted.py"

    if settings_path.exists():
        with open(settings_path, encoding="utf-8") as f:
            settings = json.load(f)
    else:
        settings = {}

    hooks = settings.setdefault("hooks", {})
    stop_hooks = hooks.setdefault("Stop", [])

    already_installed = any(
        SKILL_NAME in str(h.get("hooks", [{}])[0].get("command", ""))
        for h in stop_hooks
        if isinstance(h, dict)
    )

    if not already_installed:
        stop_hooks.append({
            "matcher": "",
            "hooks": [{"type": "command", "command": hook_cmd}],
        })

    settings_path.parent.mkdir(parents=True, exist_ok=True)
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
    print(f"  Config  → {settings_path}")

    print("\n✅ Claude Code installation complete!")


def uninstall_claude():
    """从 Claude Code 平台卸载。"""
    print("\n[Claude Code] Uninstalling...")

    # 移除 slash command
    commands_dir = get_claude_commands_dir()
    cmd_file = commands_dir / f"{SKILL_NAME}.md"
    if cmd_file.exists():
        cmd_file.unlink()
        print(f"  Removed command: {cmd_file}")

    # 移除 hook 配置
    settings_path = get_claude_settings_path()
    if settings_path.exists():
        with open(settings_path, encoding="utf-8") as f:
            settings = json.load(f)

        stop_hooks = settings.get("hooks", {}).get("Stop", [])
        settings["hooks"]["Stop"] = [
            h for h in stop_hooks
            if SKILL_NAME not in str(h.get("hooks", [{}])[0].get("command", ""))
        ]

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
        print(f"  Cleaned config: {settings_path}")

    uninstall_base_files()
    print("\n✅ Claude Code uninstallation complete!")


# ============================================================
# 入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Install agent-better-checkpoint for AI coding platforms"
    )
    parser.add_argument(
        "--platform",
        choices=["cursor", "claude"],
        help="Target platform (auto-detected if not specified)",
    )
    parser.add_argument(
        "--uninstall",
        action="store_true",
        help="Uninstall instead of installing",
    )

    args = parser.parse_args()
    platform = args.platform or detect_platform()

    if platform is None:
        print(
            "Error: could not detect platform.\n"
            "Please specify: python install.py --platform cursor|claude"
        )
        sys.exit(1)

    if args.uninstall:
        {"cursor": uninstall_cursor, "claude": uninstall_claude}[platform]()
    else:
        {"cursor": install_cursor, "claude": install_claude}[platform]()


if __name__ == "__main__":
    main()
