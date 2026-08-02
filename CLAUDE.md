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

An AI-powered PWA for one user: pantry & shopping-list management, AI meal planning with КБЖУ, receipt scanning (photo / text / QR), expense analytics, and weight tracking — one closed household loop.
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
- Receipt pipeline: any source (`PHOTO | TEXT | QR`) → `DRAFT` → user review → one atomic Prisma `$transaction` on confirm. No other path may mutate inventory from a receipt.
- Meal plan stores real calendar dates, never abstract weekdays.
- AI never silently mutates user data — every suggestion is accepted by an explicit user action.
- Money = `Decimal`; КБЖУ = `Int`; units only from the fixed list (`шт | г | кг | мл | л | упак`).

---

## 5. Security invariants (non-negotiable)

- `GEMINI_API_KEY`, `RECEIPT_API_KEY`, `AUTH_SECRET`, `DATABASE_URL` are server-only. Never `NEXT_PUBLIC_`-prefixed, never logged, never printed into chat output, never written into any tracked file.
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

---

## 8. Working Context (rewrite freely at each milestone)

- **Current phase:** Phase 1 — Auth + Inventory core ✅ **COMPLETE** (both accept criteria verified). Next up: Phase 2 — AI gateway + smart inputs (master plan §10) — **blocked on `GEMINI_API_KEY`**.
- **Last completed:** Phase 1 shipped. Auth.js v5 Credentials + argon2 with registration locked to `ALLOWED_EMAIL`; `Product` model (migration `20260802084640_add_product`); `src/server/products.ts` with per-`userId` scoping; thin routes under `/api/products`; full inventory UI per `design-system/MASTER.md` v1.3 (dark «Электрик», adaptive nav, Manrope Cyrillic, ru-RU plurals/numerals). README Reconciliation rows 1–3 → ✅. 12 unit tests green (`npm test`), lint clean, build green.
- **Accept criteria evidence:** (1) *Cross-account isolation* — a second user's product was planted directly in Postgres; the signed-in account's `GET /api/products` did not return it, and `PATCH`/`DELETE` against that exact ID both returned 404 (IDs are unprobeable). Test row removed afterwards. (2) *Instant status toggle* — toggling «Молоко» moved it between panes with an optimistic update, counts went 4/3 → 3/4, and it re-grouped under the correct category. Verified at 1440px (sidebar + two panes) and 375px (bottom bar + segmented tabs); bottom bar measured pinned at `bottom === innerHeight`, height 59px, no horizontal scroll.
- **Live infrastructure:** Neon org `org-rough-band-22135740` (free) → project `meal-assistant` = `sparkling-wildflower-51955601`, PG 18, `aws-us-east-2`, branch `production` = `br-solitary-brook-axo7lr7j`. Vercel project `prj_9KQrtAtQEmWLVIpx1TAMHcIYsCDI`, deploys via GitHub integration, live at **https://meal-assistant-nine.vercel.app**. CLIs `vercel`, `neon`/`neonctl`, and `gh` all installed and authenticated as `hemypo` (`gh` may need its full path in shells started before its install).
- **Next step:** Phase 2 — `src/lib/ai/*`, the single `/api/ai/assist` gateway with a task registry, `CategoryMapping` learned-category cache, rate limiting, bulk add (paste list → AI parse → preview → confirm), and `<AiAssist>` wired into the product form. Accept criteria: pasting 20 lines creates 20 correctly categorised products in one visible AI step, **and the Gemini key does not appear in the browser bundle** (grep the built client output as a smoke test). Read `design-system/MASTER.md` §5 BulkAddModal/AiAssistField first; this is the likely point to add shadcn/ui for a focus-trapped modal (§7).
- **Known issues:** (a) `npm audit` reports 3 high-severity advisories inside Next.js 16.2.12's bundled `postcss`/`sharp`; npm's suggested "fix" downgrades Next to 9.3.3, so it is **not** applied — revisit when a Next patch ships. (b) If the Neon password is rotated, `DATABASE_URL`/`DIRECT_URL` in Vercel need manual updating (§7). (c) Vercel env vars `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET`/`ALLOWED_EMAIL` are set for **Production only** — add them to Preview before relying on branch preview deployments. (d) The sidebar and bottom bar share `aria-label="Основная навигация"`; only one is ever displayed (`display:none` on the other), so assistive tech sees one — revisit if that ever stops being true. (e) `/menu`, `/receipts`, `/finance`, `/weight` are honest "появится в фазе N" placeholders, not stubs pretending to work.
- **Waiting on founder:** **`GEMINI_API_KEY` from Google AI Studio — this is now the hard blocker for Phase 2.** Add it to `.env` locally and to Vercel env vars. Founder performs all credential entry himself; never ask him to paste secrets into chat.
