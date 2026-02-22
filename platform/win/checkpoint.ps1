<#
.SYNOPSIS
    checkpoint.ps1 — 创建语义化的 Git checkpoint commit (Windows PowerShell)

.DESCRIPTION
    AI 生成描述性内容（subject + body），本脚本负责：
    1. 截断 user-prompt（≤60字符，头尾截断）
    2. 通过 git interpret-trailers 追加元信息
    3. 执行 git add -A && git commit

.PARAMETER Message
    Full commit message (subject + blank line + body). Required.

.PARAMETER UserPrompt
    The user's original prompt/request. Optional.

.PARAMETER Type
    Checkpoint type: "auto" (default) or "fallback".

.EXAMPLE
    .\checkpoint.ps1 "checkpoint(auth): add JWT refresh" "implement token refresh"
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,

    [Parameter(Position = 1)]
    [string]$UserPrompt = "",

    [string]$Type = "auto"
)

$ErrorActionPreference = "Stop"

# ============================================================
# 平台检测
# ============================================================

function Detect-Platform {
    if ($env:CLAUDE_CODE -or (Get-Command claude -ErrorAction SilentlyContinue)) {
        return "claude-code"
    }
    if ($env:CURSOR_VERSION -or $env:CURSOR_TRACE_ID) {
        return "cursor"
    }
    return "unknown"
}

$AgentPlatform = Detect-Platform

# ============================================================
# User-Prompt 截断（≤60 字符，头尾保留 + 中间省略号）
# ============================================================

function Truncate-Prompt {
    param([string]$Prompt)

    $MaxLen = 60
    if ($Prompt.Length -le $MaxLen) {
        return $Prompt
    }

    $HeadLen = [math]::Floor(($MaxLen - 3) / 2)
    $TailLen = $MaxLen - 3 - $HeadLen
    $Head = $Prompt.Substring(0, $HeadLen)
    $Tail = $Prompt.Substring($Prompt.Length - $TailLen, $TailLen)
    return "${Head}...${Tail}"
}

$TruncatedPrompt = ""
if ($UserPrompt) {
    $TruncatedPrompt = Truncate-Prompt -Prompt $UserPrompt
}

# ============================================================
# 检查是否有变更
# ============================================================

function Test-HasChanges {
    # staged 变更
    $diffCached = git diff --cached --quiet 2>$null
    if ($LASTEXITCODE -ne 0) { return $true }

    # unstaged 变更
    $diffWorking = git diff --quiet 2>$null
    if ($LASTEXITCODE -ne 0) { return $true }

    # untracked 文件
    $untracked = git ls-files --others --exclude-standard 2>$null
    if ($untracked) { return $true }

    return $false
}

if (-not (Test-HasChanges)) {
    Write-Host "No changes to commit."
    exit 0
}

# ============================================================
# git add -A
# ============================================================

git add -A

# ============================================================
# 构建 trailer 并提交
# ============================================================

$TrailerArgs = @(
    "--trailer", "Agent: $AgentPlatform",
    "--trailer", "Checkpoint-Type: $Type"
)

if ($TruncatedPrompt) {
    $TrailerArgs += @("--trailer", "User-Prompt: $TruncatedPrompt")
}

# 通过管道传递消息 → git interpret-trailers → git commit
$Message | git interpret-trailers @TrailerArgs | git commit -F -

Write-Host "Checkpoint committed successfully."
