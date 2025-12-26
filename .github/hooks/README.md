# Git Hooks

This directory contains git hooks that are automatically installed for all developers.

## Pre-commit Hook

The `pre-commit` hook runs ESLint and TypeScript type checking **on staged files only** before every commit to ensure code quality while maintaining fast commit times.

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

### Performance

The pre-commit hook uses `lint-staged` to check only staged files, providing fast feedback:

**Current behavior:**
- ✅ Only checks staged `.ts` and `.tsx` files
- ✅ Fast commits: ~1-5 seconds for most changes
- ✅ Auto-fixes ESLint issues with `--fix`
- ✅ TypeScript checking via `tsc-files` (faster than full `tsc`)

**Configuration:**
See `lint-staged` section in `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "tsc-files --noEmit"
  ]
}
```

**Note:** While this only checks staged files, GitHub Actions CI runs full checks on all files to catch any cross-file issues.

## CI/CD

Even if you bypass the pre-commit hook, the GitHub Actions workflow will run the same checks on all PRs, ensuring no issues reach the main branch.
