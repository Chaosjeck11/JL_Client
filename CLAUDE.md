# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Maintenance
After significant changes to the codebase, update this CLAUDE.md 
to reflect new architecture, added services, or changed conventions.


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
| `@tanstack/react-query` | ^5.100.9 | Server-state / data-fetching cache |
| `jspdf` | ^4.2.1 | PDF generation (Report-Export) |
| `jspdf-autotable` | ^5.0.7 | Table plugin for jsPDF |
| `pdf-lib` | ^1.17.1 | PDF merging — copies pages from attachment PDFs into the report, embeds images full-page (Report-Export with Anhänge) |
| `xlsx` | ^0.18.5 | Excel/CSV parsing (Buchungs-Import) |

**Dev (`devDependencies`):** TypeScript ~5.9, ESLint 9, Vite (rolldown-vite 7), `@types/react`, `@types/react-dom`, `@types/node`.

`jspdf`, `jspdf-autotable`, and `pdf-lib` are loaded via **dynamic import** inside `ReportModal` and `MemberExportModal` to keep the initial bundle lean. `xlsx` is loaded via **dynamic import** inside `ImportModal`.

## Architecture

This is a React 19 + TypeScript SPA using Vite (rolldown-vite). No router library — navigation is handled with state in `App.tsx`.

**Data fetching — TanStack Query:**
- `QueryClient` is created in `main.tsx` and wraps the whole app via `QueryClientProvider`.
- Defaults: `staleTime: 20_000`, `refetchInterval: 20_000`, `refetchIntervalInBackground: false`, `retry: 1`. Data auto-refreshes every 20 s while the tab is active.
- **All server data is fetched via `useQuery`.** Never add `useEffect` + `useState` for data loading — use `useQuery` instead.
- **After every create/update/delete, call `queryClient.invalidateQueries({ queryKey: [...] })`.** Never patch state manually.
- Query key conventions:
  - `['members']` / `['members', memberId]`
  - `['roles']`
  - `['business-years']` / `['business-years', yearId]`
  - `['categories']`
  - `['running-balance', yearId]`
  - `['mitgliedsbeitraege', { businessYearId }]`
  - `['files']` / `['files-folders']`
  - `['transaction-attachments', transactionId]`
  - `['member-attachments', memberId]`
- Exceptions (still use `useEffect`): blob URL lifecycle with cancellation tokens, event listeners, UI-state reactions (not data fetching).

**Auth flow:**
- `App.tsx` holds `loggedIn` (boolean) and `activeTab` ("members" | "finance" | "beitraege" | "files") as the only global state. On logout, `queryClient.clear()` wipes the cache.
- JWT is stored in `localStorage` via `src/auth/auth.ts`. `getCurrentUser()` in `src/auth/currentUser.ts` decodes it client-side to read `sub`, `email`, `accessLevel`, `role` without an extra API call.
- Permission checks in `src/auth/permissions.ts` gate UI elements based on `accessLevel >= 5`:
  - `canEditMembers()`, `canCreateMembers()` — member management
  - `canManageFinance()` — finance admin actions (add year, manage categories)

**API layer:**
- All requests go through `src/api/client.ts` → `apiFetch()`, which reads the token from `localStorage` and attaches `Authorization: Bearer`.
- Backend base URL is **user-configurable**: `getApiUrl()` (exported from `src/api/client.ts`) reads `localStorage('api_base_url')`, falling back to `http://100.91.210.125:3000`. The URL is saved to `localStorage` on login via the Server-Adresse field in `Login.tsx`. All API modules (`members.ts`, `finance.ts`, `files.ts`) and screens that build URLs directly (`App.tsx`, `Members.tsx`, `ProfileModal.tsx`, `MemberDetail.tsx`) import and call `getApiUrl()` — never hardcode the base URL.
- `src/api/members.ts` — `/members` endpoints (list, single, PATCH, POST, avatar upload/delete, member attachment CRUD). Avatar and attachment uploads use raw `fetch` with `FormData` (bypasses `apiFetch`). Member attachment functions: `fetchMemberAttachments`, `uploadMemberAttachment`, `downloadMemberAttachment`, `deleteMemberAttachment`, `fetchMemberAttachmentBlob`.
- `src/api/finance.ts` — `/finance/*` endpoints: categories, business years, transactions, running balance, mitgliedsbeitraege, transaction attachments (upload/download/delete/preview).
- `src/api/files.ts` — `/files` endpoints: `fetchFiles(path?)`, `fetchFolders()`, `uploadFile` (raw fetch/FormData), `downloadFile` (Blob → objectURL), `previewFile` (Blob → objectURL, inline), `updateFile`, `deleteFile`.

