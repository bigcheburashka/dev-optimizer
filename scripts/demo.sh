#!/bin/bash

# Quick demo script for dev-optimizer
# Run from project root

echo "🔍 Dev Optimizer - Quick Demo"
echo "=============================="
echo ""

# Demo 1: Docker
echo "📦 Demo 1: Docker Optimization"
echo "------------------------------"
cd demo-repos/demo-docker
echo "Analyzing Docker project..."
npx dev-optimizer analyze --type docker 2>/dev/null || echo "Run: npx dev-optimizer analyze --type docker"
echo ""
echo "Preview fixes:"
npx dev-optimizer fix --dry-run 2>/dev/null || echo "Run: npx dev-optimizer fix --dry-run"
echo ""
cd ../..

# Demo 2: CI/CD
echo "🔄 Demo 2: CI/CD Optimization"
echo "-----------------------------"
cd demo-repos/demo-ci
echo "Analyzing CI/CD project..."
npx dev-optimizer analyze --type ci 2>/dev/null || echo "Run: npx dev-optimizer analyze --type ci"
echo ""
cd ../..

# Demo 3: Dependencies
echo "📦 Demo 3: Dependency Cleanup"
echo "-----------------------------"
cd demo-repos/demo-deps
echo "Analyzing Dependencies..."
npx dev-optimizer analyze --type deps 2>/dev/null || echo "Run: npx dev-optimizer analyze --type deps"
echo ""
cd ../..

echo "✅ Demo complete!"
echo ""
echo "Next steps:"
echo "  1. Apply fixes: npx dev-optimizer fix --safe"
echo "  2. View markdown report: npx dev-optimizer analyze --format markdown"
echo "  3. Export JSON: npx dev-optimizer analyze --format json > report.json"