# Analysis Improvements Roadmap

## 1. New Checks to Add

### Docker (current: 9)

| Check | Priority | Description |
|-------|----------|-------------|
| docker-010: No HEALTHCHECK | Medium | Missing health check instruction |
| docker-011: Latest tag | High | Using :latest instead of pinned version |
| docker-012: ENV in ENTRYPOINT | Low | Environment variables not grouped |
| docker-013: Large context | High | Build context > 100MB |

### Dependencies (current: 3 + knip)

| Check | Priority | Description |
|-------|----------|-------------|
| deps-009: Duplicate deps | High | Same dep in deps and devDeps |
| deps-010: Peer dep issues | Medium | Missing peer dependencies |
| deps-011: Unmet peer deps | Medium | Incompatible peer dep versions |
| deps-012: Bundled deps | Low | Large bundled dependencies |
| deps-013: Optional deps | Low | Unused optional dependencies |

### CI (current: 6)

| Check | Priority | Description |
|-------|----------|-------------|
| ci-007: Expensive runners | High | Using paid runners for free alternatives |
| ci-008: Sequential jobs | High | Jobs that could run in parallel |
| ci-009: No artifact retention | Medium | Missing retention-days |
| ci-010: Large artifacts | Medium | Artifacts > 100MB not compressed |
| ci-011: Redundant steps | Low | Duplicate npm install across jobs |
| ci-012: Missing concurrency | Medium | No concurrency control for PR updates |

## 2. CI Cost Optimization

### Current Gaps

```yaml
# NOT detected yet:
jobs:
  test:
    runs-on: ubuntu-latest  # Could use free alternatives?
    steps:
      - run: npm install     # Could use cache?
      - run: npm install     # DUPLICATE - waste!
      - run: npm test
  
  build:
    needs: test
    runs-on: ubuntu-latest  # Could run in parallel with test?
    steps:
      - run: npm install    # DUPLICATE - waste!
```

### Proposed Analysis

```typescript
// Cost Estimate Finding
interface CostFinding extends Finding {
  costEstimate: {
    currentCost: string;      // "$5/month"
    potentialCost: string;    // "$0/month"
    savings: string;          // "$5/month"
    savingsPercent: number;  // 100%
    
    recommendations: string[];
    // "Use actions/setup-node with cache"
    // "Combine npm install steps"
    // "Use self-hosted runner"
  };
}
```

### New CI Checks with Cost Impact

| Check | Current | Potential | Savings |
|-------|---------|-----------|---------|
| Duplicate npm install | 5 min/job | 0 min | $2/job |
| No cache | 3 min | 0.5 min | $0.50/job |
| Sequential jobs | 10 min | 5 min | $0.25/job |
| Missing concurrency | 20 min | 5 min | $0.75/job |

## 3. Report Format Support

### Current State

| Format | Status | Priority |
|--------|--------|----------|
| Console (table) | ✅ Done | - |
| Markdown | ✅ Done | - |
| JSON | ❌ Missing | High |
| SARIF | ❌ Missing | Medium |

### Proposed Implementation

```typescript
// reporters/JsonReporter.ts
export class JsonReporter implements Reporter {
  format(report: FullReport): string {
    return JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      score: report.score,
      findings: report.findings.map(f => ({
        id: f.id,
        domain: f.domain,
        title: f.title,
        severity: f.severity,
        file: f.evidence.file,
        line: f.evidence.line,
        autoFixable: f.suggestedFix?.autoFixable,
        fix: f.suggestedFix
      })),
      summary: {
        total: report.findings.length,
        bySeverty: {...},
        byDomain: {...}
      }
    }, null, 2);
  }
}

// reporters/SarifReporter.ts
export class SarifReporter implements Reporter {
  format(report: FullReport): string {
    return JSON.stringify({
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'dev-optimizer',
            version: '0.1.0',
            rules: report.findings.map(f => ({
              id: f.id,
              shortDescription: { text: f.title },
              defaultConfiguration: { level: this.mapSeverity(f.severity) }
            }))
          }
        },
        results: report.findings.map(f => ({
          ruleId: f.id,
          message: { text: f.description },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: f.evidence.file },
              region: { startLine: f.evidence.line }
            }
          }]
        }))
      }]
    }, null, 2);
  }
}
```

## 4. Implementation Priority

### Phase 1: Report Formats (HIGH)
- Add JSON reporter for CI pipelines
- Add SARIF reporter for GitHub Code Scanning

### Phase 2: CI Cost Analysis (HIGH)
- Add duplicate step detection
- Add concurrency check
- Add cost estimate to findings

### Phase 3: Dependency Checks (MEDIUM)
- Add duplicate deps check
- Add peer dep validation

### Phase 4: Docker Checks (LOW)
- Add HEALTHCHECK check
- Add :latest tag check

## 5. SARIF Integration

GitHub Code Scanning supports SARIF format:

```yaml
# .github/workflows/code-scanning.yml
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: dev-optimizer-results.sarif
```

This enables:
- GitHub Security tab integration
- PR annotations
- Trend tracking
- Free for public repos