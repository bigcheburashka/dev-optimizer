# dev-optimizer Roadmap

## Статус: MVP Complete, расширяем анализаторы

---

## Текущая задача: Расширение анализаторов

### Режимы запуска

| Режим | Команда | Что делает | Время |
|-------|---------|------------|-------|
| **Quick** | `--quick` | Быстрый анализ без npm install | ~5 сек |
| **Full** | (default) | Полный анализ с npm outdated/audit | ~30 сек |
| **Deep** | `--deep` | Глубокий анализ с bundlesize | ~2 мин |

### DepsAnalyzer расширения

| Проверка | Режим | Инструмент | Статус |
|----------|-------|------------|--------|
| Unused deps | Quick | knip | ✅ Done |
| Deprecated packages | Quick | package.json parse | ❌ Todo |
| Outdated packages | Full | npm outdated | ❌ Todo |
| Security issues | Full | npm audit | ❌ Todo |
| Large dependencies | Deep | bundlesize estimate | ❌ Todo |

### CiAnalyzer расширения

| Проверка | Режим | Сложность | Статус |
|----------|-------|-----------|--------|
| No cache | Quick | Low | ✅ Done |
| No timeout | Quick | Low | ✅ Done |
| Matrix optimization | Quick | Medium | ❌ Todo |
| Artifact caching | Quick | Medium | ❌ Todo |
| Self-hosted runners | Full | Low | ❌ Todo |

### DockerAnalyzer расширения

| Проверка | Режим | Сложность | Статус |
|----------|-------|-----------|--------|
| .dockerignore | Quick | Low | ✅ Done |
| Multistage | Quick | Low | ✅ Done |
| Base image | Quick | Low | ✅ Done |
| Layer optimization | Full | Medium | ❌ Todo |
| Security scan | Deep | hadolint | ❌ Todo |

---

## Использование зависимостей

| Пакет | Назначение |
|-------|------------|
| **depcheck** | DepsAnalyzer — дублировать knip для надёжности |
| **eslint** | CodeAnalyzer — 4-й домен (future) |
| **ora** | ConsoleReporter — UX спиннер |
| **ts-node** | Разработка — запуск без build |

---

## Следующие шаги

1. Добавить флаги `--quick`, `--deep` в CLI
2. Реализовать deprecated packages check
3. Реализовать npm outdated integration
4. Реализовать npm audit integration
5. Добавить matrix optimization check
6. Добавить artifact caching check