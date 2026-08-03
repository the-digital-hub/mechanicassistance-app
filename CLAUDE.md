# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Scope of this repo

This workspace contains **only the mobile app** (Expo + React Native + expo-router, TypeScript).

The backend API (Node.js + Express + SQLite + WebSocket) and the admin portal (React + Vite) used to live in this monorepo but were extracted to a **separate repository** as of commit `502a5ba` ("refactor: remove admin-portal and server directories..."). They are not present in this workspace — if a task requires editing backend or admin-portal code, that work belongs in the other repo, not here.

This file still documents backend *behavior* (API contract, WebSocket message types, DB relationships, bot timing, etc.) where it's relevant to understanding or building mobile features — but any file path under `server/` or `admin-portal/` refers to the other repo, not this one.

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

- PROD defaults: `https://t9smggmz3a.us-east-1.awsapprunner.com` (API + WS)
- DEV defaults: `http://192.168.1.229:3000` (local LAN — iOS/Android real device) / `http://localhost:3000` (iOS sim) / `http://10.0.2.2:3000` (Android emulator)

If the backend returns `allowEnvSwitch: true`, an `EnvSelector` toggle appears on the Login screen. Switching env auto-reconnects the WebSocket (`SocketContext` has a listener).

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

### Backend contract (implementation lives in the separate backend repo)
Documented here because the mobile app's behavior depends on it:
- REST API at `/api/*`; WS on the same host. Clients register with `{ type: 'register', userId }`.
- WS message types in use: `register`, `unregister`, `chat_message`, `assistance_update`, `video_room_ready`, `register_admin`, `user_status_change`.
- `appointments` vs `assistance_requests` tables: both share the same `id` (the assistance request ID). `appointments` is the "accepted/active" record; `assistance_requests` is the source of truth for request lifecycle. `AppointmentsContext` on mobile uses the `appointments` row when it exists, filtering out the duplicate `assistance_requests` entry by ID.
- Photos: upload returns a full absolute URL (`http://<host>/api/photos/<uuid>.jpg`), stored as a JSON array. Mobile upload is `AssistanceDAO.uploadPhoto(localUri)` using `apiClient.upload()` with `FormData` — the `upload()` method must NOT set `Content-Type` manually, fetch sets it with the multipart boundary automatically. Max 3 photos per request (enforced in `app/(tabs)/request-assistance/add-details.tsx`).
- **Mechanic test bot**: simulates a real mechanic for test user `+11111111111` (acts as mechanic `mech-1`, Shayna Samett). Sets assistance status to `'offered'` first (not `'accepted'`) — `searching.tsx` listens for `status === 'offered'` to navigate to the mechanic-found screen; status becomes `'accepted'` only after the user confirms. After confirmation it progresses through status updates: "On my way" (~15s) → "Arrived" (~40s) → "Diagnosing" (~75s). Useful to know when debugging why a status transition on-device seems slow or out of order.
- Video calls: `POST /api/video-room` creates a Daily.co room; server notifies the mechanic via `video_room_ready` WS event (with a 3s polling fallback). If the mechanic is the test bot, a separate video-bot microservice joins the call as a real Daily.co participant for ~2 minutes.

### Video Call Flow (Daily.co, native SDK)
1. User requests video call → mechanic accepts → both go to video lobby (`app/(tabs)/video-lobby/[id].tsx`)
2. User starts call → backend creates the Daily.co room
3. Both join via `lib/video/useDailyCall.ts` (native Daily SDK, not a WebView)
4. `components/video/CallControls.tsx`, `components/video/VideoTile.tsx` render the call UI

### User Online Tracking
The `users.isOnline` flag is driven purely by WebSocket events on the mobile side — no polling:
- `context/SocketContext.tsx` sends `{ type: 'unregister', userId }` explicitly in three cases: on logout (`user?.id` becomes null), when `AppState` goes to `'background'`/`'inactive'`, and re-sends `{ type: 'register', userId }` when `AppState` returns to `'active'`.
- `userIdRef` keeps the userId accessible inside event handlers after user state clears.
- The server-side broadcast to admin clients and the admin portal's live dashboard are implemented in the separate backend/admin-portal repo.

