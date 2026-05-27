# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Maintenance
After significant changes to the codebase, update this CLAUDE.md 
to reflect new architecture, added services, or changed conventions.

## Wichtig — Verzeichnisstruktur

**Bearbeite immer `/home/ben/DevLocal/JL_Client/src/` — niemals `JL-Manager/src/`.**

`test_run.sh` führt `cp -r src/* JL-Manager/src/` aus, bevor es `npm run tauri dev` startet. Das bedeutet: alle Edits in `JL-Manager/src/` werden bei jedem `test_run.sh`-Aufruf überschrieben. `JL-Manager/` ist ein Build-Artefakt, kein Quellverzeichnis.

## Commands

```bash
# Entwicklung (Tauri Android/Desktop live):
./test_run.sh     # sync src/ → JL-Manager/src/, dann tauri dev

# Nur Web-Dev (kein Tauri):
cd JL-Manager && npm run dev

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
  - `['veranstaltungen']` / `['veranstaltungen', id]`
  - `['veranstaltung-form', id]`
  - `['veranstaltung-financials', id]`
  - `['veranstaltung-form-template']`
  - `['veranstaltung-kategorien']`
  - `['strafen']`
  - `['strafen-eintraege', 'meine', memberId, yearId]` / `['strafen-eintraege', 'alle', filters]`
- Exceptions (still use `useEffect`): blob URL lifecycle with cancellation tokens, event listeners, UI-state reactions (not data fetching).

**Auth flow:**
- `App.tsx` holds `loggedIn` (boolean), `activeTab` ("members" | "finance" | "beitraege" | "strafen" | "files" | "veranstaltungen" | "kalender"), and `pendingEventId` (number | null) as global state. On logout, `queryClient.clear()` wipes the cache. `pendingEventId` is set when the user clicks an event in the Kalender tab; it is passed as `initialSelectedId` to `Veranstaltungen` so the detail panel opens automatically.
- JWT is stored in `localStorage` via `src/auth/auth.ts`. `getCurrentUser()` in `src/auth/currentUser.ts` decodes it client-side to read `sub`, `email`, `accessLevel`, `role` without an extra API call.
- Permission checks in `src/auth/permissions.ts` gate UI elements based on `accessLevel >= 5`:
  - `canEditMembers()`, `canCreateMembers()` — member management
  - `canManageFinance()` — finance admin actions (add year, manage categories)

**API layer:**
- All requests go through `src/api/client.ts` → `apiFetch()`, which reads the token from `localStorage` and attaches `Authorization: Bearer`.
- Backend base URL is **user-configurable**: `getApiUrl()` (exported from `src/api/client.ts`) reads `localStorage('api_base_url')`, falling back to `http://100.91.210.125:3000`. The URL is saved to `localStorage` on login via the Server-Adresse field in `Login.tsx`. All API modules (`members.ts`, `finance.ts`, `files.ts`) and screens that build URLs directly (`App.tsx`, `Members.tsx`, `ProfileModal.tsx`, `MemberDetail.tsx`) import and call `getApiUrl()` — never hardcode the base URL.
- `apiFetch()` error handling: on non-2xx response, reads the body as text, attaches it as `body` (string) and `status` (number) to the thrown error via the exported `ApiError` interface (`src/api/client.ts`). Callers can cast the caught error to `ApiError` to access both fields.
- `src/api/members.ts` — `/members` endpoints (list, single, PATCH, POST, avatar upload/delete, member attachment CRUD). Avatar and attachment uploads use raw `fetch` with `FormData` (bypasses `apiFetch`). Member attachment functions: `fetchMemberAttachments`, `uploadMemberAttachment`, `downloadMemberAttachment`, `deleteMemberAttachment`, `fetchMemberAttachmentBlob`.
- `src/api/finance.ts` — `/finance/*` endpoints: categories, business years, transactions, running balance, mitgliedsbeitraege, transaction attachments (upload/download/delete/preview).
- `src/api/files.ts` — `/files` endpoints: `fetchFiles(path?)`, `fetchFolders()`, `uploadFile` (raw fetch/FormData), `downloadFile` (Blob → objectURL), `previewFile` (Blob → objectURL, inline), `updateFile`, `deleteFile`.
- `src/api/veranstaltungen.ts` — `/veranstaltungen` + `/veranstaltung-form-template` + `/veranstaltung-kategorien` endpoints: full CRUD, financials, form rows (add/update/delete), attachment upload/download/delete/blob-preview, template get/update, kategorie CRUD. Attachment uploads use raw `fetch`/`FormData`; downloads return Blob → objectURL.
- `src/api/strafen.ts` — `/strafen` + `/strafen/eintraege` endpoints: catalog CRUD (`fetchStrafen`, `createStrafe`, `updateStrafe`, `deleteStrafe`) and entry CRUD (`fetchEintraege`, `createEintrag`, `updateEintrag`, `deleteEintrag`). All via `apiFetch`. `fetchEintraege` accepts optional filter object `{ memberId?, strafeId?, businessYearId?, bezahlt? }`.

