# dev-optimizer — Development Plan

> **Positioning:** Cut CI time, dependency bloat, and Docker waste before merge.
> **Not** "another linter" — prioritized savings with ROI estimates and safe autofix.

## Product Strategy

Based on market research, the key insight is:
- **Problem:** Teams waste money/time on inefficient CI, bloated deps, and Docker images
- **Gap:** Existing tools are fragmented (hadolint, Trivy, Knip, Dependabot) with no unified prioritization or ROI
- **Solution:** One report, clear savings, safe fixes — focused on 3 domains only

### What We Build (MVP)

| Domain | Features | Why |
|--------|----------|-----|
| **CI Optimization** | GitHub Actions parser, cache detection, parallelization, cost estimate | Highest commercial value, clear ROI |
| **Dependency Hygiene** | Unused/duplicate deps, heavy packages, install size impact | Real pain, Knip proves demand |
| **Docker Build** | .dockerignore, multistage detection, layer analysis, build time | Standard optimization, safe autofix |

### What We Don't Build (v1)

| Feature | Why Not |
|---------|---------|
| Bundle analyzer | Covered by webpack-bundle-analyzer, ecosystem plugins |
| Security scanner | Crowded market (Snyk, Trivy, Docker Scout) |
| Files cleanup | Low willingness to pay |
| Generic "base image suggestion" | Needs confidence model, not universal |

---

## Monetization Model

**Open Source CLI + SaaS Upsell**

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Local analyze, console report, limited autofix, 1 repo |
| **Pro** | $19/mo | PR comments, history, dashboards, 10 repos |
| **Team** | $49/mo | Org policies, unlimited repos, ROI reporting |
| **Enterprise** | Custom | Private deployment, SSO, Slack/Jira integration |

**Why this model:**
- CLI is commoditized (free tools exist)
- Value is in workflow integration, visibility, and team controls
- Snyk, Docker, GitHub monetize this way

---

## ICP (Target Customer)

1. **Primary:** JS/TS teams 10-200 engineers with GitHub/GitLab CI
2. **Secondary:** Platform/DevEx teams needing fleet-wide standards
3. **Tertiary:** Startups with high CI bills

**Not targeting:** Solo devs (low willingness to pay), enterprise security teams (Snyk/Socket owned)

---

## MVP Scope (Weeks 1-3)

### Week 1: Foundation + CI Analyzer

```
src/
├── analyzers/
│   ├── CiAnalyzer.ts          # GitHub Actions parser
│   ├── DockerAnalyzer.ts      # (exists) Refine for ROI
│   └── DepAnalyzer.ts         # Dependency analysis
├── parsers/
│   └── GitHubActionsParser.ts # .github/workflows/*.yml
├── metrics/
│   ├── CiCostEstimator.ts     # GitHub Actions pricing
│   └── SavingsCalculator.ts   # Before/after ROI
└── reporters/
    └── PrCommentReporter.ts   # GitHub PR integration
```

**DoD:**
- [ ] Parse GitHub Actions workflow files
- [ ] Detect missing cache configuration
- [ ] Identify parallelization opportunities
- [ ] Estimate monthly CI cost savings
- [ ] Test on 3 public repos with known CI issues

### Week 2: Dependency + Docker Optimization

```
src/
├── analyzers/
│   └── DepAnalyzer.ts         # Complete implementation
├── fixers/
│   ├── DockerignoreFixer.ts   # Safe autofix
│   └── PackageJsonFixer.ts    # Dep fixes with confidence
└── utils/
    └── ConfidenceScore.ts     # Safety scoring
```

**DoD:**
- [ ] Detect unused dependencies (integrate Knip or reimplement)
- [ ] Find duplicate versions
- [ ] Score heavy packages with alternatives
- [ ] Calculate install size impact
- [ ] Apply safe autofix for .dockerignore (100% confidence)
- [ ] Generate patch files for risky fixes (review-first)

### Week 3: Integration + Launch

```
src/
├── integrations/
│   └── GitHubAction.ts        # GitHub Action entry point
├── reporters/
│   ├── MarkdownReporter.ts    # PR comment format
│   └── JsonReporter.ts        # CI artifact
└── cli.ts                     # Finalize CLI
```

