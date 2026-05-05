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
- `src/types/finance.ts` — `TransactionType`, `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`.

**Screens (`src/screens/`):**
- `Login` — credential form, calls `auth.login()`, notifies parent via `onSuccess`.
- `Members` — split-pane layout: member table (left) + detail/create panel (right). Manages its own list state and selected member.
- `MemberDetail` — inline edit form for a single member; only shown when `canEditMembers()`.
- `MemberCreate` — create form; `roleId` is hardcoded to `1` for now.
- `Finance` — split-pane layout: Kassenbuch table (left) + detail/form panel (right).
  - Left: year dropdown (descending), three summary badges (Übertrag/Einnahmen/Kontostand from `fetchBusinessYear`), running-balance table, summary footer row.
  - Right panel switches between: `BusinessYearForm`, `TransactionCreate`, `TransactionDetail`, or placeholder text.
  - "Kategorien verwalten" toggle (admin only) opens `CategoryManager` inline below the header.
  - "+ Jahr" button (admin only) next to the year dropdown opens `BusinessYearForm` in the right panel.
- `TransactionCreate` — create form for a new transaction (used by `Finance`).
- `TransactionDetail` — detail/edit view for a selected transaction; supports editing date, description, category and deleting.

**Finance sub-screens (`src/screens/finance/`):**
- `TransactionForm` — richer create form with segmented-control type selector and conditional `relatedTransactionId` field for `RUECKBUCHUNG`; not yet wired into `Finance.tsx` (replaces `TransactionCreate` when integrated).
- `CategoryManager` — admin panel: lists categories with per-row delete, inline create form at the bottom; calls `onCategoriesChanged` after mutations so the parent keeps its category list in sync.
- `BusinessYearForm` — simple form to create a new business year; default year is current year + 1; shows hint that carry-over is calculated automatically.


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
- Access level `5` = admin (POST / PATCH / DELETE)
- `type` and `amount` on Transactions are **immutable** after creation
- `RUECKBUCHUNG` requires `relatedTransactionId`; the related tx must not itself be a `RUECKBUCHUNG`
- Deleting a Transaction fails if reversals exist
- Deleting a BusinessYear fails if transactions exist
- Deleting a Category fails if transactions are assigned

### TypeScript types live in
- `src/types/member.ts` → `Member`
- `src/types/finance.ts` → `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`, `TransactionType`

### API client pattern
All requests go through `src/api/client.ts → apiFetch()`.
New endpoints → add a function to `src/api/members.ts` or `src/api/finance.ts`.
Never call `fetch()` directly from components.