**Types:**
- `src/types/member.ts` — `Member`, `MemberAttachment`, `MemberBeitrag`, `Role`. The JWT payload shape is defined locally in `currentUser.ts` as `JwtPayload`.
- `src/types/finance.ts` — `TransactionType`, `PaymentTag`, `Category`, `BusinessYear`, `Transaction`, `RunningBalanceEntry`, `TransactionAttachment`, `Mitgliedsbeitrag`.
- `src/types/files.ts` — `AppFile`.
- `src/types/veranstaltungen.ts` — `FormColumn`, `VeranstaltungFormRow`, `VeranstaltungForm`, `VeranstaltungAttachment`, `VeranstaltungTransaction`, `Veranstaltung`, `VeranstaltungFinancials`, `VeranstaltungFormTemplate`, `VeranstaltungKategorie`, `AllAttachments`.
- `src/types/strafen.ts` — `Strafe`, `StrafeEintrag`.

**Responsive design:**
- Mobile breakpoint: **768px**. Hook: `src/hooks/useIsMobile.ts` → `useIsMobile()` returns boolean, updates on resize.
- CSS variable `--content-h` defined in `src/styles/mobile.css` (imported in `main.tsx`):
  - Desktop: `calc(100vh - 44px)` (top nav only)
  - Mobile: `calc(100vh - 44px - 56px)` (top nav + bottom nav bar)
- Every screen that fills the viewport must use `height: "var(--content-h)"` — never hardcode `calc(100vh - 44px)`.
- Screens that accept layout adjustments receive `isMobile?: boolean` as prop (passed from `App.tsx`).
- Split-pane screens (Members, Finance, Files, Veranstaltungen) implement **stack navigation** on mobile: list panel OR detail panel visible at a time; detail panel shows a "← Zurück" button to return to the list.

**Navigation (App.tsx):**
- Desktop: sticky top bar with tab buttons + settings gear (⚙) + avatar (right).
- Mobile: slim top bar (active tab name + settings gear + avatar) + fixed 56px **bottom tab bar** with SVG icons + labels. Bottom nav uses CSS class `mobile-bottom-nav` for safe-area-inset support on notched devices.
- **Settings menu**: gear icon opens an absolutely-positioned dropdown with a backdrop overlay (click outside to dismiss). Contains **dark mode toggle** — state stored in `localStorage('darkMode')`; toggling adds/removes class `dark` on `document.documentElement`; initialized from localStorage on mount.
- `isMobile` computed from `useIsMobile()` in `App.tsx`; passed as prop to `Members`, `Finance`, `Files`, `Mitgliederbeitraege`, `Strafen`, `Veranstaltungen`, `Kalender`.