**DoD:**
- [ ] GitHub Action published to Marketplace
- [ ] PR comment with prioritized recommendations
- [ ] Confidence score visible per fix
- [ ] Before/after metrics in report
- [ ] README with quickstart (1 command setup)
- [ ] Demo video showing savings on real repo

---

## Test Repositories

Target repos for validation (public, known issues):

| Repo | Issue | Expected Improvement |
|------|-------|---------------------|
| strapi/strapi | Slow CI, large node_modules | 30-40% CI time reduction |
| nginx-proxy-manager | 1.1 GB image | 60% size reduction |
| create-react-app | Large node_modules | 25% deps reduction |
| vercel/next.js | Complex CI matrix | Cache optimization |
| pytorch/serve | 13 GB image | Base image suggestion |

---

## Metrics & DoD per Phase

### Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| CLI startup | < 500ms | `time npx dev-optimizer --version` |
| Analysis time | < 30s | Full repo scan |
| npm package size | < 1 MB | `npm pack` |
| Test coverage | > 80% | Jest --coverage |
| Real repo improvements | 5+ repos | Documented before/after |
| GitHub installs | 100+ in Month 1 | GitHub Marketplace |

### Definition of Done (Each Feature)

- [ ] Unit tests > 80% coverage
- [ ] Integration test on real repo
- [ ] Before/after metrics documented
- [ ] Confidence score assigned to fixes
- [ ] Safe autofix validated (no breaking changes)
- [ ] CLI help text and README updated

---

## Roadmap Beyond MVP

### Stage 2: Cloud Dashboard (Month 2)

- History and regression tracking
- Repo comparison
- Team dashboards
- Weekly optimization reports

### Stage 3: Autofix PRs (Month 3)

- Safe-first patches
- Automated validation runs
- Rollback-friendly diffs
- PR review workflow

### Stage 4: Enterprise (Month 4+)

- Private deployment
- SSO integration
- Org-wide policies
- Slack/Jira notifications
- Custom rules engine

---

## Technical Architecture

```
dev-optimizer/
├── src/
│   ├── index.ts              # CLI entry
│   ├── types.ts              # Interfaces
│   │
│   ├── analyzers/
│   │   ├── CiAnalyzer.ts     # GitHub Actions, GitLab CI
│   │   ├── DepAnalyzer.ts    # npm, yarn, pnpm
│   │   └── DockerAnalyzer.ts # Dockerfile, .dockerignore
│   │
│   ├── parsers/
│   │   ├── YamlParser.ts     # CI config parsing
│   │   └── PackageParser.ts  # package.json parsing
│   │
│   ├── fixers/
│   │   ├── Autofixer.ts      # Safe fix application
│   │   └── Confidence.ts     # Safety scoring
│   │
│   ├── metrics/
│   │   ├── CostEstimator.ts  # CI cost calculation
│   │   └── Savings.ts        # ROI calculation
│   │
│   ├── reporters/
│   │   ├── ConsoleReporter.ts
│   │   ├── MarkdownReporter.ts
│   │   └── PrReporter.ts
│   │
│   └── integrations/
│       └── GitHubAction.ts
│
├── tests/
│   ├── fixtures/
│   ├── unit/
│   └── integration/
│
└── docs/
    ├── ARCHITECTURE.md
    └── METRICS.md
```

---

## Current Status

### Completed

- [x] Project structure (TypeScript + ESM)
- [x] DockerAnalyzer (basic)
- [x] NpmAnalyzer (basic)
- [x] ConsoleReporter
- [x] Test infrastructure
- [x] Git repository initialized

### Next Steps (This Session)

1. **Create remote repository** → GitHub/GitLab
2. **Add CI analyzer** → GitHub Actions parser
3. **Refine messaging** → ROI-focused reports
4. **Create demo** → Before/after on real repo

---

## References

- [hadolint](https://github.com/hadolint/hadolint) — Dockerfile linter
- [Knip](https://knip.dev/) — Unused deps/exports
- [GitHub Actions Pricing](https://docs.github.com/en/billing/actions-billing)
- [Snyk Open Source](https://docs.snyk.io/scan-with-snyk/snyk-open-source)