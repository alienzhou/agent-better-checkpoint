<#
.SYNOPSIS
    check_uncommitted.ps1 — Stop Hook: 检查未提交的变更 (Windows PowerShell)

.DESCRIPTION
    在 AI 对话结束时触发，检查工作区是否存在未提交的变更。
    如果存在，输出提醒信息让 AI Agent 执行 fallback checkpoint commit。

    支持平台:
    - Cursor: stop hook (stdin JSON 含 workspace_roots)
    - Claude Code: Stop hook (stdin JSON 含 hook_event_name)

    输出协议:
    - 无问题: {} (空 JSON)
    - 有问题 (Cursor): {"followup_message": "..."}
    - 有问题 (Claude Code): {"decision": "block", "reason": "..."}
#>

$ErrorActionPreference = "Stop"

# ============================================================
# 辅助函数
# ============================================================

function Output-Allow {
    Write-Output '{}'
    exit 0
}

function Output-Block {
    param(
        [string]$Message,
        [string]$Platform
    )

    # 转义 JSON 字符串
    $Escaped = $Message -replace '\\', '\\\\' `
                        -replace '"', '\"' `
                        -replace "`r`n", '\n' `
                        -replace "`n", '\n' `
                        -replace "`r", '\r' `
                        -replace "`t", '\t'

    switch ($Platform) {
        "cursor" {
            Write-Output "{`"followup_message`":`"$Escaped`"}"
        }
        "claude_code" {
            Write-Output "{`"decision`":`"block`",`"reason`":`"$Escaped`"}"
        }
        default {
            Write-Output "{`"message`":`"$Escaped`"}"
        }
    }
    exit 0
}

# ============================================================
# 平台检测
# ============================================================

function Detect-Platform {
    param($InputData)

    if (-not $InputData) {
        return "unknown"
    }
    if ($InputData.PSObject.Properties["hook_event_name"] -or
        $InputData.PSObject.Properties["tool_name"]) {
        return "claude_code"
    }
    return "cursor"
}

# ============================================================
# Workspace Root 检测
# ============================================================

function Get-WorkspaceRoot {
    param($InputData)

    # 优先从 stdin JSON 获取
    if ($InputData) {
        foreach ($field in @("workspace_roots", "workspaceRoots")) {
            $roots = $null
            try { $roots = $InputData.$field } catch {}
            if ($roots -and $roots.Count -gt 0) {
                return $roots[0]
            }
        }
    }

    # 回退到环境变量
    foreach ($envVar in @("CURSOR_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "WORKSPACE_ROOT", "PROJECT_ROOT")) {
        $val = [Environment]::GetEnvironmentVariable($envVar)
        if ($val) { return $val }
    }

    # 最终回退到当前目录
    return (Get-Location).Path
}

# ============================================================
# Git 操作
# ============================================================

function Test-GitRepo {
    param([string]$Path)
    try {
        $null = git -C $Path rev-parse --is-inside-work-tree 2>$null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Test-UncommittedChanges {
    param([string]$Path)
    $status = git -C $Path status --porcelain 2>$null
    return [bool]$status
}

function Get-ChangeSummary {
    param(
        [string]$Path,
        [int]$MaxLines = 20
    )

    $output = git -C $Path status --short 2>$null
    if (-not $output) { return "" }

    $lines = $output -split "`n"
    if ($lines.Count -gt $MaxLines) {
        $shown = $lines[0..($MaxLines - 1)]
        $shown += "  ... and $($lines.Count - $MaxLines) more files"
        return ($shown -join "`n")
    }
    return ($lines -join "`n")
}

# ============================================================
# 主逻辑
# ============================================================

# 从 stdin 读取 JSON
$InputData = $null
try {
    $rawInput = [Console]::In.ReadToEnd()
    if ($rawInput.Trim()) {
        $InputData = $rawInput | ConvertFrom-Json
    }
}
catch {
    # 忽略 JSON 解析错误
}

# Claude Code 的 stop_hook_active 防止无限循环
if ($InputData -and $InputData.PSObject.Properties["stop_hook_active"]) {
    if ($InputData.stop_hook_active -eq $true) {
        Output-Allow
    }
}

# 检测平台
$Platform = Detect-Platform -InputData $InputData

# 获取 workspace root
$Workspace = Get-WorkspaceRoot -InputData $InputData

# 检查是否为 git 仓库
if (-not (Test-GitRepo -Path $Workspace)) {
    Output-Allow
}

# 检查是否有未提交变更
if (-not (Test-UncommittedChanges -Path $Workspace)) {
    Output-Allow
}

# 获取变更摘要
$Changes = Get-ChangeSummary -Path $Workspace
$ChangesIndented = ($Changes -split "`n" | ForEach-Object { "  $_" }) -join "`n"

# 构建提醒消息
$Reminder = @"
## ⚠️ Uncommitted Changes Detected

There are uncommitted changes in the workspace. Please create a checkpoint commit before ending the conversation.

**Changed files:**
``````
$ChangesIndented
``````

**Action Required**: Run the checkpoint script to commit these changes:

**macOS/Linux:**
``````bash
~/.agent-better-checkpoint/scripts/checkpoint.sh "checkpoint(<scope>): <description>" "<user-prompt>" --type fallback
``````

**Windows (PowerShell):**
``````powershell
powershell -File "`$env:USERPROFILE/.agent-better-checkpoint/scripts/checkpoint.ps1" "checkpoint(<scope>): <description>" "<user-prompt>" -Type fallback
``````
"@

Output-Block -Message $Reminder -Platform $Platform
