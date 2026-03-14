# Auto-Fix Expansion Plan

## Current State

| Auto-fixes | Count | Risk |
|------------|-------|------|
| Safe (autoFixSafe: true) | 6 | Low - apply without asking |
| Review needed (autoFixable: false) | 27 | High - show instructions |

## Proposed Changes

### Phase 1: Add More Safe Auto-fixes

**Docker:**
- `docker-004`: No cleanup after install
  - Auto-fix: Add `&& rm -rf /var/lib/apt/lists/*` to apt-get
  - Auto-fix: Add `&& npm cache clean --force` to npm install
  - Risk: ✅ Safe (cleanup only)

**CI:**
- Already has safe auto-fixes for cache, timeout, retention

**Deps:**
- Already has safe auto-fixes for unused deps (high confidence only)

### Phase 2: Interactive Mode

```bash
# New flag: --interactive
dev-optimizer fix --interactive

# Shows each fix and asks for confirmation:
# 
# 🐳 [HIGH] No cleanup after package installation
#    File: Dockerfile
#    Action: Add cleanup commands
#    
#    Apply? (y/n/a=all/q=quit) > _
```

### Phase 3: Show Instructions for Non-auto-fixable

For findings that can't be auto-fixed, show clear instructions:

```bash
# 🐳 [HIGH] No multistage build detected
#    Auto-fix not available. Manual steps:
#    
#    1. Create build stage:
#       FROM node:20 AS builder
#       WORKDIR /app
#       COPY package*.json ./
#       RUN npm ci
#       COPY . .
#       RUN npm run build
#    
#    2. Create runtime stage:
#       FROM node:20-alpine
#       WORKDIR /app
#       COPY --from=builder /app/dist ./dist
#       COPY --from=builder /app/node_modules ./node_modules
#       CMD ["node", "dist/index.js"]
```

## Implementation Priority

1. **HIGH**: Interactve mode (`--interactive` flag)
2. **MEDIUM**: docker-004 cleanup auto-fix
3. **LOW**: Show instructions for non-auto-fixable

## Security Considerations

| Fix Type | Action | User Consent |
|----------|--------|--------------|
| `autoFixSafe: true` | Apply automatically | Not needed |
| `autoFixable: true, autoFixSafe: false` | Ask in interactive | Required |
| `autoFixable: false` | Show instructions | Manual only |

## Code Changes

### fix.ts

```typescript
// Add interactive mode
if (options.interactive) {
  for (const finding of toFix) {
    const shouldApply = await askConfirmation(finding);
    if (shouldApply) {
      await applyFix(finding);
    }
  }
}

// Ask for each fix
async function askConfirmation(finding: Finding): Promise<boolean> {
  console.log(`\n${formatFinding(finding)}`);
  const answer = await readline.question('Apply? (y/n/a=all/q=quit) > ');
  
  if (answer === 'a') {
    options.applyAll = true;
    return true;
  }
  if (answer === 'q') {
    process.exit(0);
  }
  return answer === 'y';
}
```

### DockerAnalyzer.ts

```typescript
// docker-004: No cleanup
if (!this.hasCleanup(dockerfile)) {
  const line = this.findLastInstallLine(dockerfile);
  const cleanup = this.getCleanupCommand(baseImage);
  
  findings.push({
    id: 'docker-004',
    ...
    suggestedFix: {
      type: 'modify',
      file: 'Dockerfile',
      description: `Add cleanup after install: ${cleanup}`,
      line: line,
      autoFixable: true
    },
    autoFixSafe: true  // NEW: Safe to auto-fix
  });
}
```