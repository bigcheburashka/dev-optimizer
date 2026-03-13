# dev-optimizer — Development Plan

> **Positioning:** Cut CI time, dependency bloat, and Docker waste before merge.
> **Core value:** One report, clear savings, safe fixes — not another linter.
> **Message:** "Cut CI time, dependency bloat, and Docker waste before merge"

---

## Product Stages (GPT Plan)

### Stage 1: CLI + GitHub Action (CURRENT)
- ✅ CLI analyze command
- ✅ 3 domains (Docker, Deps, CI)
- ✅ Console + Markdown reports
- ✅ Safe auto-fixes
- ⏳ GitHub Action for PR comments

### Stage 2: Cloud Dashboard
- ⏳ Baseline persistence
- ⏳ History & regression tracking
- ⏳ Team dashboard
- ⏳ ROI calculator ($)

### Stage 3: Autofix PRs
- ⏳ Safe-first patches
- ⏳ Validation pipeline
- ⏳ Bot for auto-fixes

### Stage 4: Enterprise
- ⏳ Org policies
- ⏳ Private deployment
- ⏳ SSO/SAML

---

## Current Status (2026-03-13)

### ✅ Complete

| Component | Tests | Status |
|-----------|-------|--------|
| DockerAnalyzer | 11 | ✅ Production ready |
| CiAnalyzer | 8 | ✅ Production ready |
| DepsAnalyzer | 11 | ✅ Production ready |
| RepoScanner | 13 | ✅ Production ready |
| Fix command | 12 | ✅ Production ready |
| BaselineManager | 11 | ✅ Production ready |
| ConsoleReporter | - | ✅ Works |
| MarkdownReporter | - | ✅ Works |
| **Total** | **59** | ✅ |

### Git: 14 commits

```
81a8948 - Fix score calculation
e2b8d60 - Fix BaselineManager tests
5788877 - Add BaselineManager
40584cd - Add demo repos
7da01c2 - Implement fix command
...
```

### Tested on Real Repos

| Repository | Score | Findings |
|------------|-------|----------|
| nestjs/nest | 70/100 | 3 |
| expressjs/express | 47/100 | 9 |

---

## MVP Scope (Done)

### ✅ 3 Domains

| Domain | Analysis | Auto-fix |
|--------|----------|----------|
| **CI/CD** | GitHub Actions: cache, timeout, matrix | Add cache via setup-node |
| **Dependencies** | unused (knip), duplicates, lockfile | Remove unused (high conf) |
| **Docker** | .dockerignore, multistage, base image | Create .dockerignore |

### ✅ CLI Commands

| Command | Status |
|---------|--------|
| `analyze` | ✅ Works |
| `analyze --type docker/deps/ci` | ✅ Works |
| `analyze --format json/markdown` | ✅ Works |
| `fix --dry-run` | ✅ Works |
| `fix --safe` | ✅ Works |
| `baseline --save` | ✅ Works |
| `baseline --compare` | ✅ Works |
| `baseline --history` | ✅ Works |

### ✅ Output Formats

| Format | Status |
|--------|--------|
| Console (table) | ✅ Works |
| Markdown | ✅ Works |
| JSON | ✅ Works |

---

## Production Readiness Checklist

### Must Have (MVP)

| Item | Status | Notes |
|------|--------|-------|
| CLI works | ✅ | All commands tested |
| 3 domains | ✅ | Docker, Deps, CI |
| Safe fixes | ✅ | .dockerignore, cache |
| Reports | ✅ | Console + MD + JSON |
| Tests | ✅ | 59 passing |
| Real repo testing | ✅ | nest, express |
| Documentation | ✅ | README + docs/ |
| Score calculation | ✅ | Fixed penalties |
| Baseline persistence | ✅ | JSON storage |

### Should Have (v1.1)

| Item | Status | Notes |
|------|--------|-------|
| GitHub Action | ❌ | PR comments |
| npm publish | ⏸️ | Deferred |
| More findings | ❌ | outdated, audit, size |

### Nice to Have (v2)

| Item | Status | Notes |
|------|--------|-------|
| Dashboard | ❌ | SaaS |
| ROI calculator | ❌ | $ estimates |
| Team features | ❌ | Multi-repo |

---

## Known Gaps & Limitations

### Current Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| Unused deps in libraries | Knip misses exports used externally | Add `--is-library` flag |
| Outdated packages | Not checked | Add `npm outdated` check |
| Security vulnerabilities | Not checked | Add `npm audit` integration |
| Large dependencies | Not analyzed | Add bundlesize estimate |
| Matrix optimization | Not analyzed | Add parallelization check |

### Current Limitations

1. **GitHub Actions only** — GitLab CI in Stage 2
2. **JS/TS only** — Python, Go in Stage 3
3. **Estimates not precise** — ROI estimates, not promises
4. **Library detection** — Knip limitation for library exports

---

## Monetization Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | CLI, local analysis, unlimited repos |
| **Pro** | $19/mo | PR comments, history, 10 repos |
| **Team** | $49/mo | Org policies, unlimited repos, Slack |

---

## Next Steps (Priority Order)

### 1. Gap Fixes (This Week)

| Task | Impact | Effort |
|------|--------|--------|
| Add `npm outdated` check | Medium | Low |
| Add `npm audit` integration | Medium | Low |
| Fix score formula | High | Done |
| Test on more repos | Medium | Low |

### 2. GitHub Action (Next Week)

| Task | Impact | Effort |
|------|--------|--------|
| Create .github/workflows/action.yml | High | Low |
| PR comment generation | High | Medium |
| Baseline comparison in PR | Medium | Medium |

### 3. Polish (Post-Action)

| Task | Priority |
|------|----------|
| Improve error messages | Medium |
| Add --verbose flag | Low |
| Add --quiet flag | Low |
| Better progress output | Medium |

---

## References

- `docs/brief.md` — What we build, what NOT to build
- `docs/dod.md` — Definition of Done
- `docs/finding-schema.md` — Finding model
- `docs/mvp-scope.md` — Scope boundaries
- `docs/demo-script.md` — Demo preparation
- `docs/TODO.md` — Monetization roadmap

---

## Repository

Private: `https://github.com/bigcheburashka/dev-optimizer`

**Branch:** main
**Commits:** 14
**Tests:** 59 passing