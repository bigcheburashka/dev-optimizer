# dev-optimizer — Development Plan

> **Positioning:** Cut CI time, dependency bloat, and Docker waste before merge.
> **Core value:** One report, clear savings, safe fixes — not another linter.

---

## MVP Scope (4 weeks)

### In Scope

| Domain | Analysis | Auto-fix |
|--------|----------|----------|
| **CI/CD** | GitHub Actions: cache, matrix, timeout, parallelization | Add cache via setup-node |
| **Dependencies** | Unused deps, duplicates, prod/dev classification, heavy packages | Remove unused (high confidence only) |
| **Docker** | .dockerignore, multistage, base image, cleanup | Create .dockerignore (always safe) |

### Out of Scope (Post-MVP)

- Bundle analyzer (use webpack-bundle-analyzer)
- Security scanner (Snyk, Trivy owned)
- License policy
- Performance history
- Dashboard/SaaS
- GitLab CI (Phase 2)
- Enterprise features

---

## Architecture

```
dev-optimizer/
├── src/
│   ├── index.ts              # CLI entry
│   ├── types.ts              # Finding schema (unified)
│   │
│   ├── analyzers/
│   │   ├── CiAnalyzer.ts     # GitHub Actions parser
│   │   ├── DepsAnalyzer.ts  # package.json analysis
│   │   └── DockerAnalyzer.ts # Dockerfile analysis
│   │
│   ├── discovery/
│   │   └── RepoInventory.ts  # Detect files, lockfiles
│   │
│   ├── scoring/
│   │   ├── Confidence.ts     # High/Medium/Low
│   │   └── ImpactEstimator.ts # Time/size savings
│   │
│   ├── fixers/
│   │   ├── DockerignoreFixer.ts
│   │   ├── CacheFixer.ts
│   │   └── DepsFixer.ts
│   │
│   └── reporters/
│       ├── TableReporter.ts   # Console output
│       ├── MarkdownReporter.ts # PR comments
│       └── JsonReporter.ts    # CI/CD integration
│
├── tests/
│   ├── fixtures/              # Demo repos
│   └── unit/                  # Per-module tests
│
└── docs/
    ├── mvp-scope.md
    ├── finding-schema.md
    ├── demo-script.md
    └── dod.md
```

---

## Finding Schema (Unified)

```typescript
interface Finding {
  id: string;
  domain: 'ci' | 'deps' | 'docker';
  title: string;
  description: string;
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
    diff?: string;
    autoFixable: boolean;
  };
}
```

Full schema: `docs/finding-schema.md`

---

## Timeline (4 weeks)

### Week 1: Foundation (CURRENT)
- [x] Architecture design
- [x] Finding schema
- [x] CLI skeleton
- [x] Docker analyzer (basic)
- [x] CI analyzer (basic)
- [ ] Repo inventory
- [ ] Baseline report

### Week 2: Analyzers
- [x] Docker analyzer (partial)
- [ ] Dependency analyzer with confidence
- [x] CI analyzer (GitHub Actions)
- [ ] Markdown reporter
- [ ] Top findings ranking

### Week 3: Fixes & Ranking
- [ ] Safe fix engine
- [ ] Dockerignore fixer
- [ ] Cache fixer
- [ ] Scoring/ranking
- [ ] Demo repos setup

### Week 4: Polish
- [ ] Bug fixes
- [ ] Documentation
- [ ] Demo script
- [ ] Packaging (npm)

---

## DoD per Week

### Week 1 DoD
- [ ] `dev-optimizer analyze` runs on any repo
- [ ] Detects 3 domains (ci, deps, docker)
- [ ] Returns unified findings
- [ ] Has test fixtures for each domain

### Week 2 DoD
- [ ] All 3 analyzers produce findings
- [ ] Markdown report is human-readable
- [ ] Top findings ranked correctly

### Week 3 DoD
- [ ] `fix --safe` applies safe fixes
- [ ] `fix --dry-run` shows diffs
- [ ] Confidence model implemented

### Week 4 DoD
- [ ] Demo runs in < 5 minutes
- [ ] README is complete
- [ ] Published to npm

---

## Status Report Format

After each work session:

```
### 1. Что сделано
- [items]

### 2. Что работает
- [runnable items]

### 3. Что не сделано
- [explicit list]

### 4. Риски / ограничения
- [constraints]

### 5. Следующий шаг
- [single next step]
```

---

## Success Metrics (MVP)

| Metric | Target |
|--------|---------|
| Analysis time | < 30 seconds |
| Findings per repo | 5-10 |
| False positive rate | < 20% |
| Safe fix accuracy | > 95% |
| Demo time | < 5 minutes |

---

## Test Repositories

| Repo | Type | Issues covered |
|------|------|----------------|
| demo-service | Node.js microservice | Docker + CI basics |
| demo-frontend | React/Vite app | Dependencies |
| demo-fullstack | Monorepo | All domains |

---

## Next Step

**Week 1 continues:**
1. Complete `RepoInventory.ts` — detect package.json, Dockerfile, CI configs
2. Implement unified `Finding` type in `types.ts`
3. Add baseline section to report

---

## References

- `docs/brief.md` — Agent brief
- `docs/dod.md` — Definition of Done
- `docs/finding-schema.md` — Finding model
- `docs/mvp-scope.md` — Scope boundaries
- `docs/demo-script.md` — Demo preparation