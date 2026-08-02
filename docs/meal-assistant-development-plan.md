# Smart Meal & Household Assistant — Architecture & Development Plan

**Version 1.1 — produced by a four-role review process (Architect / Engineer / Reviewer / Optimizer); updated after founder Q&A: platform = PWA, single user, receipts = photo + text + FNS QR.**
This document is written for a founder with no prior development experience. Each phase in the roadmap is scoped so it can be handed to an AI coding assistant (e.g. Claude Code) as a self-contained work order.

---

## 1. Product summary & the ecosystem loop

One app, five modules, one loop:

```
Products in stock ─→ AI generates recipes + КБЖУ ─→ missing ingredients → shopping list
        ▲                                                        │
        │                                                        ▼
Receipt confirmed ←─ AI parses receipt photo ←─ you shop with the list
        │
        └─→ expense recorded → finance analytics     (+ weight tracking alongside)
```

The loop only works if every module writes to the same core tables. That is the central architectural constraint: **one database, one data model, shared by all five modules.**

---

## 2. Working assumptions (to confirm)

Confirmed with the founder (2026-08-02):

1. **Platform:** responsive web app installable as a PWA (home-screen icon on the phone). Native apps deferred. ✅ confirmed
2. **Users:** single user. The schema stays multi-user-ready (`userId` on every table), but **registration is locked**: signup succeeds only for the email set in the `ALLOWED_EMAIL` env variable. Auth remains mandatory — the app is on the public internet with personal data and an AI key behind it. ✅ confirmed
3. **Receipt input:** all three sources — photo of a paper receipt (Gemini Vision), pasted text, and **FNS QR-code lookup** (exact fiscal data, highest quality; see §9.1a). Photo remains the universal fallback. ✅ confirmed
4. **Language:** UI in Russian, code and identifiers in English.
5. **Budget:** free/near-free infrastructure (Vercel + Neon free tiers, Gemini pay-as-you-go, expected < $5/month at personal usage).

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Frontend + backend in one project; one language; huge learning resources; AI assistants know it extremely well |
| Database | **PostgreSQL** (hosted on Neon or Supabase) | Relational data (products ↔ recipes ↔ receipts ↔ expenses) fits SQL; free tier; real backups |
| ORM | **Prisma** | Type-safe queries, schema-as-code, painless migrations, prevents SQL injection by construction |
| Auth | **Auth.js (NextAuth v5)** — Credentials (email+password, argon2) + optional Google OAuth | Standard, well documented, session cookies handled for you |
| AI | **@google/genai** server-side; `gemini-2.5-flash` for generation, `gemini-2.5-flash-lite` for cheap classification tasks | Structured JSON output support, vision for receipts, low cost |
| Validation | **Zod** on every API route | One schema validates input and types it |
| Data fetching (client) | **TanStack Query (React Query)** | Caching, optimistic updates, loading/error states solved once |
| Charts | **Recharts** | Simple, good-looking finance/weight charts |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, mobile-first |
| File storage | **Vercel Blob** (receipt images) | Zero-config on Vercel |
| Deploy | **Vercel** (app) + **Neon** (DB) + GitHub | Push-to-deploy, preview environments per branch, HTTPS by default |
| Monitoring | **Sentry** (errors) — Phase 6 | Know when something breaks |

**Rejected alternatives (and why):** separate FastAPI/Express backend (doubles ops burden for a solo beginner); Firebase/Firestore (the data is deeply relational — cross-entity analytics gets painful in a document DB); native mobile apps (PWA covers the phone use case for MVP).

---

## 4. Data model (Prisma schema)

This is the heart of the app. Every module reads/writes these tables.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String            @id @default(cuid())
  email            String            @unique
  passwordHash     String?
  name             String?
  createdAt        DateTime          @default(now())
  products         Product[]
  recipes          Recipe[]
  mealEntries      MealPlanEntry[]
  receipts         Receipt[]
  expenses         Expense[]
  weightEntries    WeightEntry[]
  categoryMappings CategoryMapping[]
}

// ------- Module 1: Inventory / Shopping list -------

enum ProductStatus {
  IN_STOCK   // «В наличии»
  TO_BUY     // «Надо купить»
}

model Product {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  category  String        @default("Другое")   // set by AI, editable by user
  status    ProductStatus @default(TO_BUY)
  quantity  Decimal       @default(1)
  unit      String        @default("шт")       // шт | г | кг | мл | л | упак
  estPrice  Decimal?                            // ориентировочная цена
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([userId, status])
  @@index([userId, category])
}

