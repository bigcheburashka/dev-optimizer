# dev-optimizer — Development Plan

> **Positioning:** Cut CI time, dependency bloat, and Docker waste before merge.
> **Core value:** One report, clear savings, safe fixes — not another linter.
> **Message:** "Cut CI time, dependency bloat, and Docker waste before merge"

---

## Product Stages (GPT Plan)

### Stage 1: CLI + GitHub Action ✅ COMPLETE

| Feature | Status |
|---------|--------|
| CLI analyze command | ✅ Done |
| 3 domains (Docker, Deps, CI) | ✅ Done |
| Console + Markdown reports | ✅ Done |
| Safe auto-fixes | ✅ Done |
| GitHub Action for PR comments | ✅ Done |
| Extended analyzers | ✅ Done |
| Polish (spinner, flags) | ✅ Done |
| GitLab CI support | ✅ Done |

### Stage 2: Cloud Dashboard ⏳ NEXT

| Feature | Status |
|---------|--------|
| Baseline persistence | ✅ Done |
| History & regression tracking | ✅ Done |
| Team dashboard | ❌ Todo |
| ROI calculator ($) | ❌ Todo |

### Stage 3: Autofix PRs

- ⏳ Safe-first patches
- ⏳ Validation pipeline
- ⏳ Bot for auto-fixes

### Stage 4: Enterprise

- ⏳ Org policies
- ⏳ Private deployment
- ⏳ SSO/SAML

---

## Current Status (2026-03-13 22:40 UTC)

### Git: 22 commits

```
b5a5839 - Update ROADMAP
d43a76c - Add DockerAnalyzer extensions
7cf9f25 - Add CiAnalyzer extensions
3185955 - Expand DepsAnalyzer
fb871a9 - Add MIT License
66c210e - Remove node_modules
35eade8 - Add CI workflow
8d2de3e - Add GitHub Action
...
```

### Tests: 59 passing

| Component | Tests | Status |
|-----------|-------|--------|
| DockerAnalyzer | 11 | ✅ Extended (+4 checks) |
| CiAnalyzer | 8 | ✅ Extended (+3 checks) |
| DepsAnalyzer | 11 | ✅ Extended (+3 checks) |
| RepoScanner | 13 | ✅ Done |
| Fix command | 12 | ✅ Done |
| BaselineManager | 11 | ✅ Done |

### Real Repo Testing

| Repository | Score | Findings |
|------------|-------|----------|
| nestjs/nest | 70/100 | 3 |
| expressjs/express | 47/100 | 9 |

---

## Analyzer Coverage

### Docker (9 checks)

| ID | Finding | Mode |
|----|---------|------|
| docker-001 | Missing .dockerignore | Quick |
| docker-002 | No multistage build | Quick |
| docker-003 | Large base image | Quick |
| docker-004 | No cleanup after install | Quick |
| docker-005 | Too many layers | Quick |
| docker-006 | Running as root | Quick |
| docker-007 | Consecutive RUN commands | Quick |
| docker-008 | ADD instead of COPY | Quick |
| docker-009 | Use WORKDIR | Quick |
| docker-hadolint-* | Hadolint violations | Full |

### CI/CD (8 checks)

| ID | Finding | Mode |
|----|---------|------|
| ci-001 | Invalid YAML | Quick |
| ci-002 | No caching configured | Quick |
| ci-003 | No matrix strategy | Quick |
| ci-004 | No timeout configured | Quick |
| ci-005 | Sequential jobs | Quick |
| ci-006 | Artifact retention | Quick |
| ci-007 | Self-hosted runners | Full |
| ci-008 | Duplicate jobs | Quick |

### Dependencies (11 checks)

| ID | Finding | Mode |
|----|---------|------|
| deps-001 | Unused dependency | Quick |
| deps-002 | Duplicate dependency | Quick |
| deps-003 | Missing lockfile | Quick |
| deps-006 | Unused export | Quick |
| deps-007 | Large node_modules | Quick |
| deps-008 | Many dependencies | Quick |
| deps-009 | Deprecated package | Quick |
| deps-010 | Outdated package | Full |
| deps-011 | Security vulnerability | Full |

---

## CLI Commands

```bash
# Analysis
dev-optimizer analyze                    # All domains, full mode
dev-optimizer analyze --quick            # Quick mode (~5 sec)
dev-optimizer analyze --deep             # Deep mode (~2 min)
dev-optimizer analyze --type docker     # Only Docker
dev-optimizer analyze --type deps        # Only Dependencies
dev-optimizer analyze --type ci          # Only CI/CD
dev-optimizer analyze --format markdown  # PR-ready report

# Fixes
dev-optimizer fix --dry-run              # Preview changes
dev-optimizer fix --safe                 # Apply safe fixes

# Baseline
dev-optimizer baseline --save            # Save baseline
dev-optimizer baseline --compare         # Compare with baseline
dev-optimizer baseline --history         # View history
```

---

## Production Readiness

### Must Have ✅ DONE

| Item | Status |
|------|--------|
| CLI works | ✅ |
| 3 domains | ✅ |
| Safe fixes | ✅ |
| Reports | ✅ |
| Tests | ✅ 59 |
| Real repo testing | ✅ |
| Documentation | ✅ |
| Score calculation | ✅ |
| Baseline persistence | ✅ |
| GitHub Action | ✅ |
| Extended analyzers | ✅ |

### Should Have (v1.1)

| Item | Status | Notes |
|------|--------|-------|
| npm publish | ⏸️ | Ready, deferred |
| More test repos | ❌ | |
| Video demo | ❌ | |
| Landing page | ❌ | |

### Nice to Have (v2)

| Item | Status |
|------|--------|
| Dashboard | ❌ |
| ROI calculator | ❌ |
| Team features | ❌ |
| GitLab CI | ❌ |
| Python/Go support | ❌ |

---

## Monetization Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | CLI, local analysis, unlimited repos |
| **Pro** | $19/mo | PR comments, history, 10 repos |
| **Team** | $49/mo | Org policies, unlimited repos, Slack |

---

## Next Steps

### Ready Now (Stage 1 Complete)

- ✅ All MVP features implemented
- ✅ 59 tests passing
- ✅ GitHub Action ready
- ✅ Extended analyzers

### Stage 2 Options

| Option | Effort | Impact |
|--------|--------|--------|
| **npm publish** | Low | Medium - public visibility |
| **Landing page** | Medium | Medium - marketing |
| **Video demo** | Low | Medium - showcase |
| **Cloud dashboard** | High | High - monetization |
| **Team features** | High | High - monetization |
| **ROI calculator** | Medium | Medium - value proposition |

### Recommended Path

1. **npm publish** — quick win, public visibility
2. **Landing page** — marketing, email capture
3. **Video demo** — showcase capabilities
4. **Early adopters** — gather feedback
5. **Cloud dashboard** — monetization

---

## Repository

**GitHub:** `https://github.com/bigcheburashka/dev-optimizer` (private)
**Branch:** main
**Commits:** 22
**Tests:** 59 passing
**License:** MIT