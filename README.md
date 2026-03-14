# Dev Optimizer

> Cut CI time, dependency bloat, and Docker waste before merge. **Fast.**

[![npm version](https://badge.fury.io/js/dev-optimizer.svg)](https://badge.fury.io/js/dev-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/dev-optimizer.svg)](https://nodejs.org/)

## ⚡ Performance

| Mode | Time | What it does |
|------|------|--------------|
| `--quick` | **0.2 sec** | Static analysis only (Dockerfile, CI, package.json) |
| Default | **30 sec** | + npm outdated + npm audit + knip (parallel) |
| `--deep` | **45 sec** | + size estimates + deep dependency analysis |

**7.5x faster** than alternatives in quick mode.

| Tool | Time | Coverage |
|------|------|----------|
| **dev-optimizer --quick** | **0.2 sec** | Docker + CI + Deps |
| depcheck | 3 sec | Deps only |
| knip | 28 sec | Unused exports |
| npm outdated | 10 sec | Outdated packages |

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
# Install globally
npm install -g dev-optimizer

# Or use with npx (no install needed)
npx dev-optimizer analyze
```

## Usage Examples

### Basic Analysis

```bash
# Full analysis (30 sec)
dev-optimizer analyze

# Quick mode - static only (0.2 sec)
dev-optimizer analyze --quick

# Deep mode - with size estimates (45 sec)
dev-optimizer analyze --deep
```

### Target Specific Domain

```bash
# Analyze only Docker
dev-optimizer analyze --type docker

# Analyze only dependencies
dev-optimizer analyze --type deps

# Analyze only CI/CD
dev-optimizer analyze --type ci
```

### Output Formats

```bash
# Console output (default)
dev-optimizer analyze

# JSON output
dev-optimizer analyze --format json

# Markdown output (for PR comments)
dev-optimizer analyze --format markdown

# Quiet mode (errors only)
dev-optimizer analyze --quiet
```

### Auto-Fix

```bash
# Preview fixes without applying
dev-optimizer fix --dry-run

# Apply safe fixes only
dev-optimizer fix --safe

# Apply all fixes interactively
dev-optimizer fix --interactive
```

### Baseline & CI Integration

```bash
# Save baseline
dev-optimizer baseline --save

# Compare with baseline
dev-optimizer baseline --compare

# CI: Fail on regression
dev-optimizer baseline --compare --fail-on-regression

# CI: Fail if score below threshold
dev-optimizer baseline --compare --min-score 80
```

### GitHub Action

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

## What It Analyzes

### 🐳 Docker
| Check | Time | Auto-fix |
|-------|------|----------|
| Missing .dockerignore | 0.01s | ✅ Create file |
| No multistage build | 0.01s | ❌ Suggest |
| Large base image | 0.01s | ❌ Suggest alpine |
| Too many layers | 0.01s | ❌ Suggest combine |
| No cleanup commands | 0.01s | ❌ Suggest cleanup |

### 📦 Dependencies
| Check | Time | Auto-fix |
|-------|------|----------|
| Unused dependencies (knip) | 28s* | ✅ Remove |
| Deprecated packages | 0.1s | ❌ Suggest update |
| Outdated packages | 10s* | ❌ Suggest update |
| Vulnerabilities | 10s* | ❌ CVE links |
| Duplicate entries | 0.01s | ❌ Suggest cleanup |

*\*run in parallel*

### 🔄 CI/CD
| Check | Time | Auto-fix |
|-------|------|----------|
| Missing cache | 0.01s | ✅ Add cache config |
| No timeout | 0.01s | ✅ Add timeout-minutes |
| No retention-days | 0.01s | ✅ Add retention |
| Sequential jobs | 0.01s | ❌ Suggest parallel |
| Missing matrix | 0.01s | ❌ Suggest matrix |

**Total: ~0.2s (quick) / ~30s (full with parallel npm)**

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

## Comparison with Alternatives

| Tool | Time | What it checks |
|------|------|----------------|
| **dev-optimizer --quick** | **0.2s** | Docker + CI + Deps (static) |
| **dev-optimizer** | **30s** | Docker + CI + Deps + npm audit + knip |
| depcheck | 3s | Unused deps only |
| knip | 28s | Unused exports only |
| npm outdated | 10s | Outdated packages only |
| hadolint | 5s | Dockerfile only |

**Key difference:** dev-optimizer covers 3 domains (Docker, CI, Deps) in a single run, while alternatives cover 1 domain each.

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
- [x] Parallel npm outdated/audit (1.5x faster)
- [x] Performance optimization (7.5x faster)

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