# Провизия (Meal Assistant) — Design System MASTER

**Version 1.3 · 2026-08-02.** Generated with the ui-ux-pro-max engine, curated by four-role review, reoriented for desktop-primary input (v1.1), reconciled with the approved Claude Design prototype (v1.2), and now set to the founder-chosen default look: **dark «Электрик (графит)»**. Prototype adoptions are marked ◆; open items are in §9.

**Governance.** This file is the single source of truth for all UI work, subordinate to `CLAUDE.md` (§0 precedence and conflict rule apply). The prototype (`design-system/prototype/prototype.html`) is a **visual reference**: when code and prototype disagree on look/feel, match the prototype; when prototype and MASTER disagree on tokens or rules, MASTER wins — flag it (§0). Page overrides live in `design-system/pages/<page>.md` and win over MASTER for their page only. Edit this file only through the CLAUDE.md §0 confirmation flow.

---

## 1. Product context

**App name: «Провизия»** · tagline: «кухня под контролем» ◆. Logo: utensils Lucide icon in `--primary-foreground` on a 36px `--primary` square, radius 12.

Responsive web app (PWA-installable), Russian-language UI, single user. Five modules: Запасы · Рацион · Чеки · Финансы · Вес.

Two usage contexts, both first-class: **desktop** (primary input: bulk adds, receipt drafts, week planning, analytics; keyboard-first) and **mobile** (primary consumption: kitchen and store; one-handed, glanceable). Desktop is never a stretched phone column; mobile is never a shrunk desktop table.

**Surface hierarchy (dark) ◆:** the page is deep graphite (`--background #0A0C10`); content sits on raised slate cards (`--card #12151C`) with 1px `--border` hairlines. On dark surfaces the **border is the primary separator** and the soft shadow is secondary — both are always applied together for parity with the light variant. PWA meta: `<meta name="theme-color" content="#0A0C10">`.

Stack: Next.js + Tailwind CSS + shadcn/ui, Lucide icons, Recharts (visual spec in §5 ChartPanel).

## 2. Design direction

**Electric graphite: a focused dark workspace with electric-blue energy.** Deep neutral surfaces, luminous blue primary, high-contrast tokens (WCAG AA+), generous rounding and soft depth carried over from the Soft-UI base. Money and health screens read crisp and professional; food screens keep energy through the bright accent set rather than warm hues.

Decision history: engine's Claymorphism softened to Soft UI Evolution (v1.0) · Plus Jakarta Sans → **Manrope** for Cyrillic (v1.0) · desktop-primary reorientation (v1.1) · prototype reconciliation (v1.2) · **founder decision: dark «Электрик» default (v1.3)** — this consciously overrides v1.0's light-first curation; founder preference sits at the top of the §0 precedence chain. The warm «Терракота» light theme remains fully specified (§3.1a) and is one `.light` class away; no user-facing theme switcher in MVP.

## 3. Design tokens

Rule: **no raw hex in components** — components use only tokens. Everything below is a CSS variable mapped into Tailwind.

### 3.1 Color — base theme «Электрик (графит)» (dark, default)

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#0A0C10` | Page background (deep graphite) |
| `--card` ◆ | `#12151C` | Cards, panels, editor surfaces |
| `--foreground` | `#EEF2F8` | Primary text |
| `--muted` | `#191E27` | Sidebar, input backgrounds, group headers, tonal buttons |
| `--muted-foreground` | `#8D97A8` | Secondary text, captions, kickers |
| `--border` | `#272E3A` | Card borders, hairlines, chart grids — the main separator on dark |
| `--primary` | `#5B9EFF` | Electric blue: accents, primary buttons, active nav, line charts |
| `--primary-strong` ◆ | `#7DB3FF` | Primary hover — on dark, "strong" is **lighter**, not darker |
| `--primary-foreground` | `#06101F` | Text/icons on primary fills (near-black navy, not white) |
| `--secondary` | `#FBBF24` | «Надо купить», draft chips, warm emphasis (amber) |
| `--accent` | `#34D399` | «В наличии», success, progress fills, goal line |
| `--accent-strong` | `#34D399` | Same as accent on dark (already high-contrast on graphite) |
| `--destructive` | `#F87171` | Delete, validation errors |
| `--ring` | `#5B9EFF` | Focus rings (2px outline, offset 2) |
| `--inverse-bg` / `--inverse-fg` ◆ | `#EEF2F8` / `#0F172A` | Toasts and chart tooltips — **light pill on the dark theme** (theme-aware; see curation note below) |

