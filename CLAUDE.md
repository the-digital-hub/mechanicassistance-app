# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## System Overview

**Mechanic** is a monorepo with three pieces:

1. **Mobile App** — Expo + React Native + expo-router (TypeScript)
2. **Backend API** — Node.js + Express + SQLite + WebSocket
3. **Admin Portal** — React + Vite (TypeScript)

Core flow: **users** create assistance requests → **mechanics** accept → **appointments** created → real-time updates via WebSocket → optional **video-call** (Daily.co via WebView).

Two roles: `user` (client) and `mechanic`. The UI adapts per role — mechanics see the assist feed and availability toggle; users see vehicle management and request flow.

Test accounts (phone login):
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

### Backend
```bash
cd server && npm install && node index.js
# API + WS: http://localhost:3000
```

### Admin Portal
```bash
cd admin-portal && npm install && npm run dev
# http://localhost:5173
```

### Deployment
```bash
npm run upload   # Build linux/amd64 images, push to Azure VM (Tailscale: minikube), sync DB, restart pods
npm run local    # Sync prod users → build images → copy DB into pod → restart local k8s pods
```

### Admin Portal dev server
The admin portal vite dev server proxy target is controlled by `admin-portal/.env.local` (gitignored):
- `npm run local` writes `ADMIN_API_TARGET=http://192.168.1.229:3000` → dev server hits local backend
- `npm run upload` writes `ADMIN_API_TARGET=https://t9smggmz3a.us-east-1.awsapprunner.com` → dev server hits prod backend
- Docker/k8s deployments are unaffected (nginx proxies `/api` to `http://server:3000` internally)

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
- `app/(tabs)/_layout.tsx` — tab navigator (assist, appointments, chat, profile)
- `app/(tabs)/assist/` — mechanic job feed + detail
- `app/request-assistance/` — multi-step wizard for users
- `app/setup/` — multi-step registration flow
- `app/chat/[id].tsx` — real-time chat
- `app/video-lobby/[id].tsx`, `app/video-call/[id].tsx` — Daily.co video flow
- `app/appointments/[id].tsx` — appointment detail + actions

### Global State (`context/`)
- `UserContext.tsx` — current session/user
- `AppointmentsContext.tsx` — appointments list + operations
- `SocketContext.tsx` — WebSocket connection, `chatHistory`, real-time events
- `NotificationsContext.tsx` — notification UI state

### Data Layer
- `lib/api/apiClient.ts` — fetch wrapper (GET/POST/PATCH/DELETE)
- `lib/dao/` — client-side DAOs: `UserDAO`, `VehicleDAO`, `AssistanceDAO`, `AppointmentDAO`, `SetupDAO`
- `lib/dao/interfaces.ts` — shared TypeScript interfaces

Screens must use DAOs or Contexts, not raw `fetch`. For new features: add DAO method → expose in Context if global → implement backend endpoint + server DAO.

### Backend (`server/index.js`)
- REST API at `/api/*`
- WS on the same HTTP instance; clients register with `{ type: 'register', userId }`
- `notifyUser(userId, type, payload)` sends real-time events
- `server/dao/` — server-side DAOs (JS): `AssistanceDAO`, `AppointmentDAO`, `UserDAO`, `VehicleDAO`, `SetupDAO`
- SQLite at `server/mechanic.db` — schema documented in `DB.MD`

WS message types in use: `register`, `unregister`, `chat_message`, `assistance_update`, `video_room_ready`, `register_admin`, `user_status_change`.

### Photo Storage (`server/s3client.js`)
- `s3rver` runs internally on `127.0.0.1:4568` (never exposed directly)
- Photos are proxied through Express: `POST /api/photos/upload` → `GET /api/photos/:key`
- Upload returns a full absolute URL (`http://<host>/api/photos/<uuid>.jpg`) — stored as JSON array in `assistance_requests.photos`
- Storage path controlled by `PHOTOS_PATH` env var (default: `path.join(__dirname, 'photos-data')`)
- K8s: PVC `photos-pvc` mounted at `/app/photos`; configmap must include `PHOTOS_PATH=/app/photos`, `S3_USE_LOCAL=true`, `S3_BUCKET=mechanic-photos`
- **Critical**: `appointments` table has no `photos`, `locationLat`, or `locationLng` columns. `AppointmentDAO.getAll()` and `getById()` must `LEFT JOIN assistance_requests ar ON a.id = ar.id` and select `ar.photos`, `ar.locationLat`, `ar.locationLng`. Without this join, maps and photos are always `null` even when data exists.
- Mobile upload: `AssistanceDAO.uploadPhoto(localUri)` in `lib/dao/AssistanceDAO.ts` uses `apiClient.upload()` with `FormData`. The `upload()` method on `apiClient` must NOT set `Content-Type` header manually — fetch sets it with the multipart boundary automatically.
- Max 3 photos per request (enforced in `app/request-assistance/add-details.tsx`)

