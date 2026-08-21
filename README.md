# Catatan Keuangan — Mini App

A mobile-first personal finance mini app built with TanStack Start, React 19, TypeScript, and Tailwind CSS. All data stays on the device (`localStorage`), so the app runs with no backend.

## Features

### Transactions — strict input sequence

`src/components/AddTransactionSheet.tsx` enforces a progressive, bank-grade input order. Each step stays disabled until the previous one is valid:

1. **Amount** — numeric only, > 0 and ≤ 1,000,000,000,000, formatted as `id-ID`
2. **Wallet account** — pick the account family (Tunai / Bank Utama / E-Wallet), then the registered account; expenses are blocked when the balance is insufficient
3. **Category** — chosen from the user's own categories (account-specific categories are marked with `•`)
4. **Date** — validated calendar date, defaults to today
5. **Note** — optional, max 80 characters

Saving is optimistic (pending state), the sheet is a focus-trapped `role="dialog"`, and `Esc` closes it.

- **All Transactions sheet** (`src/components/AllTransactionsSheet.tsx`): filter by month, week, type, category, keyword; reset filters; "current month" shortcut from the bottom navigation.
- **Transaction list** (`src/components/TransactionList.tsx`): inline edit and delete.

### Categories start empty

The app ships with **zero** categories. Users create them in **Settings → Kategori Transaksi**, per type (income/expense) and optionally scoped to a single wallet account. Duplicate names within the same type + account scope are rejected; names must be 2–24 characters.

### Wallet (`/wallet`)

- Combined balance across all accounts plus per-family grouping.
- **Card-based Add Wallet flow — no native `<select>`**: first choose one of three type cards (Tunai, Bank Utama, E-Wallet); selecting a type instantly reveals a responsive grid of provider cards (BCA, Mandiri, BNI, BRI, CIMB Niaga, Permata for banks; GoPay, OVO, DANA, ShopeePay, LinkAja for e-wallets; physical cash sources for Tunai). The provider selection auto-suggests the account name, and the sheet validates name length (2–30) and starting balance.
- **Per-account history sheet**: tapping a wallet card opens a drawer showing only the transactions that moved that account's balance, sorted newest first, with signed amounts and the account's current balance in the header.
- **Top Up** and **Transfer** sheets with balance checks and toast confirmation.
- **Wallet activity feed** filterable by Top Up / Transfer / All.

### App Lock

- Toggled in **Settings → App Lock**. Enabling it arms the lock immediately and it is restored on every app start.
- The **Wallet route is actively protected**: while App Lock is on and the session is locked, `/wallet` renders an unlock challenge screen and no financial data (balances, accounts, activity) is rendered at all until the user unlocks.

### Settings (`/settings`)

- Language toggle (ID / EN) — the whole settings screen is translated via `src/lib/i18n.ts`
- App Lock, push notifications, dark/light theme, cloud sync
- Category management (create/delete, per type and account)
- Local avatar upload (read as a data URL, never uploaded)
- Sign out and destructive account actions

### Other

- Analytics overview (`/analytics`)
- Telegram / Google style mock login (`/login`, `/signup`)
- Accessibility: `role="dialog"` + `aria-modal`, focus traps, `Esc` to close, `role="radiogroup"`/`aria-checked` on all card selectors, `role="alert"` inline errors, and body-level portals so sheets sit above the bottom navigation

## State

`src/lib/app-store.tsx` is a single React context store: user, transactions, wallets, wallet activity, categories, settings, language, lock state, and transaction filters. Persisted to `localStorage` (`tmab-state-v1`) with debounced writes.

### Delete + Undo (a11y)

- Delete opens a focus-trapped `role="alertdialog"`; focus lands on the destructive action.
- `Enter` confirms, `Escape` cancels and returns focus to the trigger button.
- After deletion a toast exposes an **Urungkan** (undo) action that receives focus; `Enter` restores the record, `Escape` dismisses the toast and returns focus to the trigger.

## Development

```sh
bun install
bun run dev
```