Soft tints ◆ (chip/pill backgrounds, hover washes — always paired with their strong/base text color):

```css
--primary-soft:rgba(91,158,255,0.14);  --primary-faint:rgba(91,158,255,0.09);
--secondary-soft:rgba(251,191,36,0.15); --accent-soft:rgba(52,211,153,0.15);
--destructive-soft:rgba(248,113,113,0.14);
```

КБЖУ macro tokens — chips are `*-soft` background + `*-strong` text ◆ (on dark, strong variants are the *lighter* high-contrast members of each hue):

```css
--kcal:#5B9EFF;    --kcal-soft:rgba(91,158,255,0.16);                            /* text: --kcal */
--protein:#22D3EE; --protein-soft:rgba(34,211,238,0.16); --protein-strong:#67E8F9;
--fat:#EAB308;     --fat-soft:rgba(234,179,8,0.18);      --fat-strong:#E5C355;
--carbs:#FB923C;   --carbs-soft:rgba(249,115,22,0.16);   --carbs-strong:#F4A263;
--sage:#7E96BD;    --shadow-soft:0 8px 32px rgba(0,0,0,0.5);
```

**Chart palette:** `--primary`, `--accent`, `--sage`, `--secondary`, `--protein` in that order; legends and tooltips mandatory; values duplicated as text.

**Contrast rules (dark):** body text ≥4.5:1 on `--background` and `--card` (`--foreground` and `--muted-foreground` both pass). Filled CTAs (primary blue, accent green) use `--primary-foreground` — dark navy text on bright fills, never white-on-bright. Soft-tint chips always carry their `*-strong` text color. Status/macro meaning always carries text, never color alone.

**Curation note (deviation from prototype, logged):** the prototype hardcodes toasts/tooltips as a near-black `#0F172A` pill, which is invisible against the `#0A0C10` background. `--inverse-bg/fg` are therefore theme-aware: light pill on the dark theme, dark pill on the light theme.

### 3.1a Theme variants

Variants are pure token overrides; components must render correctly under any of them (a component that only works in one theme is using raw hex somewhere — anti-pattern).

- **Default: «Электрик (графит)»** — the base tokens above (`:root`).
- **Specified light theme: «Терракота»** — the original warm food palette, ship-ready behind a `.light` class for a future light mode:

```css
.light{--background:#FFFBEB;--card:#FFFFFF;--foreground:#0F172A;--muted:#F8F2F0;
--muted-foreground:#64748B;--border:#F2E6E2;--primary:#9A3412;
--primary-strong:#7C2D12;--primary-foreground:#FFFFFF;
--primary-soft:rgba(154,52,18,0.10);--primary-faint:rgba(154,52,18,0.07);
--ring:#9A3412;--kcal:#9A3412;--kcal-soft:rgba(154,52,18,0.12);
--secondary:#C2410C;--secondary-soft:rgba(194,64,12,0.12);
--accent:#059669;--accent-strong:#047857;--accent-soft:rgba(5,150,105,0.12);
--destructive:#DC2626;--destructive-soft:rgba(220,38,38,0.08);
--protein:#2563EB;--protein-strong:#1D4ED8;--protein-soft:rgba(37,99,235,0.12);
--fat:#EAB308;--fat-strong:#854D0E;--fat-soft:rgba(234,179,8,0.16);
--carbs:#F97316;--carbs-strong:#B45309;--carbs-soft:rgba(249,115,22,0.14);
--sage:#6B7B3C;--inverse-bg:#0F172A;--inverse-fg:#FFFFFF;
--shadow-soft:0 8px 32px rgba(15,23,42,0.08)}
```

  Light-theme deltas to remember: `--primary-strong` is **darker** than primary (hover darkens); filled CTAs use white `--primary-foreground`; white small text is forbidden on `#059669` — text-bearing green CTAs use `--accent-strong #047857`.
