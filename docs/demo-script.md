# Demo Script

## Цель

За 5 минут показать ценность Dev Optimizer на реальном репозитории.

---

## Подготовка (до demo)

### Demo репозитории

```bash
# Demo 1: Small Node.js service
git clone https://github.com/example/node-starter demo-service
cd demo-service

# Demo 2: React app
git clone https://github.com/example/react-boilerplate demo-frontend
cd demo-frontend

# Demo 3: Full stack (создаём проблемный intentionally)
git clone https://github.com/example/fullstack-app demo-fullstack
cd demo-fullstack
```

### Проверка

```bash
# Каждый репо должен иметь:
- package.json
- Dockerfile (для service и fullstack)
- .github/workflows/ci.yml
```

---

## Demo Script (5 минут)

### Minute 0-1: Установка и первый запуск

```bash
# Global install
npm install -g dev-optimizer

# First run
dev-optimizer analyze

# Output:
# 🔍 Dev Optimizer v0.1.0
# Analyzing: /path/to/demo-service
#
# 📊 Baseline
# ──────────────────────────────────
# Project: Node.js service
# package.json: 12 dependencies
# Dockerfile: present
# CI config: GitHub Actions
#
# 🔴 Top Findings (5 issues)
# ──────────────────────────────────
# 1. [HIGH] Missing .dockerignore → +400 MB build context
# 2. [HIGH] No cache in CI → +2 min per run
# 3. [MEDIUM] Unused dependency: lodash → 72 KB
# 4. [MEDIUM] Sequential CI jobs → +3 min total
# 5. [LOW] No timeout in CI → Risk of runaway jobs
#
# 💰 Potential Savings
# ──────────────────────────────────
# Size: 472 MB | Time: 5 min per CI run
```

### Minute 1-2: Детальный отчёт

```bash
# Markdown report
dev-optimizer analyze --format markdown > report.md

# Show top findings
dev-optimizer analyze --format table --top 3
```

### Minute 2-3: Безопасные исправления

```bash
# Preview changes
dev-optimizer fix --dry-run

# Output:
# 📝 Changes to apply:
# ──────────────────────────────────
# CREATE .dockerignore (high confidence)
# ─────────────────────────────────--
# node_modules
# .git
# *.log
# coverage
# .env
#
# Apply? (y/N) n
```

### Minute 3-4: Diff для рискованных изменений

```bash
# Show diff for multistage Docker suggestion
dev-optimizer analyze --show-diff

# Output:
# 📋 Suggested: Convert to multistage Docker
# ───────────────────────────────────
# --- Dockerfile
# +++ Dockerfile.multistage
# @@ -1,10 +1,18 @@
# -FROM ubuntu:latest
# +FROM node:18-alpine AS builder
# +
# +WORKDIR /app
# +COPY package*.json ./
# +RUN npm ci --only=production
#
# Note: This change requires testing. Not auto-applied.
```

### Minute 4-5: Before/After

```bash
# Apply safe fixes
dev-optimizer fix --safe

# Re-analyze
dev-optimizer analyze

# Output:
# ✅ Results after fixes:
# ──────────────────────────────────
# Score: 72 → 89 (+17 points)
# Issues: 5 → 2 (-3 issues)
#
# Size saved: 400 MB
# Time saved: 2 min per CI run
```

---

## Ключевые моменты для демонстрации

### 1. Скорость анализа

> "Полный анализ занял 3 секунды на репозитории с 50+ файлами"

### 2. Понятный вывод

> "Отчёт можно отправить менеджеру — clear business impact"

### 3. Безопасность

> "Мы не применяем рискованные изменения автоматически"

### 4. ROI

> "Мы показываем предполагаемую экономию времени и места"

### 5. Простота

> "Одна команда — и весь анализ готов"

---

## Ответы на вопросы

### Q: Почему только GitHub Actions?

> "GitHub — самая популярная платформа для open source. GitLab CI добавим в post-MVP."

### Q: Как вы определяете unused dependencies?

> "Static analysis + import tracing. High confidence только когда импортов точно нет."

### Q: Что если рекомендация неверна?

> "Мы показываем confidence level. Low confidence = manual review."

### Q: Сколько стоит?

> "CLI — бесплатно и open source. PR comments + dashboard — paid SaaS."

---

## После Demo

```bash
# Cleanup
npm uninstall -g dev-optimizer

# Reset demo repo
git checkout .
rm -f .dockerignore report.md
```

---

## Checklist перед Demo

- [ ] Установлен dev-optimizer
- [ ] Склонированы 3 demo репозитория
- [ ] Проверен первый запуск на каждом
- [ ] Подготовлен markdown report
- [ ] Протестирован --dry-run режим
- [ ] Протестирован --safe режим
- [ ] Протестирован --show-diff
- [ ] Подготовлен before/after скриншот