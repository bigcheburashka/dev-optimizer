# Dev Optimizer GitHub Action

Analyze your repository for CI/CD, Docker, and dependency optimization opportunities.

## Features

- ✅ **CI/CD Analysis** - Missing cache, timeouts, matrix optimization
- ✅ **Dependencies Analysis** - Unused deps, duplicates, lockfiles
- ✅ **Docker Analysis** - .dockerignore, multistage, base image
- ✅ **PR Comments** - Automatic analysis on every PR
- ✅ **Baseline Tracking** - Detect regressions over time

## Usage

### Basic Analysis

```yaml
name: Dev Optimizer

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze repository
        uses: dev-optimizer/action@v1
```

### With PR Comments

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
      
      - name: Analyze and comment
        uses: dev-optimizer/action@v1
        with:
          format: markdown
          save-baseline: true
```

### Fail on Issues

```yaml
name: Dev Optimizer

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze
        uses: dev-optimizer/action@v1
        with:
          fail-on-issues: true
```

### Baseline Comparison

```yaml
name: Dev Optimizer

on:
  pull_request:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for regressions
        uses: dev-optimizer/action@v1
        with:
          compare-baseline: true
          save-baseline: ${{ github.event_name == 'push' }}
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to analyze | `.` |
| `domains` | Domains to analyze (docker,deps,ci,all) | `all` |
| `format` | Output format (console,json,markdown) | `markdown` |
| `fail-on-issues` | Fail if issues found | `false` |
| `save-baseline` | Save baseline for tracking | `false` |
| `compare-baseline` | Compare with previous baseline | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Number of findings found |
| `score` | Repository score (0-100) |
| `report` | Path to the generated report |

## Example PR Comment

```markdown
## 🔍 Dev Optimizer Report

**Score:** 65/100
**Findings:** 5
**Potential Savings:** 120 MB, 5 min

### 🔴 High Priority

- **No caching configured in ci.yml** (ci)
  Add cache configuration to setup-node
  ✅ Auto-fixable

- **Missing .dockerignore** (docker)
  Create .dockerignore to reduce build context
  ✅ Auto-fixable

### 💡 Quick Wins

2 issues can be auto-fixed:
\`\`\`bash
npx dev-optimizer fix --safe
\`\`\`

---
*Powered by dev-optimizer*
```

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | CLI only, local analysis |
| **Pro** | $19/mo | PR comments, history, 10 repos |
| **Team** | $49/mo | Org policies, unlimited repos |

---

**[Get Started](https://github.com/bigcheburashka/dev-optimizer)**