- **Future palettes** (validated in the prototype, out of MVP scope): «Спелая вишня», «Оливковая роща», «Кофе и карамель», «Тёмная (техно)» — token sets preserved in the prototype file.

### 3.2 Typography

**Manrope**, weights 400 / 500 / 600 / 700 / 800 ◆, Cyrillic subsets required (Google Fonts).

| Role | Spec |
|---|---|
| H1 (screen title) ◆ | **40px desktop / 30px mobile**, weight 800, line 1.1, letter-spacing −0.02em |
| Kicker ◆ | 12px, 700, letter-spacing 0.14em, uppercase, `--muted-foreground` («01 · Кладовая») |
| H2 (panel title) | 22 / 1.3, 800 |
| H3 (card title) | 18 / 1.35, 700 |
| Stat value ◆ | 32px, 800, letter-spacing −0.02em, tabular |
| Body | 16 / 1.5, 400–500 |
| Secondary | 14 / 1.45, 500 |
| Caption (min) | 12 / 1.4, 500–600 |

All money, КБЖУ, dates, and counts: `font-variant-numeric: tabular-nums`. No text below 12px. On dark, prefer weight 500 over 400 for long body text (thin light-on-dark strokes read weaker).

### 3.3 Spacing & shell (density 6/10)

Scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Content max-width 1280px centered. Main padding ◆: desktop `44px 40px 72px`; mobile `24px 16px` + bottom clearance for the nav bar (and the mobile ConfirmBar when present). List rows ≥11–12px vertical padding; screen header block has 30px bottom margin.

### 3.4 Radius & elevation ◆

| Radius | Used for |
|---|---|
| 8px | Inline-edit inputs |
| 10px | Inputs, meal-slot cards, small chips, tooltips |
| 12px | Icon buttons (44px squares), logo block |
| 16px | Cards, panels, primary buttons, modals |
| 24px | Large sheets |
| full | Status pills, nav pills, tabs, count chips, toasts, progress bars |

Cards: `--card` + 1px `--border` + `--shadow-soft` (border leads on dark). Pressed state: scale 0.97. Never pure `#000000` anywhere.

### 3.5 Motion (3/10 — subtle) ◆

Easing `cubic-bezier(0.16,1,0.3,1)` everywhere. Screen enter: fade + 10px rise, 240ms. Side panel: slide-in from right 28px, 260ms. Toast: fade-up 220ms. Hover transitions 160–180ms; active press scale 0.97 (120ms). Selection highlight fades over 300ms. Transform/opacity only — never animate width/height. `prefers-reduced-motion: reduce` disables all of it.

## 4. Layout & navigation (adaptive)

Verify at 375 / 768 / 1024 / 1440; anchors are 1440 (input speed) and 375 (thumb reach). No horizontal scroll, zoom never disabled.

| Range | Navigation | Layout |
|---|---|---|
| 375–767 | **Bottom bar**: 5 items, 22px Lucide icon + 12px/600 label, active = `--primary`, min-height 56px, safe-area inset | Single column |
| 768–1023 | Bottom bar persists | Column widens; dashboards may go 2-up |
| ≥1024 | **Left sidebar** ◆: fixed 240px, sticky full-height, `--muted` bg, 1px right border; logo block on top; items = radius-full pills, 15px/700, active = `--primary-soft` bg + `--primary` text, hover = `--primary-soft` | Content grid, max 1280px |

Same 5 destinations, same order, same icons in both modes. No hamburger menus.

**Keyboard-first (desktop rule):** every form fully operable without a mouse. Tab order top-to-bottom; visible `--ring` focus on everything; **Enter** submits single-row add forms and inline edits; **Esc** closes the recipe panel and cancels inline edits (global document listener ◆); autofocus + select() on opened inline-edit inputs ◆; numeric fields use `inputmode="decimal"` and accept both comma and dot ◆. Hover is meaningful on desktop but nothing is hover-only.

**Per-module layouts (≥1024 → mobile):**