// Learned name→category cache: each product name is classified by AI once, ever.
model CategoryMapping {
  id             String  @id @default(cuid())
  userId         String?                        // null = global/shared mapping
  user           User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  normalizedName String                         // lowercased, trimmed
  category       String

  @@unique([userId, normalizedName])
}

// ------- Module 2: Recipes & meal calendar -------

enum RecipeSource {
  AI
  MANUAL
}

model Recipe {
  id          String             @id @default(cuid())
  userId      String
  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  steps       Json               // string[] — пошаговая инструкция
  calories    Int?
  proteinG    Int?
  fatG        Int?
  carbsG      Int?
  cookTimeMin Int?
  source      RecipeSource
  isSaved     Boolean            @default(false)  // «Мои рецепты» = isSaved: true
  createdAt   DateTime           @default(now())
  ingredients RecipeIngredient[]
  mealEntries MealPlanEntry[]

  @@index([userId, isSaved])
}

model RecipeIngredient {
  id           String  @id @default(cuid())
  recipeId     String
  recipe       Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  name         String
  amount       Decimal
  unit         String  @default("г")
  wasInStock   Boolean @default(true)   // available at generation time?
  estPrice     Decimal?                  // filled for missing ingredients
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
  SNACK
}

model MealPlanEntry {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date     DateTime @db.Date          // real dates, rendered as a week view
  mealType MealType
  recipeId String
  recipe   Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([userId, date, mealType, recipeId])
  @@index([userId, date])
}

// ------- Module 3: Receipts -------

enum ReceiptStatus {
  DRAFT       // parsed, awaiting user review
  CONFIRMED   // applied to inventory + expenses (atomic)
}

enum ReceiptSource {
  PHOTO       // Gemini Vision OCR
  TEXT        // pasted text → Gemini parse
  QR          // fiscal QR → receipt-data API (exact items, no OCR)
}

model Receipt {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      ReceiptStatus @default(DRAFT)
  source      ReceiptSource @default(PHOTO)
  store       String?
  purchasedAt DateTime?
  total       Decimal?
  imageUrl    String?
  rawText     String?
  qrRaw       String?       // raw QR string: t=...&s=...&fn=...&i=...&fp=...&n=...
  createdAt   DateTime      @default(now())
  items       ReceiptItem[]
  expense     Expense?
}

model ReceiptItem {
  id        String  @id @default(cuid())
  receiptId String
  receipt   Receipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  name      String
  category  String?
  quantity  Decimal @default(1)
  unit      String  @default("шт")
  price     Decimal
}

// ------- Module 4: Finance -------

model Expense {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  category  String   // «Продукты», «Бытовое», «Другое», ...
  amount    Decimal
  note      String?
  receiptId String?  @unique
  receipt   Receipt? @relation(fields: [receiptId], references: [id])

  @@index([userId, date])
}

// ------- Module 5: Weight tracking -------

