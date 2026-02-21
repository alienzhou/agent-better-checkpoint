#!/usr/bin/env bash
#
# checkpoint.sh — AI Agent checkpoint commit 脚本
#
# 职责（参见 D02/D06）：
#   1. 接收 AI 生成的 commit message ($1) 和用户 prompt ($2)
#   2. 截断 user prompt 至 ≤60 字符（头尾保留，中间 ...）
#   3. 通过 git interpret-trailers 追加 Git Trailer
#   4. 执行 git add -A && git commit
#
# 用法:
#   ./checkpoint.sh "<commit-message>" "<user-prompt>" [auto|fallback]

set -euo pipefail

MSG="${1:?Error: commit message is required}"
USER_PROMPT="${2:-}"
CHECKPOINT_TYPE="${3:-auto}"
AGENT="cursor"
MAX_PROMPT_LEN=60

# ─── 截断 user prompt ────────────────────────────────────
truncate_prompt() {
    local text="$1"
    local max="$2"
    local len=${#text}

    if [ "$len" -le "$max" ]; then
        echo "$text"
        return
    fi

    local keep=$(( (max - 3) / 2 ))
    local head="${text:0:$keep}"
    local tail="${text:$((len - keep)):$keep}"
    echo "${head}...${tail}"
}

TRUNCATED_PROMPT=""
if [ -n "$USER_PROMPT" ]; then
    TRUNCATED_PROMPT=$(truncate_prompt "$USER_PROMPT" "$MAX_PROMPT_LEN")
fi

# ─── 构造 trailer 参数 ───────────────────────────────────
TRAILER_ARGS=(
    --trailer "Agent: ${AGENT}"
    --trailer "Checkpoint-Type: ${CHECKPOINT_TYPE}"
)

if [ -n "$TRUNCATED_PROMPT" ]; then
    TRAILER_ARGS+=(--trailer "User-Prompt: ${TRUNCATED_PROMPT}")
fi

# ─── 确保 message 以换行结尾（trailer 解析需要） ─────────
if [[ "$MSG" != *$'\n' ]]; then
    MSG="${MSG}"$'\n'
fi

# ─── 暂存 + 提交 ─────────────────────────────────────────
git add -A

# 检查是否有内容可提交
if git diff --cached --quiet; then
    echo "Nothing to commit, working tree clean."
    exit 0
fi

echo "$MSG" \
    | git interpret-trailers "${TRAILER_ARGS[@]}" \
    | git commit -F -

echo "Checkpoint committed successfully."