| Module | Desktop | Mobile |
|---|---|---|
| Запасы | Two cards side by side (1fr 1fr): «В наличии» left, «Надо купить» right; pane titles with colored dot + count chip; toggling moves the item across | Segmented tabs + single list |
| Рацион | **4-column wrapping day grid** ◆ (7 cards flow 4+3); recipe opens in right slide-over panel (440px) | Single-column day cards; panel is full-width |
| Чеки | Split: history list **300px** ◆ + draft/detail editor 1fr | List ↔ detail views with «Все чеки» back button ◆ |
| Финансы | Stat cards 3-up, then charts 1fr 1fr (donut + trend) | All stacked |
| Вес | Chart card 1fr + right column **340px** ◆ (entry form + progress card) | Stacked |

## 5. Component inventory

| Component | Rules |
|---|---|
| **AdaptiveNav** | Per §4. Sidebar pills and bottom-bar items share icons and labels. |
| **ScreenHeader** ◆ | Kicker («0N · Раздел») + H1 + one-line subtitle (14px muted, live counts, tabular) on the left; primary action button or PeriodNav on the right; wraps on narrow widths. |
| **PeriodNav** ◆ | ‹ label › — two 44px icon buttons (radius 12, `--muted` bg, hover `--border`) around a centered 15px/700 fixed-min-width label. Used for weeks (Рацион) and months (Финансы). aria-labels required. |
| **StatusToggle** ◆ | Pill, radius-full: `--accent-soft` bg + `--accent-strong` text («В наличии») or `--secondary-soft` bg + `--secondary` text («Надо купить»), with a currentColor dot inside. Hover: brightness(1.1) on dark / brightness(0.95) on light; active: scale 0.96. `title` explains the resulting action («Отметить: надо купить»). Optimistic update + rollback toast. Larger padding on touch (10×16) than pointer (7×14) ◆. |
| **SegmentedTabs** ◆ (mobile inventory) | `--muted` track, radius-full, 4px padding; active segment = `--card` bg + `--shadow-soft` + status-colored text; labels carry counts («В наличии · 12»). |
| **ProductRow** | Name 15/500; sub-line 13 muted tabular («2,5 кг · 105 ₽»); StatusToggle right. Category via sticky group header (13/700 muted on `--muted`, name + count, sticky within its pane). Desktop hover invites inline edit; mobile tap opens edit sheet. |
| **AiAssistField** | Input + ✨ `sparkles` button; suggestions as dismissible chips below; applied only by click/tap/Enter; debounce 500ms passive tasks; in-field spinner while pending. |
| **BulkAddModal** | Desktop: centered dialog max-w 640, radius 16–24, textarea autofocused. Mobile: full-screen sheet. Flow: textarea → «Разобрать с ИИ» → editable preview with category chips → single confirm. |
| **RecipePanel** ◆ | Fixed right slide-over: 440px desktop / 100vw mobile, `--card`, left border + heavy left shadow, slide-in 260ms, scrollable; Esc and 44px close button. Content: kicker context («Среда · Ужин»), H2 title, time chip (`clock` icon, `--muted` pill), КБЖУ chips row, ingredient list (colored dot: accent=есть / secondary=нет; note «нет в наличии» / «в списке покупок»; qty right, tabular), then actions. |
| **Recipe actions** ◆ | Primary: «Недостающее — в закупки (N)» — `--accent-strong` fill + `--primary-foreground` text when N>0; when N=0 it becomes disabled-tonal (`--muted` bg, muted text, default cursor, label «Все ингредиенты есть или в списке»). Secondary row: «Сохранить» + «В календарь» as tonal buttons (`--muted`, hover `--border`). |
| **KbjuBadges** ◆ | Four pills: «К 380» `--kcal-soft`/`--kcal` · «Б 12» `--protein-soft`/`--protein-strong` · «Ж 9» `--fat-soft`/`--fat-strong` · «У 64» `--carbs-soft`/`--carbs-strong`. 13/700, tabular, `title` with full names («Белки, г»). |
| **DayCard** ◆ | `--card`, radius 16; header: uppercase day 12/700 muted + date 18/800 (today: `--primary` date, 2px `--primary` border, «сегодня» chip in `--primary-soft`); meal slots in a 2×2 grid — filled slot: `--muted` radius-10 card (meal 12/600 muted, title 13/600 2-line clamp, kcal 12 tabular; selected = 2px primary ring), empty slot: dashed 1.5px border ghost button with + icon, hover → `--secondary`; footer: kcal ring (r15, stroke 3.5, `--border` track, `--kcal` progress, −90° start) + «1 620 / 2 000» tabular. |
| **ReceiptDraftRow** ◆ | Read mode: values render as buttons with transparent dashed border; hover → `--muted` bg + visible dashed `--border` (the "editable" affordance). Edit mode: input with 1.5px `--primary` border, radius 8, autofocus+select; Enter commits, Esc cancels, blur commits; invalid input → no save + toast «Не сохранено: проверьте значение» (numbers: >0, <100 000, comma or dot). Edited rows keep `--muted` bg until confirm. Row: name (flex) · qty · × · price · sum (15/700, right, min-width 86) · 38px delete icon button (hover `--destructive-soft`/`--destructive`, aria-label). |
| **AI draft note** ◆ | `--muted` radius-10 strip with `sparkles` icon in `--primary`: «Черновик распознан ИИ по фото чека — проверьте… Нажмите на значение, чтобы исправить.» Shown on every AI-parsed draft. |
| **Empty draft state** ◆ | If all rows deleted: «Все позиции удалены / Пустой чек нельзя подтвердить» + tonal «Восстановить черновик». Confirm is impossible on an empty draft. |
| **ReceiptHistoryCard** ◆ | `--card` button, radius 16: store 15/700 + status chip (черновик = secondary-soft/secondary; подтверждён = accent-soft/accent-strong), meta line (date · N позиций, pluralized), total 15/800 tabular. Selected: 1.5px `--primary` border + shadow; hover: `--secondary` border. |
| **ConfirmBar** ◆ | Desktop: sticky footer *inside* the editor card (border-top, radius 0 0 16 16): «ИТОГО» caption + 22/800 total left, primary confirm button right. Mobile: fixed above the bottom nav (`bottom: calc(64px + safe-area)`), top shadow. Confirm button: check icon + «Подтвердить чек», hover `--primary-strong`, active scale 0.97. |
| **StatCard** ◆ | `--card`, padding 20/22: label 13/600 muted → value 32/800 tabular −0.02em → delta line 13/600 (colored when meaningful, e.g. `--secondary` for «+8% к июню»). |
| **ChartPanel** ◆ | On `--card`. **Donut** (category spend): r62, stroke 30 (hover segment → 37), 2.5px gaps, −90° start, interactive segments (hover/click), center shows total or hovered value + label; legend rows: 10px radius-3 swatch · name · value (14/700 tabular) · percent (muted, right). **Line** (trend, weight): area fill `--primary-faint`, line `--primary` 2.5px round joins, grid lines `--border` with muted tabular axis labels, dots r4 `--card` fill / `--primary` 2.5px stroke with ≥13px invisible hit targets; weight chart adds dashed `--accent` goal line labeled «цель 76,0». Tooltip: `--inverse-bg`/`--inverse-fg` pill, radius 10, above the point. Recharts must be styled to match this spec exactly; hand-rolled SVG (as in the prototype) is an accepted fallback where Recharts can't. |
| **ProgressBar** ◆ | 10px `--muted` track, radius-full, `--accent` fill, width animates 300ms; caption «Пройдено N% пути к цели». |
| **Toast** ◆ | `--inverse-bg`/`--inverse-fg` pill (light pill on the dark default theme), radius-full, 14/600, bottom-centered: desktop 28px, mobile above nav (`calc(88px + safe-area)`); fade-up 220ms; auto-dismiss ~2 600ms; max-width `calc(100vw − 32px)`. Used for confirmations («Чек подтверждён — расходы обновлены») and soft errors. |
| **EmptyState** ◆ | 60px `--muted` circle with a muted Lucide icon, title 15/700, one line of 13px muted text (max-w ~240), tonal CTA (`--muted` bg, `--primary` text). Every list and pane has one. |
| **WeightEntryForm** ◆ | Label above field («Вес, кг»); input 16/600 on `--muted`, radius 10, focus → `--card` bg + ring + `--primary-soft` glow; `inputmode="decimal"`, placeholder «78,4»; validation 30–250 with inline `--destructive` message; date caption below; full-width primary «Добавить»; Enter submits. The template for ALL single-row add forms. |
| **Skeletons / AI states** | Every async surface reserves final space (CLS < 0.1); AI operations show honest «Gemini думает…» with spinner. |
| **Feedback** | Errors inline at the field; toasts for background results; labels always visible — placeholder is never the only label. |

