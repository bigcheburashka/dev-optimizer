# Dev Optimizer

> Cut CI time, dependency bloat, and Docker waste before merge.

[![npm version](https://badge.fury.io/js/dev-optimizer.svg)](https://badge.fury.io/js/dev-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/dev-optimizer.svg)](https://nodejs.org/)

## Status

| Feature | Status |
|---------|--------|
| Docker analysis | ✅ Ready |
| Dependency analysis | ✅ Ready |
| CI/CD analysis | ✅ Ready |
| Safe auto-fixes | ✅ Ready |
| GitHub Action | ✅ Ready |
| Deep analysis (--deep) | ✅ Ready |
| Quick mode (--quick) | ✅ Ready |
| npm publish | ⏳ Pending |

## Installation

```bash
# Install globally
npm install -g dev-optimizer

# Or use with npx (no install)
npx dev-optimizer analyze
```

## Quick Start

```bash
# Analyze any Node.js project
cd your-project
dev-optimizer analyze

# Quick mode (3 seconds, static only)
dev-optimizer analyze --quick

# Deep mode (with size estimates)
dev-optimizer analyze --deep

# Preview fixes
dev-optimizer fix --dry-run

# Apply safe fixes
dev-optimizer fix --safe
```

## What It Does

### 🐳 Docker Analysis
| Check | Auto-fix |
|-------|----------|
| Missing .dockerignore | ✅ Create file |
| No multistage build | ❌ Suggest only |
| Large base image | ❌ Suggest alpine |
| Too many layers | ❌ Suggest combine |
| No cleanup commands | ❌ Suggest cleanup |

### 📦 Dependency Analysis
| Check | Auto-fix |
|-------|----------|
| Unused dependencies | ✅ Remove (high confidence) |
| Missing lockfile | ✅ Generate |
| Deprecated packages | ❌ Suggest update |
| Vulnerabilities | ❌ Group by severity + CVE links |

### 🔄 CI/CD Analysis
| Check | Auto-fix |
|-------|----------|
| Missing cache | ✅ Add cache config |
| No timeout | ✅ Add timeout-minutes |
| No matrix strategy | ❌ Suggest versions |
| Sequential jobs | ❌ Suggest parallel |

## Example Output

```
🔍 Dev Optimizer v0.1.0

📁 Project: your-project
   Type: nextjs
   Package Manager: npm
   CI Platform: github-actions

🐳 Running Docker analysis...
📦 Running Dependencies analysis...
🔄 Running CI/CD analysis...

══════════════════════════════════════════════════════

Score: 72/100

🔴 Top Findings
──────────────────────────────────────
🔴 [HIGH] Missing .dockerignore file
   Impact: Reduce build context by 400 MB
   Fix: Create .dockerignore ✅ auto-fixable

🟠 [HIGH] No caching in GitHub Actions
   Impact: Save 2-3 min per CI run
   Fix: Add actions/cache ✅ auto-fixable

🟡 [MEDIUM] Unused dependency: lodash
   Impact: Reduce bundle size
   Fix: Remove from dependencies ✅ auto-fixable

💾 Potential Savings: 450 MB, 5 min/CI run
```

## Commands

### `analyze`

```bash
# Full analysis
dev-optimizer analyze

# Quick (3 sec, static only)
dev-optimizer analyze --quick

# Deep (with size estimates)
dev-optimizer analyze --deep

# Specific domain
dev-optimizer analyze --type docker
dev-optimizer analyze --type deps
dev-optimizer analyze --type ci

# Output formats
dev-optimizer analyze --format json
dev-optimizer analyze --format markdown

# Quiet mode
dev-optimizer analyze --quiet
```

### `fix`

```bash
# Preview changes
dev-optimizer fix --dry-run

# Apply safe fixes only
dev-optimizer fix --safe

# Interactive mode (confirm each fix)
dev-optimizer fix --interactive
```

### `baseline`

```bash
# Save current state as baseline
dev-optimizer baseline --save

# Compare against baseline
dev-optimizer baseline --compare

# Show baseline history
dev-optimizer baseline --history

# CI: Fail if score decreased
dev-optimizer baseline --compare --fail-on-regression

# CI: Fail if score below threshold
dev-optimizer baseline --compare --min-score 80
```

## GitHub Action

Create `.github/workflows/dev-optimizer.yml`:

```yaml
name: Dev Optimizer
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bigcheburashka/dev-optimizer@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action will analyze your PR and post a comment with findings.

## Self-Analysis

Dev Optimizer can analyze itself for issues:

```bash
dev-optimizer analyze --path .
```

Features detected:
- Unused dependencies (like `depcheck` was found)
- Files without tests
- Missing package.json fields

## Auto-Fixes

These fixes are safe to apply automatically:

| Fix | Domain | Risk |
|-----|--------|------|
| Create .dockerignore | Docker | None |
| Create package-lock.json | Deps | None |
| Add cache to setup-node | CI | None |
| Add timeout-minutes | CI | None |
| Add retention-days | CI | None |
| Remove unused dep (high conf) | Deps | Low |

## Architecture

```
src/
├── analyzers/
│   ├── DockerAnalyzer.ts    # Dockerfile + .dockerignore
│   ├── DepsAnalyzer.ts      # package.json + knip
│   └── CiAnalyzer.ts        # GitHub Actions + GitLab CI
├── commands/
│   ├── analyze.ts           # Main analysis command
│   ├── fix.ts               # Auto-fix command
│   ├── baseline.ts          # Baseline management
│   └── metrics.ts           # Metrics command
├── reporters/
│   ├── ConsoleReporter.ts   # Table output
│   └── MarkdownReporter.ts   # PR comments
├── discovery/
│   └── RepoInventory.ts     # Project detection
├── deep-analyzer.ts         # Size estimates
├── self-analysis.ts         # Self-check
└── types.ts                 # Finding schema
```

## Development

```bash
# Install dependencies
npm install

# Run tests (59 tests)
npm test

# Build
npm run build

# Run locally
node dist/index.js analyze

# Test coverage
npm run test:coverage
```

## Roadmap

### ✅ Phase 1 (Complete)
- [x] Docker analysis (5 checks)
- [x] Dependency analysis (knip integration)
- [x] CI/CD analysis (GitHub Actions + GitLab CI)
- [x] Safe auto-fixes (6 fixes)
- [x] Console + Markdown reports
- [x] Quick mode (--quick)
- [x] Deep mode (--deep)
- [x] Self-analysis module
- [x] GitHub Action for PR comments

### 📝 Phase 2 (Planned)
- [ ] npm publish v0.1.0
- [ ] Baseline persistence (compare over time)
- [ ] History & regression tracking
- [ ] Landing page
- [ ] Video demo

### 📝 Phase 3 (Future)
- [ ] Bundle analysis
- [ ] Security findings (npm audit)
- [ ] Custom rules
- [ ] Team dashboard (SaaS)

## Contributing

Contributions welcome! Areas needing help:

1. **Tests** - Increase coverage to 100%
2. **Reporters** - JSON reporter, SARIF format
3. **Analyzers** - More checks per domain
4. **CI Platforms** - CircleCI, Jenkins, Azure Pipelines

## License

MIT © 2024