### Mechanic Bot (`server/bot.js`)
- Simulates a real mechanic for test user `+11111111111` (user-id: `user-111`)
- Acts as mechanic `mech-1` (Shayna Samett — existing seed mechanic)
- Polls every 4s for pending requests from user-111 via `AssistanceDAO.getAll({ userId, status: 'pending' })`
- **Status flow**: sets `'offered'` first (NOT `'accepted'`), because `searching.tsx` listens for `status === 'offered'` to navigate to mechanic-found screen. Only after the user confirms does status become `'accepted'`.
- Bot pre-creates the `appointments` row with `status: 'offered'` so mechanic info is available on the mechanic-found screen.
- After user confirms (`assistance_requests.status → 'accepted'`), bot starts status progression: "On my way" (15s) → "Arrived" (40s) → "Diagnosing" (75s)
- Replies to chat messages directed to `mech-1` with random realistic responses (1.5–3.5s delay)
- Bot is initialized in the async startup block in `server/index.js` via `bot.init(notifyUser)`
- Bot handles WS chat messages: `bot.handleChatMessage(data)` is called from the WS message handler
- **Video calls**: when `POST /api/video-room` is called for an appointment where `mechanicId === 'mech-1'`, the server calls `bot.handleVideoRoomReady(...)`, which delegates to the **video-bot microservice** (`http://video-bot:3002/join`). The bot appears as a real Daily.co participant named "Mechanic" for 2 minutes, then the room is deleted.

### Video Bot Microservice (`video-bot/`)
- Separate K8s deployment (ClusterIP service `video-bot:3002`) — keeps Chromium/Puppeteer out of the main server image
- `video-bot/index.js` — Express server with `POST /join` endpoint
- On `/join`: creates a Daily.co meeting token (user_name: `'Mechanic'`), starts an **Xvfb** virtual display, launches **non-headless Chromium** (fake camera/mic via `--use-fake-ui-for-media-stream`), navigates directly to the Daily.co HTTPS room URL (secure context = WebRTC enabled), clicks the "Join" button, stays 2 minutes, then closes the browser and deletes the Daily.co room via REST API
- **Critical**: must navigate to the actual `https://` Daily.co room URL — loading `about:blank` disables WebRTC (non-secure context). `headless: 'new'` also disables WebRTC; must use `headless: false` + Xvfb
- `video-bot/Dockerfile` — `node:20-alpine` + `chromium`, `xvfb`, `dbus` packages; `puppeteer-core` installed via npm
- K8s manifests: `k8s/video-bot-deployment.yaml`, `k8s/video-bot-service.yaml`

### `appointments` vs `assistance_requests` tables
- Both tables share the same `id` (the assistance request ID)
- `appointments` is the "accepted/active" table; `assistance_requests` is the source of truth for request lifecycle
- When status becomes `'accepted'`, `PATCH /api/assistance/:id` also syncs the `appointments` row status
- `AppointmentsContext` on mobile uses the `appointments` table row when it exists (filtering out the duplicate `assistance_requests` entry by ID)

### Video Call Flow (Daily.co)
1. User requests video call → mechanic accepts → both go to video lobby
2. User starts call → `POST /api/video-room` creates Daily.co room (5-min expiry)
3. Server notifies mechanic via `video_room_ready` WS event (3s polling fallback)
4. Both open full-screen WebView with the room URL + countdown timer
5. If mechanic is the bot (`mech-1`), `bot.handleVideoRoomReady()` is called → video-bot microservice joins Daily.co as a real participant ("Mechanic") for 2 minutes

### User Online Tracking
The `users.isOnline` column is updated purely through WebSocket events — no polling.