## 6. Pre-delivery checklist (every UI feature)

- [ ] Lucide SVG only — no emoji icons; icon-only buttons have `aria-label` and `title` ◆
- [ ] `cursor-pointer` + hover state on all clickables; nothing hover-only
- [ ] Keyboard-only pass on desktop: tab order, Enter/Esc per §4, focus visible
- [ ] Both nav modes verified (bottom ≤1023 / sidebar ≥1024)
- [ ] Checked at 375 and 1440 (+768/1024); desktop uses its width per §4
- [ ] Only tokens used — feature renders correctly under the light «Терракота» variant too ◆
- [ ] Contrast ≥4.5:1; soft-tint chips pair with strong text; filled CTAs use `--primary-foreground`, never white-on-bright
- [ ] Touch targets ≥44×44 (≥56px nav items), ≥8px apart on mobile
- [ ] `prefers-reduced-motion` respected; transform/opacity only
- [ ] Numbers: ru-RU formatting, tabular, «₽» after a space; plurals correct (позиция/позиции/позиций) ◆
- [ ] Skeletons reserve space; no layout shift
- [ ] Russian strings reviewed; dates like «2 августа», proper «−» minus ◆

## 7. Anti-patterns

Emoji as icons · raw hex in components (breaks theming) · AI-purple gradients · hover-only affordances · placeholder-only labels · color-only meaning · animating layout properties · pure #000 (the graphite base is #0A0C10, never black) · white text on bright fills or soft tints · glassmorphism blur layers · desktop as stretched phone · mobile as shrunk desktop · hamburger menus · dead low-contrast gray-on-gray (keep energy via the electric accent set) · placeholder feature stubs shipped to production (prototype's «появится в полной версии» toasts are prototype-only ◆).

