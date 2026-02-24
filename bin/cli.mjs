#!/usr/bin/env node

/**
 * agent-better-checkpoint installer (Node.js)
 *
 * One-click install via npx: checkpoint scripts, stop hook, and SKILL.md to user env.
 * Deploys platform-specific scripts (macOS/Linux vs Windows).
 *
 * Usage:
 *   npx @vibe-x/agent-better-checkpoint
 *   npx @vibe-x/agent-better-checkpoint --platform cursor
 *   npx @vibe-x/agent-better-checkpoint --uninstall
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

// ============================================================
// Path constants
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const INSTALL_BASE = join(homedir(), '.vibe-x', 'agent-better-checkpoint');
const SKILL_NAME = 'agent-better-checkpoint';

// In-package source paths
const PLATFORM_DIR = join(PKG_ROOT, 'platform');
const SKILL_SRC = join(PKG_ROOT, 'skill', 'SKILL.md');
const CONFIG_TEMPLATE = join(PLATFORM_DIR, 'config.template.yml');

// ============================================================
// Argument parsing
// ============================================================

function parseArgs(argv) {
  const args = { platform: null, uninstall: false, target: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--platform':
        args.platform = argv[++i];
        if (!['cursor', 'claude'].includes(args.platform)) {
          console.error(`Error: unsupported platform "${args.platform}". Use "cursor" or "claude".`);
          process.exit(1);
        }
        break;
      case '--target':
        args.target = argv[++i];
        if (!args.target) {
          console.error('Error: --target requires a path argument');
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
  --target <path>             Project-only install (no global). Use . for cwd
  --uninstall                 Remove installed files and hook registrations
  -h, --help                  Show this help message
`);
}

// ============================================================
// Platform detection
// ============================================================

function detectAIPlatform() {
  const home = homedir();
  // Prefer Claude (if both exist, user can override with --platform)
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
// File operation helpers
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
    // chmod may be ineffective on Windows, ignore
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
// Install logic
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
    // Check skills.sh install path
    const skillsShPath = join(homedir(), '.cursor', 'skills', SKILL_NAME, 'SKILL.md');
    if (existsSync(skillsShPath)) {
      console.log(`  Skill   → already installed at ${skillsShPath} (skipped)`);
      return;
    }

    skillDir = join(homedir(), '.cursor', 'skills', SKILL_NAME);
    skillDest = join(skillDir, 'SKILL.md');
  } else if (aiPlatform === 'claude') {
    // Claude Code: install to standard skills directory
    const skillsRootDir = join(homedir(), '.claude', 'skills');
    skillDir = join(skillsRootDir, SKILL_NAME);
    skillDest = join(skillDir, 'SKILL.md');

    if (existsSync(skillDest)) {
      console.log(`  Skill   → already installed at ${skillDest} (skipped)`);
      return;
    }
  }

  copyFileSafe(SKILL_SRC, skillDest);
  console.log(`  Skill   → ${skillDest}`);
}

function registerCursorHook(osType) {
  const hooksPath = join(homedir(), '.cursor', 'hooks.json');
  let config = readJsonFile(hooksPath) || { version: 1, hooks: {} };

  if (!config.hooks) config.hooks = {};
  if (!config.hooks.stop) config.hooks.stop = [];

  // Build hook command
  let hookCmd;
  if (osType === 'unix') {
    hookCmd = `bash ${INSTALL_BASE}/hooks/stop/check_uncommitted.sh`;
  } else {
    hookCmd = `powershell -File "${INSTALL_BASE}\\hooks\\stop\\check_uncommitted.ps1"`;
  }

  const registered = config.hooks.stop.some(
    h => typeof h === 'object' && h.command && h.command.includes('agent-better-checkpoint')
  );

  if (!registered) {
    config.hooks.stop.push({ command: hookCmd });
  }

  writeJsonFile(hooksPath, config);
  console.log(`  Config  → ${hooksPath}`);
}

// 项目级安装：仅写入 target 目录，不触碰全局
function installProjectOnly(targetDir, aiPlatform, osType) {
  const root = resolve(targetDir);

  // .vibe-x/agent-better-checkpoint: checkpoint 脚本 + config
  const vibeXBase = join(root, '.vibe-x', 'agent-better-checkpoint');
  ensureDir(vibeXBase);
  copyFileSafe(join(PLATFORM_DIR, 'unix', 'checkpoint.sh'), join(vibeXBase, 'checkpoint.sh'));
  copyFileSafe(join(PLATFORM_DIR, 'win', 'checkpoint.ps1'), join(vibeXBase, 'checkpoint.ps1'));
  setExecutable(join(vibeXBase, 'checkpoint.sh'));
  const configDest = join(vibeXBase, 'config.yml');
  if (!existsSync(configDest) && existsSync(CONFIG_TEMPLATE)) {
    copyFileSafe(CONFIG_TEMPLATE, configDest);
  }
  console.log(`  Config  → ${vibeXBase}/`);

  // Skill: .cursor/skills/ 或 .claude/skills/
  const skillRoot = aiPlatform === 'cursor' ? '.cursor' : '.claude';
  const skillDir = join(root, skillRoot, 'skills', SKILL_NAME);
  copyFileSafe(SKILL_SRC, join(skillDir, 'SKILL.md'));
  console.log(`  Skill   → ${skillDir}/`);

  if (aiPlatform === 'cursor') {
    // Cursor 支持项目级 hooks: .cursor/hooks.json + .cursor/hooks/
    const hooksDir = join(root, '.cursor', 'hooks');
    ensureDir(hooksDir);
    copyFileSafe(join(PLATFORM_DIR, 'unix', 'check_uncommitted.sh'), join(hooksDir, 'check_uncommitted.sh'));
    setExecutable(join(hooksDir, 'check_uncommitted.sh'));
    copyFileSafe(join(PLATFORM_DIR, 'win', 'check_uncommitted.ps1'), join(hooksDir, 'check_uncommitted.ps1'));
    const hookCmd = osType === 'unix'
      ? 'bash .cursor/hooks/check_uncommitted.sh'
      : `powershell -File ".cursor\\hooks\\check_uncommitted.ps1"`;
    const hooksPath = join(root, '.cursor', 'hooks.json');
    let config = readJsonFile(hooksPath) || { version: 1, hooks: {} };
    if (!config.hooks) config.hooks = {};
    if (!config.hooks.stop) config.hooks.stop = [];
    const registered = config.hooks.stop.some(
      h => typeof h === 'object' && h.command && h.command.includes('check_uncommitted')
    );
    if (!registered) {
      config.hooks.stop.push({ command: hookCmd });
    }
    writeJsonFile(hooksPath, config);
    console.log(`  Hooks   → ${hooksPath}`);
  } else {
    // Claude Code: settings.json 为全局，无项目级 hooks，仅安装 skill 和脚本
    console.log(`  Hooks   → (Claude stop hook is global-only, skipped for project install)`);
  }
}

function uninstallProjectOnly(targetDir, aiPlatform) {
  const root = resolve(targetDir);

  const vibeXBase = join(root, '.vibe-x', 'agent-better-checkpoint');
  const skillRoot = aiPlatform === 'cursor' ? '.cursor' : '.claude';
  const skillDir = join(root, skillRoot, 'skills', SKILL_NAME);
  if (existsSync(vibeXBase)) {
    rmSync(vibeXBase, { recursive: true, force: true });
    console.log(`  Removed ${vibeXBase}`);
  }

  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(`  Removed ${skillDir}`);
  }
  // 移除空的 .cursor/skills 或 .claude/skills 父目录
  const skillsParent = join(root, skillRoot, 'skills');
  if (existsSync(skillsParent)) {
    try {
      if (readdirSync(skillsParent).length === 0) {
        rmSync(skillsParent, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }

  if (aiPlatform === 'cursor') {
    const hooksPath = join(root, '.cursor', 'hooks.json');
    if (existsSync(hooksPath)) {
      const config = readJsonFile(hooksPath);
      if (config?.hooks?.stop) {
        config.hooks.stop = config.hooks.stop.filter(
          h => !(typeof h === 'object' && h.command && h.command.includes('check_uncommitted'))
        );
        if (config.hooks.stop.length === 0) delete config.hooks.stop;
        if (Object.keys(config.hooks || {}).length === 0) {
          rmSync(hooksPath, { force: true });
        } else {
          writeJsonFile(hooksPath, config);
        }
        console.log(`  Cleaned ${hooksPath}`);
      }
    }
    const hooksDir = join(root, '.cursor', 'hooks');
    const shPath = join(hooksDir, 'check_uncommitted.sh');
    const ps1Path = join(hooksDir, 'check_uncommitted.ps1');
    if (existsSync(shPath)) rmSync(shPath, { force: true });
    if (existsSync(ps1Path)) rmSync(ps1Path, { force: true });
    if (existsSync(hooksDir) && readdirSync(hooksDir).length === 0) {
      rmSync(hooksDir, { recursive: true, force: true });
    }
  }
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
// Uninstall logic
// ============================================================

function hasInstallation(platform) {
  const home = homedir();
  const skillDir = join(home, platform === 'cursor' ? '.cursor' : '.claude', 'skills', SKILL_NAME);
  return existsSync(skillDir);
}

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
  const skillDir = join(homedir(), '.claude', 'skills', SKILL_NAME);
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(`  Removed skill: ${skillDir}`);
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
// Main entry
// ============================================================

function main() {
  const args = parseArgs(process.argv);
  const osType = getOSType();
  const aiPlatform = args.platform || detectAIPlatform();
  const projectTargetDir = args.target ? resolve(args.target) : null;

  if (!aiPlatform && !projectTargetDir && !args.uninstall) {
    console.error(
      'Error: could not detect AI platform.\n' +
      'Please specify: npx @vibe-x/agent-better-checkpoint --platform cursor|claude'
    );
    process.exit(1);
  }

  if (args.uninstall) {
    if (projectTargetDir) {
      // 优先从项目目录检测平台（与安装时一致），否则用 --platform 或全局检测
      let platform = args.platform;
      if (!platform) {
        const cursorSkill = join(projectTargetDir, '.cursor', 'skills', SKILL_NAME);
        const claudeSkill = join(projectTargetDir, '.claude', 'skills', SKILL_NAME);
        if (existsSync(cursorSkill)) platform = 'cursor';
        else if (existsSync(claudeSkill)) platform = 'claude';
      }
      if (!platform) platform = aiPlatform;
      if (!platform) {
        console.error('Error: --target uninstall requires --platform cursor|claude (or project must have skill installed)');
        process.exit(1);
      }
      console.log(`\n[Project-local] Uninstalling from ${projectTargetDir}...`);
      uninstallProjectOnly(projectTargetDir, platform);
    } else {
      const platforms = args.platform
        ? [args.platform]
        : ['cursor', 'claude'].filter(p => hasInstallation(p));
      for (const p of platforms) {
        console.log(`\n[${p === 'cursor' ? 'Cursor' : 'Claude Code'}] Uninstalling...`);
        if (p === 'cursor') {
          uninstallCursorSkill();
          unregisterCursorHook();
        } else {
          uninstallClaudeSkill();
          unregisterClaudeHook();
        }
      }
      if (platforms.length > 0) uninstallScripts();
      if (platforms.length === 0) console.log('\nNo global installation found.');
    }
    console.log('\n✅ Uninstallation complete!');
  } else {
    if (projectTargetDir) {
      if (!aiPlatform) {
        console.error('Error: --target requires --platform cursor|claude');
        process.exit(1);
      }
      console.log(`\n[Project-local] Installing to ${projectTargetDir}... (OS: ${osType})`);
      installProjectOnly(projectTargetDir, aiPlatform, osType);
      console.log('\n✅ Installation complete! (project-only, no global changes)');
    } else {
      console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Installing... (OS: ${osType})`);
      installScripts(osType);
      installSkill(aiPlatform);
      if (aiPlatform === 'cursor') {
        registerCursorHook(osType);
      } else {
        registerClaudeHook(osType);
      }
      console.log('\n✅ Installation complete!');
      console.log('\nInstalled components:');
      console.log(`  📜 Checkpoint script → ~/.vibe-x/agent-better-checkpoint/scripts/`);
      console.log(`  🔒 Stop hook         → ~/.vibe-x/agent-better-checkpoint/hooks/stop/`);
      console.log(`  📖 SKILL.md          → ${aiPlatform === 'cursor' ? '~/.cursor/skills/' : '~/.claude/skills/'}${SKILL_NAME}/`);
    }
    console.log('\nThe AI agent will now auto-commit with semantic messages. Happy coding! 🎉');
  }
}

main();
