#!/usr/bin/env bash
#
# checkpoint.sh — 创建语义化的 Git checkpoint commit
#
# AI 生成描述性内容（subject + body），本脚本负责：
# 1. 截断 user-prompt（≤60字符，头尾截断）
# 2. 通过 git interpret-trailers 追加元信息
# 3. 执行 git add -A && git commit
#
# Usage:
#   checkpoint.sh <message> [user-prompt] [--type auto|fallback]

set -euo pipefail

# ============================================================
# 参数解析
# ============================================================
MESSAGE="${1:-}"
USER_PROMPT="${2:-}"
CHECKPOINT_TYPE="auto"

shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --type)
            CHECKPOINT_TYPE="${2:-auto}"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

if [[ -z "$MESSAGE" ]]; then
    echo "Error: commit message is required" >&2
    echo "Usage: checkpoint.sh <message> [user-prompt] [--type auto|fallback]" >&2
    exit 1
fi

# ============================================================
# 平台检测
# ============================================================
detect_platform() {
    if [[ -n "${CLAUDE_CODE:-}" ]] || command -v claude &>/dev/null; then
        echo "claude-code"
    elif [[ -n "${CURSOR_VERSION:-}" ]] || [[ -n "${CURSOR_TRACE_ID:-}" ]]; then
        echo "cursor"
    else
        echo "unknown"
    fi
}

AGENT_PLATFORM=$(detect_platform)

# ============================================================
# User-Prompt 截断（≤60 字符，头尾保留 + 中间省略号）
# ============================================================
truncate_prompt() {
    local prompt="$1"
    local max_len=60
    local len=${#prompt}

    if [[ $len -le $max_len ]]; then
        echo "$prompt"
        return
    fi

    local head_len=$(( (max_len - 3) / 2 ))
    local tail_len=$(( max_len - 3 - head_len ))
    local head="${prompt:0:$head_len}"
    local tail="${prompt:$((len - tail_len)):$tail_len}"
    echo "${head}...${tail}"
}

TRUNCATED_PROMPT=""
if [[ -n "$USER_PROMPT" ]]; then
    TRUNCATED_PROMPT=$(truncate_prompt "$USER_PROMPT")
fi

# ============================================================
# 检查是否有变更
# ============================================================
has_changes() {
    # staged 变更
    if ! git diff --cached --quiet 2>/dev/null; then
        return 0
    fi
    # unstaged 变更
    if ! git diff --quiet 2>/dev/null; then
        return 0
    fi
    # untracked 文件
    if [[ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]]; then
        return 0
    fi
    return 1
}

if ! has_changes; then
    echo "No changes to commit."
    exit 0
fi

# ============================================================
# git add -A
# ============================================================
git add -A

# ============================================================
# 构建 trailer 并提交
# ============================================================
TRAILER_ARGS=(
    --trailer "Agent: ${AGENT_PLATFORM}"
    --trailer "Checkpoint-Type: ${CHECKPOINT_TYPE}"
)

if [[ -n "$TRUNCATED_PROMPT" ]]; then
    TRAILER_ARGS+=(--trailer "User-Prompt: ${TRUNCATED_PROMPT}")
fi

echo "$MESSAGE" | git interpret-trailers "${TRAILER_ARGS[@]}" | git commit -F -

echo "Checkpoint committed successfully."
