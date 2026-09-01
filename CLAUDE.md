# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Scope of this repo

This directory contains the **mobile app** (Expo + React Native + expo-router, TypeScript).

**The backend lives in the parent monorepo, not in a separate repo.** The old Express +
SQLite server and the admin portal were removed in commit `502a5ba`, and the backend is
now 8 NestJS microservices over PostgreSQL + Redis (`appointments-service`,
`mechanicassistance-service-price`, `api-gateway`, …) — see the root `CLAUDE.md` for the
service/port table. Backend changes are made in those sibling directories.

Any file path under `server/` or `admin-portal/` in this file is stale: those directories
no longer exist anywhere. Backend *behavior* documented here (API contract, WebSocket
message types, DB relationships) may also have drifted — check the actual service.

---

## System Overview

Core flow: **users** create assistance requests → **mechanics** accept → **appointments** created → real-time updates via WebSocket → optional **video-call** (Daily.co, native SDK).

Two roles: `user` (client) and `mechanic`. The UI adapts per role — mechanics see the assist feed and availability toggle; users see vehicle management and request flow.

Test accounts (phone login, against the deployed backend):
- Mechanic: `(718) 871-2281`
- User (bot-assisted): `+11111111111` / `(555) 010-1234`

---

## Commands

### Mobile (Expo)
```bash
npm install
npm run start      # or: npm run ios / android / web
npm run lint
```

### Deployment
`npm run upload` and `npm run local` (and the `k8s/` manifests, `docker-compose.yml`, `scripts/upload.sh`, `scripts/local-deploy.sh`, `scripts/sync-users-from-prod.sh`) are **deprecated** — they were written for the old monorepo layout and reference a local `server/` and `admin-portal/` that no longer exist in this repo. Don't rely on them. The current deployment process is not yet documented here; confirm with the team before deploying.

---

## Architecture

### Config / Endpoints (`lib/config/ConfigService.ts`)
On startup, fetches config from `https://bootstrap.mechanicapp.com/config`, caches in AsyncStorage, falls back to `DEFAULT_FALLBACK_CONFIG`. All code uses `ConfigService.getApiBaseUrl()` and `ConfigService.getWsUrl()` — never hardcode endpoints.

- PROD defaults: `https://t9smggmz3a.us-east-1.awsapprunner.com` (API) / `wss://ws.mechanicassistance.com` (WS)

There is a single environment: prod. The old DEV/PROD `EnvSelector` on the login screen was removed — to hit a local backend, edit the URLs in `DEFAULT_FALLBACK_CONFIG` by hand. `SocketContext` still listens for config changes and reconnects the WebSocket if the remote bootstrap config changes the prod URL.

### Mobile Routing (`app/`)
Expo Router file-based routing. Key entrypoints:
- `app/_layout.tsx` — root layout, all providers
- `app/(tabs)/_layout.tsx` — tab navigator (dashboard, assist, appointments, chat, profile)
- `app/(tabs)/dashboard/` — mechanic job feed + user home
- `app/(tabs)/assist/` — mechanic assist feed + detail
- `app/(tabs)/request-assistance/` — multi-step wizard for users
- `app/setup/` — multi-step registration flow
- `app/(tabs)/chat/[id].tsx` — real-time chat
- `app/(tabs)/video-lobby/[id].tsx`, `app/(tabs)/video-call/[id].tsx` — Daily.co video flow
- `app/(tabs)/appointments/[id].tsx` — appointment detail + actions

### Global State (`context/`)
- `UserContext.tsx` — current session/user
- `AppointmentsContext.tsx` — appointments list + operations
- `SocketContext.tsx` — WebSocket connection, `chatHistory`, real-time events
- `NotificationsContext.tsx` — notification UI state
- `MechanicStatusContext.tsx` — mechanic Available/Busy/Offline toggle (local-only state, not persisted or synced to the backend — see [docs/](docs/) for known gaps)

### Data Layer
- `lib/api/apiClient.ts` — fetch wrapper (GET/POST/PATCH/DELETE), unwraps the standard `{ success, message, data }` envelope
- `lib/dao/` — client-side DAOs: `UserDAO`, `VehicleDAO`, `AssistanceDAO`, `AppointmentDAO`, `SetupDAO`, `AddressDAO`, `AseDAO`, `ExpertiseDAO`, `MediaDAO`
- `lib/dao/interfaces.ts` — shared TypeScript interfaces

Screens must use DAOs or Contexts, not raw `fetch`. Adding a new feature that needs backend support means coordinating with the backend repo — this repo alone can't add endpoints.