## Testing (Vitest)

Vitest runs in `jsdom` with Testing Library (`vitest.config.ts`, setup in `src/tests/setup.ts`).

```sh
bun run test          # single run of all suites (vitest run)
bun run test:watch    # watch mode
bunx vitest run src/tests/delete-undo.test.tsx   # delete dialog + undo toast only
```

Current suites:

- `src/tests/delete-undo.test.tsx` — delete confirmation dialog and undo toast: initial focus, Enter to confirm/undo, Escape to cancel/dismiss with focus return, Tab focus trap.
- `src/tests/fund-source.test.tsx` — fund source CRUD, duplicate guard, in-use delete block, search/type filter, audit log.

Typecheck and production build:

```sh
bunx tsgo --noEmit
bun run build
```

## Testing (Playwright E2E)

Browser-level suites live in `e2e/` and run against the dev server
(`E2E_BASE_URL` overrides the base URL, default `http://localhost:8080`).
Every test starts from a seeded, signed-in and category-free local state
(`e2e/fixtures.ts`), so focus order and screenshots are deterministic.

```sh
bun run e2e           # run the suites
bun run e2e:update    # refresh visual baselines on purpose
bun run e2e:report    # open the last HTML report
```

- `e2e/category-keyboard.spec.ts` — Pengaturan > Kategori Transaksi keyboard
  audit: Enter opens the sheet and moves focus inside it, Tab/Shift+Tab stay
  trapped, the tab order is stable and reversible, Escape closes and restores
  focus to the opener row.
- `e2e/category-empty-state.spec.ts` — visual regression of the empty state,
  with the baseline committed under `e2e/__screenshots__/`.

On failure Playwright keeps a trace, screenshot, and video under
`test-results/` (`bunx playwright show-trace <path>` to inspect).

## Built with

- TanStack Start (TanStack Router)
- TypeScript
- React 19
- Tailwind CSS
- sonner (toasts)

## Sumber Dana & Kantong (REV017+)

- **Settings → Sumber Dana**: pencarian nama + filter Jenis, urutan field `Jenis` lalu `Nama Sumber Dana`.
- **Hapus**: dialog konfirmasi (`role="alertdialog"`) hanya untuk sumber dana yang tidak dipakai; yang masih dipakai diblokir dengan pesan inline. Setelah dihapus muncul toast dengan aksi **Urungkan** (`restoreWallet`).
- **Tambah Kantong**: urutan `Jenis` → `Nama Sumber Dana` → `Nama Kantong` → `Saldo Awal`, validasi inline per-field, dan penyimpanan diblokir bila belum ada / belum memilih Sumber Dana.
- **Empty state**: daftar bawaan dihapus total; Sumber Dana & pilihan provider kosong sampai user membuatnya sendiri.
- Test: `bun run test` (lihat bagian **Testing (Vitest)**).

## Validation, quality gates & monitoring (REV021)

### Fund source name rule — minimum 3 characters

Fund source names are validated in two layers and both enforce the same rule:

- UI (`src/routes/settings.tsx`): `minLength=3`, `maxLength=24`, inline `role="alert"` error, `aria-invalid` / `aria-errormessage` wiring.
- Store (`src/lib/app-store.tsx` → `addWallet` / `renameWallet`): the name is trimmed and whitespace-collapsed, then rejected when it is shorter than 3 or longer than 24 characters, or when it duplicates an existing name in the same type + provider.

So `"Ka"` and `"  Ab  "` are rejected, `"Kas"` is accepted.

### API error handling for saving a fund source

`src/lib/wallet-api.ts` is the persistence seam (`persistWallet`, `WalletApiError` with an HTTP `status`). When the commit fails:

1. the optimistic row is rolled back (no phantom fund source),
2. a clear toast is shown (`Gagal menyimpan sumber dana. Coba lagi.` + hint that the input was kept),
3. the typed name stays in the form and focus returns to the field so the user can retry with one click,
4. a severity-tagged Sentry issue is created.

### Scripts

