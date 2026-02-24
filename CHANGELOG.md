# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING**: `--target` is now project-only: when specified, installs only to the target directory (`.cursor/skills/`, `.cursor/hooks.json`, `.vibe-x/`), no global writes. Use without `--target` for global install.

### Fixed

- Uninstall with `--target` now correctly detects platform from project (cursor vs claude) when `--platform` is omitted

---

## [0.3.0] - 2026-02-24

### Added

- `--target` option for project-level install: install scripts into a project directory for self-contained setup (commit with repo)
- Project-local mode: `.vibe-x/agent-better-checkpoint/` can be committed; global hook delegates to project-local scripts when present

### Changed

- Renamed `--project-local` / `--dir` to unified `--target` option

### Fixed

- Uninstall now correctly cleans all installed platforms (global + project-local)

---

## [0.2.0] - 2025

### Added

- **ABC** (Agent Better Checkpoint) acronym in branding
- Passive file filtering and threshold trigger in stop hook: configurable via `.vibe-x/config/checkpoint.yaml`
- `discuss-for-specs` skill with hooks infrastructure for discussion facilitation

### Changed

- Restructured project with `.vibe-x` local scripts layout
- Stop hook: passive patterns (e.g. `.discuss/**`, `.vibe-x/**`) and `min_changed_lines` threshold

---

## [0.1.1] - 2025

### Fixed

- Claude: install skill to standard skills directory

### Chore

- Ignore `.agentlens` directory
- Add agent skills configuration

---

## [0.1.0] - 2025

### Added

- Node.js CLI installer (`npx @vibe-x/agent-better-checkpoint`)
- Unix stop hook: Bash `check_uncommitted.sh`
- Windows stop hook: PowerShell scripts
- SKILL.md with bootstrap and platform commands
- npm package layout: `bin/`, `platform/`, `skill/`
- Core MVP: checkpoint.sh commit script, Conventional Commits + Git Trailers format
- README in English and Chinese
- CONTRIBUTING.md developer handbook
