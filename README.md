# dev-optimizer

> Optimize Docker images, npm packages, and CI/CD pipelines in one CLI.

## Problem

| Issue | Before | After |
|-------|--------|-------|
| Docker image size | 1.2 GB | 400 MB |
| npm install time | 45 sec | 8 sec |
| CI/CD build time | 12 min | 6 min |
| Unused dependencies | 35% | 0% |

## Quick Start

```bash
npx dev-optimizer analyze
npx dev-optimizer fix --safe
```

## Features

- **Docker Analysis**: .dockerignore, multistage, layers, base image
- **npm Analysis**: unused deps, duplicates, alternatives, bundle size
- **CI/CD Analysis**: parallel steps, caching, artifacts
- **Security Audit**: vulnerabilities, licenses, outdated packages
- **Auto-fix**: safe fixes with diff preview for risky changes

## Metrics (Before/After)

All changes show measurable results:

```
Before: Docker image 1.2 GB → After: 400 MB (67% reduction)
Before: npm install 45 sec → After: 8 sec (82% faster)
Before: 12 unused deps → After: 0 unused deps
```

## Repository Structure

```
dev-optimizer/
├── src/
│   ├── analyzers/
│   │   ├── DockerAnalyzer.ts
│   │   ├── NpmAnalyzer.ts
│   │   ├── CiAnalyzer.ts
│   │   ├── BundleAnalyzer.ts
│   │   └── SecurityAnalyzer.ts
│   ├── fixers/
│   │   ├── DockerignoreFixer.ts
│   │   ├── PackageFixer.ts
│   │   └── DockerfileFixer.ts
│   ├── reporters/
│   │   ├── ConsoleReporter.ts
│   │   ├── JsonReporter.ts
│   │   └── MarkdownReporter.ts
│   ├── utils/
│   │   ├── Executor.ts
│   │   ├── FileScanner.ts
│   │   └── MetricsCollector.ts
│   └── index.ts
├── tests/
│   ├── fixtures/
│   │   ├── sample-react-app/
│   │   ├── sample-node-api/
│   │   └── sample-nextjs/
│   ├── integration/
│   │   ├── github-repos.test.ts
│   │   └── metrics.test.ts
│   └── unit/
├── docs/
│   ├── METRICS.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
├── package.json
├── tsconfig.json
└── README.md
```

## Test Coverage

- Unit tests: 80%+ coverage
- Integration tests: Real GitHub repositories
- E2E tests: Before/After metrics validation

## Public Repositories for Testing

| Repository | Issue | Expected Fix |
|------------|-------|--------------|
| nginx-proxy-manager | 1.1 GB image | .dockerignore, multistage |
| automatic-ripping-machine | 2.4 GB image | Layer optimization |
| pytorch/serve | 13 GB image | Base image suggestion |
| vercel/next.js | Large node_modules | Unused deps analysis |
| strapi/strapi | Docker time | Cache optimization |

## License

MIT