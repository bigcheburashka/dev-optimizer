# Duplicate Dependencies Strategy

## Problem

Multiple versions of same package in dependency tree:
- Increases bundle size
- Can cause type conflicts
- Makes debugging harder

## Root Causes

1. **Different major versions** - Package A needs v4, Package B needs v5
2. **Outdated transitive deps** - Old jest pulls chalk@4 while we use chalk@5
3. **Package manager fragmentation** - npm/yarn/pnpm resolve differently

## Safe Solutions

### 1. npm dedupe (Safe)

```bash
npm dedupe --dry-run  # Preview
npm dedupe            # Apply
```

Only merges compatible versions (same major).

### 2. Update packages (Safe with tests)

```bash
npm update
npm audit fix
```

Updates to latest compatible versions.

### 3. Resolution overrides (Caution)

```json
// package.json
"overrides": {
  "chalk": "^5.0.0"
}
```

Forces all packages to use same version. RISKY.

## Interactive Fix Strategy

### Step 1: Analyze Source

```bash
npm ls <package>
```

Shows which packages pull different versions.

### Step 2: Show Impact

```
chalk: 4.1.2, 5.6.2
├── chalk@5.6.2 (direct, 1.2MB)
└── chalk@4.1.2 (jest-matcher-utils, 0.8MB)

Potential savings: 0.8MB
Risk: Low (different majors)
```

### Step 3: Offer Options

```
[1] npm dedupe --dry-run (preview merge)
[2] Update jest to latest (may fix chalk version)
[3] Add override to package.json (force one version)
[4] Skip (keep both versions)
```

### Step 4: Execute Safely

```typescript
// In fix.ts
if (finding.id.startsWith('deps-duplicate')) {
  // Show dependency tree
  console.log(await runNpmLs(packageName));
  
  // Offer options
  const choice = await askChoice([
    'npm dedupe --dry-run',
    'Update packages',
    'Add override',
    'Skip'
  ]);
  
  // Safe execution
  if (choice === 'dedupe') {
    await runNpmDedupe();
  }
}
```

## Examples

### chalk@4.1.2 + 5.6.2

**Source:** jest uses old chalk
**Solution:** Update jest
**Command:** `npm update jest`

### minimatch@3.x + 9.x + 10.x

**Source:** Different packages need different majors
**Solution:** npm dedupe (merges 3.x only)
**Command:** `npm dedupe --dry-run`

### string-width@4 + 5 + 8

**Source:** ora, inquirer, chalk use different versions
**Solution:** Add resolution
**Command:** Edit package.json overrides

## Implementation Priority

1. Show dependency tree for duplicate packages
2. Add `npm dedupe --dry-run` preview
3. Suggest package updates
4. Add resolution override option (with warning)