```sh
bun run typecheck   # tsc --noEmit (zero errors required)
bun run test        # Vitest: unit, flow and visual-contract suites
bun run lint        # ESLint incl. jsx-a11y
bun run build       # production build
bun run smoke       # smoke test against the production build (scripts/smoke.mjs)
```

Suites added in REV021:

- `src/tests/fund-source-add-flow.test.tsx` — end-to-end add flow, 3-character rule, live search filtering.
- `src/tests/fund-source-api-error.test.tsx` — API failure: toast, rollback, preserved input, focus recovery, Sentry severity mapping.
- `src/tests/visual-regression.test.tsx` — layout contract snapshots for the delete dialog and the Undo toast (container classes, element sizes, focus position). Update intentional changes with `bunx vitest run -u`.

Suites added in REV026:

- `src/tests/fund-source-reload-recovery.test.tsx` — E2E: load failure → "Muat ulang daftar" → successful refetch renders the real list; the empty state is never shown, and focus stays inside the sheet (on the retry button when the reload fails again).
- `src/tests/toast-a11y.test.tsx` — error toasts never steal focus on appear, expose a keyboard-reachable close button, return focus to the trigger on dismiss/auto-close, and leave focus untouched when the user already moved on.
- `src/tests/toast-focus-sequence.test.tsx` — regression for several error/success toasts raised in sequence: focus stays on the triggering control, is never parked on a removed toast node while stacked toasts are closed one by one, is not stolen when the user moved elsewhere, and axe reports no violations with multiple toasts visible.
- `src/tests/toast-close-keyboard.test.tsx` — E2E keyboard: the toast close button is focusable (no positive `tabindex`) and closes with Enter or Space, focus returns to the trigger, Tab continues normally afterwards; `Alt+T` reveals the toast region on demand, focus returns correctly after closing, and pressing it with no toast visible changes nothing.

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request (and pushes to `main`): install → lint → typecheck → unit tests → E2E flow suites → axe-core accessibility suites → production build. Each layer is a separate step, so a failing PR shows immediately whether the regression is functional or accessibility-related.

### Toast accessibility

`src/lib/toast-a11y.ts` wraps sonner (`toastError` / `toastSuccess` / `toastInfo`): it records the focused element when a toast is raised and restores focus **only** if focus was actually lost (`<body>` or a detached node) after dismiss/auto-close. The toaster (`src/components/ui/sonner.tsx`) ships a close button on every toast and an `Alt+T` hotkey to jump into the toast region on demand — focus is never moved automatically, so keyboard navigation is not disrupted.

### CI workflow

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: install → lint → typecheck → test → build → smoke. Any failing step blocks the merge.

### Enabling Sentry

Monitoring (`src/lib/monitoring.ts`) is inert until a DSN is configured. Set these environment variables (e.g. in `.env`):

```sh
VITE_SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project>
VITE_SENTRY_ENV=production      # optional, defaults to the Vite mode
VITE_APP_RELEASE=rev021         # optional, used for release health
```

Behaviour once enabled:

- `initMonitoring()` boots Sentry in the browser only, with PII scrubbing (`beforeSend`) so no financial data leaves the device.
- `captureApiError(error, { operation, status })` creates one stable issue per operation + status (fingerprint `["api", operation, status]`) and tags `api.operation`, `api.status`, `api.severity`.
- Severity routing (`severityForStatus`): `4xx → warning`, `5xx → error`, unknown/transport → `fatal`. Configure Sentry alert rules on `level` or the `api.severity` tag (e.g. page on `fatal`, alert on `error`, digest `warning`).

## A11y tests (REV022)

- `src/tests/a11y.test.tsx` — axe-core scan (`axe-core`, jsdom) on the Sumber Dana sheet and the delete/undo flow: no serious/critical violations, `role="dialog"`/`aria-modal`, focus-trap, `aria-live` status announcements.
- `src/tests/undo-after-api-error.test.tsx` — failure → retry → delete → undo cycle keeps the typed input and focus correct.
- Run only the accessibility layer:

