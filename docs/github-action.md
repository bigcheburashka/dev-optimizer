# GitHub Action Integration

## Overview

Dev Optimizer GitHub Action automatically analyzes your repository on every PR and posts comments with optimization opportunities.

## Quick Start

1. Create `.github/workflows/dev-optimizer.yml`:

```yaml
name: Dev Optimizer

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze repository
        uses: dev-optimizer/action@v1
```

2. Commit and push to your repository.

3. Open a PR to see the analysis comment.

## Features

### Automatic Analysis

On every PR, the action will:
- Analyze CI/CD workflows for optimization opportunities
- Check dependencies for unused packages
- Analyze Dockerfile for best practices
- Post a comment with findings grouped by severity

### Score Tracking

The action tracks your repository's optimization score over time:
- 0-100 score based on findings
- Higher score = more optimized
- Track trends with baseline comparison

### Quick Wins

Automatically identifies issues that can be fixed safely:
- Missing .dockerignore
- Missing cache in CI
- Unused dependencies

## Configuration

### Domains

Analyze specific domains:

```yaml
with:
  domains: docker  # Only Docker
  domains: ci      # Only CI/CD
  domains: deps     # Only dependencies
  domains: all      # Everything (default)
```

### Fail on Issues

Prevent merging if issues found:

```yaml
with:
  fail-on-issues: true
```

### Baseline Tracking

Track optimizations over time:

```yaml
# Save baseline on main branch
on:
  push:
    branches: [main]

jobs:
  save-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dev-optimizer/action@v1
        with:
          save-baseline: true

# Compare on PRs
on:
  pull_request:

jobs:
  compare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dev-optimizer/action@v1
        with:
          compare-baseline: true
```

## Output

### PR Comment Example

```markdown
## 🔍 Dev Optimizer Report

**Score:** 65/100
**Findings:** 5
**Potential Savings:** 120 MB, 5 min

### 🔴 High Priority

- **No caching configured in ci.yml** (ci)
  Add cache configuration to setup-node
  ✅ Auto-fixable

### 🟠 Medium Priority

- **No timeout configured in ci.yml** (ci)

### 💡 Quick Wins

2 issues can be auto-fixed:
\`\`\`bash
npx dev-optimizer fix --safe
\`\`\`
```

### GitHub Summary

In the action summary, you'll see:
- Score: 65/100
- Findings: 5
- Savings: 120 MB, 5 min

## Integration with CI/CD

### Cache Optimization

The action can detect missing cache in your workflows:

```yaml
# Before
- uses: actions/setup-node@v4
  with:
    node-version: 20

# After (action suggestion)
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
```

**Savings:** 2-3 minutes per CI run

### Docker Optimization

Detects missing .dockerignore and suggests improvements:

```dockerignore
# .dockerignore (auto-generated)
node_modules
npm-debug.log
Dockerfile
.dockerignore
.git
.github
.gitignore
README.md
```

**Savings:** 400-500 MB build context reduction

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | CLI only, local analysis |
| **Pro** | $19/mo | PR comments, history, 10 repos |
| **Team** | $49/mo | Org policies, unlimited repos |

---

**[Get Started](https://github.com/bigcheburashka/dev-optimizer)**