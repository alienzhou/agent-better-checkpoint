#!/usr/bin/env node

/**
 * agent-better-checkpoint 安装器 (Node.js)
 *
 * 通过 npx 一键安装 checkpoint 脚本、stop hook 和 SKILL.md 到用户环境。
 * 按平台（macOS/Linux vs Windows）选择性部署对应脚本。
 *
 * Usage:
 *   npx @vibe-x/agent-better-checkpoint
 *   npx @vibe-x/agent-better-checkpoint --platform cursor
 *   npx @vibe-x/agent-better-checkpoint --uninstall
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

// ============================================================
// 路径常量
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const INSTALL_BASE = join(homedir(), '.agent-better-checkpoint');
const SKILL_NAME = 'agent-better-checkpoint';

// 包内源文件路径
const PLATFORM_DIR = join(PKG_ROOT, 'platform');
const SKILL_SRC = join(PKG_ROOT, 'skill', 'SKILL.md');

// ============================================================
// 参数解析
// ============================================================

function parseArgs(argv) {
  const args = { platform: null, uninstall: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--platform':
        args.platform = argv[++i];
        if (!['cursor', 'claude'].includes(args.platform)) {
          console.error(`Error: unsupported platform "${args.platform}". Use "cursor" or "claude".`);
          process.exit(1);
        }
        break;
      case '--uninstall':
        args.uninstall = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${argv[i]}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
agent-better-checkpoint — Semantic Git Checkpoint Installer

Usage:
  npx @vibe-x/agent-better-checkpoint [options]

Options:
  --platform <cursor|claude>  Target AI platform (auto-detected if omitted)
  --uninstall                 Remove installed files and hook registrations
  -h, --help                  Show this help message
`);
}

// ============================================================
// 平台检测
// ============================================================

function detectAIPlatform() {
  const home = homedir();
  // 优先 Claude（如果两者都存在，用户可以用 --platform 覆盖）
  if (existsSync(join(home, '.claude'))) return 'claude';
  if (existsSync(join(home, '.cursor'))) return 'cursor';
  return null;
}

function getOSType() {
  const p = platform();
  if (p === 'win32') return 'win';
  return 'unix'; // darwin, linux, freebsd, etc.
}

// ============================================================
// 文件操作辅助
// ============================================================

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

function setExecutable(filepath) {
  try {
    const st = statSync(filepath);
    chmodSync(filepath, st.mode | 0o111);
  } catch {
    // Windows 下 chmod 可能无效，忽略
  }
}

function readJsonFile(filepath) {
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filepath, data) {
  ensureDir(dirname(filepath));
  writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ============================================================
// 安装逻辑
// ============================================================

function installScripts(osType) {
  const scriptsDir = join(INSTALL_BASE, 'scripts');
  const hooksDir = join(INSTALL_BASE, 'hooks', 'stop');

  ensureDir(scriptsDir);
  ensureDir(hooksDir);

  if (osType === 'unix') {
    const checkpointSrc = join(PLATFORM_DIR, 'unix', 'checkpoint.sh');
    const hookSrc = join(PLATFORM_DIR, 'unix', 'check_uncommitted.sh');
    const checkpointDest = join(scriptsDir, 'checkpoint.sh');
    const hookDest = join(hooksDir, 'check_uncommitted.sh');

    copyFileSafe(checkpointSrc, checkpointDest);
    copyFileSafe(hookSrc, hookDest);
    setExecutable(checkpointDest);
    setExecutable(hookDest);

    console.log(`  Scripts → ${scriptsDir}/checkpoint.sh`);
    console.log(`  Hooks   → ${hooksDir}/check_uncommitted.sh`);
  } else {
    const checkpointSrc = join(PLATFORM_DIR, 'win', 'checkpoint.ps1');
    const hookSrc = join(PLATFORM_DIR, 'win', 'check_uncommitted.ps1');
    const checkpointDest = join(scriptsDir, 'checkpoint.ps1');
    const hookDest = join(hooksDir, 'check_uncommitted.ps1');

    copyFileSafe(checkpointSrc, checkpointDest);
    copyFileSafe(hookSrc, hookDest);

    console.log(`  Scripts → ${scriptsDir}\\checkpoint.ps1`);
    console.log(`  Hooks   → ${hooksDir}\\check_uncommitted.ps1`);
  }
}

function installSkill(aiPlatform) {
  let skillDir;
  let skillDest;

  if (aiPlatform === 'cursor') {
    // 检查 skills.sh 安装路径
    const skillsShPath = join(homedir(), '.cursor', 'skills', SKILL_NAME, 'SKILL.md');
    if (existsSync(skillsShPath)) {
      console.log(`  Skill   → already installed at ${skillsShPath} (skipped)`);
      return;
    }

    skillDir = join(homedir(), '.cursor', 'skills', SKILL_NAME);
    skillDest = join(skillDir, 'SKILL.md');
  } else if (aiPlatform === 'claude') {
    // Claude Code: 作为 slash command 安装
    const commandsDir = join(homedir(), '.claude', 'commands');
    skillDest = join(commandsDir, `${SKILL_NAME}.md`);

    if (existsSync(skillDest)) {
      console.log(`  Skill   → already installed at ${skillDest} (skipped)`);
      return;
    }

    skillDir = commandsDir;
  }

  copyFileSafe(SKILL_SRC, skillDest);
  console.log(`  Skill   → ${skillDest}`);
}

function registerCursorHook(osType) {
  const hooksPath = join(homedir(), '.cursor', 'hooks.json');
  let config = readJsonFile(hooksPath) || { version: 1, hooks: {} };

  if (!config.hooks) config.hooks = {};
  if (!config.hooks.stop) config.hooks.stop = [];

  // 构建 hook 命令
  let hookCmd;
  if (osType === 'unix') {
    hookCmd = `bash ${INSTALL_BASE}/hooks/stop/check_uncommitted.sh`;
  } else {
    hookCmd = `powershell -File "${INSTALL_BASE}\\hooks\\stop\\check_uncommitted.ps1"`;
  }

  // 检查是否已注册
  const alreadyRegistered = config.hooks.stop.some(
    h => typeof h === 'object' && h.command && h.command.includes(SKILL_NAME.replace(/-/g, ''))
  );

  // 用更精确的检测：检查命令中是否包含 agent-better-checkpoint
  const registered = config.hooks.stop.some(
    h => typeof h === 'object' && h.command && h.command.includes('agent-better-checkpoint')
  );

  if (!registered) {
    config.hooks.stop.push({ command: hookCmd });
  }

  writeJsonFile(hooksPath, config);
  console.log(`  Config  → ${hooksPath}`);
}

function registerClaudeHook(osType) {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  let settings = readJsonFile(settingsPath) || {};

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  let hookCmd;
  if (osType === 'unix') {
    hookCmd = `bash ${INSTALL_BASE}/hooks/stop/check_uncommitted.sh`;
  } else {
    hookCmd = `powershell -File "${INSTALL_BASE}\\hooks\\stop\\check_uncommitted.ps1"`;
  }

  const registered = settings.hooks.Stop.some(
    h => typeof h === 'object' &&
         JSON.stringify(h).includes('agent-better-checkpoint')
  );

  if (!registered) {
    settings.hooks.Stop.push({
      matcher: '',
      hooks: [{ type: 'command', command: hookCmd }]
    });
  }

  writeJsonFile(settingsPath, settings);
  console.log(`  Config  → ${settingsPath}`);
}

// ============================================================
// 卸载逻辑
// ============================================================

function uninstallScripts() {
  if (existsSync(INSTALL_BASE)) {
    rmSync(INSTALL_BASE, { recursive: true, force: true });
    console.log(`  Removed ${INSTALL_BASE}`);
  } else {
    console.log(`  ${INSTALL_BASE} not found, nothing to remove`);
  }
}

function uninstallCursorSkill() {
  const skillDir = join(homedir(), '.cursor', 'skills', SKILL_NAME);
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(`  Removed skill: ${skillDir}`);
  }
}

function uninstallClaudeSkill() {
  const cmdFile = join(homedir(), '.claude', 'commands', `${SKILL_NAME}.md`);
  if (existsSync(cmdFile)) {
    rmSync(cmdFile, { force: true });
    console.log(`  Removed command: ${cmdFile}`);
  }
}

function unregisterCursorHook() {
  const hooksPath = join(homedir(), '.cursor', 'hooks.json');
  if (!existsSync(hooksPath)) return;

  const config = readJsonFile(hooksPath);
  if (!config || !config.hooks || !config.hooks.stop) return;

  config.hooks.stop = config.hooks.stop.filter(
    h => !(typeof h === 'object' && h.command && h.command.includes('agent-better-checkpoint'))
  );

  writeJsonFile(hooksPath, config);
  console.log(`  Cleaned config: ${hooksPath}`);
}

function unregisterClaudeHook() {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return;

  const settings = readJsonFile(settingsPath);
  if (!settings || !settings.hooks || !settings.hooks.Stop) return;

  settings.hooks.Stop = settings.hooks.Stop.filter(
    h => !JSON.stringify(h).includes('agent-better-checkpoint')
  );

  writeJsonFile(settingsPath, settings);
  console.log(`  Cleaned config: ${settingsPath}`);
}

// ============================================================
// 主入口
// ============================================================

function main() {
  const args = parseArgs(process.argv);
  const osType = getOSType();
  const aiPlatform = args.platform || detectAIPlatform();

  if (!aiPlatform) {
    console.error(
      'Error: could not detect AI platform.\n' +
      'Please specify: npx @vibe-x/agent-better-checkpoint --platform cursor|claude'
    );
    process.exit(1);
  }

  if (args.uninstall) {
    // 卸载流程
    console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Uninstalling...`);

    if (aiPlatform === 'cursor') {
      uninstallCursorSkill();
      unregisterCursorHook();
    } else {
      uninstallClaudeSkill();
      unregisterClaudeHook();
    }

    uninstallScripts();
    console.log(`\n✅ Uninstallation complete!`);
  } else {
    // 安装流程
    console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Installing... (OS: ${osType})`);

    installScripts(osType);
    installSkill(aiPlatform);

    if (aiPlatform === 'cursor') {
      registerCursorHook(osType);
    } else {
      registerClaudeHook(osType);
    }

    console.log(`\n✅ Installation complete!`);
    console.log(`\nInstalled components:`);
    console.log(`  📜 Checkpoint script → ~/.agent-better-checkpoint/scripts/`);
    console.log(`  🔒 Stop hook         → ~/.agent-better-checkpoint/hooks/stop/`);
    console.log(`  📖 SKILL.md          → ${aiPlatform === 'cursor' ? '~/.cursor/skills/' : '~/.claude/commands/'}${SKILL_NAME}/`);
    console.log(`\nThe AI agent will now auto-commit with semantic messages. Happy coding! 🎉`);
  }
}

main();