```sh
bunx vitest run src/tests/a11y.test.tsx
bunx vitest run src/tests/undo-after-api-error.test.tsx
```

ESLint (`bun run lint`) also enforces `eslint-plugin-jsx-a11y`, so A11y regressions fail CI before the tests run.

## Sentry source map upload (CI env)

`@sentry/vite-plugin` uploads source maps during `bun run build` when all three variables are present; without them the build simply skips the upload.

```sh
SENTRY_AUTH_TOKEN=sntrys_...   # token with project:releases + org:read scope (secret)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

Add them as GitHub repository secrets (Settings → Secrets and variables → Actions) and expose them to the build step in `.github/workflows/ci.yml`. Never commit the token; rotate it if it leaks.

## Reading the snapshot artifact in a PR

Every pull-request run uploads `visual-regression-<PR number>` with `if: always()`, so it exists even when the test step fails.

1. Open the PR → **Checks** → job **verify**.
2. Scroll to **Artifacts** and download `visual-regression-<PR number>`.
3. It contains `src/tests/__snapshots__/**` (committed layout contracts) and `test-report/vitest-report.json` (the Vitest diff report — failed assertions include the expected/received snapshot diff).
4. If the diff is an intentional design change, run `bunx vitest run -u` locally and commit the updated snapshot; otherwise fix the component.

## Fund source filters (Sumber Dana)

- `src/lib/fund-source-filter.ts` holds pure helpers: `filterWallets`, `matchesFilters`, and `sanitizeFilters`.
- Invariant: a persisted filter never hides fund sources. On hydration, a stored type filter that matches no wallet is reset to `all`, and a stored query with zero matches is cleared. The sanitizer is idempotent, so no one-shot ref is needed.
- Filters changed by the user in the current session are respected as-is (an intentional "no results" empty state still shows).
- The Reset filter button clears `tmab-fund-source-query` / `tmab-fund-source-type` from localStorage and announces the reset via an `aria-live="polite"` summary (`fund-source-filter-reset-notice`).
- Tests: `src/tests/fund-source-filter.test.ts` (unit) and `src/tests/fund-source-persisted-filter.test.tsx` (integration/E2E: stale `cash` filter with `bank` wallets, reset + focus, API error path).

## Fund source identity (Sumber Dana)

- Wallet ids come from `createWalletId()` (`crypto.randomUUID` with a counter
  fallback). `Date.now()` alone collided within one millisecond, which made a
  second row (BRI) overwrite the first (BCA) because they shared a React key.
- List rows are keyed by `w.id` only — never by name, type, or provider.
- Restored state passes through `dedupeWallets()`: malformed rows are dropped and
  ids are made unique, so distinct fund sources are never merged.
- Persisted filters are validated on load by `sanitizeFilters()`: a stored type
  filter that matches no wallet falls back to `all`, so the list can never render
  an empty state while real fund sources exist.
- Regression coverage: `src/tests/fund-source-identity.test.tsx`.

## Kategori Transaksi — filter & pencarian

Sheet **Pengaturan → Kategori Transaksi** kini memakai kontrak filter yang sama
dengan Sumber Dana:

- `category-search` (pencarian nama), `category-filter-type` (Semua/Pemasukan/
  Pengeluaran), `category-sort`, dan `category-reset-filter`.
- `category-filter-summary` menampilkan `ditampilkan/total` ketika ada baris
  yang tersembunyi oleh filter.
- Empty state `category-empty` membedakan "belum ada kategori" dari "tidak ada
  hasil filter" dan menawarkan tombol reset.

**Perbaikan bug "3 kategori, hanya 2 tampil":** filter jenis tersimpan
(`tmab-category-type`) menyembunyikan kategori tanpa kontrol yang terlihat.
Sekarang filter dirender, dan nilai tersimpan yang menyembunyikan seluruh data
disanitasi kembali ke `all` (`sanitizeFilters`) dengan notifikasi
`category-filter-reset-notice`.

## CI artefak laporan

`.github/workflows/ci.yml` menjalankan unit, E2E, dan axe-core secara terpisah
dengan reporter JUnit + HTML ke `reports/`, lalu mengunggahnya sebagai artefak
`test-reports-*` pada setiap PR dan menerbitkan ringkasan JUnit sebagai check.

### Kategori Transaksi — daftar & filter

- Daftar kategori tampil **penuh** secara default. Pilihan `Tampilkan semua (N)` /
  `Sembunyikan` disimpan (`tmab-category-expanded`) sehingga tetap konsisten saat
  berpindah halaman atau reload. Saat diringkas, notice `3/5`
  (`category-collapsed-notice`) selalu menyatakan berapa baris yang disembunyikan —
  ini menutup bug "filter Semua Jenis (5) tapi hanya 3 baris tampil".
- E2E memakai helper `activate()` (`e2e/fixtures.ts`): klik pointer dulu, lalu
  fallback ke focus + Enter khusus untuk timeout/intercept bottom nav. Kegagalan
  lain tetap dilempar sehingga trace, screenshot, dan video terunggah CI.
- Baseline visual kategori: `category-list-expanded`, `category-list-collapsed`,
  `category-list-income`, `category-list-empty`, `category-filled-state`,
  `category-empty-state`, `category-empty-filter`. Perbarui dengan `bun run e2e:update`.

## Suites added in REV031

Unit (Vitest):

- `src/tests/category-filter-a11y.test.tsx` — ARIA contract for the Kategori Transaksi filter bar (role + accessible name for Cari / Jenis / Urutkan, per-Jenis counts on each option, `aria-expanded` / `aria-controls` on "Tampilkan semua (N)", polite hidden-row notice) and the Tab / Shift+Tab focus order, including the reset button and keyboard activation of the collapse toggle.
- `src/tests/category-visual-regression.test.tsx` — layout contract snapshots for the category list: fully populated (expanded), collapsed preview with the highlighted show-all control, and the active Jenis selection highlight. Update intentional changes with `bunx vitest run -u`.

E2E (Playwright):

- `e2e/category-filter-state-persistence.spec.ts` — the collapsed/expanded state and the "Tampilkan semua (N)" label stay consistent after a hard reload and after visiting a detail page and pressing Back; an active Jenis filter still overrides the stored collapse and restores it on reset.
- `e2e/category-visual-states.spec.ts` — extended with `category-list-filled-active` and `category-list-collapsed-active` baselines (active selection highlighted). Refresh baselines with `bun run e2e:update`.

Fix shipped with these tests: `src/hooks/use-modal-a11y.ts` no longer relies on `offsetParent` to detect hidden nodes, so the modal focus trap enumerates every focusable control (previously it collapsed to a single node in layout-less environments, making Tab appear stuck).

Verification: `bunx tsc --noEmit`, `bun run lint`, `bunx vitest run` (114 tests) and `bunx playwright test` (31 tests) all pass; no stale expectation such as the old "2/5 · Reset filter" text remains.

## CI and snapshot tolerance (REV031)

`.github/workflows/ci.yml` runs on every push and pull request (plus manual dispatch) and executes, in order: `bun run lint`, `bunx tsc --noEmit`, `bunx vitest run`, `bunx playwright test`. Traces, screenshots, videos and the current baselines are uploaded as artifacts on every run.

Snapshot update scripts:

```bash
bun run test:update         # vitest structural snapshots (vitest run -u)
bun run e2e:update          # all Playwright baselines
bun run e2e:update:visual   # only the Kategori Transaksi visual baselines
```

Visual tolerance policy (`playwright.config.ts` + `e2e/screenshot.css`): fonts are pinned to a system stack and text rendering, ligatures, kerning, animations, transitions and the caret are frozen, so cross-machine glyph rasterisation no longer moves pixels. On top of that, `threshold: 0.15` with `maxDiffPixelRatio: 0.015` absorbs anti-aliased edges only — a changed highlight color, ring or fill repaints a whole control and still fails, so active-selection accuracy is unchanged.

Edge-case suites added:

- `src/tests/category-filter-edge-cases.test.tsx` — no Jenis selected (no reset control, self-consistent collapse state), empty category list (empty state, no reset/summary/show-all, filters still focusable), filter that matches nothing, and rapid successive filter changes where focus stays on the changed control and the Tab order stays identical.
- `e2e/category-filter-edge-cases.spec.ts` — the same edge cases in the browser, including a regression guard that exactly one "Reset filter" control is ever rendered.

Duplicate removed: the category filter summary row rendered a second "Reset filter" button next to the toolbar one. The row is now a pure `role="status"` count (`N/M`); the single reset lives in the filter toolbar (`category-reset-filter`). Recommendation kept the toolbar button because it sits in the natural Tab order right after the filter controls and is present for every active filter, not only when rows are hidden. A review of the other screens found no further duplicated actions — `wallet-filter-reset` (Sumber Dana) and `tx-reset-button` (Semua Transaksi) are single controls on separate surfaces.

## REV032 — Tagihan Bulanan, focus/hover baselines, axe & CI cache

Feature:

- `src/lib/billing.ts` — pure billing domain: integer Rupiah math (`computeTotals` applies the discount first, then tax, and clamps to `>= 0`), strict draft validation (`parseBillDraft`), phone normalisation to `62…`, recurring roll-forward (`nextDueDate`, clamping 31 Jan → 28/29 Feb), status derivation and the deterministic WhatsApp reminder text/deep link.
- `src/lib/app-store.tsx` — `bills` + `billingProfile` state, add/update/delete/`markPaid` (recurring bills roll to the next due date instead of being archived), persisted to `localStorage` behind the same sanitising loaders as the rest of the store.
- `src/components/BillingSheet.tsx` — management sheet: amount, due date, recurring interval, tax %, percent/fixed discount, live totals breakdown, focusable summary items (Tagihan / Belum lunas / Terlambat), invoice template + branding (business name, logo text, brand colour, footer note) with a live preview, and a WhatsApp reminder action per bill.
- `src/routes/settings.tsx` — “Tagihan Bulanan” entry point in the Data group with an unpaid-count status label.

Tests:

- `src/tests/billing.test.ts` — 17 unit tests covering discount/tax ordering, clamping, `NaN` inputs, validation rejections, persisted-row sanitising, the recurring calendar and the reminder link.
- `e2e/category-focus-hover-visuals.spec.ts` — focus **and** hover baselines for the active Jenis filter, the first row of an active filter, the collapse toggle ring, and the billing summary item.
- `e2e/category-filter-axe.spec.ts` — axe audits for the filter controls, the no-results and empty states, plus Tab / Shift+Tab focus-order assertions.
- `e2e/billing-a11y.spec.ts` — axe audits for the billing sheet (including the branding panel) and its Tab order.

Config:

- `playwright.config.ts` — `retries: 2` on CI / `1` locally, `trace: "retain-on-failure"`, and a tighter `maxDiffPixelRatio: 0.005` so a lost focus ring fails.
- `e2e/fixtures.ts` — console logs, page errors and failed requests are attached to the report for failed attempts only.
- `.github/workflows/ci.yml` — `actions/cache` for `~/.bun/install/cache` + `node_modules` keyed on `bun.lock` (with restore-keys), and a separate cache for `~/.cache/ms-playwright`; `bun install --frozen-lockfile` still reconciles the tree, so caching cannot change results.

Note: the four new visual baselines are generated on the first `bun run e2e:update` run (this sandbox has no browser libraries, so they are not committed yet).

## REV034 — WhatsApp deep link validation, focus restoration & visual baselines

### WhatsApp reminder deep link — validation contract

`src/lib/billing.ts` builds and gates every reminder URL. No link ever reaches
`window.open`/`href` without passing both stages:

1. `buildReminderMessage(bill, profile, today)` — deterministic Indonesian text
   (fixed formatting, no locale surprises).
2. `sanitizeReminderText(text)` — normalises `\r\n`/`\r` to `\n`, strips control
   characters, `\u007f-\u009f`, zero-width and bidi overrides
   (`\u200b-\u200f`, `\u2028`, `\u2029`, `\u202a-\u202e`, `\ufeff`), trims
   trailing spaces before newlines, collapses 3+ blank lines to one, and caps
   the result at `WHATSAPP_TEXT_LIMIT` (4000 chars) with a trailing `…`.
3. `buildWhatsAppLink(...)` — percent-encodes the sanitised text with
   `encodeURIComponent` and emits `https://wa.me/<phone>?text=…`, or
   `https://wa.me/?text=…` when no valid recipient exists.
4. `validateWhatsAppLink(link)` — format gate returning
   `{ ok: true, phone, text }` or `{ ok: false, reason }` with reasons:

   | reason | rejected when |
   | --- | --- |
   | `malformed` | not a string, empty, unparseable, or contains whitespace / `< > " ' \` \\` |
   | `protocol` | scheme is not `https:` |
   | `host` | hostname is not `wa.me` |
   | `phone` | path is present but not 8–15 digits (normalised `62…` form) |
   | `text` | `text` param missing or blank |
   | `length` | `text` exceeds `WHATSAPP_TEXT_LIMIT` |

### Special-character encoding rules

- The full message is encoded once with `encodeURIComponent`, so `&`, `#`, `+`,
  `=`, `?`, `/`, spaces, newlines and emoji cannot break out of the query
  parameter. Never concatenate an already-encoded string a second time.
- Newlines are emitted as `%0A`; `+` stays `%2B` (never a literal `+`, which
  WhatsApp would render as a space).
- The phone segment is digits only (`^\d{8,15}$`), normalised to the
  international `62…` prefix; `+`, spaces and dashes are stripped before use.
- Currency and totals are pre-formatted integers (Rupiah), so no locale
  separator can inject a stray `#` or `&`.

### Visual regression baselines — BillingCalendar / BillingSheet

- Baselines live in `e2e/__screenshots__/<spec>-snapshots/`, pinned by
  `e2e/screenshot.css` (fixed fonts, animations and carets frozen).
- Tolerance policy from `playwright.config.ts`: `threshold` stays low so a lost
  focus ring or changed highlight fails, with `maxDiffPixelRatio: 0.005` for
  anti-aliasing noise only.
- Required shots: BillingSheet default/branding panel, BillingCalendar month
  grid (empty + populated), the selected-day highlight, the keyboard focus ring
  on a day button, and the open due-date popover with its active day.
- Seed data must come from the `EMPTY_STATE`/seed fixtures and a fixed `today`
  so month labels and dot markers are deterministic.
- Regenerate intentionally only, with `bun run e2e:update`, and review the diff
  image in the PR artifact before committing a new baseline.

### Focus restoration (no `requestAnimationFrame`)

- `BillingCalendar` marks a keyboard move with a ref and refocuses the new
  `[data-day="selected"]` button inside `useLayoutEffect`, i.e. synchronously
  after React commits — arrow-key navigation never races a frame.
- `DueDatePicker` closes through the same layout effect: it focuses the active
  day when open and returns focus to `billing-due-date-toggle` when it closes.
- The popover carries `data-escape-scope`; `useModalA11y` skips its document
  capture handler for that subtree so Escape dismisses only the popover and
  keeps the parent sheet open.
- `e2e/billing-calendar-a11y.spec.ts` asserts with `expect(locator).toBeFocused()`
  and `expect.poll(document.activeElement)` instead of timing assumptions.

## REV035 — Focus helpers, month-transition e2e, deep-link builder tests & baseline policy

### Shared e2e focus helper (`e2e/focus-helpers.ts`)

Every focus-sensitive spec waits on committed DOM state, never on
`requestAnimationFrame` or `waitForTimeout`:

| helper | guarantees before returning |
| --- | --- |
| `activeTestId(page)` | reads `document.activeElement`'s `data-testid` (`""` on `<body>`) |
| `expectActiveTestId(page, id)` | polls until focus really is on that element |
| `expectFocusWithin(locator)` | polls until focus is inside the container |
| `openPopover(page, open, popover)` | popover visible **and** owns focus |
| `closePopover(page, close, popover, restoreTo)` | popover hidden **and** focus restored to the trigger |
| `pressAndExpectGridFocus(...)` | key pressed, new day focused, still exactly one tab stop |

Use these instead of ad-hoc `expect(...).toBeFocused()` chains so new specs
inherit the same anti-flake contract.

### Month-transition focus coverage

`e2e/billing-calendar-focus.spec.ts` walks BillingCalendar across month
boundaries and asserts focus restoration after **every** change:

- `PageDown`/`PageUp` — month label changes, focused day survives the remount.
- `End` → `ArrowRight` (roll forward) and `Home` → `ArrowLeft` (roll backward),
  each verified to return to the exact original day when reversed.
- `ArrowDown`/`ArrowUp` weeks spilling into the neighbouring month.

### DueDatePicker focus trap

The popover is a `role="dialog" aria-modal="true"` region with a real focus
trap: `Tab`/`Shift+Tab` cycle only through its own controls (prev month, next
month, the roving active day), and `Escape` is scoped through
`data-escape-scope` so it dismisses the popover and returns focus to
`billing-due-date-toggle` while the parent BillingSheet stays open. A second
`Escape` — now outside the scope — closes the sheet.
`e2e/due-date-picker-a11y.spec.ts` asserts the cycle, the scoping and runs axe
against the open popover.

### WhatsApp deep-link builder unit tests

`src/tests/whatsapp-deep-link-builder.test.ts` pins the builder as a URL:

- exact percent-encoding for ` `, `&`, `#`, `+`, `=`, `?`, `/`, `%`;
- `buildWhatsAppLink` additionally encodes `'`, `!`, `(`, `)`, `*`, which
  `encodeURIComponent` leaves literal — otherwise a bill name with an
  apostrophe would fail the strict format gate;
- no whitespace or `" ' < > \` \\` ever appears in the emitted link;
- rejection reasons (`malformed`, `protocol`, `host`, `phone`, `text`,
  `length`) for malformed URLs, wrong schemes, look-alike hosts and non-string
  input;
- hostile field content (bidi overrides, NUL, embedded URLs, 8k notes) still
  produces a link that passes `validateWhatsAppLink`.

### Visual regression baselines — enforced thresholds

Enforced globally in `playwright.config.ts > expect.toHaveScreenshot`:

| setting | value | why |
| --- | --- | --- |
| `threshold` | `0.1` | per-pixel YIQ distance; a recoloured highlight/ring fails |
| `maxDiffPixelRatio` | `0.005` | absorbs anti-aliased edges only (0.5% of pixels) |
| `animations` | `disabled` | no mid-transition frames |
| `caret` | `hide` | text carets never blink into a shot |
| `scale` | `css` | DPR-independent output |
| `stylePath` | `e2e/screenshot.css` | pinned font stack, no ligature/kerning drift |

Required BillingCalendar / BillingSheet baselines: sheet default state, sheet
branding panel, calendar grid empty, calendar grid populated, selected-day
highlight, keyboard focus ring on a day button, open due-date popover with its
active day. All must be seeded from the `EMPTY_STATE`/`FILLED_STATE` fixtures
with a fixed `today` so labels and dot markers are deterministic.

Updating a baseline after an **intentional** UI change:

1. Land the UI change and confirm the diff is intended.
2. `bun run e2e:update:billing` (only the billing baselines) or
   `bun run e2e:update` (all).
3. Open the `visual-regression-<PR number>` artifact and review each `-diff.png`
   — a diff that touches controls you did not change means the change is not
   intentional; fix the code, not the baseline.
4. Commit the regenerated `-actual`→baseline PNGs in the same PR as the UI
   change, and note in the PR description which baselines moved and why.

Never lower `threshold`/`maxDiffPixelRatio` or add `--update-snapshots` to CI to
make a red baseline pass.
