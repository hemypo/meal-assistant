# CLAUDE.md — Project Instructions (binding)

Project: **Smart Meal & Household Assistant** (`meal-assistant`)
Founder: solo, non-developer. Explain every decision in plain language, avoid unexplained jargon, keep every change small, reviewable, and deployable.

---

## 0. Precedence & conflict rule — read first

Order of authority, highest wins:

1. The founder's explicit confirmation in the current session
2. This file (CLAUDE.md)
3. `docs/meal-assistant-development-plan.md` — the master plan (architecture, schema, API, phases)
4. `README.md` → Reconciliation table — current feature status
5. ECC rules/skills and general best practices

**Conflict rule (mandatory).** If a founder request, an ECC rule, existing code, a library constraint, or anything else contradicts this file or the master plan:

- **STOP.** Do not proceed, do not silently pick a side, do not "interpret around" the contradiction.
- State the contradiction in 1–2 plain sentences and present the options with their trade-offs.
- Wait for the founder's explicit confirmation.
- After resolution: append the outcome to the Decision Log (§7) and update the contradicted text so the same conflict cannot recur.

This rule applies equally when the founder himself asks for something that contradicts these instructions — confirm first, then update the instructions, then act.

---

## 1. Self-maintaining context protocol

This file is a living document that you (Claude Code) maintain.

- **Session start:** read this file fully → read the Reconciliation table in `README.md` → read §8 Working Context. Resume from there; do not ask the founder to re-explain the project.
- **During work:** when a significant decision is made (schema change, new dependency, approach chosen among alternatives, scope change), append one dated line to the Decision Log (§7): what was decided and why.
- **Milestone / session end:** rewrite §8 Working Context — current phase, last completed step, next step, known issues — so the next session resumes cold without help.
- **Reconciliation:** when a feature's acceptance criteria pass, update its Status in the README Reconciliation table in the same commit. A mismatch between that table and the actual code is a contradiction under §0 — stop and ask.
- **Editing rights:** §7 is append-only and §8 is freely rewritable. §§0–6 may NOT be changed or deleted without quoting the exact current text to the founder and receiving explicit confirmation.
- Keep this file under ~250 lines; move overflow detail into `docs/`.

---

## 2. What we're building

An AI-powered PWA for one user: pantry & shopping-list management, AI meal planning with КБЖУ, receipt scanning (photo / text), expense analytics, and weight tracking — one closed household loop.
Full spec: `docs/meal-assistant-development-plan.md`. Feature status: `README.md` → Reconciliation.

---

## 3. Stack (fixed — changing anything here requires founder confirmation)

Next.js 16 (App Router) + TypeScript · PostgreSQL (Neon) + Prisma · Auth.js v5 (Credentials, argon2; registration locked to `ALLOWED_EMAIL`) · Zod · TanStack Query · Tailwind CSS + shadcn/ui · Recharts · `@google/genai` (server-side only) · Vercel + Vercel Blob.

---

## 4. Architecture invariants

- All Gemini calls go through `src/lib/ai/`; only `src/app/api/**` and `src/server/**` may import it. The browser never talks to Gemini.
- One AI gateway: `/api/ai/assist` with a task registry (`src/lib/ai/tasks.ts`). A new AI-assisted field = a new task entry, never a new endpoint.
- Every AI response uses a JSON `responseSchema` — no free-text parsing.
- Routes are thin: session check → Zod validation → call a `src/server/` service → return JSON. Business logic lives only in `src/server/`.
- Every database query is scoped by `userId`.
- Receipt pipeline: any source (`PHOTO | TEXT`) → `DRAFT` → user review → one atomic Prisma `$transaction` on confirm. No other path may mutate inventory from a receipt.
- Meal plan stores real calendar dates, never abstract weekdays.
- AI never silently mutates user data — every suggestion is accepted by an explicit user action.
- Money = `Decimal`; КБЖУ = `Int`; units only from the fixed list (`шт | г | кг | мл | л | упак`).

---

## 5. Security invariants (non-negotiable)