**Types:**
- `src/types/member.ts` — `Member`, `MemberAttachment`, `MemberBeitrag`, `Role`. The JWT payload shape is defined locally in `currentUser.ts` as `JwtPayload`.
- `src/types/finance.ts` — `TransactionType`, `PaymentTag`, `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`, `TransactionAttachment`, `Mitgliedsbeitrag`.
- `src/types/files.ts` — `AppFile`.

**Screens (`src/screens/`):**
- `Login` — redesigned card UI (dark gradient background, centered white card). Credential form + **"Server-Adresse"** field pre-filled from `localStorage('api_base_url')` (default `http://100.91.210.125:3000`). On submit saves the URL to localStorage before calling `auth.login()`, then notifies parent via `onSuccess`.
- `ProfileModal` — overlay modal opened by the avatar button (top-right nav, all logged-in users). Edits own profile fields. Includes a **"Passwort ändern"** section: two password inputs (new + confirm), `password` sent in PATCH body only when filled and matching (min 6 chars). Backend `PATCH /members/:id` requires `accessLevel >= 5` — non-admin saves will be rejected by the API. **Avatar upload/delete**: avatar circle is clickable → opens file picker; camera overlay on hover; "Löschen" button shown when avatar exists. Upload calls `uploadAvatar` (raw `fetch`/`FormData`). `onAvatarChanged` prop notifies `App.tsx` to update the nav avatar immediately without closing the modal.
- `Members` — split-pane layout: member table (left) + detail/create panel (right). Manages its own list state and selected member. Toolbar: **"Export"** button (all users) opens `MemberExportModal`; **"+ Neues Mitglied"** (admin only). Avatar shown in list row when `avatarPath` set; falls back to initials.
- `MemberDetail` — inline edit form for a single member; only shown when `canEditMembers()`. If any beitragsrelevante field (`u18`, `bereitsMitglied`, `schuelerStudentAzubi`) changed, saving triggers a two-step flow: business years are fetched and shown as checkboxes (all pre-selected); the user picks which years to update retroactively; the PATCH is sent with `retroactiveYearIds: number[]` containing only the selected IDs. If no beitragsrelevante field changed, the PATCH goes out immediately without that field. Includes a **"Passwort ändern"** section (two password inputs, new + confirm); `password` is included in the PATCH body only when the field is filled and both inputs match (min 6 chars). State is cleared on cancel and after successful save. Includes **"Anhänge"** section (view mode only): lists attachments with filename/size; single click opens `AttachmentViewer` side panel (click again to close); download button (↓) per row; admins can upload multiple files and delete attachments. Active attachment row highlighted blue.
- `MemberCreate` — create form; `roleId` is hardcoded to `1` for now. Includes a `joinedAt` date picker (defaults to today) that is passed as an ISO string to `POST /members`.
- `Finance` — split-pane layout: Kassenbuch table (left) + detail/form panel (right).
  - Left: year dropdown (descending), three summary badges (Übertrag/Einnahmen/Kontostand from `fetchBusinessYear`), running-balance table with a „Zahlung" column (tag: Online/Bar) that is filterable via dropdown, summary footer row.
  - Right panel switches between: `BusinessYearForm`, `TransactionCreate`, `TransactionDetail`, or placeholder text.
  - Toolbar buttons: "Kategorien" (admin), "Rückbuchungen", **"Report"** (all users), **"Import"** (admin), "+ Neue Buchung" (admin).
  - "Kategorien verwalten" toggle (admin only) opens `CategoryManager` inline below the header.
  - "+ Jahr" button (admin only) next to the year dropdown opens `BusinessYearForm` in the right panel.
