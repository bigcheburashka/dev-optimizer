# dev-optimizer Roadmap

## Статус: MVP Complete + Extended Analyzers

---

## Выполнено (сессия 2026-03-13)

### DepsAnalyzer расширения ✅

| Проверка | Режим | Инструмент | Статус |
|----------|-------|------------|--------|
| Unused deps | Quick | knip | ✅ Done |
| Deprecated packages | Quick | package.json parse | ✅ Done |
| Outdated packages | Full | npm outdated | ✅ Done |
| Security issues | Full | npm audit | ✅ Done |

### CiAnalyzer расширения ✅

| Проверка | Режим | Статус |
|----------|-------|--------|
| No cache | Quick | ✅ Done |
| No timeout | Quick | ✅ Done |
| Matrix optimization | Quick | ✅ Done |
| Artifact caching | Quick | ✅ Done |
| Duplicate jobs | Quick | ✅ Done |
| Self-hosted runners | Full | ✅ Done |

### DockerAnalyzer расширения ✅

| Проверка | Режим | Статус |
|----------|-------|--------|
| .dockerignore | Quick | ✅ Done |
| Multistage | Quick | ✅ Done |
| Base image | Quick | ✅ Done |
| Layer optimization | Quick | ✅ Done |
| COPY vs ADD | Quick | ✅ Done |
| WORKDIR check | Quick | ✅ Done |
| Hadolint | Full | ✅ Done |

---

## Текущий статус

| Компонент | Тесты | Статус |
|-----------|-------|--------|
| DockerAnalyzer | 11 | ✅ Extended |
| CiAnalyzer | 8 | ✅ Extended |
| DepsAnalyzer | 11 | ✅ Extended |
| RepoScanner | 13 | ✅ Done |
| Fix command | 12 | ✅ Done |
| BaselineManager | 11 | ✅ Done |
| GitHub Action | - | ✅ Done |
| **Total** | **59** | ✅ |

---

## Режимы анализа

```bash
dev-optimizer analyze --quick   # ~5 сек, только статический анализ
dev-optimizer analyze           # ~30 сек, +npm outdated/audit, +hadolint
dev-optimizer analyze --deep   # ~2 мин, +size estimates (future)
```

---

## Remaining (Deprioritized)

| Задача | Приоритет | Статус |
|--------|-----------|--------|
| ora UX spinner | Low | ❌ |
| depcheck integration | Low | ❌ |
| Image size analysis | Low | ❌ |
| Bundle size estimates | Low | ❌ |