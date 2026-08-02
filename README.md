# Smart Meal & Household Assistant

Умный помощник для управления питанием, запасами продуктов и домашней экономикой. A single-user PWA that closes one household loop:

```
Products in stock ─→ AI recipes + КБЖУ ─→ missing items → shopping list
        ▲                                            │
        │                                            ▼
Receipt confirmed ←─ receipt scan (photo/text/QR) ←─ you shop
        │
        └─→ expense recorded → finance analytics    (+ weight tracking)
```

## Documentation map

| File | Purpose |
|---|---|
| `README.md` (this file) | Functionality description + plan-vs-implementation reconciliation |
| `CLAUDE.md` | Binding instructions for AI-assisted development (Claude Code) |
| `docs/meal-assistant-development-plan.md` | Master plan: architecture, DB schema, API, security, phased roadmap |
| `design-system/MASTER.md` *(generated at Phase 1 start)* | Binding UI design system; per-page overrides in `design-system/pages/` |

## Functionality (по разделам)

**1. 🧊 Запасы и Закупки.** Product inventory with two statuses — «В наличии» and «Надо купить» — as one table, so moving an item between the fridge view and the shopping list is a single tap. Add items one by one or paste a multiline list; AI parses names, quantities, and units and assigns categories automatically (with a learned-mapping cache so each name is classified once, ever). Items group by category, alphabetical inside each group.

**2. 🧑‍🍳 Рацион.** Week meal calendar (real dates, rendered Mon–Sun × Завтрак/Обед/Ужин/Перекус) with daily КБЖУ totals. Two recipe modes: «Шеф-повар Gemini» generates a step-by-step recipe from what's currently in stock, honoring free-text wishes, with computed КБЖУ and cooking time, flagging missing ingredients (one tap sends them to the shopping list with estimated prices); «Свой рецепт» is manual entry with AI assistance on КБЖУ estimation. Any recipe can be saved to «Мои рецепты» and re-scheduled later without regeneration.

**3. 🧾 Чеки.** Three input sources: photo of a paper receipt (Gemini Vision), pasted text, and fiscal QR-code lookup (exact item data via a receipt-data API; photo remains the universal fallback). Every parse lands as an editable **draft**; confirming runs one atomic transaction that moves items into «В наличии» and records the expense. Nothing is ever applied silently.

**4. 📊 Финансы.** Expenses recorded automatically from confirmed receipts plus manual entries; charts for monthly spend, category breakdown, and trend.

**5. ⚖️ Вес.** One weight entry per day with a progress chart, shown alongside average daily КБЖУ from the meal calendar.

## Reconciliation — сверка план ↔ реализация

**Rules of this table.** It is the single source of truth for what is actually built. Claude Code updates a row's Status *in the same commit* where the feature's acceptance criteria (master plan §10) pass. A mismatch between this table and the code is a contradiction under CLAUDE.md §0: stop and ask the founder. Statuses: ⬜ Planned · 🟨 In progress · ✅ Done · ⏸ Deferred (v2).

| # | Feature | Plan ref | Phase | Status |
|---|---|---|---|---|
| 1 | Auth (Auth.js, argon2) + registration locked to `ALLOWED_EMAIL` | §3, §7 | 1 | ✅ |
| 2 | Product CRUD, two statuses, quantity/unit/price | §4, §5 | 1 | ✅ |
| 3 | Category grouping + alphabetical sort; status toggle | §4 | 1 | ✅ |
| 4 | AI gateway `/api/ai/assist` + task registry + rate limiting | §6 | 2 | ✅ |
| 5 | `CategoryMapping` learned-category cache | §6.5 | 2 | ✅ |
| 6 | Bulk add: paste list → AI parse → preview → confirm | §5, §6 | 2 | ✅ |
| 7 | `<AiAssist>` component in product form (category, unit, price) | §6.4 | 2 | ✅ |
| 8 | AI recipe generation from stock + wishes, КБЖУ, cook time | §9.2 | 3 | ⬜ |
| 9 | Manual recipe entry with AI КБЖУ assist | §6.4 | 3 | ⬜ |
| 10 | «Мои рецепты» base (`isSaved`) | §4 | 3 | ⬜ |
| 11 | Missing ingredients → shopping list with est. prices | §9.2 | 3 | ⬜ |
| 12 | Meal calendar (real dates) + daily КБЖУ totals | §4 | 3 | ⬜ |
| 13 | Receipt: photo + text → draft → edit → atomic confirm | §9.1 | 4 | ⬜ |
| 14 | Receipt: QR / fiscal-data API + photo fallback | §9.1a | 4b | ⬜ |
| 15 | Manual expenses + analytics charts | §5 | 5 | ⬜ |
| 16 | Weight tracking + progress chart | §5 | 5 | ⬜ |
| 17 | PWA manifest, Sentry, empty/error states, cleanup cron, backup test | §10 P6 | 6 | ⬜ |
| 18 | Family sharing, barcode scan, reminders, goals, native apps, offline | §10 | v2 | ⏸ |