- `TransactionCreate` — create form for a new transaction (used by `Finance`). `tag` (`ONLINE` | `BAR`) is required; defaults to `ONLINE`.
- `TransactionDetail` — detail/edit view for a selected transaction; supports editing date, description, category, tag and deleting. Existing transactions without a tag default to `ONLINE` in the edit form. Includes **"Anhänge"** section (always visible in detail view): single click on filename opens `AttachmentViewer` side panel (click again to close); active row highlighted blue; download button (↓) per row; admins can upload multiple files and delete attachments. Upload uses raw `fetch` with `FormData` (not `apiFetch`). Download fetches as Blob + object URL (auth header can't be sent via `<a href>`).

**Shared components (`src/components/`):**
- `AttachmentViewer` — generic side-panel file viewer (fixed right-edge panel, 600px wide, full viewport height). Props: `filename`, `url` (blob URL), `mimeType`, `onDownload`, `onClose`. Renders PDF via iframe, images via img, fallback with download button for other types. Used by both `TransactionDetail` and `MemberDetail`.

**Members sub-screens (`src/screens/members/`):**
- `MemberExportModal` — overlay modal for exporting the member list. Fields are selectable in three groups (Stammdaten, Mitgliedschaft, Beitragsinfos) with group-level checkboxes and Alle/Keine shortcuts. Beitragskategorie is a computed field ("Reduziert (35 €)" if u18 || bereitsMitglied || schuelerStudentAzubi, else "Voll (100 €)"). Status filter: Alle/Aktiv/Inaktiv with live member count. Format: CSV (semicolon-delimited, UTF-8 BOM) or PDF (portrait/landscape depending on column count, via jsPDF + AutoTable). Libraries loaded via dynamic import. Accessible to all logged-in users.

**Finance sub-screens (`src/screens/finance/`):**
- `TransactionForm` — richer create form with segmented-control type selector and conditional `relatedTransactionId` field for `RUECKBUCHUNG`; not yet wired into `Finance.tsx` (replaces `TransactionCreate` when integrated).
- `CategoryManager` — admin panel: lists categories with per-row delete, inline create form at the bottom; calls `onCategoriesChanged` after mutations so the parent keeps its category list in sync.
- `BusinessYearForm` — simple form to create a new business year; default year is current year + 1; shows hint that carry-over is calculated automatically.
- `ReportModal` — overlay modal for generating finance reports. Filters: Geschäftsjahr(e) (multi-select), Kategorien (multi-select, empty = all), Rückbuchungen toggle, Tag (ONLINE/BAR/kein Tag, empty = all). Option **"Anhänge einschließen"**: fetches attachments for all filtered transactions in parallel; for PDF: jsPDF renders the main tables + a per-year attachment overview table, then `pdf-lib` merges actual attachment files — PDF attachments are copied page-by-page, JPEG/PNG embedded full-page, other image formats converted via canvas to JPEG first, unsupported formats get a placeholder page; each attachment is preceded by a separator page (transaction date/description + filename); for CSV: adds a "Anhänge" column with pipe-separated filenames. Format: CSV (semicolon-delimited, UTF-8 BOM, Excel-kompatibel) or PDF (landscape, via jsPDF + AutoTable with summary footer). Accessible to all logged-in users. Libraries loaded via dynamic import.
- `ImportModal` — overlay modal for bulk-importing transactions from `.xlsx` or `.csv`. CSV delimiter is semicolon. Columns: `Datum;Beschreibung;Kategorie;Tag;Typ;Betrag` (same template as CSV export, `Kontostand` column is ignored if present). Datum format: `DD.MM.YYYY`. Geschäftsjahr is auto-detected from date (month ≥ 2 → year Y, month = 1 → year Y−1). `RUECKBUCHUNG` rows are rejected with an error. Shows a preview table with per-row validation before importing. "Vorlage (.csv)" button downloads an example file. Admin only.

**Files screen (`src/screens/Files.tsx`):**
- Split-pane: 180px folder sidebar (left, `#f1f5f9` bg) + file list (center) + detail/upload panel (right, shown on file select or "+ Datei hochladen").
- Folder sidebar lists distinct paths from `fetchFolders()` + "Alle Dateien" root; selecting a folder filters the file list client-side.
- File list table: name, size (human-readable), date, description; search filters on filename + description.
- Detail panel: filename, mimeType, size, upload date, uploader name (looked up from `fetchMembers()`); description + path editable inline (admin only, saved via `updateFile`); "Herunterladen" → `downloadFile`; "Löschen" (admin only, `confirm()` guard); preview area: images via `<img>`, PDFs via `<iframe>`, other types show extension badge + download button.
- Upload form (admin only): single file input, path and description fields, calls `uploadFile` (raw fetch/FormData); on success refreshes file list and folder list, then shows detail of new file.
- Blob URL lifecycle: `previewUrlRef` tracks current URL for revocation on file switch and unmount; cancellation token prevents stale state when switching files during a pending preview fetch.
- Types: `src/types/files.ts` → `AppFile`. API functions: `src/api/files.ts` (`fetchFiles`, `fetchFolders`, `uploadFile`, `downloadFile`, `previewFile`, `updateFile`, `deleteFile`).


## Backend reference

Full backend docs (data model, all routes, business logic):
@../JL_Backend/CLAUDE.md   ← Claude Code löst diesen Pfad automatisch auf

### Quick-reference: API base URL
Default: `http://100.91.210.125:3000`. Configurable at runtime via the Login screen → stored in `localStorage('api_base_url')`. Always access via `getApiUrl()` from `src/api/client.ts`.

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
| Transaction Attachments | `/finance/transactions/:id/attachments` |
| Member Attachments | `/members/:id/attachments` |
| Member Avatars | `POST/GET/DELETE /members/:id/avatar` |
| Files | `/files` |

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
- `src/types/member.ts` → `Member`, `MemberAttachment`, `MemberBeitrag`, `Role`
- `src/types/finance.ts` → `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`, `TransactionType`, `PaymentTag`, `TransactionAttachment`, `Mitgliedsbeitrag`
- `src/types/files.ts` → `AppFile`

### API client pattern
All requests go through `src/api/client.ts → apiFetch()`.
New endpoints → add a function to the appropriate API module (`members.ts`, `finance.ts`, `files.ts`).
Never call `fetch()` directly from components.
**Exception:** file upload (`multipart/form-data`) and binary download (Blob/ArrayBuffer/DataURL) bypass `apiFetch` because it hardcodes `Content-Type: application/json` and calls `res.json()`. These use raw `fetch` with the token attached manually — see in `src/api/finance.ts`:
- `uploadAttachment` — multipart upload
- `downloadAttachment` — Blob → object URL → browser download
- `fetchAttachmentBlob` — returns `{ url: string; mimeType: string }` blob URL (used by `TransactionDetail` for `AttachmentViewer` preview)
- `fetchAttachmentArrayBuffer` — returns `ArrayBuffer` (used by `ReportModal` to feed `pdf-lib` for PDF merging and JPEG/PNG embedding)
- `fetchAttachmentDataUrl` — returns base64 data URL (used by `ReportModal` for canvas-based conversion of non-JPEG/PNG image formats)

And in `src/api/members.ts`:
- `uploadAvatar` — multipart upload to `POST /members/:id/avatar`; returns updated `Member`
- `deleteAvatar` — `DELETE /members/:id/avatar` via `apiFetch`
- `fetchMemberAttachments` — list attachments for a member
- `uploadMemberAttachment` — multipart upload to `POST /members/:id/attachments`
- `downloadMemberAttachment` — Blob → object URL → browser download
- `deleteMemberAttachment` — `DELETE /members/:id/attachments/:aid` via `apiFetch`
- `fetchMemberAttachmentBlob` — returns `{ url: string; mimeType: string }` blob URL (used by `MemberDetail` for `AttachmentViewer` preview)

And in `src/api/files.ts` (all raw fetch — no `apiFetch`):
- `uploadFile` — multipart upload to `POST /files/upload`; body fields `path?`, `description?`; returns `AppFile`
- `downloadFile` — Blob → object URL → browser download (`Content-Disposition: attachment`)
- `previewFile` — Blob → object URL for inline preview (`Content-Disposition: inline`); used by `Files` screen
- `updateFile` — `PATCH /files/:id` via `apiFetch` (description, path)
- `deleteFile` — `DELETE /files/:id` via `apiFetch`
