# Finding Schema

## Единая модель находок (findings)

Все анализаторы возвращают находки в едином формате:

```typescript
interface Finding {
  id: string;                    // Уникальный идентификатор
  domain: 'ci' | 'deps' | 'docker';  // Домен анализа
  title: string;                  // Краткое название
  description: string;            // Подробное описание
  evidence: Evidence;             // Доказательства
  severity: Severity;             // Уровень критичности
  confidence: Confidence;         // Уверенность в находке
  impact: Impact;                 // Влияние
  suggestedFix: SuggestedFix;     // Предложенное исправление
  autoFixSafe: boolean;           // Можно ли автоматически исправить
}

interface Evidence {
  file?: string;                  // Файл с проблемой
  line?: number;                  // Строка
  snippet?: string;               // Код/конфиг
  metrics?: Record<string, number>; // Численные метрики
}

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Confidence = 'high' | 'medium' | 'low';

interface Impact {
  type: 'time' | 'size' | 'cost' | 'security';
  estimate: string;               // "2-5 min per CI run"
  confidence: Confidence;
}

interface SuggestedFix {
  type: 'create' | 'modify' | 'delete';
  file: string;
  description: string;
  diff?: string;                  // Patch для review
  autoFixable: boolean;
}
```

---

## Примеры находок по доменам

### CI/CD Finding

```json
{
  "id": "ci-001",
  "domain": "ci",
  "title": "Missing cache configuration",
  "description": "No cache configured for npm dependencies",
  "evidence": {
    "file": ".github/workflows/ci.yml",
    "line": 15,
    "snippet": "run: npm install",
    "metrics": {
      "currentInstallTime": 45,
      "cachedInstallTime": 8
    }
  },
  "severity": "high",
  "confidence": "high",
  "impact": {
    "type": "time",
    "estimate": "Save 37 seconds per CI run",
    "confidence": "high"
  },
  "suggestedFix": {
    "type": "modify",
    "file": ".github/workflows/ci.yml",
    "description": "Add actions/cache for npm",
    "diff": "--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ ...\n+      - uses: actions/cache@v4\n+        with:\n+          path: ~/.npm\n+          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}",
    "autoFixable": true
  },
  "autoFixSafe": true
}
```

### Dependency Finding

```json
{
  "id": "deps-042",
  "domain": "deps",
  "title": "Unused dependency: lodash",
  "description": "Package 'lodash' is in dependencies but never imported",
  "evidence": {
    "file": "package.json",
    "snippet": "\"lodash\": \"^4.17.21\"",
    "metrics": {
      "packageSize": 72,
      "totalDeps": 45,
      "unusedCount": 1
    }
  },
  "severity": "medium",
  "confidence": "high",
  "impact": {
    "type": "size",
    "estimate": "Save 72 KB in node_modules",
    "confidence": "high"
  },
  "suggestedFix": {
    "type": "modify",
    "file": "package.json",
    "description": "Remove lodash from dependencies",
    "diff": "--- a/package.json\n+++ b/package.json\n-    \"lodash\": \"^4.17.21\",",
    "autoFixable": true
  },
  "autoFixSafe": true
}
```

### Docker Finding

```json
{
  "id": "docker-017",
  "domain": "docker",
  "title": "Missing .dockerignore",
  "description": "No .dockerignore file found. Build context includes unnecessary files.",
  "evidence": {
    "metrics": {
      "currentContextSize": 450,
      "estimatedContextSize": 50,
      "potentialSavings": 400
    }
  },
  "severity": "high",
  "confidence": "high",
  "impact": {
    "type": "size",
    "estimate": "Reduce build context by 400 MB",
    "confidence": "medium"
  },
  "suggestedFix": {
    "type": "create",
    "file": ".dockerignore",
    "description": "Create .dockerignore with common patterns",
    "diff": "node_modules\n.git\n*.log\ncoverage\n.env",
    "autoFixable": true
  },
  "autoFixSafe": true
}
```

---

## Severity по доменам

### CI/CD

| Finding | Severity | Confidence |
|---------|----------|------------|
| Missing cache | High | High |
| Missing matrix | Medium | Medium |
| Missing timeout | Low | High |
| Sequential jobs | Medium | High |

### Dependencies

| Finding | Severity | Confidence |
|---------|----------|------------|
| Unused dep | Medium | High |
| Duplicate version | Medium | High |
| Prod vs dev misclassified | High | Medium |
| Heavy package | Low | Low |

### Docker

| Finding | Severity | Confidence |
|---------|----------|------------|
| Missing .dockerignore | High | High |
| No multistage | High | Medium |
| Large base image | Medium | Medium |
| Missing cleanup | Medium | High |

---

## Confidence модель

### High
- Детектировано статическим анализом кода
- Отсутствие файла явно проверено
- Метрики точно измерены

### Medium
- Эвристика с высокой точностью
- Требует контекста проекта
- Может иметь исключения

### Low
- Спекулятивное улучшение
- Зависит от архитектуры
- Требует ручной проверки

---

## Auto-fix правила

### Safe для автофикса (autoFixSafe: true)

- Создание .dockerignore
- Создание .gitignore (дополнение)
- Удаление unused deps (confidence: high)
- Добавление cache в CI

### Требует review (autoFixSafe: false)

- Multistage Docker migration
- Base image更换
- Prod/dev deps перемещение
- Удаление deps (confidence: medium/low)

---

## Ранжирование findings

Приоритет отображения:

1. **Critical + High confidence** — top of report
2. **High + High confidence** — quick wins
3. **Medium + High confidence** — manual review
4. **Low confidence** — optional suggestions