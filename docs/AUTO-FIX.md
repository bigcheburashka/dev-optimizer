# Auto-fix Implementation Plan

## Current Auto-fixes (6)

| ID | Domain | Finding | Action |
|----|--------|---------|--------|
| docker-001 | Docker | Missing .dockerignore | Create file |
| ci-002 | CI | No caching in GitHub Actions | Add cache config |
| ci-002-gitlab | CI | No caching in GitLab CI | Add cache config |
| deps-003 | Deps | Missing package-lock.json | Generate lockfile |
| deps-001 | Deps | Unused dependency (high conf) | Remove from package.json |

## Proposed Auto-fixes (+4)

| ID | Domain | Finding | Action | Risk |
|----|--------|---------|--------|------|
| ci-004 | CI | No timeout | Add timeout-minutes: 10 | Low |
| ci-006 | CI | Artifact retention not optimized | Add retention-days: 7 | Low |
| deps-009 | Deps | Deprecated package | Comment out in package.json | Medium |
| ci-matrix | CI | No matrix strategy | Add matrix for Node versions | Medium |

## Implementation

### 1. No timeout (ci-004)

Already auto-fixable. Add timeout-minutes to GitHub Actions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
+   timeout-minutes: 10
```

### 2. Artifact retention (ci-006)

Add retention-days to upload-artifact:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/
+   retention-days: 7
```

### 3. Deprecated packages (deps-009)

Comment out deprecated packages in package.json:

```json
{
  "dependencies": {
    "request": "^2.88.0",  // deprecated - use axios instead
    "left-pad": "^1.3.0"   // deprecated - use padStart
  }
}
```

### 4. No matrix (ci-matrix)

Add matrix for Node versions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
+   strategy:
+     matrix:
+       node-version: [18, 20]
    steps:
-     - uses: actions/setup-node@v4
-       with:
-         node-version: 20
+     - uses: actions/setup-node@v4
+       with:
+         node-version: ${{ matrix.node-version }}
```

## Priority

1. **High confidence** (ci-004, ci-006) - safe to auto-fix
2. **Medium confidence** (deps-009) - requires backup
3. **Low confidence** (ci-matrix) - may break existing workflows

## Next Steps

1. Update CiAnalyzer to mark ci-004, ci-006 as autoFixSafe
2. Update fix.ts to handle YAML modifications
3. Add interactive mode for medium confidence fixes
4. Test on real repositories