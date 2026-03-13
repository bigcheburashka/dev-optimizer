# TODO: Monetization Path

**Цель:** Монетизация через SaaS (PR comments, dashboard, history)

## Pricing Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | CLI only, local, unlimited repos |
| **Pro** | $19/м | PR comments, history, 10 repos, ROI reporting |
| **Team** | $49/м | Org policies, unlimited repos, Slack/Jira |

---

## Roadmap

### Phase 1: MVP ✅ (Done)
- ✅ CLI analyze + fix
- ✅ 3 домена (Docker, Deps, CI)
- ✅ Console + Markdown reports
- ✅ Demo repos
- ✅ 51 tests passing

### Phase 2: SaaS Foundation (Next)
- [ ] Baseline persistence — базовые метрики
- [ ] npm publish v0.1.0 — публичный релиз
- [ ] GitHub Action — PR comments
- [ ] history.jsonl — лог анализов

### Phase 3: SaaS Features
- [ ] Web dashboard — статистика команды
- [ ] ROI calculator — экономия в $
- [ ] Multi-repo analysis — все репо орги
- [ ] Regression alerts — уведомления

### Phase 4: Business
- [ ] Landing page
- [ ] Stripe integration
- [ ] GitHub OAuth
- [ ] Onboarding

---

## Current Priority

1. **Baseline persistence** — для отслеживания изменений
2. **npm publish** — публичный релиз v0.1.0
3. **GitHub Action** — авто-анализ в PR