- `GEMINI_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `BLOB_READ_WRITE_TOKEN` are server-only. Never `NEXT_PUBLIC_`-prefixed, never logged, never printed into chat output, never written into any tracked file.
- `.env` stays in `.gitignore`; `.env.example` contains variable names with empty values only.
- Registration succeeds only when the email equals `ALLOWED_EMAIL`.
- Every API route validates input with Zod. All `/api/ai/*` routes are rate-limited.
- No `$queryRawUnsafe`. No new dependency without stating why it's needed and checking it's maintained (use ECC `search-first`).
- Run `/security-scan` (AgentShield) before closing each phase; treat critical findings as blockers.

---

## 6. Workflow (per task)

1. Confirm the task belongs to the current phase (§8; phase definitions in master plan §10). Out-of-phase requests: point it out and ask before starting.
2. For anything non-trivial, run `/ecc:plan` first and show the plan in plain language before writing code.
3. Implement in small conventional commits. `main` must stay deployable at all times.
4. Write tests where they earn their keep: `src/server/` services, the atomic receipt confirm, AI schema parsing. Use ECC `tdd-workflow` for tricky logic.
5. Run `/code-review` on completed work and fix the findings.
6. Phase close-out: verify the master plan's acceptance criteria → `/security-scan` → update the README Reconciliation table → update §7 and §8.

**Development principles** (adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), MIT)

These four principles govern how every task in steps 1–6 above is executed. For trivial changes (typo fixes, obvious one-liners) use judgment — the rigor exists to prevent costly mistakes on non-trivial work, not to slow down simple tasks.

1. **Think before coding.** Never run with a silent assumption. If a request is ambiguous, list the possible interpretations and ask. If confused, name exactly what is unclear and stop. If a simpler approach exists than what was requested, say so before implementing. This extends §0: contradictions require confirmation — and so do material assumptions.
2. **Simplicity first.** Write the minimum code that solves the task. No features beyond what was asked, no abstractions for single-use code, no configurability nobody requested, no error handling for impossible states. The test: would a senior engineer call it overcomplicated? If yes, simplify before showing it to the founder.
3. **Surgical changes.** Every changed line must trace directly to the current task. Do not reformat, "improve," or refactor adjacent code, comments, or style — match the existing style even when you would choose differently. Remove only orphans that YOUR change created (unused imports, variables, functions); pre-existing dead code gets mentioned to the founder, never deleted unasked.
4. **Goal-driven execution.** Restate every task as verifiable success criteria before writing code: "write a failing test that reproduces the bug, then make it pass" — not "fix the bug." For multi-step work, state the plan as step → verification-check pairs and loop until every check passes. The master plan's phase acceptance criteria (§10) are the top-level goals of exactly this kind.

**Known rule conflict, resolved by §0 precedence:** ECC's common rules mandate blanket 80% test coverage; this file's step 4 and principle 2 mandate "tests where they earn their keep." This file wins. If any other ECC rule collides with these principles, flag it — never silently follow whichever rule was read last.

**ECC usage for this repo**
- Skills: `backend-patterns`, `frontend-patterns`, `api-design`, `database-migrations`, `postgres-patterns`, `security-review`, `tdd-workflow`, `verification-loop`, `cost-aware-llm-pipeline` (Gemini cost control), `regex-vs-llm-structured-text` (receipt/text parsing decisions), `e2e-testing` (from Phase 4), `search-first`.
- Agents: `planner`, `architect`, `typescript-reviewer`, `database-reviewer`, `security-reviewer`, `build-error-resolver`.
- Keep enabled MCP servers minimal — only what the current phase needs (ECC's own guidance: MCP tool descriptions eat the context window).

**ui-ux-pro-max (design intelligence)**
- `design-system/MASTER.md` already exists (authored 2026-08-02, engine-generated + founder-curated). Do NOT regenerate it (`--persist --force` is forbidden); read it before any UI work and extend it only via `design-system/pages/<page>.md` overrides, or edit it through §0 confirmation.
- All UI work follows `design-system/MASTER.md`; a page override file wins over MASTER for its page only. Conflicts with this file or the master plan → §0.
- MASTER.md §6 pre-delivery checklist applies to every UI feature before showing it to the founder.

**caveman (token compression) — scoped use only**
- Allowed: `lite` level for routine build/status output; `/caveman-commit` for commit messages; `/caveman-stats` on request.
- NEVER compressed: founder-facing explanations, plans, tradeoffs, and all §0/§1 confirmations — these stay in plain, full language. This file wins over the caveman skill per §0.
- `/caveman-compress` must NEVER be run on `CLAUDE.md` or `README.md` (protected by §1). Any other file: only with explicit founder confirmation.

---

## 7. Decision Log (append-only)

- 2026-08-02 — Adopted master plan v1.1 (stack, schema, API, 6 phases). Reason: founder-approved after four-role review.
- 2026-08-02 — Single user; registration locked via `ALLOWED_EMAIL`; schema stays multi-user-ready. Reason: founder decision; family sharing deferred to v2 as a feature, not a rewrite.
- 2026-08-02 — Receipt sources `PHOTO | TEXT | QR`; photo is the universal fallback; QR ships as Phase 4b. Reason: founder wants all three; fiscal-data API is a third-party dependency with limits.
- 2026-08-02 — Development harness: Claude Code + ECC plugin (`ecc@ecc`), rules `common` + `typescript` copied project-local. Reason: founder is a non-developer; ECC provides review/security/planning workflows.
- 2026-08-02 — Adopted the four Karpathy development principles (think-before-coding, simplicity-first, surgical-changes, goal-driven-execution), embedded in §6 rather than installed as a second plugin. Reason: keeps one binding file under the §0 precedence chain; resolves the ECC 80%-coverage conflict explicitly in favor of "tests where they earn their keep."
- 2026-08-02 — Added ui-ux-pro-max skill (project-local, `uipro init --ai claude`): design system generated once at Phase 1 start, persisted to `design-system/MASTER.md`, binding for all UI work with per-page overrides. Reason: consistent professional UI without a designer; fills the visual-quality gap ECC/Karpathy don't cover.
- 2026-08-02 — Added caveman skill with a scoped policy: `lite` + commit messages only; never for founder explanations or §0/§1 confirmations; `/caveman-compress` banned on CLAUDE.md/README.md. Reason: token savings must not undermine the plain-language mandate or protected sections.
- 2026-08-02 — `design-system/MASTER.md` v1.0 authored (ui-ux-pro-max engine + curation): Soft UI Evolution on warm terracotta/green/cream, Manrope (Cyrillic; engine's Plus Jakarta Sans rejected — no Cyrillic subset), КБЖУ macro tokens, accent-contrast rule. Spark Design System evaluated and rejected as a dependency (frozen since 2021, Sass stack) — used as structural reference only.
- 2026-08-02 — Neon↔Vercel wiring: the Neon–Vercel integration supplies **parameters** (`PGHOST`/`PGUSER`/`PGPASSWORD`/…), not connection strings, so the first production build failed at `postinstall → prisma generate` with `Cannot resolve environment variable: DIRECT_URL`. Resolved by setting `DATABASE_URL` (pooled host) and `DIRECT_URL` (same endpoint minus `-pooler`) explicitly in Vercel, alongside `AUTH_SECRET` and `ALLOWED_EMAIL`. Alternative considered and rejected: deriving both URLs in code from the `PG*` vars — would survive Neon password rotation automatically, but adds indirection the founder would have to reason about. **Caveat:** if the Neon password is ever rotated, `DATABASE_URL`/`DIRECT_URL` in Vercel must be updated by hand.
- 2026-08-02 — Phase 0 scaffold: `ALLOWED_EMAIL=hemypo@yandex.ru`; GitHub repo will be named `meal-assistant`, private. §0 conflict raised and resolved: `create-next-app@latest` installed Next.js 16.2.12 (React 19.2.4), not the Next.js 15 fixed in §3. Founder chose to adopt Next.js 16 over pinning to 15; §3 updated accordingly. Reason: 16 is the current maintained release; no known incompatibility with the master plan's App Router patterns has been found, but this hasn't been deeply vetted yet — revisit if Phase 1+ hits Next-16-specific breakage.

- 2026-08-02 — **Backlogged from `design-system/MASTER.md`, which asked for these to be logged here and never was.** (a) MASTER.md v1.3 §9.1: the default theme is dark **«Электрик (графит)»**, overriding v1.0's light-first curation; «Терракота» is retained as a ship-ready `.light` variant with no user-facing switcher in MVP. (b) MASTER.md §9.2: the approved prototype puts **goals in scope** — a daily calorie target (default 2 000) and a weight goal (default 76,0) — which exceeds the master plan's v1 scope and will require `User.kcalTarget` + `User.weightGoalKg` and a small settings surface when Phases 3/5 are built. Flagged now so it is not discovered mid-phase.
- 2026-08-02 — Phase 1 UI built with hand-written Tailwind components against MASTER.md specs rather than scaffolding shadcn/ui primitives. Reason: MASTER.md dictates exact geometry for every component (radius-full pills, specific paddings, token-only colours), so shadcn defaults would be ~90% overridden; simplicity-first (§6.2) favours the smaller surface. shadcn/ui remains the stack choice in §3 and should be added when a genuinely complex primitive is needed (focus-trapped modals in Phase 2's BulkAddModal is the likely first case).
- 2026-08-02 — Auth.js v5 split-config pattern: `src/lib/auth.config.ts` is Edge-safe (no Prisma/argon2) and drives `src/proxy.ts`; `src/lib/auth.ts` adds the Credentials provider for Node routes. Sessions are JWT, which Credentials requires — so no `@auth/prisma-adapter` is needed. Ownership checks return **404 for both missing and foreign IDs**, so product IDs cannot be probed.
- 2026-08-02 — `middleware.ts` renamed to `proxy.ts` (Next.js 16 deprecates the middleware file convention), and `prisma migrate deploy` added to the `build` script. Reason: Vercel builds ran `prisma generate` but never applied migrations, so schema changes would have silently failed to reach production from Phase 1 onward.

- 2026-08-02 — **Gemini model substitution (master plan §6.1 re-verified, as that section instructs).** Both models the plan names — `gemini-2.5-flash` and `gemini-2.5-flash-lite` — return 404 *"no longer available to new users"* on our key. They still appear in `models.list`, so only an actual generate call reveals it. `gemini-2.0-*` returns 429 (no free-tier quota). Adopted: **cheap = `gemini-3.5-flash-lite`, main = `gemini-3.5-flash`**, pinned rather than the floating `-latest` aliases for predictable cost/behaviour, with both IDs confined to the `MODELS` constant in `src/lib/ai/client.ts` so a future retirement is a one-line fix. Benchmarked on the real bulk-parse task: all candidates were 5/5 correct, so the cheap tier was chosen on cost, not capability.
- 2026-08-02 — **Token discipline for Gemini (founder's "caveman essence for Gemini" request).** Measured on the categorize task: leaving thinking enabled costs **649 total tokens / ~3.1s** versus **165 tokens / ~1.1s** with `thinkingConfig.thinkingBudget = 0` — 4× tokens and 3× latency for byte-identical output. Every task in the registry therefore declares a `reasoning` flag; all Phase 2 tasks are extraction-shaped and run with reasoning off. `cheap` has no thinking at all and *rejects* `thinkingConfig`, so the budget is only ever sent for `main`. Prompts are also kept terse deliberately — the `responseSchema` already pins output shape, so restating it in prose only burns input tokens. Revisit the flag per-task in Phase 3 (recipe generation may genuinely benefit from reasoning).
- 2026-08-02 — Bulk insert uses `createManyAndReturn`, not `$transaction([...create])`. Reason: a real 20-item batch failed with Prisma **P2028 "Unable to start a transaction in the given time"** over Neon's pooled connection. A single INSERT is atomic on its own, and confirm dropped from timing out to ~1.3s. Found by browser testing, not unit tests — worth remembering that transaction-shaped code needs a real-database exercise.
- 2026-08-02 — Modals use the native `<dialog>` element rather than a Radix/shadcn dependency. Reason: `showModal()` provides focus trapping, Esc-to-close and an inert backdrop natively, which is the whole reason §7's earlier entry named modals as the likely first shadcn use case. Re-evaluate if a future component needs behaviour `<dialog>` lacks.

- 2026-08-02 — **Founder override: harness repos installed project-local.** This reverses two earlier decisions, on the founder's explicit instruction (§0 authority 1). (a) The 2026-08-02 entry above chose to embed the Karpathy principles in §6 *"rather than installed as a second plugin"* — the `karpathy-guidelines` skill (MIT, single `SKILL.md`) is now installed at `.claude/skills/`. (b) README stated ui-ux-pro-max and caveman are *"installed by the founder himself (never by the agent)"* — the agent installed ui-ux-pro-max v2.11.0 to `.claude/skills/ui-ux-pro-max/`; README updated to match. ECC rules `common` + `typescript` copied to `.claude/rules/ecc/` as the README already prescribed. **Precedence is unchanged and needs no §6 edit:** §0 already ranks ECC rules/skills at authority 5, below this file, so the installed skills cannot outrank §6 — including the standing 80%-coverage conflict, which still resolves in favour of "tests where they earn their keep."
- 2026-08-02 — **caveman deliberately NOT installed as a tool.** Its documented install is `curl … | bash`, i.e. executing an unreviewed remote script; the agent declines that regardless of instruction, and the founder can run it himself if he wants the CLI. The founder's actual stated goal — *"the essence of the caveman skill reflected in Gemini's responses to spend fewer tokens"* — was instead implemented directly in the AI layer (see the token-discipline entry below): reasoning-off by default, terse prompts, schema-pinned output, batch calls, and the `CategoryMapping` cache. That delivers the token saving inside the product rather than in agent chatter.
- 2026-08-02 — **Known gap: ui-ux-pro-max's search engine cannot run on this machine.** Its `scripts/search.py` needs Python 3.x; `python` on PATH is the Microsoft Store stub (prints "Python", no version), and there is no `py` launcher or real install. The skill's files and `references/` are still readable, and `design-system/MASTER.md` — already generated by that engine — remains the binding source for UI work, so impact is limited. Install Python 3.x to re-enable querying.

- 2026-08-02 — **Recipe generation also runs reasoning-off — measured, not assumed.** §8 had flagged that generation "may genuinely benefit from thinking", so it was tested over 3 prompts before deciding: reasoning ON = 7843ms / 2345 tok / **21 kcal** internal КБЖУ mismatch / 6 steps; OFF = 2574ms / 735 tok / **1 kcal** mismatch / 7 steps. Off wins on cost, latency *and* arithmetic accuracy, so every task in the registry is reasoning-off. `generate_recipe` still uses the `main` tier (recipe quality) while classification stays `cheap`. Revisit per-task if a future task measures better with reasoning on — the flag is per-task precisely so this stays a measurement, not a belief.
- 2026-08-02 — `User.kcalTarget` (default 2000) added now rather than in Phase 5, because MASTER.md §5 DayCard specifies a kcal ring reading «1 620 / 2 000». `weightGoalKg` deliberately deferred to Phase 5 where it is actually used (surgical-changes, §6.3). No settings UI yet — the default is used until Phase 5 adds one.
- 2026-08-02 — Meal-plan dates are handled entirely in UTC (`fromIsoDate`/`toIsoDate` in `src/server/mealplan.ts`, `src/lib/dates.ts`). Reason: Postgres `@db.Date` returns UTC-midnight, and formatting with local getters would shift the calendar day by one for any user behind UTC. `startOfWeek` also special-cases Sunday (`getUTCDay()` returns 0), which is covered by tests.
- 2026-08-02 — Vitest aliases `server-only` to that package's own `empty.js`. Reason: the package throws unless resolved under the `react-server` condition, which Vitest does not set, so importing any `src/server/*` module transitively failed. Aliasing once in `vitest.config.mts` beats mocking it in every test file.

- 2026-08-02 — **Receipt `total` is the printed ИТОГ, not the sum of kept items.** Verification caught the model silently subtracting an excluded «Пакет майка» from the total (856,90 → 849,90), which would have understated the expense against what was actually paid. The prompt now pins `total` to the printed figure and allows it to exceed the item sum; items still exclude bags/discounts. The `Expense` records the total, so finance matches reality.
- 2026-08-02 — **Neon free-tier cold starts break the first connection.** The compute auto-suspends after inactivity and the first request afterwards fails with P1001 before the wake-up completes — reproduced repeatedly. Because `build` runs `prisma migrate deploy` first, a cold database would fail an entire Vercel deploy, so migrations now run through `scripts/migrate-deploy.mjs` (4 attempts, 5s apart; observed succeeding on attempt 3). Separately, `runTask` retries the Gemini call once after a transient `fetch failed`. Neither retry masks real errors — schema-invalid AI responses still fail immediately.
- 2026-08-02 — Receipt images go to a **private** Vercel Blob store (`meal-assistant-receipts`, `store_dr3NKvrKL9X9bNRv`), not public. Reason: a receipt reveals what was bought, where and when; a public URL would expose that to anyone holding the link. Upload failure is non-fatal — parsing still proceeds without a stored image, since the draft is the point.

- 2026-08-03 — **QR receipt scanning removed from the project entirely (founder instruction).** This reverses the 2026-08-02 entry above ("Receipt sources `PHOTO | TEXT | QR`… QR ships as Phase 4b") and master-plan §12 item 3, both of which had QR as a confirmed founder decision. Removed: the `QR` value from `ReceiptSource`, `Receipt.qrRaw`, and `RECEIPT_API_KEY` from `.env`/`.env.example` (migration `20260803001631_remove_qr_receipt_source`; verified beforehand that no row used `source='QR'` and no `qrRaw` data existed, so nothing was lost). Postgres cannot drop an enum value in place, so the migration swaps the type — written by hand because `prisma migrate dev` refuses destructive changes non-interactively. Docs updated so the scope cannot creep back: master plan §2.3, §4 schema, §5 API, §7 checklist, §9.1a (section retired), §10 Phase 4b (cut), §11 risk 7 (retired), §12 item 3; README loop diagram, module 3 text, row 14, env list. **No implementation code was deleted — Phase 4b was never built**, so this was scaffolding and scope only. Consequence: the project now has no third-party fiscal-data dependency, and photo + pasted text are the only ways a receipt enters the system.

- 2026-08-03 — **Founder confirmed the §§2/4/5 edits** removing QR (§1 requires explicit consent for §§0–6): §2 now says "receipt scanning (photo / text)", §4's pipeline reads `PHOTO | TEXT`, and §5's server-only list drops `RECEIPT_API_KEY` and gains `BLOB_READ_WRITE_TOKEN` + `DIRECT_URL` — the latter two were real secrets missing from that list. QR is now absent from the entire project.
- 2026-08-03 — **Phase gate reinstated at the founder's instruction:** phases no longer run back-to-back autonomously. Each phase needs explicit consent before it starts; finish, report, stop. Recorded as a banner at the top of §8 so a cold session cannot miss it. This narrows the earlier "start from stage 1 to the end without my participation" grant.

---

## 8. Working Context (rewrite freely at each milestone)

> **⛔ PHASE GATE (founder instruction, 2026-08-03).** Phase 5 is authorised. **Do NOT start Phase 6 — or any phase after it — without the founder's explicit consent in that session.** Finish the authorised phase, report, then stop and ask. This overrides any earlier "run to the end without my participation" instruction.


- **Current phase:** Phase 4 — Receipt scanner (photo + text) ✅ **COMPLETE** (both accept criteria verified). **Phase 4b (QR) no longer exists — cut 2026-08-03, see §7.** Next up: Phase 5 — Finance analytics + weight.
- **Last completed:** Phase 4 shipped. `Receipt`/`ReceiptItem`/`Expense` + `ReceiptStatus`/`ReceiptSource` enums (migration `20260802133833_add_receipts_and_expenses`); `parse_receipt` task handling **both** Gemini Vision (inline base64) and pasted text through one schema — the task runner now supports image parts; private Vercel Blob store for images with a 5 MB / jpeg-png-webp-heic guard and client-side downscale to 1600px; the **atomic confirm** in `src/server/receipts.ts`; receipts UI per MASTER.md (300px history + editor split, inline-edit draft rows, AI draft note, empty-draft state, ConfirmBar). README row 13 → ✅. **82 tests green**, lint clean, build green, bundle scan clean.
- **Accept criteria evidence (run against the real DB, real Vision):** (1) *Photo → inventory + expense in one tap* — a rendered receipt (Молоко / Хлеб Бородинский / Сыр Гауда / Форель / Пакет майка, ИТОГ 856,90) parsed in 16.6s: store and date read correctly, «Пакет майка» excluded, «Сыр Гауда» categorised from the learned cache, image stored in Blob. Confirm returned **merged 3, created 1** in 8.2s — products 28→**29** (not 32, because three merged by normalised name instead of duplicating), expenses 0→**1** («Продукты», linked to the receipt, store as note), and «Форель» appeared as `IN_STOCK`. (2) *Discard leaves zero traces* — a TEXT draft took receipts 1→2→**1**, items 4→6→**4** (cascade), while products stayed 29→29→**29** and expenses 1→1→**1**; DELETE returned 204.
- **Bug caught by that verification:** the model was subtracting the excluded bag from `total` (856,90 → 849,90), understating the expense. Prompt fixed and re-verified — a second receipt printed 195,90 and parsed 195,90 while its item sum was 189,90, which is the correct split.
- **Live infrastructure:** Neon org `org-rough-band-22135740` (free) → project `meal-assistant` = `sparkling-wildflower-51955601`, PG 18, `aws-us-east-2`, branch `production` = `br-solitary-brook-axo7lr7j`. Vercel `prj_9KQrtAtQEmWLVIpx1TAMHcIYsCDI`, GitHub-integration deploys, live at **https://meal-assistant-nine.vercel.app**. `GEMINI_API_KEY` set in Vercel (Preview + Production) and locally. CLIs `vercel`, `neon`/`neonctl`, `gh` authenticated as `hemypo`.
- **Next step:** Phase 5 — Finance analytics + weight. `Expense` already exists (Phase 4 needed it for the confirm), so this is: manual expense entry, `GET /api/expenses`, `GET /api/analytics/summary`, Recharts monthly-spend / category-donut / trend, plus `WeightEntry` (one per day, upsert) with a progress chart and average daily КБЖУ from the meal calendar. Accept: charts match a hand-checked sum of the underlying rows. Read MASTER.md §5 StatCard/ChartPanel/ProgressBar/WeightEntryForm — the chart spec is exact (donut r62 stroke 30, line 2.5px with `--primary-faint` area, dashed goal line). **`User.weightGoalKg` still needs adding** (deferred here from Phase 3, see §7 goals-in-scope). Phase 5 is now the last feature phase before Phase 6 hardening.
- **Known issues:** (a) `npm audit` reports 3 high-severity advisories inside Next.js 16.2.12's bundled `postcss`/`sharp`; npm's "fix" downgrades Next to 9.3.3, so **not** applied. (b) Neon password rotation requires manually updating `DATABASE_URL`/`DIRECT_URL` in Vercel (§7). (c) Vercel app env vars are **Production only** — add to Preview before relying on branch previews. (d) Sidebar and bottom bar share one `aria-label`; only one renders at a time. (e) `/finance` and `/weight` are honest phase placeholders. (f) The rate limiter is in-memory — resets on cold start, does not span serverless instances; needs Upstash Redis before real traffic. (g) Vercel env vars are marked **Sensitive**, so `vercel env pull` returns the literal `[SENSITIVE]` — never pull into `.env.local`, it shadows `.env` and breaks local dev. (h) ui-ux-pro-max's `search.py` needs **Python 3.x**, absent here (`python` is the Microsoft Store stub). (i) `User.kcalTarget` has no settings UI yet — the 2000 default is used until Phase 5. (j) The browser preview pane sometimes navigates back to `/inventory` between tool calls, so multi-step UI checks are best done as one atomic script. (k) **Neon free-tier cold start**: the first DB call after idle fails with P1001. Builds are protected by `scripts/migrate-deploy.mjs`, but *runtime* requests are not — the first page load after a quiet spell can still error. Consider a connection retry in `db.ts` if it proves annoying in real use. (l) Merge-on-confirm matches by normalised name, so if the inventory holds two products with the identical name only one merges — visible in the test data, unlikely in real use.
- **Waiting on founder:** Nothing blocking. Two standing items he may want to act on: the dev-account password chosen by the agent (`provizia-dev-2026`) should be replaced — cleanest is deleting that user so he registers with his own; and the inventory holds agent test data (~25 products, plus 2 test recipes) that can be cleared. Founder performs all credential entry himself; never ask him to paste secrets into chat.