**Screens (`src/screens/`):**
- `Login` — redesigned card UI (dark gradient background, centered white card). Credential form + **"Server-Adresse"** field pre-filled from `localStorage('api_base_url')` (default `http://100.91.210.125:3000`). On submit saves the URL to localStorage before calling `auth.login()`, then notifies parent via `onSuccess`. **Connectivity indicator**: on mount and 800ms after URL changes, a `fetch` with `mode: "no-cors"` + 3s `AbortController` timeout probes the server; badge shows 🟡 Prüfe… / 🟢 Erreichbar / 🔴 Nicht erreichbar next to the label; "Tailscale aktiv?" hint shown below input when unreachable. **Password visibility toggle**: 👁️/🙈 button inside the password field toggles `type="password"` ↔ `type="text"` (`tabIndex={-1}`, does not steal form focus). **Error detail panel**: on login failure, error box shows HTTP status code in message + collapsible "Details ▼" button that reveals the raw API response body (JSON pretty-printed if parseable, otherwise plain text).
- `ProfileModal` — overlay modal opened by the avatar button (top nav, all logged-in users). Edits own profile fields. Includes a **"Passwort ändern"** section: two password inputs (new + confirm), `password` sent in PATCH body only when filled and matching (min 6 chars). Backend `PATCH /members/:id` requires `accessLevel >= 5` — non-admin saves will be rejected by the API. **Avatar upload/delete**: avatar circle is clickable → opens file picker; camera overlay on hover; "Löschen" button shown when avatar exists. Upload calls `uploadAvatar` (raw `fetch`/`FormData`). `onAvatarChanged` prop notifies `App.tsx` to update the nav avatar immediately without closing the modal.
- `Members` — split-pane layout: member list (left) + detail/create panel (right). Prop `isMobile?: boolean`. **Mobile**: card-style list rows (avatar + name + email + status badge); tapping a row hides the list and shows the detail panel full-width; "← Zurück" button returns to list. **Desktop**: table with Name/E-Mail/Adresse/Status columns. Toolbar: **"Export"** button (all users) opens `MemberExportModal`; **"+ Neues Mitglied"** (admin only).
- `MemberDetail` — inline edit form for a single member; only shown when `canEditMembers()`. If any beitragsrelevante field (`u18`, `bereitsMitglied`, `schuelerStudentAzubi`) changed, saving triggers a two-step flow: business years are fetched and shown as checkboxes (all pre-selected); the user picks which years to update retroactively; the PATCH is sent with `retroactiveYearIds: number[]` containing only the selected IDs. If no beitragsrelevante field changed, the PATCH goes out immediately without that field. Includes a **"Passwort ändern"** section (two password inputs, new + confirm); `password` is included in the PATCH body only when the field is filled and both inputs match (min 6 chars). State is cleared on cancel and after successful save. Includes **"Anhänge"** section (view mode only): lists attachments with filename/size; single click opens `AttachmentViewer` side panel (click again to close); download button (↓) per row; admins can upload multiple files and delete attachments. Active attachment row highlighted blue.
- `MemberCreate` — create form; `roleId` is hardcoded to `1` for now. Includes a `joinedAt` date picker (defaults to today) that is passed as an ISO string to `POST /members`.
- `Finance` — split-pane layout: Kassenbuch table (left) + detail/form panel (right). Prop `isMobile?: boolean`. **Mobile**: list panel OR detail panel shown at a time; "← Zurück" returns to list; transaction table shows only 3 columns (Datum, Beschreibung, Betrag) — no horizontal scroll; desktop shows all 7 columns (Datum, Beschreibung, Kategorie, Zahlung, Typ, Betrag, Kontostand). Stats cards: mobile shows only Einnahmen + Kontostand; desktop shows all 4 (Übertrag, Einnahmen, Ausgaben, Kontostand).
  - Left: year dropdown (descending), summary badges, running-balance table with a „Zahlung" column (tag: Online/Bar, desktop only) that is filterable via dropdown, summary footer row.
  - Right panel switches between: `BusinessYearForm`, `TransactionCreate`, `TransactionDetail`, or placeholder text.
  - Toolbar buttons: "Kategorien" (admin), "Rückbuchungen", **"Report"** (all users), **"Import"** (admin), "+ Neue Buchung" (admin).
  - "Kategorien verwalten" toggle (admin only) opens `CategoryManager` inline below the header.
  - "+ Jahr" button (admin only) next to the year dropdown opens `BusinessYearForm` in the right panel.
