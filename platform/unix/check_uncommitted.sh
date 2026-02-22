#!/usr/bin/env bash
#
# check_uncommitted.sh — Stop Hook: 检查未提交的变更
#
# 在 AI 对话结束时触发，检查工作区是否存在未提交的变更。
# 如果存在，输出提醒信息让 AI Agent 执行 fallback checkpoint commit。
#
# 支持平台:
#   - Cursor: stop hook (stdin JSON 含 workspace_roots)
#   - Claude Code: Stop hook (stdin JSON 含 hook_event_name)
#
# 输出协议:
#   - 无问题: {} (空 JSON)
#   - 有问题 (Cursor): {"followup_message": "..."}
#   - 有问题 (Claude Code): {"decision": "block", "reason": "..."}
#
# JSON 解析使用 grep+sed，不依赖 jq。

set -euo pipefail

# ============================================================
# 辅助函数：简易 JSON 字段提取（不依赖 jq）
# ============================================================

# 输出允许通过的 JSON
output_allow() {
    echo '{}'
    exit 0
}

# 从 JSON 中提取布尔字段值
# Usage: json_bool "$json" "field_name" → 输出 "true" 或 "false"
json_bool() {
    local json="$1" field="$2"
    if echo "$json" | grep -qE "\"${field}\"[[:space:]]*:[[:space:]]*true"; then
        echo "true"
    else
        echo "false"
    fi
}

# 从 JSON 中提取字符串字段值
# Usage: json_string "$json" "field_name" → 输出字符串值（不含引号）
json_string() {
    local json="$1" field="$2"
    echo "$json" | grep -oE "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
        | sed -E "s/\"${field}\"[[:space:]]*:[[:space:]]*\"([^\"]*)\"/\1/" \
        | head -1
}

# 从 JSON 的 workspace_roots / workspaceRoots 数组中提取第一个路径
# Usage: json_workspace_root "$json" → 输出路径
json_workspace_root() {
    local json="$1"
    local result=""

    # 尝试 workspace_roots 和 workspaceRoots
    for field in "workspace_roots" "workspaceRoots"; do
        result=$(echo "$json" \
            | grep -oE "\"${field}\"[[:space:]]*:[[:space:]]*\[[^]]*\]" \
            | grep -oE '"[^"]*"' \
            | tail -n +2 \
            | head -1 \
            | tr -d '"' || true)
        if [[ -n "$result" ]]; then
            echo "$result"
            return
        fi
    done
}

# ============================================================
# 平台检测
# ============================================================

detect_platform() {
    local json="$1"
    if [[ -z "$json" ]]; then
        echo "unknown"
        return
    fi
    # Claude Code: 有 hook_event_name 或 tool_name
    if echo "$json" | grep -qE '"hook_event_name"|"tool_name"'; then
        echo "claude_code"
    else
        echo "cursor"
    fi
}

# ============================================================
# Workspace Root 检测
# ============================================================

get_workspace_root() {
    local json="$1"

    # 优先从 stdin JSON 获取
    if [[ -n "$json" ]]; then
        local ws
        ws=$(json_workspace_root "$json")
        if [[ -n "$ws" ]]; then
            echo "$ws"
            return
        fi
    fi

    # 回退到环境变量
    for env_var in CURSOR_PROJECT_DIR CLAUDE_PROJECT_DIR WORKSPACE_ROOT PROJECT_ROOT; do
        local val="${!env_var:-}"
        if [[ -n "$val" ]]; then
            echo "$val"
            return
        fi
    done

    # 最终回退到 PWD / cwd
    echo "${PWD:-$(pwd)}"
}

# ============================================================
# Git 操作
# ============================================================

is_git_repo() {
    git -C "$1" rev-parse --is-inside-work-tree &>/dev/null
}

has_uncommitted_changes() {
    local status
    status=$(git -C "$1" status --porcelain 2>/dev/null)
    [[ -n "$status" ]]
}

get_change_summary() {
    local workspace="$1"
    local max_lines="${2:-20}"
    local output
    output=$(git -C "$workspace" status --short 2>/dev/null || true)

    if [[ -z "$output" ]]; then
        return
    fi

    local total
    total=$(echo "$output" | wc -l)

    if [[ "$total" -gt "$max_lines" ]]; then
        echo "$output" | head -n "$max_lines"
        echo "  ... and $((total - max_lines)) more files"
    else
        echo "$output"
    fi
}

# ============================================================
# 输出提醒
# ============================================================

# 转义字符串用于 JSON 值（处理引号、反斜杠、换行等）
json_escape() {
    local str="$1"
    str="${str//\\/\\\\}"    # 反斜杠
    str="${str//\"/\\\"}"    # 双引号
    str="${str//$'\n'/\\n}"  # 换行
    str="${str//$'\r'/\\r}"  # 回车
    str="${str//$'\t'/\\t}"  # Tab
    echo "$str"
}

output_block() {
    local message="$1"
    local platform="$2"
    local escaped
    escaped=$(json_escape "$message")

    if [[ "$platform" == "cursor" ]]; then
        echo "{\"followup_message\":\"${escaped}\"}"
    elif [[ "$platform" == "claude_code" ]]; then
        echo "{\"decision\":\"block\",\"reason\":\"${escaped}\"}"
    else
        echo "{\"message\":\"${escaped}\"}"
    fi
    exit 0
}

# ============================================================
# 主逻辑
# ============================================================

main() {
    # 从 stdin 读取 JSON（非阻塞：如果无输入则为空）
    local input=""
    if [[ ! -t 0 ]]; then
        input=$(cat)
    fi

    # Claude Code 的 stop_hook_active 防止无限循环
    if [[ -n "$input" ]]; then
        local stop_active
        stop_active=$(json_bool "$input" "stop_hook_active")
        if [[ "$stop_active" == "true" ]]; then
            output_allow
        fi
    fi

    # 检测平台
    local platform
    platform=$(detect_platform "$input")

    # 获取 workspace root
    local workspace
    workspace=$(get_workspace_root "$input")

    # 检查是否为 git 仓库
    if ! is_git_repo "$workspace"; then
        output_allow
    fi

    # 检查是否有未提交变更
    if ! has_uncommitted_changes "$workspace"; then
        output_allow
    fi

    # 获取变更摘要
    local changes
    changes=$(get_change_summary "$workspace")
    local changes_indented
    changes_indented=$(echo "$changes" | sed 's/^/  /')

    # 构建提醒消息
    local reminder
    reminder="## ⚠️ Uncommitted Changes Detected

There are uncommitted changes in the workspace. Please create a checkpoint commit before ending the conversation.

**Changed files:**
\`\`\`
${changes_indented}
\`\`\`

**Action Required**: Run the checkpoint script to commit these changes:

**macOS/Linux:**
\`\`\`bash
~/.agent-better-checkpoint/scripts/checkpoint.sh \"checkpoint(<scope>): <description>\" \"<user-prompt>\" --type fallback
\`\`\`

**Windows (PowerShell):**
\`\`\`powershell
powershell -File \"\$env:USERPROFILE/.agent-better-checkpoint/scripts/checkpoint.ps1\" \"checkpoint(<scope>): <description>\" \"<user-prompt>\" -Type fallback
\`\`\`"

    output_block "$reminder" "$platform"
}

main
