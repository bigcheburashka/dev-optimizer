# Development Plan

## Overview

**Goal:** Create dev-optimizer CLI tool that analyzes and fixes Docker, npm, and CI/CD issues.

**Timeline:** 6 weeks (MVP in 2 weeks)

**Success Metrics:**
- 50+ GitHub stars in first month
- 100+ npm downloads/week
- Documented before/after metrics for 5+ repositories

---

## Phase 1: Foundation (Week 1)

### 1.1 Project Setup

**DoD:**
- [ ] Repository created on GitHub (private initially)
- [ ] TypeScript configured
- [ ] ESLint + Prettier configured
- [ ] Jest configured with 80% coverage threshold
- [ ] Husky pre-commit hooks
- [ ] CI/CD workflow (GitHub Actions)

**Commands:**
```bash
npm init -y
npm install -D typescript @types/node ts-node jest @types/jest
npm install -D eslint prettier husky lint-staged
npx tsc --init
npx jest --init
```

**Test:**
```bash
npm run build  # Should compile
npm test       # Should run tests (even if empty)
npm run lint    # Should pass
```

**Metrics:** N/A (setup phase)

---

### 1.2 CLI Structure

**DoD:**
- [ ] CLI entry point working
- [ ] Command parsing (commander.js or yargs)
- [ ] Help text generated
- [ ] Version flag working

**Commands:**
```bash
npx dev-optimizer --help
npx dev-optimizer --version
npx dev-optimizer analyze
npx dev-optimizer fix
```

**Test:**
```bash
npx dev-optimizer --help      # Shows help
npx dev-optimizer --version   # Shows version
npx dev-optimizer analyze      # Returns "No Dockerfile found" or analysis
```

**Metrics:**
- Command execution time: < 500ms
- Memory usage: < 50MB

---

### 1.3 Dockerfile Analyzer (Basic)

**DoD:**
- [ ] Parse Dockerfile into instructions
- [ ] Detect missing .dockerignore
- [ ] Detect large base images
- [ ] Count layers
- [ ] Output basic report

**Test Fixtures:**
```dockerfile
# tests/fixtures/bad-dockerfile/Dockerfile
FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y nodejs npm
COPY . .
RUN npm install
CMD ["npm", "start"]
```

```dockerfile
# tests/fixtures/good-dockerfile/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app .
CMD ["npm", "start"]
```

**Test:**
```bash
npx dev-optimizer analyze docker --path tests/fixtures/bad-dockerfile
# Expected: Issues found, suggestions
```

**Metrics:**
```
Before: 1.2 GB image (ubuntu base + full npm)
After: 150 MB image (alpine + production deps)
```

**Unit Tests:**
```typescript
describe('DockerAnalyzer', () => {
  it('should detect missing .dockerignore')
  it('should detect large base image')
  it('should count layers correctly')
  it('should detect missing multistage')
  it('should suggest alpine alternatives')
})
```

---

## Phase 2: Core Analyzers (Week 2)

### 2.1 npm Analyzer

**DoD:**
- [ ] Parse package.json
- [ ] Detect unused dependencies (using depcheck)
- [ ] Detect outdated packages
- [ ] Detect duplicates
- [ ] Suggest alternatives (bundlephobia integration)
- [ ] Calculate potential savings

**Test Fixtures:**
```json
// tests/fixtures/npm-project/package.json
{
  "dependencies": {
    "lodash": "^4.17.21",      // unused
    "moment": "^2.29.0",       // unused, suggest date-fns
    "axios": "^0.24.0"         // used
  },
  "devDependencies": {
    "jest": "^28.0.0"         // should be in dependencies for library
  }
}
```

**Test:**
```bash
npx dev-optimizer analyze npm --path tests/fixtures/npm-project
# Expected: 2 unused deps, 1 outdated, alternatives suggested
```

**Metrics:**
```
Before: node_modules 450 MB, 2 unused deps
After: node_modules 320 MB, 0 unused deps
```

**Unit Tests:**
```typescript
describe('NpmAnalyzer', () => {
  it('should detect unused dependencies')
  it('should detect outdated packages')
  it('should detect duplicates')
  it('should suggest alternatives')
  it('should calculate savings')
})
```

---

### 2.2 .dockerignore Fixer

**DoD:**
- [ ] Generate .dockerignore from template
- [ ] Merge with existing .dockerignore
- [ ] Include common patterns (node_modules, .git, etc.)
- [ ] Show diff before applying

**Test:**
```bash
npx dev-optimizer fix dockerignore --path tests/fixtures/npm-project
# Expected: .dockerignore created with common patterns
```

**Metrics:**
```
Before: Docker context 500 MB (copies everything)
After: Docker context 50 MB (ignores node_modules, .git, etc.)
```

---

### 2.3 CI/CD Analyzer

**DoD:**
- [ ] Parse GitHub Actions workflow
- [ ] Detect sequential steps that can be parallel
- [ ] Detect missing cache
- [ ] Detect large artifacts
- [ ] Suggest matrix optimization

