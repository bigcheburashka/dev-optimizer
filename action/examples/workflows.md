# Example workflows

## Basic PR Check

```yaml
# .github/workflows/dev-optimizer.yml
name: Dev Optimizer

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze repository
        uses: dev-optimizer/action@v1
```

## Strict Mode (Fail on Issues)

```yaml
# .github/workflows/dev-optimizer-strict.yml
name: Dev Optimizer (Strict)

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze (strict)
        uses: dev-optimizer/action@v1
        with:
          fail-on-issues: true
          domains: docker,ci
```

## Baseline Tracking

```yaml
# .github/workflows/dev-optimizer-baseline.yml
name: Dev Optimizer (Baseline)

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Compare with baseline
        uses: dev-optimizer/action@v1
        with:
          compare-baseline: true
          save-baseline: ${{ github.event_name == 'push' }}
```

## Scheduled Analysis

```yaml
# .github/workflows/dev-optimizer-scheduled.yml
name: Weekly Dev Optimizer Report

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Weekly analysis
        uses: dev-optimizer/action@v1
        with:
          save-baseline: true
          format: markdown
```

## Docker-Only Analysis

```yaml
# .github/workflows/docker-optimizer.yml
name: Docker Optimizer

on:
  pull_request:
    paths:
      - 'Dockerfile'
      - '.dockerignore'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Docker analysis
        uses: dev-optimizer/action@v1
        with:
          domains: docker
```

## CI-Only Analysis

```yaml
# .github/workflows/ci-optimizer.yml
name: CI Optimizer

on:
  pull_request:
    paths:
      - '.github/workflows/*.yml'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: CI analysis
        uses: dev-optimizer/action@v1
        with:
          domains: ci
```