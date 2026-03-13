# Demo Script

## Quick Demo (30 seconds)

```bash
# Install globally
npm install -g dev-optimizer

# Run on any Node.js project
cd your-project
dev-optimizer analyze

# Preview fixes
dev-optimizer fix --dry-run

# Apply safe fixes
dev-optimizer fix --safe
```

---

## Full Demo (5 minutes)

### Setup

```bash
# Clone demo repos
git clone https://github.com/example/bad-docker-demo demo-1
git clone https://github.com/example/bad-ci-demo demo-2
git clone https://github.com/example/bad-deps-demo demo-3
```

---

### Demo 1: Docker Optimization (Node.js microservice)

**Before:**
```
🐳 Docker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 35/100
Issues: 4
  - Missing .dockerignore (-20 points)
  - No multistage build (-15 points)  
  - Large base image: ubuntu:latest (-10 points)
  - No cleanup after install (-10 points)

Potential Savings: 650 MB (54% reduction)
```

**After:**
```bash
dev-optimizer fix --safe
```

```
✅ Created .dockerignore

📊 Summary:
✅ Applied: 1
⏭️  Skipped: 0
❌ Errors: 0

Score: 55/100 (+20 points)
Savings: 400 MB applied
```

**Manual review for multistage:**
```bash
dev-optimizer analyze --format markdown > docker-fixes.md
```

---

### Demo 2: CI/CD Optimization (GitHub Actions)

**Before:**
```
🔄 CI/CD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 40/100
Issues: 3
  - No caching configured (-20 points)
  - No matrix strategy (-10 points)
  - Sequential jobs (-10 points)

Potential Savings: 8 min per CI run
```

**After:**
```bash
dev-optimizer fix --dry-run
```

```
📝 Planned fixes:

🔄 [HIGH] No caching configured
   File: .github/workflows/ci.yml
   Action: Add actions/cache for npm

--- .github/workflows/ci.yml ---
      - uses: actions/setup-node@v4
        with:
          node-version: 20
+         cache: 'npm'
```

**Score: 60/100 (+20 points)**
**Savings: 3 min per CI run**

---

### Demo 3: Dependency Cleanup (npm)

**Before:**
```
📦 Dependencies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 50/100
Issues: 4
  - Unused: lodash (72 KB)
  - Unused: moment (230 KB)  
  - Duplicate: axios appears twice
  - Missing package-lock.json

node_modules: 285 MB
Dependencies: 52
```

**After:**
```bash
dev-optimizer fix --safe
```

```
✅ Removed unused: lodash
✅ Created package-lock.json

📊 Summary:
✅ Applied: 2
⏭️  Skipped: 1 (requires review)
❌ Errors: 0

Score: 70/100 (+20 points)
Savings: 45 MB
```

---

## Expected Results

### Demo 1: Docker
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Image size | 1.2 GB | 550 MB | 54% |
| Build time | 180s | 90s | 50% |
| Score | 35 | 55 | +20 |

### Demo 2: CI/CD
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| CI time | 12 min | 4 min | 67% |
| Cache hits | 0% | 85% | +85% |
| Score | 40 | 60 | +20 |

### Demo 3: Dependencies
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| node_modules | 285 MB | 240 MB | 16% |
| Dependencies | 52 | 48 | 8% |
| Score | 50 | 70 | +20 |

---

## One-Liner Demo

```bash
npx dev-optimizer analyze && npx dev-optimizer fix --dry-run
```

---

## Key Selling Points

1. **One command** - Analyze all domains at once
2. **Safe fixes** - Only applies low-risk changes
3. **Clear ROI** - Shows savings in MB and minutes
4. **No setup** - Works on any Node.js project
5. **Fast** - Complete analysis in < 5 seconds