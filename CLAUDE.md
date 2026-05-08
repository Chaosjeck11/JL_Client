# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, HMR)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Preview production build
```

No test framework is configured yet.

## Dependencies

**Runtime (`dependencies`):**
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.0 | UI framework |
| `react-dom` | ^19.2.0 | DOM renderer |
| `jspdf` | ^4.2.1 | PDF generation (Report-Export) |
| `jspdf-autotable` | ^5.0.7 | Table plugin for jsPDF |
| `xlsx` | ^0.18.5 | Excel/CSV parsing (Buchungs-Import) |

**Dev (`devDependencies`):** TypeScript ~5.9, ESLint 9, Vite (rolldown-vite 7), `@types/react`, `@types/react-dom`, `@types/node`.

`jspdf` and `jspdf-autotable` are loaded via **dynamic import** inside `ReportModal` and `MemberExportModal` to keep the initial bundle lean. `xlsx` is loaded via **dynamic import** inside `ImportModal`.

## Architecture

This is a React 19 + TypeScript SPA using Vite (rolldown-vite). No router library — navigation is handled with state in `App.tsx`.

**Auth flow:**
- `App.tsx` holds `loggedIn` (boolean) and `activeTab` ("members" | "finance") as the only global state.
- JWT is stored in `localStorage` via `src/auth/auth.ts`. `getCurrentUser()` in `src/auth/currentUser.ts` decodes it client-side to read `sub`, `email`, `accessLevel`, `role` without an extra API call.
- Permission checks in `src/auth/permissions.ts` gate UI elements based on `accessLevel >= 5`:
  - `canEditMembers()`, `canCreateMembers()` — member management
  - `canManageFinance()` — finance admin actions (add year, manage categories)

**API layer:**
- All requests go through `src/api/client.ts` → `apiFetch()`, which reads the token from `localStorage` and attaches `Authorization: Bearer`.
- Backend base URL is hardcoded: `http://100.91.210.125:3000`.
- `src/api/members.ts` — `/members` endpoints (list, PATCH, POST).
- `src/api/finance.ts` — `/finance/*` endpoints: categories, business years, transactions, running balance.

**Types:**
- `src/types/member.ts` — `Member`. The JWT payload shape is defined locally in `currentUser.ts` as `JwtPayload`.
- `src/types/finance.ts` — `TransactionType`, `PaymentTag`, `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`.

**Screens (`src/screens/`):**
- `Login` — credential form, calls `auth.login()`, notifies parent via `onSuccess`.
- `ProfileModal` — overlay modal opened by the avatar button (top-right nav, all logged-in users). Edits own profile fields. Includes a **"Passwort ändern"** section: two password inputs (new + confirm), `password` sent in PATCH body only when filled and matching (min 6 chars). Backend `PATCH /members/:id` requires `accessLevel >= 5` — non-admin saves will be rejected by the API.
- `Members` — split-pane layout: member table (left) + detail/create panel (right). Manages its own list state and selected member. Toolbar: **"Export"** button (all users) opens `MemberExportModal`; **"+ Neues Mitglied"** (admin only).
- `MemberDetail` — inline edit form for a single member; only shown when `canEditMembers()`. If any beitragsrelevante field (`u18`, `bereitsMitglied`, `schuelerStudentAzubi`) changed, saving triggers a two-step flow: business years are fetched and shown as checkboxes (all pre-selected); the user picks which years to update retroactively; the PATCH is sent with `retroactiveYearIds: number[]` containing only the selected IDs. If no beitragsrelevante field changed, the PATCH goes out immediately without that field. Includes a **"Passwort ändern"** section (two password inputs, new + confirm); `password` is included in the PATCH body only when the field is filled and both inputs match (min 6 chars). State is cleared on cancel and after successful save.
- `MemberCreate` — create form; `roleId` is hardcoded to `1` for now. Includes a `joinedAt` date picker (defaults to today) that is passed as an ISO string to `POST /members`.
- `Finance` — split-pane layout: Kassenbuch table (left) + detail/form panel (right).
  - Left: year dropdown (descending), three summary badges (Übertrag/Einnahmen/Kontostand from `fetchBusinessYear`), running-balance table with a „Zahlung" column (tag: Online/Bar) that is filterable via dropdown, summary footer row.
  - Right panel switches between: `BusinessYearForm`, `TransactionCreate`, `TransactionDetail`, or placeholder text.
  - Toolbar buttons: "Kategorien" (admin), "Rückbuchungen", **"Report"** (all users), **"Import"** (admin), "+ Neue Buchung" (admin).
  - "Kategorien verwalten" toggle (admin only) opens `CategoryManager` inline below the header.
  - "+ Jahr" button (admin only) next to the year dropdown opens `BusinessYearForm` in the right panel.
