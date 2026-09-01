# Backend contract (reference)

La implementación del backend vive en un **repo separado** (no está en este
workspace). Se documenta acá porque el comportamiento de la app móvil depende de
este contrato.

## REST + WebSocket

- REST API en `/api/*`; WS en el mismo host. Los clientes se registran con
  `{ type: 'register', userId }`.
- Tipos de mensaje WS en uso: `register`, `unregister`, `chat_message`,
  `assistance_update`, `video_room_ready`, `register_admin`, `user_status_change`.

## Tablas `appointments` vs `assistance_requests`

Ambas comparten el mismo `id` (el ID de la assistance request). `appointments` es
el registro "aceptado/activo"; `assistance_requests` es la fuente de verdad del
ciclo de vida del request. `AppointmentsContext` en mobile usa la fila de
`appointments` cuando existe, filtrando el duplicado de `assistance_requests` por ID.

## Fotos y videos

El upload devuelve una URL absoluta completa, guardada dentro del JSON de
`photos`. Los uploads mobile son `AssistanceDAO.uploadPhoto(localUri)`
(`POST /api/photos/upload`, imágenes, 5 MB) y `AssistanceDAO.uploadVideo(localUri)`
(`POST /api/videos/upload`, mp4/mov/webm, 50 MB), ambos con `apiClient.upload()` y
`FormData` — el método `upload()` **no** debe setear `Content-Type` manual (fetch lo
pone con el boundary multipart automáticamente). Máximo 3 fotos + 1 video por
request, enforceado en `app/(tabs)/request-assistance/vehicle-documentation.tsx`.

`photos` guarda un array JSON de `{ url, type: 'photo' | 'video', note? }`. Los
requests creados antes de los videos tienen un array de strings; todo lector pasa
por `parseAttachments()` (`lib/media/attachments.ts`) y renderiza con
`components/appointments/AttachmentStrip.tsx`.

`GET /uploads/:filename` responde a `Range` (206) para que el video se pueda
reproducir en iOS.

## Mechanic test bot

Simula un mecánico real para el usuario de prueba `+11111111111` (actúa como
mecánico `mech-1`, Shayna Samett). Setea el status de la asistencia a `'offered'`
primero (no `'accepted'`) — `searching.tsx` escucha `status === 'offered'` para
navegar a la pantalla mechanic-found; el status pasa a `'accepted'` recién cuando el
usuario confirma. Después de confirmar progresa: "On my way" (~15s) → "Arrived"
(~40s) → "Diagnosing" (~75s). Útil al debuggear por qué una transición de status en
dispositivo parece lenta o fuera de orden.

## Video calls

`POST /api/video-room` crea una sala Daily.co; el server notifica al mecánico vía
evento WS `video_room_ready` (con fallback de polling de 3s). Si el mecánico es el
test bot, un microservicio video-bot aparte se une a la llamada como participante
real de Daily.co por ~2 minutos.

## Video Call Flow (Daily.co, SDK nativo)

1. Usuario pide videollamada → mecánico acepta → ambos van al lobby
   (`app/(tabs)/video-lobby/[id].tsx`).
2. Usuario inicia la llamada → backend crea la sala Daily.co.
3. Ambos se unen vía `lib/video/useDailyCall.ts` (SDK nativo de Daily, no WebView).
4. `components/video/CallControls.tsx`, `components/video/VideoTile.tsx` renderizan
   la UI de la llamada.

## User Online Tracking (lado mobile)

El flag `users.isOnline` se maneja puramente por eventos WebSocket en mobile — sin
polling:

- `context/SocketContext.tsx` envía `{ type: 'unregister', userId }` explícitamente
  en tres casos: al logout (`user?.id` pasa a null), cuando `AppState` va a
  `'background'`/`'inactive'`, y reenvía `{ type: 'register', userId }` cuando
  `AppState` vuelve a `'active'`.
- `userIdRef` mantiene el userId accesible dentro de los handlers después de que el
  estado del usuario se limpie.
- El broadcast del lado server a los clientes admin y el dashboard live del admin
  portal están implementados en el repo separado de backend/admin-portal.
