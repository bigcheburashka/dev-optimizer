# Dev Optimizer

> Cut CI time, dependency bloat, and Docker waste before merge.

[![npm version](https://badge.fury.io/js/dev-optimizer.svg)](https://badge.fury.io/js/dev-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
# Install globally
npm install -g dev-optimizer

# Analyze any Node.js project
cd your-project
dev-optimizer analyze

# Preview fixes
dev-optimizer fix --dry-run

# Apply safe fixes
dev-optimizer fix --safe
```

## What It Does

**🐳 Docker Analysis**
- Missing .dockerignore → Auto-create
- No multistage build → Suggest conversion
- Large base image → Recommend alpine
- Too many layers → Combine instructions
- No cleanup → Add cleanup commands

**📦 Dependency Analysis**
- Unused dependencies → Remove (knip integration)
- Duplicate dependencies → Deduplicate
- Missing lockfile → Generate
- Large node_modules → Warn with alternatives

**🔄 CI/CD Analysis**
- Missing cache → Add setup-node cache
- No matrix strategy → Suggest Node versions
- No timeout → Add timeout-minutes
- Sequential jobs → Suggest parallelization

## Example Output

```
🔍 Dev Optimizer v0.1.0

Analyzing: your-project

📁 Project: your-project
   Type: nextjs
   Package Manager: npm
   CI Platform: github-actions

📊 Stats:
   Dependencies: 45
   node_modules: 280 MB
   CI time (est.): 10 min

🔍 Available analysis domains:
   🐳 docker
   📦 deps
   🔄 ci

🐳 Running Docker analysis...
📦 Running Dependencies analysis...
🔄 Running CI/CD analysis...

══════════════════════════════════════════════════════

Score: 55/100

📊 Baseline
──────────────────────────────────────
Project: nextjs
Dependencies: 45
Docker: ✅
CI/CD: ✅

🔴 Top Findings (3 issues)
──────────────────────────────────────
🔴 [HIGH] Missing .dockerignore file
   Impact: Reduce build context by 400-500 MB
   Fix: Create .dockerignore (auto-fixable ✅)

🟠 [HIGH] No caching configured in .github/workflows/ci.yml
   Impact: Save 2-3 minutes per CI run
   Fix: Add actions/cache for npm (auto-fixable ✅)

🟡 [MEDIUM] Unused dependency: lodash
   Impact: Remove to reduce node_modules size
   Fix: Remove from dependencies (auto-fixable ✅)

💰 Potential Savings
──────────────────────────────────────
Size: 450 MB
Time: 5 min/CI run
Improvement: 35%
```

## Commands

### `analyze`

Analyze project for optimization opportunities.

```bash
# Analyze all domains
dev-optimizer analyze

# Analyze specific domain
dev-optimizer analyze --type docker
dev-optimizer analyze --type deps
dev-optimizer analyze --type ci

# Output formats
dev-optimizer analyze --format table    # Console (default)
dev-optimizer analyze --format markdown # PR-ready
dev-optimizer analyze --format json     # CI/CD

# Limit results
dev-optimizer analyze --top 5
```

### `fix`

Apply safe optimizations automatically.

```bash
# Preview changes
dev-optimizer fix --dry-run

# Apply safe fixes only
dev-optimizer fix --safe

# Apply all auto-fixable
dev-optimizer fix

# Fix specific domain
dev-optimizer fix --type docker --safe
```

## Finding Schema

All findings follow a unified schema:

```typescript
interface Finding {
  id: string;                    // docker-001, ci-002, etc.
  domain: 'docker' | 'deps' | 'ci';
  title: string;                 // Human-readable title
  description: string;            // Detailed explanation
  evidence: {
    file?: string;
    line?: number;
    snippet?: string;
    metrics?: Record<string, number>;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  impact: {
    type: 'time' | 'size' | 'cost';
    estimate: string;
  };
  suggestedFix: {
    type: 'create' | 'modify' | 'delete';
    file: string;
    description: string;
    autoFixable: boolean;
  };
}
```

## Safe Fixes

Only these fixes are applied automatically:

| Fix | Domain | Risk |
|-----|--------|------|
| Create .dockerignore | Docker | None |
| Create .gitignore | Deps | None |
| Create package-lock.json | Deps | None |
| Add cache to setup-node | CI | None |
| Remove unused dep (high confidence) | Deps | Low |

All other fixes require manual review.

## Demo

```bash
# Clone demo repos
git clone https://github.com/bigcheburashka/dev-optimizer

# Run demos
cd dev-optimizer/demo-repos/demo-docker
npx dev-optimizer analyze

cd ../demo-ci
npx dev-optimizer analyze

cd ../demo-deps
npx dev-optimizer analyze
```

## Architecture

```
src/
├── analyzers/
│   ├── DockerAnalyzer.ts    # Dockerfile + .dockerignore
│   ├── DepsAnalyzer.ts      # package.json + knip
│   └── CiAnalyzer.ts        # GitHub Actions + GitLab CI
├── commands/
│   ├── analyze.ts           # Analysis command
│   └── fix.ts               # Fix command
├── reporters/
│   ├── ConsoleReporter.ts   # Table output
│   └── MarkdownReporter.ts  # PR comments
├── discovery/
│   └── RepoInventory.ts     # Project detection
└── types.ts                 # Finding schema
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run locally
node dist/index.js analyze
```

## Roadmap

### Phase 1 (Current)
- ✅ Docker analysis
- ✅ Dependency analysis (knip)
- ✅ CI/CD analysis
- ✅ Safe auto-fixes
- ✅ Console + Markdown reports

### Phase 2
- 📝 GitHub Action for PR comments
- 📝 Baseline persistence
- 📝 History & regression tracking
- 📝 GitLab CI parity

### Phase 3
- 📝 Bundle analysis
- 📝 Security findings
- 📝 Custom rules
- 📝 Team dashboard

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © 2024