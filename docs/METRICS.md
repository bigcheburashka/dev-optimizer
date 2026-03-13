# Metrics Documentation

## Overview

This document defines all metrics that dev-optimizer measures and reports.

## Docker Metrics

### Image Size (MB)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `docker.image_size` | Final Docker image size | `docker images --format {{.Size}}` |
| `docker.context_size` | Build context size | `du -sh .` before .dockerignore |
| `docker.potential_size` | Estimated size after optimization | Based on .dockerignore + base image |

**Before/After Example:**
```
Before: 1.2 GB (ubuntu + node_modules)
After: 400 MB (alpine + production deps)
Improvement: 67%
```

### Build Time (seconds)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `docker.build_time` | Time to build image | `time docker build -t test .` |
| `docker.layer_count` | Number of layers | `docker history --no-trunc` |
| `docker.cache_usage` | Cache hit rate | Analysis of build output |

**Before/After Example:**
```
Before: 180 sec (15 layers, no cache)
After: 60 sec (8 layers, with cache)
Improvement: 67%
```

### Dockerfile Quality

| Issue | Severity | Impact |
|-------|----------|--------|
| Missing .dockerignore | High | +200-500 MB |
| No multistage build | High | +50-70% size |
| Large base image | Medium | +100-500 MB |
| Too many layers | Low | +10-20% size |
| RUN without cleanup | Medium | +50-200 MB |

---

## npm Metrics

### Install Time (seconds)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `npm.install_time_cold` | First install (no cache) | `time npm install` |
| `npm.install_time_cached` | Second install (with cache) | `time npm install` |
| `npm.install_time_ci` | CI install (npm ci) | `time npm ci` |

**Before/After Example:**
```
Before: 45 sec (npm install)
After: 8 sec (npm ci with cache)
Improvement: 82%
```

### Package Metrics

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `npm.total_deps` | Total dependencies | `jq '.dependencies | length' package.json` |
| `npm.prod_deps` | Production dependencies | `jq '.dependencies | length' package.json` |
| `npm.dev_deps` | Development dependencies | `jq '.devDependencies | length' package.json` |
| `npm.unused_deps` | Unused dependencies | `npx depcheck --json` |
| `npm.outdated_deps` | Outdated dependencies | `npm outdated --json` |

**Before/After Example:**
```
Before: 45 deps, 12 unused, 8 outdated
After: 33 deps, 0 unused, 0 outdated
Improvement: 27% fewer deps
```

### node_modules Size (MB)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `npm.node_modules_size` | Size of node_modules | `du -sh node_modules` |
| `npm.largest_deps` | Top 10 largest deps | `du -sh node_modules/* \| sort -hr` |
| `npm.duplicate_deps` | Duplicate versions | `npm ls --depth=0 \| grep deduped` |

**Before/After Example:**
```
Before: 450 MB node_modules
After: 280 MB node_modules
Improvement: 38%
```

### Package Quality Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Unused dependency | Medium | +5-50 MB |
| Duplicate version | Medium | +10-100 MB |
| Outdated package | Low (security: High) | Security risk |
| Large package | Medium | +10-100 MB |
| Better alternative exists | Low | +20-80% size |

---

## CI/CD Metrics

### Pipeline Time (seconds)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `ci.total_time` | Total pipeline time | GitHub Actions API |
| `ci.job_time` | Per-job time | GitHub Actions API |
| `ci.step_time` | Per-step time | GitHub Actions API |
| `ci.wait_time` | Queue time | GitHub Actions API |

**Before/After Example:**
```
Before: 12 min total (sequential jobs)
After: 5 min total (parallel + cache)
Improvement: 58%
```

### Cache Performance

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `ci.cache_hit_rate` | % of cache hits | GitHub Actions logs |
| `ci.cache_restore_time` | Time to restore cache | GitHub Actions logs |
| `ci.cache_save_time` | Time to save cache | GitHub Actions logs |

**Before/After Example:**
```
Before: 0% cache hits
After: 85% cache hits
Improvement: npm install 45s → 8s
```

### CI/CD Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Missing cache | High | +50-80% time |
| Sequential steps | High | +30-50% time |
| Large artifacts | Medium | +Storage + time |
| No parallelization | Medium | +50-100% time |
| Missing timeout | Low | Cost overrun |

---

## Bundle Metrics (Frontend)

### Bundle Size (KB)

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `bundle.total_size` | Total bundle size | `du -sh dist/` |
| `bundle.gzipped_size` | Gzip size | `gzip -c dist/*.js \| wc -c` |
| `bundle.brotli_size` | Brotli size | `brotli -c dist/*.js \| wc -c` |
| `bundle.chunk_count` | Number of chunks | `ls dist/*.js \| wc -l` |

**Before/After Example:**
```
Before: 2.3 MB (uncompressed), 580 KB (gzip)
After: 1.7 MB (uncompressed), 420 KB (gzip)
Improvement: 26% uncompressed, 28% gzip
```

### Tree Shaking

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `bundle.unused_exports` | Unused exports | `ts-prune` |
| `bundle.side_effects` | Files with side effects | package.json `sideEffects` |
| `bundle.lazy_loaded` | Lazy-loaded chunks | webpack-bundle-analyzer |

