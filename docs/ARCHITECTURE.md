# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry                             │
│                    (src/index.ts)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                            │
│               (src/Orchestrator.ts)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Analyze    │  │    Fix      │  │   Metrics   │          │
│  │  Command    │  │  Command    │  │  Command    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ DockerAnalyzer │   │  NpmAnalyzer   │   │   CiAnalyzer   │
│ (analyzers/)   │   │ (analyzers/)   │   │  (analyzers/)  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Reporters                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Console    │  │    JSON     │  │  Markdown   │          │
│  │  Reporter   │  │  Reporter   │  │  Reporter   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Analyzers

Each analyzer follows the same interface:

```typescript
interface Analyzer {
  name: string;
  analyze(path: string): Promise<AnalysisResult>;
  isApplicable(path: string): Promise<boolean>;
}

interface AnalysisResult {
  issues: Issue[];
  suggestions: Suggestion[];
  metrics: Metrics;
  potentialSavings: Savings;
}
```

### 2. Analyzers Pipeline

```typescript
class AnalyzerPipeline {
  private analyzers: Analyzer[] = [
    new DockerAnalyzer(),
    new NpmAnalyzer(),
    new CiAnalyzer(),
    new BundleAnalyzer(),
    new SecurityAnalyzer()
  ];

  async run(path: string): Promise<FullReport> {
    const results = [];
    for (const analyzer of this.analyzers) {
      if (await analyzer.isApplicable(path)) {
        results.push(await analyzer.analyze(path));
      }
    }
    return this.mergeResults(results);
  }
}
```

### 3. Fixers

```typescript
interface Fixer {
  name: string;
  canFix(issue: Issue): boolean;
  fix(issue: Issue, options: FixOptions): Promise<FixResult>;
  isSafe(issue: Issue): boolean;
}

class FixerRegistry {
  private fixers: Fixer[] = [
    new DockerignoreFixer(),
    new PackageFixer(),
    new DockerfileFixer(),
    new GitignoreFixer()
  ];

  getSafeFixes(issues: Issue[]): FixAction[] {
    return issues
      .filter(i => this.fixers.some(f => f.isSafe(i)))
      .map(i => this.fixers.find(f => f.canFix(i)));
  }
}
```

### 4. Reporters

```typescript
interface Reporter {
  format(result: FullReport): string;
  getExtension(): string;
}

class ConsoleReporter implements Reporter {
  format(result: FullReport): string {
    // ANSI colored output
  }
}

class JsonReporter implements Reporter {
  format(result: FullReport): string {
    return JSON.stringify(result, null, 2);
  }
}

class MarkdownReporter implements Reporter {
  format(result: FullReport): string {
    // Markdown tables with emojis
  }
}
```

### 5. Metrics Collector

```typescript
class MetricsCollector {
  async collect(path: string): Promise<Metrics> {
    return {
      docker: {
        imageSize: await this.getDockerImageSize(path),
        buildTime: await this.measureDockerBuild(path),
        layerCount: await this.getLayerCount(path)
      },
      npm: {
        installTime: await this.measureNpmInstall(path),
        nodeModulesSize: await this.getNodeModulesSize(path),
        depCount: await this.getDepCount(path)
      },
      ci: {
        lastRunTime: await this.getCiRunTime(path),
        cacheHitRate: await this.getCacheHitRate(path)
      }
    };
  }

  async compare(before: Metrics, after: Metrics): Promise<Comparison> {
    return {
      docker: {
        imageSize: this.percentDiff(before.docker.imageSize, after.docker.imageSize),
        buildTime: this.percentDiff(before.docker.buildTime, after.docker.buildTime)
      },
      // ...
    };
  }
}
```

## Data Flow

```
1. User runs: npx dev-optimizer analyze
                  │
2. CLI parses command and options
                  │
3. Orchestrator runs applicable analyzers
                  │
4. Each analyzer:
   - Checks if applicable (Dockerfile exists? package.json exists?)
   - Scans files
   - Detects issues
   - Calculates potential savings
                  │
5. Results merged into FullReport
                  │
6. Reporter formats output
                  │
7. CLI prints to console / file
```

## File Structure