### Firebase Phone Auth (`lib/firebase/auth.ts`)
- Uses `auth().signInWithPhoneNumber(phoneNumber)` — **namespaced API only**. The modular `signInWithPhoneNumber(getAuth(), ...)` does not properly handle the reCAPTCHA fallback on iOS.
- Signs out any existing Firebase user before calling `signInWithPhoneNumber` to avoid `auth/internal-error`.
- **Firebase Blaze billing plan is required** for real SMS on real devices. Test phone numbers (Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing") bypass SMS and work on any plan — use them for local dev to avoid rate limiting.
- `auth/too-many-requests` = device blocked due to too many failed attempts → wait ~1 hour or use a test phone number.
- `auth/internal-error` in <500ms on real device = check Firebase billing (must be Blaze) and verify via: `curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=<API_KEY>" -H "Content-Type: application/json" -d '{"phoneNumber":"+1...","recaptchaToken":"test"}'` — if returns `BILLING_NOT_ENABLED`, upgrade to Blaze.
- APNs forwarding is set up in `ios/Mechanic/AppDelegate.swift` via `withFirebaseAuthAPNS` config plugin — `setAPNSToken(.sandbox)` for DEBUG, `.prod` for release. Required entitlements: `aps-environment: production`, `UIBackgroundModes: remote-notification`.
- Config plugin files: `plugins/withFirebasePodfile.js`, `plugins/withFirebaseAuthAPNS.js` — these survive `expo prebuild --clean` (EAS).
- `firebase/GoogleService-Info.plist` → copied to `ios/Mechanic/GoogleService-Info.plist` during prebuild. Must include `REVERSED_CLIENT_ID` for reCAPTCHA fallback.

### Internationalization (`lib/i18n/`)
- `i18next` + `react-i18next`, initialized as a side-effect import (`import "@/lib/i18n"` in `app/_layout.tsx`) — no Provider needed, `useTranslation()` reads the global instance.
- Locale files: `lib/i18n/locales/en.json`, `lib/i18n/locales/es.json`. Selected language persists to AsyncStorage (`app_language`) and restores on app start; switch it with `setAppLanguage('en' | 'es')` from `lib/i18n`.
- Namespaced by screen/feature (`profile`, `dashboard`, `requestAssistance`, `appointments`, ...). When translating a new screen, check for existing shared keys (e.g. `requestAssistance.header.*`, `requestAssistance.badge.*`) before adding duplicates — several wizard screens repeat the same title/badge text.
- Not all screens are translated yet — see [docs/](docs/) or check a screen directly before assuming `t()` is wired up.

### Styling
Mobile: **NativeWind** (Tailwind classes on RN components). Base components in `components/ui/`.

---

## Conventions

- **TypeScript** — avoid `any`; when unavoidable (WS parsing), encapsulate it.
- **Files to ignore** — `._*` (Apple resource forks), `node_modules/`, `.expo/`, build artifacts.
- **Minimal diffs** — prefer small targeted changes; do not refactor surrounding code.
- **No direct backend edits** — this repo can't implement or modify API endpoints; new features that need backend support require coordinating with the backend repo.

### Styling Rules

**View Titles (Screen Headers)**
- **Font size**: `text-3xl` (30px)
- **Color**: `text-gray-900` (#111827)
- **Font weight**: `font-outfit-medium`
- Example: Welcome back title in `app/(tabs)/dashboard/index.tsx`
- Use this standard for all primary screen titles unless explicitly overridden by design specs

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
| Photo upload/display | `app/(tabs)/request-assistance/add-details.tsx`, `lib/dao/AssistanceDAO.ts`, `components/appointments/UserStatusTab.native.tsx` |
| Appointment map | `components/appointments/UserStatusTab.native.tsx` (user), `components/appointments/MechanicAssistanceInfoTab.native.tsx` (mechanic) — both require `locationLat`/`locationLng` from the backend |
| Translations | `lib/i18n/`, `app/_layout.tsx` (init) |
| User online tracking (mobile side) | `context/SocketContext.tsx` |
| DB schema, backend API, admin portal | separate backend repo (not in this workspace) |

---

## Known documentation gaps

- **Deployment**: `npm run upload`/`npm run local`, `k8s/`, `docker-compose.yml`, and `scripts/upload.sh` / `local-deploy.sh` / `sync-users-from-prod.sh` are leftover from the pre-split monorepo and are deprecated — do not use them as a guide to how deployment actually works today. This section needs to be rewritten once the current process is confirmed.
- `DB.MD` documents the SQLite schema as it existed when the backend was still in this repo — still a useful reference for field names, but the schema itself now lives in the backend repo and may have drifted.
- Pending product/engineering follow-ups are tracked in [docs/](docs/) (e.g. `docs/PENDING-decline-request-action.md`, `docs/PENDING-persist-assistance-issues.md`).