- `TransactionCreate` — create form for a new transaction (used by `Finance`). `tag` (`ONLINE` | `BAR`) is required; defaults to `ONLINE`.
- `TransactionDetail` — detail/edit view for a selected transaction; supports editing date, description, category, tag and deleting. Existing transactions without a tag default to `ONLINE` in the edit form.

**Members sub-screens (`src/screens/members/`):**
- `MemberExportModal` — overlay modal for exporting the member list. Fields are selectable in three groups (Stammdaten, Mitgliedschaft, Beitragsinfos) with group-level checkboxes and Alle/Keine shortcuts. Beitragskategorie is a computed field ("Reduziert (35 €)" if u18 || bereitsMitglied || schuelerStudentAzubi, else "Voll (100 €)"). Status filter: Alle/Aktiv/Inaktiv with live member count. Format: CSV (semicolon-delimited, UTF-8 BOM) or PDF (portrait/landscape depending on column count, via jsPDF + AutoTable). Libraries loaded via dynamic import. Accessible to all logged-in users.

**Finance sub-screens (`src/screens/finance/`):**
- `TransactionForm` — richer create form with segmented-control type selector and conditional `relatedTransactionId` field for `RUECKBUCHUNG`; not yet wired into `Finance.tsx` (replaces `TransactionCreate` when integrated).
- `CategoryManager` — admin panel: lists categories with per-row delete, inline create form at the bottom; calls `onCategoriesChanged` after mutations so the parent keeps its category list in sync.
- `BusinessYearForm` — simple form to create a new business year; default year is current year + 1; shows hint that carry-over is calculated automatically.
- `ReportModal` — overlay modal for generating finance reports. Filters: Geschäftsjahr(e) (multi-select), Kategorien (multi-select, empty = all), Rückbuchungen toggle, Tag (ONLINE/BAR/kein Tag, empty = all). Format: CSV (semicolon-delimited, UTF-8 BOM, Excel-kompatibel) or PDF (landscape, via jsPDF + AutoTable with summary footer). Accessible to all logged-in users. Libraries loaded via dynamic import.
- `ImportModal` — overlay modal for bulk-importing transactions from `.xlsx` or `.csv`. CSV delimiter is semicolon. Columns: `Datum;Beschreibung;Kategorie;Tag;Typ;Betrag` (same template as CSV export, `Kontostand` column is ignored if present). Datum format: `DD.MM.YYYY`. Geschäftsjahr is auto-detected from date (month ≥ 2 → year Y, month = 1 → year Y−1). `RUECKBUCHUNG` rows are rejected with an error. Shows a preview table with per-row validation before importing. "Vorlage (.csv)" button downloads an example file. Admin only.


## Backend reference

Full backend docs (data model, all routes, business logic):
@../JL_Backend/CLAUDE.md   ← Claude Code löst diesen Pfad automatisch auf

### Quick-reference: API base URL
`http://100.91.210.125:3000`  (hardcoded in `src/api/client.ts`)

### Available endpoints (summary)

| Resource | Base path |
|---|---|
| Auth | `POST /auth/login` |
| Members | `/members` |
| Business Years | `/finance/business-years` |
| Categories | `/finance/categories` |
| Transactions | `/finance/transactions` |
| Running balance | `GET /finance/transactions/balance/:businessYearId` |
| Mitgliedsbeiträge | `/finance/mitgliedsbeitraege` |

### Key constraints Claude Code must respect
- Access level `0` = any authenticated user (GET routes)
- Access level `5` = admin (POST / PATCH / DELETE); `PATCH /members/:id` (including password change) therefore only works for admins
- `type` and `amount` on Transactions are **immutable** after creation
- `tag` (`ONLINE` | `BAR`) is required on every Transaction; the frontend enforces this on create and defaults to `ONLINE` in the edit form
- `RUECKBUCHUNG` requires `relatedTransactionId`; the related tx must not itself be a `RUECKBUCHUNG`
- Deleting a Transaction fails if reversals exist
- Deleting a BusinessYear fails if transactions exist
- Deleting a Category fails if transactions are assigned

### TypeScript types live in
- `src/types/member.ts` → `Member`
- `src/types/finance.ts` → `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`, `TransactionType`, `PaymentTag`

### API client pattern
All requests go through `src/api/client.ts → apiFetch()`.
New endpoints → add a function to `src/api/members.ts` or `src/api/finance.ts`.
Never call `fetch()` directly from components.