```
src/
├── index.ts                    # CLI entry point
├── Orchestrator.ts             # Main orchestrator
├── types.ts                    # TypeScript interfaces
│
├── analyzers/
│   ├── Analyzer.ts             # Base class
│   ├── DockerAnalyzer.ts       # Dockerfile analysis
│   ├── NpmAnalyzer.ts          # package.json analysis
│   ├── CiAnalyzer.ts           # GitHub Actions analysis
│   ├── BundleAnalyzer.ts      # Bundle size analysis
│   └── SecurityAnalyzer.ts     # Security audit
│
├── fixers/
│   ├── Fixer.ts                # Base class
│   ├── DockerignoreFixer.ts    # Create .dockerignore
│   ├── PackageFixer.ts         # Remove unused deps
│   ├── DockerfileFixer.ts      # Suggest multistage
│   └── GitignoreFixer.ts       # Add .gitignore entries
│
├── reporters/
│   ├── Reporter.ts             # Base class
│   ├── ConsoleReporter.ts      # Terminal output
│   ├── JsonReporter.ts         # JSON output
│   └── MarkdownReporter.ts     # Markdown output
│
└── utils/
    ├── Executor.ts             # Run shell commands
    ├── FileScanner.ts          # Scan files
    ├── MetricsCollector.ts     # Collect metrics
    └── Logger.ts               # Logging
```

## Dependencies

```json
{
  "dependencies": {
    "commander": "^11.0.0",     // CLI parsing
    "chalk": "^5.0.0",          // Terminal colors
    "ora": "^7.0.0",            // Spinners
    "depcheck": "^1.4.0",       // Unused deps detection
    "dockerfile-parser": "^1.0.0", // Dockerfile parsing
    "yaml": "^2.3.0",           // YAML parsing (CI configs)
    "bundlephobia": "^0.1.0"    // Package sizes
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0"
  }
}
```

## Extension Points

### Adding a new analyzer:

```typescript
// 1. Create analyzer
class MyAnalyzer implements Analyzer {
  name = 'my-analyzer';
  
  async isApplicable(path: string): Promise<boolean> {
    return fs.existsSync(path.join(path, 'my-config.json'));
  }
  
  async analyze(path: string): Promise<AnalysisResult> {
    // Analysis logic
  }
}

// 2. Register in Orchestrator
const analyzers = [
  new DockerAnalyzer(),
  new NpmAnalyzer(),
  new MyAnalyzer() // Add here
];
```

### Adding a new fixer:

```typescript
class MyFixer implements Fixer {
  name = 'my-fixer';
  
  isSafe(issue: Issue): boolean {
    return issue.type === 'my-issue' && issue.severity === 'low';
  }
  
  async fix(issue: Issue): Promise<FixResult> {
    // Fix logic
  }
}
```

## Error Handling

```typescript
class DevOptimizerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
  }
}

// Error codes
const ERROR_CODES = {
  NO_DOCKERFILE: 'NO_DOCKERFILE',
  NO_PACKAGE_JSON: 'NO_PACKAGE_JSON',
  PARSE_ERROR: 'PARSE_ERROR',
  FIX_FAILED: 'FIX_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};
```

## Performance

| Operation | Target Time | Memory |
|-----------|-------------|--------|
| Dockerfile parse | < 100ms | < 10MB |
| package.json parse | < 50ms | < 5MB |
| Unused deps scan | < 5s | < 100MB |
| Full analysis | < 30s | < 200MB |

## Caching Strategy

```typescript
class Cache {
  private cacheDir = '.dev-optimizer-cache';
  
  async get(key: string): Promise<any> {
    const cached = await fs.readFile(
      path.join(this.cacheDir, key),
      'utf-8'
    );
    return JSON.parse(cached);
  }
  
  async set(key: string, value: any): Promise<void> {
    await fs.writeFile(
      path.join(this.cacheDir, key),
      JSON.stringify(value)
    );
  }
}
```

Cache keys:
- npm package info: `npm:${packageName}:${version}`
- Docker image info: `docker:${imageName}:${tag}`
- Bundle size: `bundle:${packageName}:${version}`

Cache TTL: 24 hours