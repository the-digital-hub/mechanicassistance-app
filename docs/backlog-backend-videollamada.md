# Backlog para backend — videollamada (para Alejandro)

**Fecha:** 18-nov-2026 · **De:** app mobile · **Detalle completo de cada punto:** [backend-brief-videollamada.md](backend-brief-videollamada.md)
(las referencias `§` de abajo apuntan a ese documento).

Cuando estén hechos, avisar a la app: cada punto dice **cómo lo vamos a verificar** (contra producción, no solo contra la documentación;
ya pasó que algo figuraba como hecho en el README y producción lo rechazaba).

Leyenda de prioridad: 🔴 bloquea o es de cumplimiento · 🟠 importante · 🟡 cuando haya capacidad.

---

## 🔴 1. Hacer primero

### [ ] B — Cotización con `duration_minutes` (§4.1)
- **Problema:** `POST /api/pricing/calculate` y `POST /api/pricing/requests/:id/price` responden **400 "property duration_minutes should not exist"** en producción (re-verificado el 18-nov 16:14 UTC). El README dice que ya se acepta: falta desplegar price-service.
- **Hecho cuando:** ambos endpoints aceptan `duration_minutes` (alias `durationMinutes`) y devuelven el precio de la duración elegida (60/70/80 base + franja).
- **Cómo lo verificamos:** en la app, elegir 15/30/45 min en "Plan your video call" y ver el precio en el resumen (hoy muestra el del menú porque la cotización falla).

### [ ] N — Poder agendar a cualquier hora, aunque no haya técnicos cargados (§5.10)
- **Problema:** `GET /video-call/slots` ya devuelve 24 h (00:00–23:30), pero marca `available: false, reason: 'no_mechanics'` fuera de 07:00–18:00 (EST) y `create()` (`assertBookable`) rechaza esos turnos con `409 slot_unavailable`. Producto: la videollamada se pide 24/7; si nadie la acepta, se cancela sin cargo.
- **Hacer:** que `POST /api/assistance` (videocall agendada) **no rechace** por `no_mechanics` (sí por `past`, demasiado próximo, `full`, fuera de grilla). En `/slots`, devolver `available: true` + campo informativo (ej. `staffed: false`), o mantener `no_mechanics` (la app ya los trata como reservables; avisar cuál se elige). Definir cancelación automática sin cargo si nadie acepta al llegar la hora, con aviso al dueño.
- **Cómo lo verificamos:** agendar un turno de madrugada desde la app y que se cree la solicitud.

### [ ] O — Zona horaria del dueño en la videollamada agendada (§5.11)
- **Problema:** el técnico puede estar en otra zona que el dueño y leer una hora distinta del mismo turno.
- **Hacer:** aceptar `timezone` (IANA válido) en `POST /api/assistance` (videocall agendada), guardarlo (`assistance_requests.timezone`, nullable) y devolverlo en `GET /api/assistance`, `/assistance/:id`, `GET /appointments` y `/appointments/:id`. La app ya lo manda (si el backend lo rechaza reintenta sin él).
- **Cómo lo verificamos:** pedir una videollamada agendada con un teléfono en otra zona y ver el recuadro "El cliente está en otra zona horaria" con las dos horas en la oferta del técnico.

### [ ] Q — Registro de consentimientos y cumplimiento (§5.13)
- **Hacer:** `POST /api/appointments/:id/video/consent` `{ version, kind: 'precall'|'captions-request'|'captions-answer', role, accepted, at }` (rol desde la sesión; solo dueño y técnico de la cita; otro → 403; idempotente). Guardar con hora del servidor. **Exigirlo del lado servidor:** no emitir ni guardar transcripción sin `precall` aceptado de ambos y `captions-answer` aceptado de quien no pidió; si Daily transcribe igual, descartar el archivo. Devolver `consents[]` en `GET …/video/transcript`.
- **Definir con legal:** textos con versión, retención del texto y del registro. **El texto actual de la app es un borrador, no asesoría legal.**
- **Cómo lo verificamos:** aceptar en la pantalla previa de ambos teléfonos y ver las filas guardadas; intentar transcribir sin aceptación y que no se guarde nada.

### [ ] R — Un problema "Otro" que se pueda cotizar (§5.14)
- **Problema:** la app ya tiene una tarjeta "Other" en la pantalla de problemas (inmediata y videollamada) con texto libre, pero sin un issue de catálogo la solicitud no se puede cotizar (queda `TBD`) y el texto viaja mezclado en el título.
- **Hacer:** un issue "Other" en `vehicle-issue-catalog` (UUID, traducciones, precio por defecto definido por producto) y un campo opcional `customIssue` (≤ 200) en `POST /api/assistance`, detalle y listado.
- **Cómo lo verificamos:** pedir una asistencia solo con "Other" y ver que tenga precio y que el técnico lea el texto en la oferta.

---