**Test Fixtures:**
```yaml
# tests/fixtures/github-workflows/ci.yml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install      # No cache!
      - run: npm run lint
      - run: npm test
      - run: npm run build    # No cache!
```

**Test:**
```bash
npx dev-optimizer analyze ci --path tests/fixtures/github-workflows
# Expected: Missing cache, sequential steps could be parallel
```

**Metrics:**
```
Before: CI time 12 min (no cache, sequential)
After: CI time 4 min (with cache, parallel)
```

---

### 2.4 Metrics Collector

**DoD:**
- [ ] Measure npm install time
- [ ] Measure docker build time
- [ ] Measure test execution time
- [ ] Store baseline metrics
- [ ] Compare before/after

**Test:**
```bash
npx dev-optimizer metrics baseline
npx dev-optimizer metrics compare
```

**Metrics:**
```json
{
  "baseline": {
    "npm_install_time_s": 45,
    "docker_build_time_s": 225,
    "test_time_s": 300,
    "docker_image_size_mb": 1200
  },
  "current": {
    "npm_install_time_s": 8,
    "docker_build_time_s": 90,
    "test_time_s": 180,
    "docker_image_size_mb": 400
  },
  "improvement": {
    "npm_install_time": "82%",
    "docker_build_time": "60%",
    "test_time": "40%",
    "docker_image_size": "67%"
  }
}
```

---

## Phase 3: Integration Testing (Week 3)

### 3.1 Real Repository Testing

**DoD:**
- [ ] Clone 5 public repositories with known issues
- [ ] Run analyzer on each
- [ ] Document before metrics
- [ ] Apply auto-fixes
- [ ] Document after metrics
- [ ] Create comparison report

**Test Repositories:**

| Repository | Known Issue | Expected Improvement |
|------------|-------------|---------------------|
| nginx-proxy-manager | 1.1 GB image | 60% size reduction |
| automatic-ripping-machine | 2.4 GB image | 50% size reduction |
| create-react-app | Large node_modules | 30% unused deps |
| strapi/strapi | Slow CI | 40% time reduction |
| sample-nextjs-app | No .dockerignore | 70% context reduction |

**Integration Test:**
```typescript
describe('Real Repository Tests', () => {
  it('should reduce nginx-proxy-manager image by 60%', async () => {
    const before = await analyzeImage('nginx-proxy-manager')
    await applyFixes('dockerignore', 'multistage')
    const after = await analyzeImage('nginx-proxy-manager')
    expect(after.size).toBeLessThan(before.size * 0.4)
  })
})
```

**Metrics Report:**
```markdown
# Before/After Report

## nginx-proxy-manager
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Docker image | 1.1 GB | 420 MB | 62% |
| Build time | 3 min | 1.2 min | 60% |
| CI time | 8 min | 4 min | 50% |

## create-react-app
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| node_modules | 450 MB | 280 MB | 38% |
| npm install | 32 sec | 18 sec | 44% |
| Unused deps | 8 | 0 | 100% |
```

---

### 3.2 Test Coverage Requirements

**DoD:**
- [ ] Unit tests: 80%+ coverage
- [ ] Integration tests: 5+ real repositories
- [ ] E2E tests: CLI commands work end-to-end
- [ ] All tests pass in CI

**Coverage Check:**
```bash
npm run test:coverage
# Expected: 80%+ statements, 80%+ branches, 80%+ functions
```

**CI Configuration:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
```

---

## Phase 4: Auto-Fix Features (Week 4)

### 4.1 Safe Auto-Fix

**DoD:**
- [ ] Identify safe fixes (no risk of breaking)
- [ ] Auto-apply safe fixes
- [ ] Show summary of changes
- [ ] Create backup of changed files

**Safe Fixes:**
- [ ] Create .dockerignore
- [ ] Add entries to .gitignore
- [ ] Remove unused dependencies (with confirmation)
- [ ] Update .npmrc for caching

**Test:**
```bash
npx dev-optimizer fix --safe
# Expected: Only safe fixes applied
```

---

### 4.2 Manual Fix with Diff

**DoD:**
- [ ] Identify risky fixes
- [ ] Show diff preview
- [ ] Ask for confirmation
- [ ] Apply on confirmation
- [ ] Create backup

**Risky Fixes:**
- [ ] Multistage Dockerfile conversion
- [ ] Base image change
- [ ] Remove dependencies
- [ ] Package alternative suggestions

**Test:**
```bash
npx dev-optimizer fix
# Expected: Diff preview, confirmation prompt
```

---

### 4.3 Report Generation

**DoD:**
- [ ] Console report (default)
- [ ] JSON report (for CI)
- [ ] Markdown report (for documentation)
- [ ] HTML report (for visualization)

**Test:**
```bash
npx dev-optimizer analyze --output json > report.json
npx dev-optimizer analyze --output markdown > report.md
npx dev-optimizer analyze --output html > report.html
```

---

## Phase 5: Documentation & Polish (Week 5)

### 5.1 Documentation

**DoD:**
- [ ] README.md with quick start
- [ ] METRICS.md explaining before/after
- [ ] ARCHITECTURE.md explaining code structure
- [ ] CONTRIBUTING.md for open source
- [ ] CHANGELOG.md for releases

---

### 5.2 Example Projects

**DoD:**
- [ ] example-minimal (minimal Dockerfile)
- [ ] example-nextjs (Next.js with Docker)
- [ ] example-node-api (Node.js API)
- [ ] Each with before/after comparison

---

### 5.3 GitHub Actions Integration

**DoD:**
- [ ] GitHub Action published
- [ ] Action.yaml configured
- [ ] Example workflow in README
- [ ] Tested in real repository

**Action:**
```yaml
# .github/workflows/dev-optimizer.yml
name: Dev Optimizer
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dev-optimizer/action@v1
        with:
          fail-on-regression: true
