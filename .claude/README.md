# Claude Code Settings

This directory contains Claude Code configuration for this project.

## Settings Files

- **`settings.json`** - Project-level settings (committed to git, shared across all machines)
- **`settings.local.json`** - Local overrides (gitignored, machine-specific)

## Policy: Use Project-Level Settings

**For this project, we use project-level settings by default.**

### Why?
- This is a multi-machine project (same developer working from different machines)
- Settings should be consistent across all development environments
- Team members (if added later) should have the same permissions

### How to add new settings

When adding new permissions or configuration:

1. ✅ **DO**: Add to `.claude/settings.json` (project-level)
2. ❌ **DON'T**: Add to `.claude/settings.local.json` (local-only)

### When to use local settings

Use `settings.local.json` only for:
- Machine-specific overrides (e.g., different paths)
- Temporary testing
- Personal preferences that shouldn't affect others

### Current Permissions

The project-level settings include permissions for:
- npm operations (install, uninstall, build)
- Git operations (checkout, add, commit, push, pull)
- GitHub CLI (pr list, view, create)
- File operations (find, read)
- Claude updates

These permissions are shared across all machines to ensure consistent behavior.
