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
- Permission checks (`canEditMembers`, `canCreateMembers`) in `src/auth/permissions.ts` gate UI elements based on `accessLevel >= 5`.

**API layer:**
- All requests go through `src/api/client.ts` → `apiFetch()`, which reads the token from `localStorage` and attaches `Authorization: Bearer`.
- Backend base URL is hardcoded: `http://100.91.210.125:3000`.
- `src/api/members.ts` wraps the `/members` endpoints (list, PATCH, POST).

**Screens (`src/screens/`):**
- `Login` — credential form, calls `auth.login()`, notifies parent via `onSuccess`.
- `Members` — split-pane layout: member table (left) + detail/create panel (right). Manages its own list state and selected member.
- `MemberDetail` — inline edit form for a single member; only shown when `canEditMembers()`.
- `MemberCreate` — create form; `roleId` is hardcoded to `1` for now.
- `Finance` — placeholder, to be implemented.

**Types:** `src/types/member.ts` is the single shared type (`Member`). The JWT payload shape is defined locally in `currentUser.ts` as `JwtPayload`.