model WeightEntry {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date     DateTime @db.Date
  weightKg Decimal

  @@unique([userId, date])
}
```

**Key modeling decisions:**
- `Product.status` implements both «Холодильник» and «Закупки» as one table — moving an item between lists is a one-field PATCH, which is what makes the ecosystem loop cheap.
- `CategoryMapping` is the cost-control table: bulk-adding 30 products triggers *one* AI call for unknown names only.
- `MealPlanEntry.date` is a real date (not "Monday") so КБЖУ history and finance analytics stay possible.
- `Receipt.status = DRAFT → CONFIRMED` is the safety valve against OCR errors.
- Every table carries `userId` with `onDelete: Cascade` — ownership checks and clean account deletion come for free.

---

## 5. API design

All routes are Next.js Route Handlers under `src/app/api/`. Every route: (1) requires a session, (2) validates the body with Zod, (3) scopes every query by `userId`.

```
AUTH (Auth.js)
  /api/auth/*                          register / login / session / logout

PRODUCTS
  GET    /api/products?status=IN_STOCK|TO_BUY&category=...
  POST   /api/products                 create one product
  POST   /api/products/bulk            raw multiline text → AI parse+categorize → create many
  PATCH  /api/products/:id             edit fields / flip status (куплено ↔ надо купить)
  DELETE /api/products/:id

AI GATEWAY (all Gemini traffic funnels through here)
  POST   /api/ai/assist                { task, payload } → suggestion
         tasks: categorize | parse_bulk_list | estimate_price |
                suggest_unit | normalize_name | suggest_field
  POST   /api/ai/recipe                { wishes?: string } → recipe JSON
                                       (server loads IN_STOCK products itself)
  POST   /api/ai/receipt               { imageUrl | rawText } → creates DRAFT receipt

RECIPES & MEAL PLAN
  GET    /api/recipes?saved=true       «Мои рецепты»
  POST   /api/recipes                  manual recipe entry
  PATCH  /api/recipes/:id              edit; { isSaved: true } = «сохранить в базу»
  DELETE /api/recipes/:id
  POST   /api/recipes/:id/missing-to-shopping   missing ingredients → TO_BUY products
  GET    /api/meal-plan?from=YYYY-MM-DD&to=YYYY-MM-DD
  POST   /api/meal-plan                { date, mealType, recipeId }
  DELETE /api/meal-plan/:id

RECEIPTS
  POST   /api/receipts                 { source: PHOTO|TEXT|QR, ... } → DRAFT
                                       PHOTO/TEXT → Gemini parse; QR → fiscal-data API
  PATCH  /api/receipts/:id             edit draft items before confirming
  POST   /api/receipts/:id/confirm     ATOMIC TRANSACTION:
                                         items → Product(IN_STOCK) (merge by name)
                                         + Expense created
                                         + Receipt → CONFIRMED
  DELETE /api/receipts/:id             discard a draft

FINANCE & HEALTH
  GET    /api/expenses?from&to
  POST   /api/expenses                 manual expense
  GET    /api/analytics/summary?from&to   totals, by-category breakdown, trend
  GET    /api/weights?from&to
  POST   /api/weights                  { date, weightKg } (upsert per day)
```

**Why REST route handlers and not tRPC/GraphQL:** fewer concepts to learn, every endpoint is a plain file you can read, and AI assistants generate/debug them reliably.

---

## 6. AI integration layer (the «Gemini everywhere» design)

### 6.1 Server-side client — the only place the key exists

```ts
// src/lib/ai/client.ts
import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const MODELS = {
  cheap: "gemini-2.5-flash-lite",   // classification, normalization
  main:  "gemini-2.5-flash",        // recipes, receipt vision
} as const;
```

Rules (non-negotiable):
- The variable is `GEMINI_API_KEY`. It must **never** be prefixed `NEXT_PUBLIC_` — that prefix ships variables to the browser.
- No component ever imports the AI client. Only files under `src/server/` and `src/app/api/` may touch it.
- Model names change over time — verify current names in Google's docs when starting Phase 2.

### 6.2 Structured output — never parse free text

Every AI task declares a JSON `responseSchema`, so Gemini returns machine-readable JSON, not prose:

```ts
// Example: recipe generation
const result = await ai.models.generateContent({
  model: MODELS.main,
  contents: buildRecipePrompt(inStockProducts, wishes),
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        title:       { type: "string" },
        steps:       { type: "array", items: { type: "string" } },
        calories:    { type: "integer" },
        proteinG:    { type: "integer" },
        fatG:        { type: "integer" },
        carbsG:      { type: "integer" },
        cookTimeMin: { type: "integer" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:       { type: "string" },
              amount:     { type: "number" },
              unit:       { type: "string" },
              wasInStock: { type: "boolean" },
              estPrice:   { type: "number" },
            },
            required: ["name", "amount", "unit", "wasInStock"],
          },
        },
      },
      required: ["title", "steps", "ingredients"],
    },
  },
});
```

The same pattern covers `parse_bulk_list` (text → array of {name, category, quantity, unit}), `categorize` (names → categories from a fixed list), and receipt parsing (image → {store, date, total, items[]}).

### 6.3 The task registry (`/api/ai/assist`)

One endpoint, a switch over task types. Each task defines: model tier, prompt builder, response schema, cache policy, and rate-limit weight. Adding "AI help" to a new input field = adding one entry to the registry, zero new endpoints.

### 6.4 The `<AiAssist>` UI pattern («ИИ во всех полях ввода»)

One reusable component, three trigger modes:

| Mode | Used for | Behavior |
|---|---|---|
| **Passive (debounced)** | category auto-fill, unit suggestion | fires 500ms after typing stops, only for cheap tasks, shows a suggestion chip the user taps to accept |
| **Button (✨)** | price estimate, name normalization, "improve my step description" | explicit click, small spinner in the field |
| **Modal** | recipe generation, receipt parsing, bulk add | full-screen flow with preview + edit before saving |

AI never silently writes into your data — every suggestion is accepted by a tap. (Reviewer requirement: predictability builds trust; auto-mutation destroys it.)

### 6.5 Cost & abuse control

- `CategoryMapping` cache: a product name is classified once per lifetime, then served from Postgres.
- Batch prompts: bulk add of N products = 1 AI call, not N.
- Model tiering: flash-lite for classification (fractions of a cent), flash for generation/vision.
- Rate limiting on `/api/ai/*`: e.g. 20 requests/min/user (simple in-memory counter for MVP; Upstash Redis when you have real users).
- Log token usage per call into a small `AiUsage` table in Phase 6 if costs ever surprise you.
- Expected personal-use cost: **well under $5/month.**

---

## 7. Security checklist

- [ ] `.env` in `.gitignore` from the first commit; ship a committed `.env.example` with empty values (`DATABASE_URL=`, `GEMINI_API_KEY=`, `AUTH_SECRET=`, `ALLOWED_EMAIL=`, `RECEIPT_API_KEY=`).
- [ ] Registration locked to single-user mode: signup succeeds only when the email equals `ALLOWED_EMAIL`.
- [ ] Gemini key server-only (see §6.1). Search the built client bundle for the key once as a smoke test.
- [ ] Passwords hashed with argon2 (never stored, never logged).
- [ ] Every API route: session required → Zod validation → queries scoped `where: { userId: session.user.id }`. A user must not be able to read or mutate another user's rows even by guessing IDs.
- [ ] Receipt image uploads: max 5 MB, content-type whitelist (jpeg/png/webp/heic), stored in Vercel Blob (not the repo, not the DB).
- [ ] Rate limiting on all `/api/ai/*` routes.
- [ ] Prisma everywhere = parameterized queries = no SQL injection. Never use `$queryRawUnsafe`.
- [ ] HTTPS enforced (automatic on Vercel).
- [ ] Send Gemini only what the task needs (product names, receipt image) — never email/password/session data.
- [ ] Neon automatic backups on; test a restore once before public beta.

---

## 8. Project file layout

```
meal-assistant/
├─ prisma/
│  └─ schema.prisma
├─ public/                    # icons, PWA manifest
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  └─ register/page.tsx
│  │  ├─ (app)/               # authenticated shell with bottom-nav (mobile-first)
│  │  │  ├─ inventory/page.tsx      # 🧊 Запасы + Закупки (tabs)
│  │  │  ├─ menu/page.tsx           # 🧑‍🍳 Рацион: week calendar + recipe flows
│  │  │  ├─ receipts/page.tsx       # 🧾 Чеки: upload + drafts
│  │  │  ├─ finance/page.tsx        # 📊 Аналитика
│  │  │  └─ weight/page.tsx         # ⚖️ Вес
│  │  ├─ api/
│  │  │  ├─ auth/[...nextauth]/route.ts
│  │  │  ├─ products/ ... /route.ts
│  │  │  ├─ ai/{assist,recipe,receipt}/route.ts
│  │  │  ├─ recipes/ ... , meal-plan/ ...
│  │  │  ├─ receipts/ ... /confirm/route.ts
│  │  │  └─ expenses/, analytics/, weights/
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ui/                  # shadcn primitives
│  │  ├─ AiAssist.tsx         # the reusable ✨ pattern (§6.4)
│  │  ├─ inventory/ menu/ receipts/ finance/ weight/
│  ├─ lib/
│  │  ├─ db.ts                # Prisma singleton
│  │  ├─ auth.ts              # Auth.js config
│  │  ├─ ai/
│  │  │  ├─ client.ts         # §6.1 — the ONLY Gemini touchpoint
│  │  │  ├─ tasks.ts          # task registry (§6.3)
│  │  │  └─ schemas.ts        # responseSchema definitions
│  │  └─ validation/          # Zod schemas shared by routes & forms
│  └─ server/                 # business logic (routes stay thin)
│     ├─ products.ts
│     ├─ recipes.ts
│     ├─ receipts.ts          # incl. the atomic confirm transaction
│     ├─ analytics.ts
│     └─ ratelimit.ts
├─ .env.example
├─ .gitignore
└─ package.json
```

Convention: **routes are thin** (auth check → validate → call a `src/server/` function → return JSON). All real logic lives in `src/server/`, which keeps it testable and lets you later move it anywhere.

---

## 9. The two critical flows, step by step

### 9.1 Receipt → inventory + expense (atomic)

1. User photographs a receipt → `POST /api/receipts` (image → Vercel Blob).
2. Server calls Gemini Vision with a receipt `responseSchema` → creates `Receipt(DRAFT)` + `ReceiptItem[]` (categories via `CategoryMapping` cache first, AI for unknowns).
3. UI shows the draft: user fixes misread names/prices, deletes junk lines (bags, discounts).
4. `POST /api/receipts/:id/confirm` runs **one Prisma `$transaction`**:
   - each item merges into `Product` as `IN_STOCK` (existing TO_BUY item with the same normalized name → flipped and quantity updated; otherwise created);
   - an `Expense` (category «Продукты», amount = receipt total, linked to the receipt) is created;
   - receipt → `CONFIRMED`.
5. If any step fails, nothing is applied. Inventory can never half-update.

### 9.1a The QR path (best data quality)

1. In the app, the camera scans the receipt's QR code client-side (native `BarcodeDetector` API where available, `html5-qrcode` as fallback) and sends the raw string (`t=…&s=…&fn=…&i=…&fp=…&n=…`) to `POST /api/receipts` with `source: QR`.
2. The server queries a receipt-data API — either the official FNS «Проверка чеков» API or a wrapper service such as proverkacheka.com. This needs its own registration and key (`RECEIPT_API_KEY` in `.env`) and has daily request limits.
3. The response contains the *exact* fiscal item list (names, prices, quantities) — no OCR, no Gemini parsing needed. Only categorization runs: `CategoryMapping` cache first, one batched AI call for unknown names.
4. From here the flow is identical: DRAFT → user review → atomic confirm.
5. **Fallback rule:** if the fiscal API is down or the receipt isn't found yet (data can lag by a few hours), the UI offers the photo path instead. QR is an enhancement, never the only door.

### 9.2 AI recipe → cook or shop

1. `POST /api/ai/recipe` with optional wishes («лёгкий ужин, высокобелковое»).
2. Server loads the user's `IN_STOCK` products, builds the prompt, gets structured recipe JSON (КБЖУ, время, ingredients flagged `wasInStock`).
3. Recipe stored with `isSaved: false` and shown with three actions:
   - **«Сохранить в мои рецепты»** → `isSaved: true`;
   - **«Добавить в календарь»** → `MealPlanEntry` for a chosen date + meal;
   - **«Недостающее — в закупки»** → `POST /api/recipes/:id/missing-to-shopping` creates `TO_BUY` products with `estPrice`.
4. Unsaved, unscheduled AI recipes are garbage-collected after 7 days (cron in Phase 6).

---

## 10. Development roadmap (beginner-paced, ~10 weeks part-time)

Each phase ends with something working and deployed. Do not start a phase before the previous one's acceptance criteria pass.

**Phase 0 — Foundations (week 1).**
Install Node.js LTS, Git, VS Code. Create GitHub account. Scaffold `create-next-app` (TypeScript, Tailwind, App Router). Push to GitHub, connect Vercel, see the hello-world live on a real URL. Create Neon database, add Prisma, run first migration with just the `User` model. *Accept:* the deployed site loads; `npx prisma studio` shows your empty DB.
*Risk for beginners:* environment setup eats time — let an AI assistant drive the terminal commands.

**Phase 1 — Auth + Inventory core (weeks 2–3).**
Auth.js login, with registration locked to your email via the `ALLOWED_EMAIL` check (§7). Product CRUD with the two-status model, manual category select, grouping by category with alphabetical sort inside groups, «куплено» / «надо купить» toggle. Mobile-first UI with bottom navigation. *Accept:* two different accounts see only their own products; status toggle moves items between the Холодильник and Закупки tabs instantly.

**Phase 2 — AI gateway + smart inputs (week 4).**
`src/lib/ai/*`, `/api/ai/assist`, `CategoryMapping` cache, rate limiter. Bulk add (paste a multiline list → preview with AI-parsed names/categories/quantities → confirm). `<AiAssist>` component wired into the product form (category auto-fill, unit suggestion, price estimate). *Accept:* pasting 20 lines creates 20 correctly categorized products with a single visible AI step; the Gemini key does not appear in the browser bundle.

**Phase 3 — Recipes + meal calendar (weeks 5–6).**
AI recipe generation from IN_STOCK products with wishes; manual recipe entry form (with `<AiAssist>` on КБЖУ estimation from the ingredient list); «Мои рецепты» base; missing-ingredients → shopping list; week calendar (Mon–Sun × Завтрак/Обед/Ужин/Перекус) with real dates; daily КБЖУ totals shown per day. *Accept:* the full loop of §9.2 works end-to-end.

**Phase 4 — Receipt scanner: photo + text (week 7).**
Upload, Gemini Vision parsing (and pasted-text parsing via the same schema), draft review/edit screen, atomic confirm (§9.1). *Accept:* a real photographed receipt updates inventory and creates an expense in one confirm tap; a discarded draft leaves zero traces.

**Phase 4b — QR / fiscal-data source (week 8).**
Register for the receipt-data API, add `RECEIPT_API_KEY`, client-side QR scanning, `source: QR` path (§9.1a) with the photo fallback rule. *Accept:* scanning a QR from a real receipt yields the exact item list with no manual price fixes; when the API is unreachable, the app offers the photo path instead of failing.

**Phase 5 — Finance analytics + weight (week 9).**
Manual expenses, `/api/analytics/summary`, Recharts: monthly spend, category pie, spend trend; weight entry (one per day, upsert) + progress line chart alongside average daily КБЖУ from the calendar. *Accept:* charts match a hand-checked sum of the underlying rows.

**Phase 6 — Hardening & beta (week 10+).**
PWA manifest + icons (installable on phone), Sentry, empty/loading/error states everywhere, the 7-day cleanup cron for orphan AI recipes, backup-restore test, security checklist (§7) walked top to bottom, invite 2–3 friends.

**Deferred to v2 (deliberately cut from MVP):** family/shared households (schema-ready, so it's a feature later, not a rewrite), barcode scanning, push reminders (expiry dates), nutrition goals & coaching, native apps, offline mode.

---

## 11. Review log (Reviewer) & optimization notes (Optimizer)

**Top risks and their mitigations:**
1. **API key leak** → server-only client (§6.1), bundle smoke test in Phase 2 acceptance.
2. **OCR errors corrupting inventory** → draft/confirm pipeline + atomic transaction (§9.1).
3. **AI cost creep** → mapping cache, batch prompts, model tiering, rate limits (§6.5).
4. **Unit/quantity chaos** («упаковка» vs «кг» vs «шт») → fixed unit list in the schema prompt; merge-by-normalized-name on receipt confirm; accept imprecision — this app tracks *roughly* what you have, not warehouse-grade stock.
5. **Scope creep** → the v2 cut list exists so features have somewhere to go besides "now".
6. **Beginner overwhelm** → phases are sequential, each independently shippable; if a phase stalls, ship it smaller rather than pausing deploys.
7. **Fiscal-data API dependence (QR path)** → third-party service with registration, its own key, rate limits, and data that can lag hours behind purchase → the photo path is always available as a fallback (§9.1a), and QR ships as Phase 4b only after photo/text is stable.

**Performance/UX optimizations already designed in:** React Query with optimistic updates on status toggles (the most-used action must feel instant); DB indexes on `(userId, status)`, `(userId, category)`, `(userId, date)`; client-side image compression before receipt upload (~4× faster on mobile data); saved recipes reused from the base with zero AI calls; skeleton loaders on AI actions with honest "Gemini думает…" states.

---

## 12. Founder decisions log

1. **Platform:** PWA. ✅ resolved 2026-08-02
2. **Audience:** single user; registration locked via `ALLOWED_EMAIL`; schema stays multi-user-ready. ✅ resolved 2026-08-02
3. **Receipts:** all three sources (photo / text / QR), photo as universal fallback, QR in Phase 4b. ✅ resolved 2026-08-02
4. **Weight module:** default = logging + progress chart. Goals/targets can be added in v2 without schema changes (a `targetWeightKg` field on User).
5. **Currency/locale:** default = RUB only, Russian UI. Multi-currency deferred; all money columns are `Decimal`, so a later `currency` column is a trivial migration.

Items 4–5 proceed on defaults unless you say otherwise — neither blocks any phase.