**Server (`server/index.js`):**
- `clients` Map — active app WS connections (userId → ws)
- `adminClients` Set — admin portal WS connections for dashboard broadcasts
- On `register` message → `UserDAO.update(userId, { isOnline: 1 })` + broadcast `user_status_change` to all admin clients
- On `unregister` message (explicit logout/background) → `UserDAO.update(userId, { isOnline: 0 })` + broadcast
- On WS `close` event → same offline update (fallback for killed/crashed app)
- `broadcastUserStatus(userId, isOnline, userInfo)` sends `{ type: 'user_status_change', payload: { userId, isOnline, name, surname, role, phone } }` to all admin portal connections

**Mobile (`context/SocketContext.tsx`):**
- Sends `{ type: 'unregister', userId }` explicitly in three cases:
  1. `useEffect` cleanup (user logs out — `user?.id` becomes null)
  2. `AppState 'background'` or `'inactive'` — app goes to background
  3. Re-sends `{ type: 'register', userId }` when `AppState` returns to `'active'`
- `userIdRef` keeps the userId accessible inside event handlers after user state clears

**Admin Portal (`admin-portal/src/pages/Dashboard.tsx`):**
- On mount: fetches all users via `UserAPI.getAll()` (already includes `isOnline` from `SELECT *`)
- Connects WS with `{ type: 'register_admin' }` — receives `user_status_change` events in real time
- Auto-reconnects with 5s backoff if WS drops
- Shows live indicator dot, summary cards (total / online / online users / online mechanics), and two grids (online / offline)
- WS URL derived from `VITE_API_BASE_URL` env var: strips `/api` suffix and replaces `http` → `ws`

**Admin portal credentials:**
- Phone: `+10000000000` (enter as `0000000000` in login form)
- Password: `admin123` (fallback; override with `VITE_ADMIN_PASSWORD` env var)
- User ID: `admin-1`, role: `admin` — seeded in `server/mechanic.db`
- ⚠️ `npm run upload` overwrites the remote DB with the local one — the admin user must exist in the local `server/mechanic.db` before uploading

### Admin Portal (`admin-portal/`)
SPA with react-router-dom + axios. Use `VITE_*` env vars for API URLs.
- `VITE_API_BASE_URL` — HTTP API base (e.g. `https://t9smggmz3a.us-east-1.awsapprunner.com/api`); WS URL is auto-derived from it
- `VITE_ADMIN_PASSWORD` — admin login password (default: `admin123`)

