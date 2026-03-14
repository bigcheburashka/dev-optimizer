# Performance Optimization Plan (Clean Install)

## Problem

Users install dev-optimizer from scratch. They don't have knip, hadolint, etc.
Current bottlenecks are external tools that need to be downloaded/installed.

## Solutions

### Solution 1: Native Analysis (RECOMMENDED)

Replace external tools with native Node.js code:

```typescript
// Instead of running npx knip (25 sec)
// Use native fs + ts-morph for unused exports

class NativeDepsAnalyzer {
  async findUnusedExports(projectPath: string) {
    // Parse exports with ts-morph (already a dep)
    // Check imports
    // Find unused
    // Time: ~1-2 sec
  }
}
```

**Impact:** 25 sec → 2 sec (12x faster, no external deps)

### Solution 2: Quick Mode by Default

```bash
dev-optimizer analyze          # Quick mode (1-2 sec) - static analysis only
dev-optimizer analyze --full   # Full mode (10-15 sec) - + npm outdated/audit
dev-optimizer analyze --deep   # Deep mode (30 sec) - + knip/hadolint
```

**Quick mode includes:**
- Docker: Dockerfile analysis (fs.readFile + regex)
- CI: YAML parsing (native yaml package)
- Deps: package.json analysis (fs.readFile)
- Self-analysis: Native checks

**Time: 1-2 seconds for quick mode on any project**

### Solution 3: Lazy External Tools

Only install external tools when user requests deep analysis:

```typescript
async function ensureKnip() {
  if (!await hasKnipInstalled()) {
    console.log('📦 Installing knip for deep analysis...');
    await installKnip();
  }
  return runKnip();
}
```

**Impact:** First run slower, subsequent runs cached

### Solution 4: Parallel External Calls

If external tools needed, run in parallel:

```typescript
// Instead of sequential:
await runKnip();      // 25 sec
await runNpmAudit();  // 10 sec

// Run in parallel:
Promise.all([
  runKnip(),
  runNpmAudit(),
  runNpmOutdated()
]);
```

**Impact:** 42 sec → 25 sec (still slow)

### Solution 5: Cache External Results

```typescript
// .dev-optimizer/cache/knip-{hash}.json
// Hash = package.json + tsconfig.json hash
// TTL = 24 hours
```

**Impact:** 25 sec → 0.1 sec (after first run)

## Recommended Architecture

```
dev-optimizer analyze (default = quick)
├── Native Docker Analyzer      ~0.3 sec
├── Native CI Analyzer         ~0.2 sec
├── Native Deps Analyzer       ~0.5 sec
│   ├── package.json parse
│   ├── import analysis (ts-morph)
│   └── dupe detection
└── Self Analyzer              ~0.2 sec
Total: ~1-2 sec

dev-optimizer analyze --full
├── All quick checks           ~1-2 sec
├── npm outdated               ~5-7 sec (parallel)
├── npm audit                   ~5-10 sec (parallel)
└── Total: ~10-15 sec

dev-optimizer analyze --deep
├── All full checks            ~10-15 sec
├── knip (cached after first)  ~25 sec (first), ~0.1 sec (cached)
├── hadolint (optional)        ~3-5 sec
└── Total: ~30-40 sec (first), ~15 sec (cached)
```

## Implementation Priority

### Phase 1: Native Quick Mode (HIGH)
- Replace npx knip with ts-morph for import analysis
- Native package.json analysis
- Remove external dependencies from quick mode

**Expected:** 31 sec → **1-2 sec**

### Phase 2: Parallel External Calls (MEDIUM)
- Run npm outdated + npm audit in parallel
- Show progress while running

**Expected:** 42 sec → **15-20 sec** (full mode)

### Phase 3: Caching (MEDIUM)
- Cache knip results
- Cache npm outdated results
- Invalidate on package.json change

**Expected:** First run slow, subsequent runs fast

### Phase 4: Lazy Installation (LOW)
- Only install external tools when --deep requested
- Prompt user before installation

## Comparison with Alternatives

| Tool | First Run | Clean Install | External Deps |
|------|-----------|---------------|--------------|
| **dev-optimizer (current)** | 31 sec | Works | Yes (npx) |
| **dev-optimizer (proposed)** | **1-2 sec** | Works | **No** |
| depcheck | 3 sec | Works | Yes (npx) |
| knip | 25 sec | Works | Yes (npx) |

## Code Changes

### 1. Add ts-morph for native analysis

```bash
npm install ts-morph
```

### 2. Create NativeUnusedAnalyzer

```typescript
// src/analyzers/NativeUnusedAnalyzer.ts
import { Project } from 'ts-morph';

export class NativeUnusedAnalyzer {
  async findUnusedExports(projectPath: string): Promise<string[]> {
    const project = new Project({ tsConfigFilePath: `${projectPath}/tsconfig.json` });
    const sourceFiles = project.getSourceFiles();
    const unused: string[] = [];

    for (const file of sourceFiles) {
      const exports = file.getExportedDeclarations();
      // Check if imported anywhere
      // Add to unused if not
    }

    return unused;
  }
}
```

### 3. Update DepsAnalyzer to use native by default

```typescript
// Quick mode: use native analysis
if (options.mode === 'quick') {
  return this.nativeUnusedAnalysis(projectPath);
}

// Full mode: use knip (if available)
return this.knipAnalysis(projectPath);
```

## Estimated Impact

| Mode | Before | After | Improvement |
|------|--------|-------|-------------|
| quick | 31 sec | **1-2 sec** | **15-30x** |
| full | 42 sec | **10-15 sec** | **3-4x** |
| deep | 60 sec | **30-40 sec** | **1.5-2x** |

## Questions

1. Should we keep npx knip for --deep mode or implement fully native?
2. Should we install knip lazily when --deep is requested?
3. Should we bundle ts-morph or use dynamic import?