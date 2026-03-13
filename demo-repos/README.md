# Demo Repositories

This directory contains demo projects for testing and showcasing dev-optimizer.

## Demo 1: Docker Optimization (`demo-docker/`)

**Issues:**
- Missing .dockerignore
- No multistage build
- Large base image (ubuntu:latest)
- No cleanup after apt-get install
- Too many layers
- Copies entire context

**Expected Findings:** 4 Docker issues
**Expected Score:** ~35/100
**Expected Savings:** 650 MB

## Demo 2: CI/CD Optimization (`demo-ci/`)

**Issues:**
- No caching in GitHub Actions
- No matrix strategy
- No timeout configuration
- Sequential jobs (no parallelization)

**Expected Findings:** 3 CI issues
**Expected Score:** ~40/100
**Expected Savings:** 8 min per CI run

## Demo 3: Dependency Cleanup (`demo-deps/`)

**Issues:**
- Multiple unused dependencies (lodash, moment, axios, etc.)
- Duplicate dependency (lodash in deps AND devDeps)
- Deprecated packages (request)
- Unnecessary packages (left-pad)
- Large node_modules

**Expected Findings:** 4+ dependency issues
**Expected Score:** ~30/100
**Expected Savings:** 100+ MB

## Running Demos

```bash
# Analyze each demo
cd demo-repos/demo-docker
npx dev-optimizer analyze

cd ../demo-ci
npx dev-optimizer analyze

cd ../demo-deps
npx dev-optimizer analyze

# Preview fixes
npx dev-optimizer fix --dry-run

# Apply safe fixes
npx dev-optimizer fix --safe
```

## Expected Results

| Demo | Before Score | After Score | Savings |
|------|-------------|-------------|---------|
| Docker | 35 | 55+ | 400 MB |
| CI/CD | 40 | 60+ | 5 min |
| Deps | 30 | 50+ | 80 MB |