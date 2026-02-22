# Agent Better Checkpoint

**一行命令安装，零配置。** 将 AI Agent 的编辑自动转为透明、可查询的 Git commit。

```bash
npx @vibe-x/agent-better-checkpoint
```

搞定。你的 AI 编程助手（Cursor、Claude Code）会自动在每次有意义的编辑后生成语义化的 commit，并附带结构化元信息——再也不用忍受黑盒 checkpoint。

---

## 问题

AI 编程助手在你工作时会创建"检查点"，但这些都是黑盒快照：
- **看不懂** — 没有有意义的 commit message
- **导航难** — 无法浏览或 diff 单个变更
- **查不到** — 无法过滤、搜索或追溯

## 方案

Agent Better Checkpoint 用真正的 Git commit 替代黑盒快照：

```
checkpoint(api): add user registration endpoint

Implement POST /api/users with email/password validation.
Includes bcrypt hashing and duplicate email check.

Agent: cursor
Checkpoint-Type: auto
User-Prompt: 帮我实现用户注册接口，需要邮...要密码加密
```

每个 commit 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，通过 [Git Trailers](https://git-scm.com/docs/git-interpret-trailers) 携带结构化元信息——用标准 Git 工具即可查询：

```bash
git log --grep="^checkpoint("                          # 所有 checkpoint
git log --format="%(trailers:key=Agent,valueonly)"     # 按 agent 过滤
git log --grep="User-Prompt:.*registration"            # 按 prompt 关键词搜索
```

---

## 工作原理

三个组件，安装后全自动运行：

| 组件 | 作用 |
|------|------|
| **SKILL.md** | 指导 AI 在每次有意义的编辑后自主 commit，并使用规范格式 |
| **Commit 脚本** | 追加 Git Trailers（agent、类型、用户 prompt）并执行 `git commit` |
| **Stop Hook** | 安全网——对话结束时提醒 AI 提交遗漏的变更 |

```
用户下达任务 → AI 编辑代码 → AI 调用 checkpoint 脚本 → 带 trailer 的 Git commit
                                                       ↗
                           对话结束 → Stop hook 检查是否有未提交变更
```

---

## 安装

### 前置条件

- Git ≥ 2.0
- Node.js ≥ 18（仅安装时需要）
- [Cursor](https://cursor.com) 或 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

### 快速安装

```bash
npx @vibe-x/agent-better-checkpoint
```

自动检测 OS 和 AI 平台，也可以手动指定：

```bash
npx @vibe-x/agent-better-checkpoint --platform cursor
npx @vibe-x/agent-better-checkpoint --platform claude
```

### 通过 [skills.sh](https://skills.sh) 安装

```bash
npx skills add alienzhou/agent-better-checkpoint
```

AI Agent 会在首次使用时自动引导安装运行时脚本。

### 安装内容

| 位置 | 内容 |
|------|------|
| `~/.agent-better-checkpoint/scripts/` | Commit 脚本（`checkpoint.sh` / `.ps1`） |
| `~/.agent-better-checkpoint/hooks/stop/` | Stop hook（`check_uncommitted.sh` / `.ps1`） |
| 平台 skill 目录 | `SKILL.md` — AI Agent 指令 |
| 平台 hook 配置 | Stop hook 注册 |

### 卸载

```bash
npx @vibe-x/agent-better-checkpoint --uninstall
```

---

## 平台支持

| 平台 | 操作系统 | 状态 |
|------|----------|------|
| Cursor | macOS、Linux、Windows | ✅ |
| Claude Code | macOS、Linux、Windows | ✅ |

---

## 贡献

开发、测试和发布流程请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
