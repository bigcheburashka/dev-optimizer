# Potential New Checks

## Docker (3 more)

| ID | Finding | Priority | Effort |
|----|---------|----------|--------|
| docker-010 | No HEALTHCHECK | Low | Easy |
| docker-011 | Using ADD for URLs | Low | Easy |
| docker-012 | ENV without default value | Low | Easy |

## CI/CD (4 more)

| ID | Finding | Priority | Effort |
|----|---------|----------|--------|
| ci-009 | No concurrency group | Medium | Medium |
| ci-010 | Hardcoded branch names | Low | Easy |
| ci-011 | Missing permissions block | Medium | Easy |
| ci-012 | No cancel-in-progress | Low | Easy |

## Dependencies (3 more)

| ID | Finding | Priority | Effort |
|----|---------|----------|--------|
| deps-012 | Duplicate version constraints | Low | Medium |
| deps-013 | Peer dependency warnings | Medium | Easy |
| deps-014 | Bundle size estimate | Low | Hard |

## Performance Improvements

| Current | Proposed | Speedup |
|---------|----------|---------|
| npm outdated (10s) | Skip in --quick | 3x |
| npm audit (15s) | Skip in --quick | 9x |
| knip (5s) | Cache results | 1.5x |

## Test Coverage Gaps

| File | Status | Priority |
|------|--------|----------|
| commands/analyze.ts | ❌ No tests | High |
| commands/baseline.ts | ❌ No tests | Medium |
| commands/metrics.ts | ❌ No tests | Low |
| reporters/ConsoleReporter.ts | ❌ No tests | High |
| reporters/MarkdownReporter.ts | ❌ No tests | High |

## Pre-public Checklist

- [x] README.md updated
- [x] LICENSE added
- [x] package.json main/bin/files
- [x] .npmignore created
- [x] depcheck removed (unused)
- [ ] Tests for commands/*
- [ ] Tests for reporters/*
- [ ] GitHub release notes