### Backend contract, video flow, online tracking
The mobile app depends on a backend contract (REST/WS shape, `appointments` vs
`assistance_requests`, photo upload rules, test-bot timing), plus the Daily.co video
flow and WebSocket-driven online tracking. Full reference: [docs/backend-contract.md](docs/backend-contract.md).

### Area-specific guides → skills
Conditional/procedural knowledge lives in skills (loaded on-demand), not here:
- **Firebase phone auth / login / OTP** → skill `firebase-phone-auth`
- **Traducciones / i18n** → skill `add-translation`
- **Estilos de UI (cards, botones, badges, sombras, títulos)** → skill `ui-card-styling`

---

## Conventions (always apply)

- **Backend edits go in the sibling services** — endpoints are implemented in the parent monorepo (`appointments-service`, `mechanicassistance-service-price`, …), not here. Deploy the backend before the app when a DTO gets stricter: `forbidNonWhitelisted: true` turns a removed field into a 400 for older app builds.
- **Minimal diffs** — prefer small targeted changes; do not refactor surrounding code.
- **TypeScript** — avoid `any`; when unavoidable (WS parsing), encapsulate it.
- **Use DAOs/Contexts, never raw `fetch`** — screens consume `lib/dao/` or `context/`.
- **Never hardcode endpoints** — always `ConfigService.getApiBaseUrl()` / `getWsUrl()`.
- **Styling** — NativeWind (Tailwind on RN); base components in `components/ui/`. Screen-title/card/button conventions live in the `ui-card-styling` skill.
- **Files to ignore** — `._*` (Apple resource forks), `node_modules/`, `.expo/`, build artifacts.

---

## "Where to look" by task

| Task | Files |
|------|-------|
| Login / session | `app/login.tsx`, `context/UserContext.tsx`, `lib/dao/UserDAO.ts`, `lib/firebase/auth.ts` |
| Firebase Phone Auth | `lib/firebase/auth.ts`, `plugins/withFirebaseAuthAPNS.js`, `firebase/GoogleService-Info.plist` |
| Dashboard / assist feed | `app/(tabs)/dashboard/`, `app/(tabs)/assist/`, `lib/dao/AssistanceDAO.ts` |
| Request assistance wizard | `app/(tabs)/request-assistance/` |
| Appointments | `app/(tabs)/appointments/`, `context/AppointmentsContext.tsx`, `components/appointments/` |
| Chat / realtime | `app/(tabs)/chat/[id].tsx`, `context/SocketContext.tsx` |
| Video call | `app/(tabs)/video-lobby/[id].tsx`, `app/(tabs)/video-call/[id].tsx`, `lib/video/useDailyCall.ts` |
| Environment config | `lib/config/ConfigService.ts`, `context/SocketContext.tsx` |
| Photo/video upload/display | `app/(tabs)/request-assistance/vehicle-documentation.tsx`, `lib/dao/AssistanceDAO.ts`, `lib/media/attachments.ts`, `components/appointments/AttachmentStrip.tsx`, `components/appointments/VideoPlayerModal.tsx` (expo-video) |
| Appointment map | `components/appointments/UserStatusTab.native.tsx` (user), `components/appointments/MechanicAssistanceInfoTab.native.tsx` (mechanic) — both require `locationLat`/`locationLng` from the backend |
| Translations | `lib/i18n/`, `app/_layout.tsx` (init) |
| User online tracking (mobile side) | `context/SocketContext.tsx` |
| DB schema, backend API, admin portal | separate backend repo (not in this workspace) |

---

## Known documentation gaps

- **Deployment**: `npm run upload`/`npm run local`, `k8s/`, `docker-compose.yml`, and `scripts/upload.sh` / `local-deploy.sh` / `sync-users-from-prod.sh` are leftover from the pre-split monorepo and are deprecated — do not use them as a guide to how deployment actually works today. This section needs to be rewritten once the current process is confirmed.
- `DB.MD` documents the SQLite schema as it existed when the backend was still in this repo — still a useful reference for field names, but the schema itself now lives in the backend repo and may have drifted.
- Pending product/engineering follow-ups are tracked in [docs/](docs/) (e.g. `docs/PENDING-decline-request-action.md`).
- Field-by-field persistence of assistance requests (what reaches the DB, what doesn't, and the deployment ordering it implies) is audited in [docs/assistance-request-field-persistence.md](docs/assistance-request-field-persistence.md). `docs/PENDING-persist-assistance-issues.md` is closed — its premise was wrong.
- The mechanic availability step's contract — `HH:mm` 24-hour times, per-day `schedule`, service radius, and the fact that no service reads the schedule back — is documented in [docs/mechanic-availability-contract.md](docs/mechanic-availability-contract.md).