```

---

## Phase 6: Launch (Week 6)

### 6.1 Open Source Release

**DoD:**
- [ ] MIT License added
- [ ] Public repository created
- [ ] npm package published
- [ ] GitHub Action published
- [ ] Product Hunt launch

---

### 6.2 Landing Page

**DoD:**
- [ ] Landing page created
- [ ] Before/after metrics visible
- [ ] Installation instructions
- [ ] GitHub link

---

### 6.3 Community

**DoD:**
- [ ] GitHub Discussions enabled
- [ ] Issue templates created
- [ ] CONTRIBUTING.md published
- [ ] First 10 stars from real users

---

## Test Repositories Details

### Repository 1: nginx-proxy-manager

**Issue:** 1.1 GB Docker image

**Analysis:**
```bash
git clone https://github.com/NginxProxyManager/nginx-proxy-manager
cd nginx-proxy-manager
npx dev-optimizer analyze docker
```

**Expected Fixes:**
1. Add .dockerignore (node_modules, .git)
2. Multistage build
3. Alpine base image

**Metrics:**
```
Before: 1.1 GB
After: 400 MB (estimated 64% reduction)
```

---

### Repository 2: create-react-app

**Issue:** Large node_modules, unused dependencies

**Analysis:**
```bash
npx create-react-app test-app
cd test-app
npx dev-optimizer analyze npm
```

**Expected Fixes:**
1. Remove unused dependencies
2. Suggest alternatives
3. Add .npmrc for cache

**Metrics:**
```
Before: 350 MB node_modules, 45 sec install
After: 250 MB node_modules, 15 sec install
```

---

### Repository 3: strapi/strapi

**Issue:** Slow CI, no caching

**Analysis:**
```bash
git clone https://github.com/strapi/strapi
cd strapi
npx dev-optimizer analyze ci
```

**Expected Fixes:**
1. Add npm cache
2. Parallelize tests
3. Optimize artifacts

**Metrics:**
```
Before: 18 min CI time
After: 6 min CI time (estimated 67% reduction)
```

---

## Metrics Dashboard

### Baseline Metrics Template

```json
{
  "project": "nginx-proxy-manager",
  "date": "2024-01-15",
  "metrics": {
    "docker": {
      "image_size_mb": 1100,
      "build_time_s": 180,
      "layers": 15
    },
    "npm": {
      "install_time_s": 45,
      "node_modules_mb": 450,
      "unused_deps": 8
    },
    "ci": {
      "total_time_s": 480,
      "cache_hit_rate": 0,
      "parallel_jobs": 1
    }
  }
}
```

### After Metrics Template

```json
{
  "project": "nginx-proxy-manager",
  "date": "2024-01-16",
  "metrics": {
    "docker": {
      "image_size_mb": 420,
      "build_time_s": 72,
      "layers": 8
    },
    "npm": {
      "install_time_s": 12,
      "node_modules_mb": 280,
      "unused_deps": 0
    },
    "ci": {
      "total_time_s": 180,
      "cache_hit_rate": 0.85,
      "parallel_jobs": 3
    },
    "improvement": {
      "docker_image": "62%",
      "docker_build": "60%",
      "npm_install": "73%",
      "ci_time": "62%"
    }
  }
}
```

---

## Success Criteria

### Technical Metrics

| Metric | Target |
|--------|--------|
| Test coverage | > 80% |
| Real repo tests | 5+ |
| npm package size | < 1 MB |
| CLI startup time | < 500ms |
| Memory usage | < 100MB |

### Business Metrics

| Metric | Target |
|--------|--------|
| GitHub stars (month 1) | 50+ |
| npm downloads/week | 100+ |
| Real repos fixed | 5+ documented |
| Before/after examples | 10+ |

---

## Weekly Checkpoints

### Week 1: Foundation ✅
- Project setup
- CLI structure
- Basic Dockerfile analyzer

### Week 2: Core Analyzers ✅
- npm analyzer
- .dockerignore fixer
- CI/CD analyzer
- Metrics collector

### Week 3: Integration ✅
- Real repository tests
- Test coverage > 80%
- Before/after documentation

### Week 4: Auto-Fix ✅
- Safe auto-fix
- Manual fix with diff
- Report generation

### Week 5: Polish ✅
- Documentation
- Example projects
- GitHub Action

### Week 6: Launch ✅
- Open source release
- Landing page
- Community setup