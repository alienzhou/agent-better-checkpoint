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

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync, rmSync, statSync } from 'node:fs';
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
  const args = { platform: null, uninstall: false, projectLocal: false, dir: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--platform':
        args.platform = argv[++i];
        if (!['cursor', 'claude'].includes(args.platform)) {
          console.error(`Error: unsupported platform "${args.platform}". Use "cursor" or "claude".`);
          process.exit(1);
        }
        break;
      case '--project-local':
        args.projectLocal = true;
        break;
      case '--dir':
        args.dir = argv[++i];
        if (!args.dir) {
          console.error('Error: --dir requires a path argument');
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
  --project-local             Install to current project (.vibe-x/agent-better-checkpoint/)
  --dir <path>                Install to specified project directory
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

  // Check if already registered
  const alreadyRegistered = config.hooks.stop.some(
    h => typeof h === 'object' && h.command && h.command.includes(SKILL_NAME.replace(/-/g, ''))
  );

  // More precise check: command includes agent-better-checkpoint
  const registered = config.hooks.stop.some(
    h => typeof h === 'object' && h.command && h.command.includes('agent-better-checkpoint')
  );

  if (!registered) {
    config.hooks.stop.push({ command: hookCmd });
  }

  writeJsonFile(hooksPath, config);
  console.log(`  Config  → ${hooksPath}`);
}

function installProjectLocal(targetDir, osType) {
  const projectBase = join(resolve(targetDir), '.vibe-x', 'agent-better-checkpoint');
  ensureDir(projectBase);

  if (osType === 'unix') {
    copyFileSafe(join(PLATFORM_DIR, 'unix', 'checkpoint.sh'), join(projectBase, 'checkpoint.sh'));
    copyFileSafe(join(PLATFORM_DIR, 'unix', 'check_uncommitted.sh'), join(projectBase, 'check_uncommitted.sh'));
    setExecutable(join(projectBase, 'checkpoint.sh'));
    setExecutable(join(projectBase, 'check_uncommitted.sh'));
  }
  copyFileSafe(join(PLATFORM_DIR, 'win', 'checkpoint.ps1'), join(projectBase, 'checkpoint.ps1'));
  copyFileSafe(join(PLATFORM_DIR, 'win', 'check_uncommitted.ps1'), join(projectBase, 'check_uncommitted.ps1'));

  const configDest = join(projectBase, 'config.yml');
  if (!existsSync(configDest) && existsSync(CONFIG_TEMPLATE)) {
    copyFileSafe(CONFIG_TEMPLATE, configDest);
  }

  console.log(`  Project → ${projectBase}/`);
}

function uninstallProjectLocal(targetDir) {
  const projectBase = join(resolve(targetDir), '.vibe-x', 'agent-better-checkpoint');
  if (existsSync(projectBase)) {
    rmSync(projectBase, { recursive: true, force: true });
    console.log(`  Removed project-local: ${projectBase}`);
  } else {
    console.log(`  ${projectBase} not found, nothing to remove`);
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
  const projectTargetDir = args.dir || (args.projectLocal ? process.cwd() : null);

  if (!aiPlatform && !projectTargetDir) {
    console.error(
      'Error: could not detect AI platform.\n' +
      'Please specify: npx @vibe-x/agent-better-checkpoint --platform cursor|claude'
    );
    process.exit(1);
  }

  if (args.uninstall) {
    if (projectTargetDir) {
      console.log('\n[Project-local] Uninstalling...');
      uninstallProjectLocal(projectTargetDir);
    } else if (aiPlatform) {
      console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Uninstalling...`);
      if (aiPlatform === 'cursor') {
        uninstallCursorSkill();
        unregisterCursorHook();
      } else {
        uninstallClaudeSkill();
        unregisterClaudeHook();
      }
      uninstallScripts();
    }
    console.log('\n✅ Uninstallation complete!');
  } else {
    if (projectTargetDir) {
      if (!aiPlatform) {
        console.error('Error: --project-local/--dir requires AI platform for global hook. Specify --platform cursor|claude');
        process.exit(1);
      }
      console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Installing... (OS: ${osType})`);
      installScripts(osType);
      installSkill(aiPlatform);
      if (aiPlatform === 'cursor') {
        registerCursorHook(osType);
      } else {
        registerClaudeHook(osType);
      }
      installProjectLocal(projectTargetDir, osType);
    } else {
      console.log(`\n[${aiPlatform === 'cursor' ? 'Cursor' : 'Claude Code'}] Installing... (OS: ${osType})`);
      installScripts(osType);
      installSkill(aiPlatform);
      if (aiPlatform === 'cursor') {
        registerCursorHook(osType);
      } else {
        registerClaudeHook(osType);
      }
    }

    console.log('\n✅ Installation complete!');
    console.log('\nInstalled components:');
    console.log(`  📜 Checkpoint script → ~/.vibe-x/agent-better-checkpoint/scripts/`);
    console.log(`  🔒 Stop hook         → ~/.vibe-x/agent-better-checkpoint/hooks/stop/`);
    console.log(`  📖 SKILL.md          → ${aiPlatform === 'cursor' ? '~/.cursor/skills/' : '~/.claude/skills/'}${SKILL_NAME}/`);
    if (projectTargetDir) {
      const projectBase = join(resolve(projectTargetDir), '.vibe-x', 'agent-better-checkpoint');
      console.log(`  📁 Project-local     → ${projectBase}/`);
    }
    console.log('\nThe AI agent will now auto-commit with semantic messages. Happy coding! 🎉');
  }
}

main();