## 🟠 2. Importantes

### [ ] P — Guardar la transcripción como dato de la cita (§5.12)
- **Hacer:** al terminar la transcripción de la sala, tomar el archivo de Daily (webhook `transcript.ready-to-download` o `GET api.daily.co/v1/transcript?roomName=…`) y guardarlo asociado a la cita. `GET /api/appointments/:id/video/transcript` (dueño, técnico de la cita, admin; otro → 403; sin transcripción → 404) → `{ appointmentId, language, consents[], lines: [{ id, role: 'owner'|'mechanic', name?, text, at }] }`. Verificar con Daily que la transcripción en tiempo real deja archivo en la cuenta.
- **Depende de:** Q.
- **Cómo lo verificamos:** hacer una llamada con subtítulos y ver que el botón "Transcripción de la llamada" muestre el texto del servidor (hoy dice "Guardada solo en este teléfono").

### [ ] L — Habilitar la transcripción en Daily y permisos en el token (§5.8)
- **Hacer:** confirmar transcripción habilitada en el dominio de Daily (plan, ya funciona en pruebas) y que el **meeting token del dueño** (no solo el del técnico, que ya es `is_owner`) permita iniciar la transcripción. Precios Daily al 18-nov: USD 0.0059/min por participante con micrófono activo (tiempo real).
- **Cómo lo verificamos:** que el dueño pueda activar los subtítulos desde su teléfono.

### [ ] M — Push al técnico cuando el dueño pide más tiempo (§5.9)
- **Problema:** la solicitud de extensión solo llega por WebSocket ("sin push"); con la app cerrada el pedido vence (`extension_response_seconds`, 60 s por defecto).
- **Hacer:** al crear una extensión `requested`, push al técnico (sin monto ni medio de pago) que abra `/appointments/:id`.
- **Cómo lo verificamos:** pedir tiempo extra con la app del técnico cerrada y recibir el push.

### [ ] K — Cuánto gana el técnico por cada extensión (§5.7)
- **Hacer:** en `GET …/video/extensions`, para el técnico, agregar `providerAmount` por extensión (neto del platform fee, sin impuestos ni medio de pago) y `providerAmountTotal`. Confirmar que `provider_payout` sube recién al aceptar la extensión.
- **Cómo lo verificamos:** en el Budget del técnico, la fila "Extended time" muestra "+15 min · $X" desde el dato del servidor (hoy la app lo deduce por diferencia).

### [ ] J — Saber quién está conectado en la sala (§5.6)
- **Hacer:** en `GET /api/video-room/:id` (o `/video`) devolver `participants: { owner, mechanic }` (webhooks `participant.joined/left` de Daily) y publicar `video_call_update` con `stage: 'participant_joined'|'participant_left'`.
- **Cómo lo verificamos:** la tarjeta "El cliente ya está en la sala" aparece y desaparece en vivo, sin falsos positivos.

---

## 🟡 3. Cuando haya capacidad

### [ ] E — `offerExpiresAt` en el listado de pedidos (§5.1)
- Hoy solo está en `GET /assistance/:id/offer-summary` y como columna. Agregarlo a `GET /api/assistance` (listado/feed).

### [ ] Actualizar la documentación (repo de análisis)
- Turnos de `/video-call/slots`: ahora son 24 h, 48 por día (el README dice 08:00–19:30), y `period` incluye `night`.
- Documentar lo que se agregue de O, N, Q, P, K, J, M.

---

## ✅ Ya hecho según la documentación — solo confirmar que está desplegado

| Punto | Qué | Cómo lo confirmamos |
|---|---|---|
| **A** | El técnico aprueba las extensiones (`requireApproval`, accept/decline, `pendingRequest`, eventos) y flag `extension_approval_enabled` | Con el flag prendido, el dueño pide tiempo y al técnico le aparece Aceptar/Rechazar |
| **C** | `GET /api/assistance/:id` devuelve `durationMinutes` | La oferta del técnico muestra la duración antes de aceptar |
| **D** | `baseMinutes` = duración elegida de esa llamada; sala de Daily con esa duración | El contador arranca en 15/30/45 según lo elegido |
| **F** | `assistanceRequestId` en `walletMovements` | La actividad del wallet muestra el servicio |
| **G** | La videollamada no usa radio de servicio | Un técnico lejano recibe la oferta de videollamada |
| **H** | Corte anticipado → disputa del dueño; lista de disputas del Hub con `contractedMinutes` | El técnico finaliza antes y el dueño puede reclamar |
| **I** | Grilla de turnos de 24 h | ✅ Verificado en producción el 18-nov |

---

## Orden sugerido
1. **B** (desbloquea el precio) → 2. **N** y **O** (agendar 24/7 sin errores de hora) → 3. **Q** (con legal) → 4. **P**, **L** → 5. **M**, **K**, **J** → 6. **E** y documentación.