- `TransactionCreate` — create form for a new transaction (used by `Finance`). `tag` (`ONLINE` | `BAR`) is required; defaults to `ONLINE`.
- `TransactionDetail` — detail/edit view for a selected transaction; supports editing date, description, category, tag and deleting. Existing transactions without a tag default to `ONLINE` in the edit form. Includes **"Anhänge"** section (always visible in detail view): single click on filename opens `AttachmentViewer` side panel (click again to close); active row highlighted blue; download button (↓) per row; admins can upload multiple files and delete attachments. Upload uses raw `fetch` with `FormData` (not `apiFetch`). Download fetches as Blob + object URL (auth header can't be sent via `<a href>`).

**Shared components (`src/components/`):**
- `AttachmentViewer` — generic side-panel file viewer (fixed right-edge panel, 600px wide, full viewport height). Props: `filename`, `url` (blob URL), `mimeType`, `onDownload`, `onClose`. Renders PDF via iframe, images via img, fallback with download button for other types. Used by `TransactionDetail`, `MemberDetail`, and `VeranstaltungDetail`.

**Members sub-screens (`src/screens/members/`):**
- `MemberExportModal` — overlay modal for exporting the member list. Fields are selectable in three groups (Stammdaten, Mitgliedschaft, Beitragsinfos) with group-level checkboxes and Alle/Keine shortcuts. Beitragskategorie is a computed field ("Reduziert (35 €)" if u18 || bereitsMitglied || schuelerStudentAzubi, else "Voll (100 €)"). Status filter: Alle/Aktiv/Inaktiv with live member count. Format: CSV (semicolon-delimited, UTF-8 BOM) or PDF (portrait/landscape depending on column count, via jsPDF + AutoTable). Libraries loaded via dynamic import. Accessible to all logged-in users.

**Finance sub-screens (`src/screens/finance/`):**
- `TransactionForm` — richer create form with segmented-control type selector and conditional `relatedTransactionId` field for `RUECKBUCHUNG`; not yet wired into `Finance.tsx` (replaces `TransactionCreate` when integrated).
- `CategoryManager` — admin panel: lists categories with per-row delete, inline create form at the bottom; calls `onCategoriesChanged` after mutations so the parent keeps its category list in sync.
- `BusinessYearForm` — simple form to create a new business year; default year is current year + 1; shows hint that carry-over is calculated automatically.
- `ReportModal` — overlay modal for generating finance reports. Filters: Geschäftsjahr(e) (multi-select), Kategorien (multi-select, empty = all), Rückbuchungen toggle, Tag (ONLINE/BAR/kein Tag, empty = all). Option **"Anhänge einschließen"**: fetches attachments for all filtered transactions in parallel; for PDF: jsPDF renders the main tables + a per-year attachment overview table, then `pdf-lib` merges actual attachment files — PDF attachments are copied page-by-page, JPEG/PNG embedded full-page, other image formats converted via canvas to JPEG first, unsupported formats get a placeholder page; each attachment is preceded by a separator page (transaction date/description + filename); for CSV: adds a "Anhänge" column with pipe-separated filenames. Format: CSV (semicolon-delimited, UTF-8 BOM, Excel-kompatibel) or PDF (landscape, via jsPDF + AutoTable with summary footer). Accessible to all logged-in users. Libraries loaded via dynamic import.
- `ImportModal` — overlay modal for bulk-importing transactions from `.xlsx` or `.csv`. CSV delimiter is semicolon. Columns: `Datum;Beschreibung;Kategorie;Tag;Typ;Betrag` (same template as CSV export, `Kontostand` column is ignored if present). Datum format: `DD.MM.YYYY`. Geschäftsjahr is auto-detected from date (month ≥ 2 → year Y, month = 1 → year Y−1). `RUECKBUCHUNG` rows are rejected with an error. Shows a preview table with per-row validation before importing. "Vorlage (.csv)" button downloads an example file. Admin only.

**Files screen (`src/screens/Files.tsx`):** Prop `isMobile?: boolean`.
- **Desktop**: 180px folder sidebar (left, `#f1f5f9` bg) + file list (center) + detail/upload panel (right, shown on file select or "+ Datei hochladen").
- **Mobile**: folder sidebar replaced by a horizontal-scroll pill bar above the file list; file list OR detail panel shown at a time; "← Zurück" returns to list.
- Folder sidebar/pills list distinct paths from `fetchFolders()` + "Alle Dateien" root; selecting a folder filters the file list client-side.
- File list table: desktop shows name, size, date, description; **mobile shows only name + date** — no horizontal scroll. Search filters on filename + description.
- Detail panel: filename, mimeType, size, upload date, uploader name (looked up from `fetchMembers()`); description + path editable inline (admin only, saved via `updateFile`); "Herunterladen" → `downloadFile`; "Löschen" (admin only, `confirm()` guard); preview area: images via `<img>`, PDFs via `<iframe>`, other types show extension badge + download button.
- Upload form (admin only): single file input, path and description fields, calls `uploadFile` (raw fetch/FormData); on success refreshes file list and folder list, then shows detail of new file.
- Blob URL lifecycle: `previewUrlRef` tracks current URL for revocation on file switch and unmount; cancellation token prevents stale state when switching files during a pending preview fetch.
- Types: `src/types/files.ts` → `AppFile`. API functions: `src/api/files.ts` (`fetchFiles`, `fetchFolders`, `uploadFile`, `downloadFile`, `previewFile`, `updateFile`, `deleteFile`).

**Strafen screen (`src/screens/Strafen.tsx`):** Props `isMobile?: boolean`. Tab label: "Strafen" (flag icon).
- Three subtabs: **Strafen** (catalog), **Deine Strafen** (own entries), **Alle Strafen** (admin only).
- **Strafen subtab** (`KatalogTab`): table of all catalog entries. Admin: inline edit, delete (blocked if `_count.eintraege > 0`), "+ Neue Strafe" form, and "+" button per row that opens `AssignModal`. `staleTime: 30_000` (no loading flash on tab switch).
- **Deine Strafen** (`MeineEintraege`): year filter, own entries table. Uses `placeholderData: keepPreviousData` + `enabled: effectiveYearId !== null` to avoid flash on mount.
- **Alle Strafen** (`AlleEintraege`, admin only): year + member filter, all entries table with toggle-bezahlt / delete per row. "+ Eintrag" button in subtab bar toolbar. Same caching as MeineEintraege.
- **AssignModal**: member dropdown (active only), date (default today), auto-detected Geschäftsjahr displayed inline (month Jan → year−1, month Feb–Dec → current year), optional Grund. Error messages read from `err.body` via `apiErrMsg()`.
- Business year auto-detection shared helper: `detectBusinessYearId(dateStr, businessYears)`.

**Mitgliederbeitraege screen (`src/screens/Mitgliederbeitraege.tsx`):** Prop `isMobile?: boolean`.
- Uses `height: "var(--content-h)"`. **Mobile**: table shows 3 columns (Mitglied, Offen, Status) — no horizontal scroll; desktop shows all 7 (Mitglied, Beitrag JL, Beitrag KG, Bezahlt JL, Bezahlt KG, Offen, Status). Summary cards: mobile shows only Ausstehend + Gesamt offen; desktop shows all 4.

**Veranstaltungen screen (`src/screens/Veranstaltungen.tsx`):** Props `isMobile?: boolean`, `initialSelectedId?: number | null`. Tab label: "Events" (calendar icon).
- Split-pane: event list (left, 320px) + right panel. Mobile: stack navigation.
- Left list: events sorted by date desc; search on name + description; count badges (Buchungen / Anhänge). Toolbar: "Vorlage" button (admin, opens `FormTemplateManager`), "+ Neu" button (admin, opens `VeranstaltungCreate`).
- Right panel switches between: `VeranstaltungCreate`, `FormTemplateManager`, `VeranstaltungDetail`, or placeholder text.
- Detail data fetched via `useQuery(['veranstaltungen', id])` → `fetchVeranstaltung(id)` (includes transactions, attachments, form).
- `initialSelectedId`: when provided (from Kalender tab navigation), sets initial `selectedId` and `rightPanel = "detail"` on mount so the event detail opens immediately.

**Kalender screen (`src/screens/Kalender.tsx`):** Props `isMobile?: boolean`, `onGoToEvent?: (id: number) => void`. Tab label: "Kalender" (calendar grid icon).
- Monthly calendar grid (Mo–So columns, German locale). Month navigation: ‹ › arrows + "Heute" button.
- Events fetched via `useQuery(['veranstaltungen'])` — shares cache with Veranstaltungen tab.
- Desktop: event chips (blue, up to 2 per day, "+N weitere" on overflow). Clicking chip calls `onGoToEvent(id)` → App.tsx sets `pendingEventId` + switches to "veranstaltungen" tab.
- Mobile: dot indicators on days with events (up to 3 blue dots + grey overflow dot). Event list for current month shown below the grid; tapping calls `onGoToEvent`.
- **Abonnieren button** (header): opens a dropdown panel with:
  - The raw iCal URL (`${getApiUrl()}/veranstaltungen/ical`) — monospace display + "Kopieren" button (clipboard, shows "Kopiert!" confirmation for 2 s).
  - "In Kalender-App öffnen" button — `<a href={webcalUrl}>` where `webcalUrl` replaces `http(s)://` with `webcal://`. Opens the system calendar app for direct subscription.
  - Backdrop div closes the panel on outside click.
- iCal feed at `GET /veranstaltungen/ical` is public (no JWT). URL derived from `getApiUrl()` — never hardcoded.

**Veranstaltungen sub-screens (`src/screens/veranstaltungen/`):**
- `VeranstaltungCreate` — form with name, date (defaults today), description, and optional category multi-select (toggle buttons). Fetches available categories via `useQuery(['veranstaltung-kategorien'])`. Creates via `POST /veranstaltungen` with optional `kategorieIds`; invalidates `['veranstaltungen']`; calls `onCreated` with new event.
- `VeranstaltungDetail` — detail/edit view. Sections:
  - **Metadata** (name, date, description): inline edit toggle (admin); "Bearbeiten" / "Speichern" / "Abbrechen" buttons. Delete button with confirmation (admin).
  - **Finanzen**: 3 stat cards (Einnahmen, Ausgaben, Saldo) fetched via `useQuery(['veranstaltung-financials', id])`.
  - **Buchungen**: read-only table of linked transactions (date, description, category, amount) from the event detail response.
  - **Formular**: table rendered from the event's `form.columns` snapshot. Admin can edit cells inline (input type matches `column.type`: text/number/date/checkbox), save per-row via PATCH, add rows, delete rows. Non-admin sees read-only values.
  - **Anhänge**: list with filename, size, download (↓), delete (×, admin). Clicking row opens `AttachmentViewer` side panel (click again to close); blob URL lifecycle managed with `useRef` + cancellation token. Admin upload: multi-file label input.
- `FormTemplateManager` — admin template column editor. Fetches singleton via `useQuery(['veranstaltung-form-template'])`. Displays editable table of columns (label, type); add column form at bottom; save via `PATCH /veranstaltung-form-template`. Note: changes only affect new Veranstaltungen.
- `VeranstaltungKategorienManager` — admin category CRUD panel. Fetches via `useQuery(['veranstaltung-kategorien'])`. List with color dot, name, description, usage count; inline edit row; create form with color picker (presets + custom color input). Delete blocked client-side if `_count.veranstaltungen > 0`. Exports `KategoriePill` (colored pill chip used in list + detail views).


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
| Veranstaltungen | `/veranstaltungen` |
| Veranstaltung Form Template | `/veranstaltung-form-template` |
| Veranstaltung Kategorien | `/veranstaltung-kategorien` |
| Strafen (catalog) | `/strafen` |
| Strafen (entries) | `/strafen/eintraege` |

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
- `src/types/veranstaltungen.ts` → `FormColumn`, `VeranstaltungFormRow`, `VeranstaltungForm`, `VeranstaltungAttachment`, `VeranstaltungTransaction`, `Veranstaltung`, `VeranstaltungFinancials`, `VeranstaltungFormTemplate`, `AllAttachments`

### API client pattern
All requests go through `src/api/client.ts → apiFetch()`.
New endpoints → add a function to the appropriate API module (`members.ts`, `finance.ts`, `files.ts`, `veranstaltungen.ts`).
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

And in `src/api/veranstaltungen.ts`:
- `fetchVeranstaltungen` / `fetchVeranstaltung(id)` — list + single event (with transactions, attachments, form)
- `createVeranstaltung` / `updateVeranstaltung` / `deleteVeranstaltung` — CRUD via `apiFetch`
- `fetchVeranstaltungFinancials(id)` — `{ einnahmen, ausgaben, saldo }` via `apiFetch`
- `uploadVeranstaltungAttachment` — multipart upload to `POST /veranstaltungen/:id/attachments`
- `downloadVeranstaltungAttachment` — Blob → object URL → browser download
- `fetchVeranstaltungAttachmentBlob` — returns `{ url: string; mimeType: string }` blob URL (used by `VeranstaltungDetail` for `AttachmentViewer` preview)
- `deleteVeranstaltungAttachment` — `DELETE` via `apiFetch`
- `fetchVeranstaltungForm(id)` — form columns snapshot + rows
- `addFormRow` / `updateFormRow` / `deleteFormRow` — form row CRUD via `apiFetch`
- `fetchFormTemplate` / `updateFormTemplate` — singleton template GET/PATCH via `apiFetch`
- `fetchVeranstaltungKategorien` / `createVeranstaltungKategorie` / `updateVeranstaltungKategorie` / `deleteVeranstaltungKategorie` — kategorie CRUD via `apiFetch`

And in `src/api/strafen.ts`:
- `fetchStrafen` / `createStrafe` / `updateStrafe` / `deleteStrafe` — catalog CRUD via `apiFetch`
- `fetchEintraege(filters?)` — list entries, optional `{ memberId?, strafeId?, businessYearId?, bezahlt? }` filter
- `createEintrag` / `updateEintrag` / `deleteEintrag` — entry CRUD via `apiFetch`

And in `src/api/files.ts` (all raw fetch — no `apiFetch`):
- `uploadFile` — multipart upload to `POST /files/upload`; body fields `path?`, `description?`; returns `AppFile`
- `downloadFile` — Blob → object URL → browser download (`Content-Disposition: attachment`)
- `previewFile` — Blob → object URL for inline preview (`Content-Disposition: inline`); used by `Files` screen
- `updateFile` — `PATCH /files/:id` via `apiFetch` (description, path)
- `deleteFile` — `DELETE /files/:id` via `apiFetch`

## Android (Tauri)

Config lives in `src-tauri/gen/android/app/src/main/`.

**Permissions** (`AndroidManifest.xml`): `INTERNET` + `ACCESS_NETWORK_STATE`.

**Network security** (`AndroidManifest.xml` → `android:networkSecurityConfig="@xml/network_security_config"`): `res/xml/network_security_config.xml` sets `cleartextTrafficPermitted="true"` globally so HTTP traffic to `100.91.210.125` (Tailscale) works without TLS. `android:usesCleartextTraffic` is also set via Tauri's build variable `${usesCleartextTraffic}`.

## Progressive Web App (PWA)

Static files in `public/` — served as-is by Vite, no build step needed.

- `public/manifest.json` — Web App Manifest (`name: "JL Manager"`, `theme_color: "#1a1a2e"`, 192 × 512 icons, `purpose: "any maskable"` for adaptive icon support)
- `public/sw.js` — service worker with **network-first** strategy; cache name `jl-manager-v1`; old caches purged on `activate` event
- `public/192x192.png` / `public/512x512.png` — app icons
- `index.html` — registers the service worker + iOS `apple-mobile-web-app-*` meta tags for standalone install on Safari
