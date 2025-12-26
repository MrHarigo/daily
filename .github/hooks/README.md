# Git Hooks

This directory contains git hooks that are automatically installed for all developers.

## Pre-commit Hook

The `pre-commit` hook runs ESLint and TypeScript type checking before every commit to ensure code quality.

### Automatic Installation

The hook is automatically installed when you run `npm install` via the `prepare` script in `package.json`.

### Manual Installation

If the hook isn't installed automatically, you can install it manually:

```bash
ln -sf ../../.github/hooks/pre-commit .git/hooks/pre-commit
```

### Bypassing the Hook

In rare cases where you need to commit despite lint errors (e.g., work-in-progress commit):

```bash
git commit --no-verify -m "your message"
```

**Note:** Use this sparingly! The CI workflow will still catch any issues.

### Performance Considerations

The pre-commit hook runs full linting and type checking on the entire codebase, which can take 10-30 seconds depending on project size.

**Current behavior:**
- ✅ Catches all issues before commit
- ⚠️  Runs on entire codebase (slower)

**Future optimization (not yet implemented):**
- Consider using `lint-staged` to only check staged files
- Would reduce commit time to 1-5 seconds for most commits
- Trade-off: May miss issues in unchanged files that interact with your changes

## CI/CD

Even if you bypass the pre-commit hook, the GitHub Actions workflow will run the same checks on all PRs, ensuring no issues reach the main branch.