## Tech stack

Next.js 16 (App Router) + TypeScript · PostgreSQL (Neon) + Prisma 7 · Auth.js v5 · Zod · TanStack Query · Tailwind + shadcn/ui · Recharts · `@google/genai` (server-side only) · Vercel + Vercel Blob. Rationale and rejected alternatives: master plan §3; version deviations logged in `CLAUDE.md` §7.

## Setup

Requirements: Node.js LTS (≥ 20), Git, a Neon account, a Google AI Studio (Gemini) API key.

```bash
git clone <your-repo-url> meal-assistant && cd meal-assistant
npm install
cp .env.example .env        # fill in the values yourself — never paste secrets into chat
npx prisma migrate dev
npm run dev                  # http://localhost:3000
```

`.env` variables (all server-only, see CLAUDE.md §5): `DATABASE_URL` (Neon **pooled** string), `DIRECT_URL` (same endpoint **without** `-pooler`, used by Prisma migrations), `AUTH_SECRET`, `ALLOWED_EMAIL`, `GEMINI_API_KEY` (Phase 2+), `RECEIPT_API_KEY` (Phase 4b only).

## Development toolchain — Claude Code + ECC (one-time)

This project is developed with [Claude Code](https://code.claude.com) (CLI ≥ v2.1.0) and the [ECC](https://github.com/affaan-m/ECC) harness system. **Use exactly one ECC install path** — the plugin (recommended) — and never run ECC's full manual installer on top of it (per ECC's own docs, stacking installs is the most common broken setup).

```bash
# Inside Claude Code:
/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc

# Rules can't ship via plugin — copy them project-local (one-time):
git clone https://github.com/affaan-m/ECC.git /tmp/ECC
mkdir -p .claude/rules/ecc
cp -r /tmp/ECC/rules/common .claude/rules/ecc/
cp -r /tmp/ECC/rules/typescript .claude/rules/ecc/
```

Keep enabled MCP servers minimal (`/mcp`) — ECC warns that each server's tool descriptions consume the context window. Claude Code reads `CLAUDE.md` automatically at session start; its conflict rule (§0) and self-maintaining context protocol (§1) govern every session.

Development principles from [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (think-before-coding, simplicity-first, surgical-changes, goal-driven-execution) are **embedded in `CLAUDE.md` §6** — no separate plugin install is needed for this project, and any collision with ECC rules resolves in CLAUDE.md's favor per its §0.

Two more project skills, installed by the founder himself (never by the agent):

```bash
# UI UX Pro Max — design intelligence (requires Python 3.x installed on your machine)
npx ui-ux-pro-max-cli init --ai claude      # installs to .claude/skills/ui-ux-pro-max

# caveman — output token compression (scoped use, see CLAUDE.md §6)
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```

The design system is generated once at the start of Phase 1 and persisted to `design-system/MASTER.md`, which is binding for all UI work. caveman runs in `lite` mode for routine output and commit messages only — founder-facing explanations and confirmations always stay in plain language, and `/caveman-compress` is banned on `CLAUDE.md` and `README.md` (CLAUDE.md §6).

## Deployment

Push to GitHub → Vercel auto-deploys `main`; preview deployments per branch. Database on Neon (automatic backups; restore tested in Phase 6). Environment variables are set in the Vercel dashboard by the founder — never committed.