### Firebase Phone Auth (`lib/firebase/auth.ts`)
- Uses `auth().signInWithPhoneNumber(phoneNumber)` — **namespaced API only**. The modular `signInWithPhoneNumber(getAuth(), ...)` does not properly handle the reCAPTCHA fallback on iOS.
- Signs out any existing Firebase user before calling `signInWithPhoneNumber` to avoid `auth/internal-error`.
- **Firebase Blaze billing plan is required** for real SMS on real devices. Test phone numbers (Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing") bypass SMS and work on any plan — use them for local dev to avoid rate limiting.
- `auth/too-many-requests` = device blocked due to too many failed attempts → wait ~1 hour or use a test phone number.
- `auth/internal-error` in <500ms on real device = check Firebase billing (must be Blaze) and verify via: `curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=<API_KEY>" -H "Content-Type: application/json" -d '{"phoneNumber":"+1...","recaptchaToken":"test"}'` — if returns `BILLING_NOT_ENABLED`, upgrade to Blaze.
- APNs forwarding is set up in `ios/Mechanic/AppDelegate.swift` via `withFirebaseAuthAPNS` config plugin — `setAPNSToken(.sandbox)` for DEBUG, `.prod` for release. Required entitlements: `aps-environment: production`, `UIBackgroundModes: remote-notification`.
- Config plugin files: `plugins/withFirebasePodfile.js`, `plugins/withFirebaseAuthAPNS.js` — these survive `expo prebuild --clean` (EAS).
- `firebase/GoogleService-Info.plist` → copied to `ios/Mechanic/GoogleService-Info.plist` during prebuild. Must include `REVERSED_CLIENT_ID` for reCAPTCHA fallback.

### Styling
Mobile: **NativeWind** (Tailwind classes on RN components). Base components in `components/ui/`.

---

## Conventions

- **No SQL in route handlers** — keep all SQL in server DAOs.
- **TypeScript** — avoid `any`; when unavoidable (WS parsing), encapsulate it.
- **Files to ignore** — `._*` (Apple resource forks), `node_modules/`, `.expo/`, build artifacts.
- **Minimal diffs** — prefer small targeted changes; do not refactor surrounding code.

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
| Assistance feed | `app/(tabs)/assist/`, `lib/dao/AssistanceDAO.ts`, `server/dao/AssistanceDAO.js` |
| Appointments | `app/(tabs)/appointments.tsx`, `app/appointments/`, `context/AppointmentsContext.tsx`, `server/dao/AppointmentDAO.js` |
| Chat / realtime | `app/chat/[id].tsx`, `context/SocketContext.tsx`, `server/index.js` |
| Video call | `app/video-lobby/[id].tsx`, `app/video-call/[id].tsx`, `/api/video-room*` in backend |
| DB schema | `DB.MD`, `server/mechanic.db`, `server/dao/` |
| Environment config | `lib/config/ConfigService.ts`, `context/SocketContext.tsx` |
| Photo upload/display | `app/request-assistance/add-details.tsx`, `app/request-assistance/confirmation.tsx`, `lib/dao/AssistanceDAO.ts`, `server/s3client.js`, `server/dao/AppointmentDAO.js`, `components/appointments/UserStatusTab.native.tsx` |
| Appointment map | `components/appointments/UserStatusTab.native.tsx` (user), `components/appointments/MechanicAssistanceInfoTab.native.tsx` (mechanic) — both require `locationLat`/`locationLng` from server DAO join |
| Mechanic bot | `server/bot.js` |
| Video bot (bot Daily.co participant) | `video-bot/index.js`, `k8s/video-bot-deployment.yaml`, `k8s/video-bot-service.yaml` |
| User online tracking | `context/SocketContext.tsx`, `server/index.js` (`broadcastUserStatus`), `admin-portal/src/pages/Dashboard.tsx` |
| Admin portal dashboard | `admin-portal/src/pages/Dashboard.tsx`, `admin-portal/src/App.tsx` |

---

## Kubernetes (Remote Minikube on Azure)

- **Production cluster**: Remote Minikube on Azure VM at `20.124.131.193`
- **kubeconfig**: `~/.kube/minikube-azure-config` — always prefix kubectl with `KUBECONFIG=$HOME/.kube/minikube-azure-config kubectl ...`
- **Tailscale**: remote host is accessible as `minikube` via Tailscale (IP `100.73.30.97`) — no SSH tunnel needed
- **Deploy**: `npm run upload` — builds linux/amd64 images, SCPs to Azure VM, loads into Minikube, syncs SQLite DB, restarts pods
- **Never** apply manifests with `kubectl apply` alone on this machine without `KUBECONFIG` set — it will attempt localhost:8080 (default kubeconfig = docker-desktop or nothing)

### Required K8s resources for photos
All three must be applied to the remote cluster for photos to work:
1. `k8s/photos-pvc.yaml` — 5Gi PVC (`photos-pvc`)
2. `k8s/configmap.yaml` — must include `PHOTOS_PATH`, `S3_USE_LOCAL`, `S3_BUCKET`
3. `k8s/server-deployment.yaml` — must mount `photos-pvc` at `/app/photos`

### DB sync behavior
- `npm run upload` copies the local `server/mechanic.db` into the running pod — this **overwrites the remote DB**. Every upload wipes all remote users, appointments, and registrations. The admin user (`admin-1`) must always be present in the local DB before uploading. Consider pulling the remote DB before uploading if there is production data worth keeping.
- `npm run local` runs `scripts/sync-users-from-prod.sh` (downloads prod DB users via SSH → Tailscale), then rebuilds images, then copies the local DB into the running pod and restarts. The pod's PVC at `/app/db` overrides the image's DB — always copy after restart.
- `scripts/sync-users-from-prod.sh` skips `admin-1` and `mech-1` (local seed accounts). Uses explicit column list for `users` INSERT to handle schema diff (prod may lack `firebaseUid` column).

### Admin portal login (`server/dao/UserDAO.js` `getByPhone`)
- `getByPhone` normalizes the input phone to 10 digits, then queries with two OR conditions: exact match AND `'1' || phone` (11-digit with country code).
- Uses `ORDER BY CASE WHEN ... = '1' || ? THEN 0 ELSE 1 END LIMIT 1` to prefer the 11-digit match — prevents `(000) 000-0000` from matching before `+10000000000` (admin-1).
- `db.get` call passes **3 params**: `[cleanedPhone, cleanedPhone, cleanedPhone]` matching the 3 `?` placeholders (2 in WHERE + 1 in ORDER BY CASE).