## 8. Page overrides

`design-system/pages/<page>.md` (`inventory`, `menu`, `receipts`, `finance`, `weight`) contains only deviations; read MASTER first, page file wins for its page. Expected first override: `finance.md` density 8/10.

## 9. Open items

1. ~~Default theme~~ — **resolved 2026-08-02: dark «Электрик (графит)» is the default**; «Терракота» retained as the specified `.light` variant; no user-facing switcher in MVP. Log in CLAUDE.md §7.
2. **Goals are in scope ◆.** The approved prototype includes a daily calorie target (default 2 000, range 1 400–3 200, step 50) driving the Рацион caption and day rings, and a weight goal (default 76,0, step 0,5) driving the goal line, «До цели» stat, and progress bar. This exceeds the master plan's v1 scope. Required when implementing Phases 3/5: `User.kcalTarget` and `User.weightGoalKg` fields + a small settings surface. Log as a scope decision in CLAUDE.md §7.

## Change log

- 2026-08-02 — **v1.3.** Founder decision: **dark «Электрик (графит)» becomes the default theme** (overrides v1.0's light-first curation per §0 precedence). Base tokens swapped to the Электрик set; «Терракота» preserved as the ship-ready `.light` variant; contrast rules rewritten for dark (filled CTAs use dark `--primary-foreground`; "strong" variants are lighter on dark); borders promoted to primary separator; `--inverse-bg/fg` made theme-aware (curation fix: prototype's hardcoded dark toast is invisible on graphite); body-weight guidance for light-on-dark text; PWA theme-color note; §9.1 resolved.
- 2026-08-02 — v1.2. Reconciled with the approved Claude Design prototype: app name «Провизия», `--card` hierarchy, soft-tint + strong-text token families, theme-variant architecture, responsive H1 + kicker + stat type roles, refined radius/motion, 4-column week grid, ~12 components specced from the prototype, localization rules, goals scope flagged.
- 2026-08-02 — v1.1. Desktop-primary reorientation: adaptive nav, per-module desktop layouts, keyboard-first entry.
- 2026-08-02 — v1.0. Engine generation + curation: Soft UI Evolution, warm palette, Manrope for Cyrillic, macro tokens.
