# Performance Optimization Plan

## Current Bottlenecks

| Component | Time | % of Total |
|-----------|------|------------|
| npx knip | 25 сек | 80% |
| npm outdated | 7 сек | 15% |
| Docker/CI analysis | 1 сек | 3% |
| Node startup | 1 сек | 2% |

## Optimizations

### 1. Cache knip results (HIGH IMPACT)

```typescript
// Store knip results in .dev-optimizer/cache/knip-{hash}.json
// Hash = package.json + tsconfig.json hash
// TTL = 1 hour or until package.json changes
```

**Impact:** 25 сек → 0.1 сек (250x faster)

### 2. Cache npm outdated (MEDIUM IMPACT)

```typescript
// Store npm outdated results in .dev-optimizer/cache/outdated-{hash}.json
// TTL = 1 hour
```

**Impact:** 7 сек → 0.1 сек (70x faster)

### 3. Use knip package directly (MEDIUM IMPACT)

Instead of spawning npx knip:

```typescript
import { runKnip } from 'knip';
const results = await runKnip({ config: knipConfig });
```

**Impact:** 25 сек → 5 сек (5x faster)
**Reason:** No Node.js startup + no npm resolution

### 4. Remove ora spinner (LOW IMPACT)

Ora adds ~500ms per analysis.

**Impact:** 500ms saved

### 5. Lazy load analyzers (LOW IMPACT)

Only load analyzers when needed.

```typescript
// Instead of importing all analyzers upfront
const { DockerAnalyzer } = await import('../analyzers/DockerAnalyzer.js');
```

**Impact:** 200ms saved

## Implementation Priority

1. **Phase 1:** Cache knip results (HIGH)
2. **Phase 2:** Use knip package directly (MEDIUM)
3. **Phase 3:** Cache npm outdated (MEDIUM)
4. **Phase 4:** Remove ora (LOW)
5. **Phase 5:** Lazy load (LOW)

## Expected Result

| Mode | Before | After |
|------|--------|-------|
| --quick | 31 сек | **2-3 сек** |
| --full | 60 сек | **5-10 сек** |
| --deep | 120 сек | **10-20 сек** |

## Quick Win

Add cache file structure:

```
.dev-optimizer/
├── cache/
│   ├── knip-{hash}.json (TTL: 1h)
│   ├── npm-outdated-{hash}.json (TTL: 1h)
│   └── npm-audit-{hash}.json (TTL: 24h)
└── baseline.json
```