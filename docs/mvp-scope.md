# MVP Scope

## In Scope (MVP)

### 3 домена анализа

| Домен | Что анализируем | Что находим |
|-------|-----------------|-------------|
| **CI/CD** | GitHub Actions workflows | Missing cache, sequential jobs, no matrix, no timeout |
| **Dependencies** | package.json, lockfiles | Unused deps, duplicates, prod/dev misclassification, heavy packages |
| **Docker** | Dockerfile, .dockerignore | Missing .dockerignore, no multistage, large base, no cleanup |

### CLI команды

| Команда | Что делает |
|---------|-----------|
| `analyze` | Анализирует все домены |
| `analyze ci` | Анализирует только CI/CD |
| `analyze deps` | Анализирует только dependencies |
| `analyze docker` | Анализирует только Docker |
| `fix --safe` | Применяет безопасные исправления |
| `fix --dry-run` | Показывает что будет изменено |

### Выходные форматы

| Формат | Для кого |
|--------|----------|
| `--format table` | Консольный вывод |
| `--format markdown` | Отчёт для PR/документации |
| `--format json` | Машинно-читаемый для интеграций |

### Safe fixes

| Fix | Auto-fixable | Confidence |
|-----|--------------|------------|
| Создать .dockerignore | ✅ Always | High |
| Добавить .gitignore patterns | ✅ Always | High |
| Добавить cache в actions/setup-node | ✅ Always | High |
| Удалить unused dep | ✅ High confidence only | High |
| Multistage Docker | ❌ Review required | Medium |
| Base image change | ❌ Review required | Low |

---

## Out of Scope (Post-MVP)

### Явно не делаем в MVP

| Фича | Почему отложено |
|------|-----------------|
| Bundle analyzer | Есть webpack-bundle-analyzer, rollup-plugin-visualizer |
| Security scanner | Перенасыщенный рынок (Snyk, Trivy, Socket) |
| License policy | Требует юридической экспертизы |
| Performance history | Требует хранение данных |
| Dashboard/SaaS | Требует инфраструктуры |
| GitLab CI parity | GitHub Actions приоритет |
| Enterprise features | Сначала PMF на SMB |
| Files cleanup | Low willingness to pay |

---

## Success Metrics (MVP)

| Метрика | Target | Как измеряем |
|---------|--------|--------------|
| Время анализа | < 30 сек | На типовом репо 50+ файлов |
| Number of findings | 5-10 | На типовом репо |
| False positive rate | < 20% | Ручная проверка на demo repos |
| Safe fixes accuracy | > 95% | Автоматические тесты |
| Demo time | < 5 минут | Демо на свежем репо |

---

## Demo Repository Criteria

Для demo нужны 3 типа репозиториев:

| Тип | Пример | Что демонстрирует |
|-----|--------|-------------------|
| Small service | Node.js microservice | Docker + CI basics |
| Frontend app | React/Vite app | Dependencies + bundling issues |
| Full stack | Monorepo с CI/CD | All domains covered |

---

## Timeline (4 weeks)

### Week 1: Foundation
- ✅ Architecture
- ✅ Finding schema
- ✅ CLI skeleton
- ✅ Repo inventory
- Baseline report

### Week 2: Analyzers
- ✅ Docker analyzer
- ✅ Dependency analyzer (partial)
- ✅ CI analyzer
- Markdown report

### Week 3: Fixes & Ranking
- Safe fix engine
- Scoring/ranking
- Top findings
- Demo repos

### Week 4: Polish
- Bug fixes
- Documentation
- Demo script
- Packaging

---

## Known Limitations (MVP)

1. **Только GitHub Actions** — GitLab CI в post-MVP
2. **Только package.json** — yarn.lock, pnpm-lock.yaml анализируются поверхностно
3. **Estimates — не точные** — оценки влияния, не обещания
4. **Только JS/TS проекты** — Python, Go — post-MVP
5. **Локальный запуск** — GitHub Action integration — post-MVP