**Before/After Example:**
```
Before: 35% unused exports
After: 10% unused exports
Improvement: 25% smaller bundle
```

### Bundle Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Large chunk (>500KB) | High | Slow initial load |
| No code splitting | High | +50-100% initial |
| No lazy loading | Medium | +20-50% initial |
| No tree shaking | Medium | +30-50% unused |
| Missing compression | Low | +60-70% transfer |

---

## Security Metrics

### Vulnerabilities

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `security.critical` | Critical CVEs | `npm audit` |
| `security.high` | High severity CVEs | `npm audit` |
| `security.moderate` | Medium severity CVEs | `npm audit` |
| `security.low` | Low severity CVEs | `npm audit` |

**Before/After Example:**
```
Before: 3 critical, 5 high, 12 moderate
After: 0 critical, 0 high, 2 moderate
Improvement: 92% vulnerability reduction
```

### License Issues

| Metric | Description | How Measured |
|--------|-------------|--------------|
| `security.copyleft` | GPL/AGPL packages | `npx license-checker` |
| `security.unknown_license` | Packages without license | `npx license-checker` |
| `security.restricted` | Non-commercial licenses | `npx license-checker` |

---

## Performance Metrics

### CLI Performance

| Metric | Target | How Measured |
|--------|--------|--------------|
| `cli.startup_time` | < 500ms | `time npx dev-optimizer --version` |
| `cli.analysis_time` | < 30s | `time npx dev-optimizer analyze` |
| `cli.memory_usage` | < 200MB | Process memory |
| `cli.cpu_usage` | < 50% | Process CPU |

---

## Composite Scores

### Docker Score (0-100)

```typescript
dockerScore = 100 - (
  (unusedDeps * 5) +
  (missingDockerignore ? 20 : 0) +
  (noMultistage ? 15 : 0) +
  (largeBaseImage ? 10 : 0) +
  (uncleanedLayers ? 10 : 0)
)
```

### npm Score (0-100)

```typescript
npmScore = 100 - (
  (unusedDeps * 3) +
  (outdatedDeps * 2) +
  (vulnerabilities * 10) +
  (largePackages * 1)
)
```

### CI/CD Score (0-100)

```typescript
ciScore = 100 - (
  (noCache ? 20 : 0) +
  (sequentialSteps ? 15 : 0) +
  (largeArtifacts ? 10 : 0) +
  (noTimeout ? 5 : 0)
)
```

### Overall Score (0-100)

```typescript
overallScore = (
  dockerScore * 0.35 +
  npmScore * 0.35 +
  ciScore * 0.30
)
```

---

## Reports

### Console Report Format

```
🐳 Docker Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 65/100
Issues: 4

ISSUES:
├─ Missing .dockerignore (-20 points)
├─ No multistage build (-15 points)
├─ Large base image (ubuntu:latest) (-10 points)
└─ Too many layers (15 layers) (-5 points)

POTENTIAL SAVINGS:
├─ .dockerignore: 300 MB
├─ Multistage: 500 MB
├─ Alpine base: 150 MB
└─ Layer merge: 50 MB
Total: 1000 MB (50% reduction)
```

### JSON Report Format

```json
{
  "docker": {
    "score": 65,
    "issues": [
      {
        "type": "missing_dockerignore",
        "severity": "high",
        "message": "Missing .dockerignore file",
        "suggestion": "Create .dockerignore with common patterns"
      }
    ],
    "metrics": {
      "image_size_mb": 1200,
      "layer_count": 15,
      "build_time_s": 180
    },
    "potential_savings": {
      "size_mb": 1000,
      "time_s": 120
    }
  },
  "npm": { ... },
  "ci": { ... },
  "overall_score": 72
}
```

---

## Before/After Comparison

### Example Project Report

```markdown
# dev-optimizer Report

## Project: example-nextjs-app

### Before (2024-01-15 10:30:00)

| Category | Metric | Value |
|----------|--------|-------|
| Docker | Image size | 1.2 GB |
| Docker | Build time | 180 sec |
| npm | Install time | 45 sec |
| npm | node_modules | 450 MB |
| npm | Unused deps | 12 |
| CI/CD | Pipeline time | 12 min |
| CI/CD | Cache hits | 0% |

### After (2024-01-15 10:45:00)

| Category | Metric | Value |
|----------|--------|-------|
| Docker | Image size | 420 MB |
| Docker | Build time | 72 sec |
| npm | Install time | 12 sec |
| npm | node_modules | 280 MB |
| npm | Unused deps | 0 |
| CI/CD | Pipeline time | 5 min |
| CI/CD | Cache hits | 85% |

### Improvement

| Category | Metric | Improvement |
|----------|--------|-------------|
| Docker | Image size | 65% |
| Docker | Build time | 60% |
| npm | Install time | 73% |
| npm | node_modules | 38% |
| CI/CD | Pipeline time | 58% |

**Overall time saved per build: 10 minutes**
**Overall storage saved: 930 MB**
```