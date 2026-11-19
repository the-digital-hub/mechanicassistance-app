# Backlog para backend (para Alejandro)

**Fecha:** 18-nov-2026 · **De:** app mobile · **Detalle completo de cada punto:** [backend-brief.md](backend-brief.md)
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

### [ ] S — Avisar al técnico cuando otro técnico ya tomó la solicitud
- **Problema (visto el 18-nov):** un técnico estaba por ofertar en una videollamada; el cliente confirmó a otro técnico y el primero se quedó en la pantalla de la oferta, sin aviso. La app ahora vuelve a consultar la solicitud (al abrir, cada 15 s, al volver a la app y antes de enviar), pero eso es un parche: el servidor no le avisa.
- **Hacer:**
  1. **Evento en tiempo real.** Cuando una solicitud deja de estar abierta (el cliente confirma a un técnico, se cancela o vence), publicar `assistance_update` (o un `request_taken`) a **los demás técnicos que la tienen en su feed o abierta**, con `{ requestId, status, mechanicId? }`. Hoy el feed solo se entera si el técnico vuelve a cargar.
  2. **Error claro al ofertar sobre una solicitud ya cerrada.** `PATCH /api/assistance/:id` con `status: 'offered'` sobre una solicitud ya tomada o cancelada debe responder **409** con `error.code: 'request_unavailable'` y el `status` actual (hoy la app no distingue ese caso de un error cualquiera).
  3. **Qué ve el técnico que no ganó.** `GET /api/assistance/:id` para un técnico que no es el asignado: documentar si responde 200 con el estado nuevo, 403 o 404 (la app trata 403/404/409 como "la tomó otro"; con 200 usa `status` y `mechanicId`).
  4. Sacar la solicitud del listado `GET /api/assistance` (feed) de los otros técnicos apenas se toma.
- **Cómo lo verificamos:** con dos técnicos viendo la misma videollamada, el cliente confirma a uno; el otro recibe el aviso "Otro técnico tomó esta videollamada" al instante y no puede ofertar; y si intenta ofertar justo en ese momento, recibe el 409 `request_unavailable`.

### [ ] T — Confirmar que una duración nueva del menú (ej. 60 min) funciona de punta a punta
- **Contexto:** el menú de duraciones sale del Hub (`videocall_settings.duration_options`, 1 a 6 opciones) y llega a la app en `durations` de `GET /api/video-call/now`. El 18-nov se agregó una opción de **60 min** en el Hub y, pasado el caché de 60 s de `VideoCallPricingClient`, ya aparece en la app (15/30/45/60). Falta confirmar el resto de la cadena.
- **Hacer:** con una opción nueva en el menú, comprobar que (a) `GET /api/video-call/now` la devuelve con su precio (ya se ve en la app), (b) `POST /api/assistance` acepta `durationMinutes: 60` (no `invalid_duration`), (c) `POST /api/pricing/calculate` devuelve el precio de esa duración (ver B), (d) la sala de Daily y `baseMinutes` quedan en 60 y el contador arranca en 60:00.
- **Cómo lo verificamos:** en "Plan your video call" aparece "60 min" y el resumen muestra su precio; al pedir la llamada, el técnico ve la duración de 60 min antes de aceptar.

### [ ] P — Guardar la transcripción como dato de la cita (§5.12)
- **Hacer:** al terminar la transcripción de la sala, tomar el archivo de Daily (webhook `transcript.ready-to-download` o `GET api.daily.co/v1/transcript?roomName=…`) y guardarlo asociado a la cita. `GET /api/appointments/:id/video/transcript` (dueño, técnico de la cita, admin; otro → 403; sin transcripción → 404) → `{ appointmentId, language, consents[], lines: [{ id, role: 'owner'|'mechanic', name?, text, at }] }`. Verificar con Daily que la transcripción en tiempo real deja archivo en la cuenta.
- **Depende de:** Q.
- **Cómo lo verificamos:** hacer una llamada con subtítulos y ver que el botón "Transcripción de la llamada" muestre el texto del servidor (hoy dice "Guardada solo en este teléfono").

### [ ] U — Recibir la transcripción que sube la app, anidada a la solicitud (§5.12)
- **Qué se quiere (19-nov):** que el texto de la llamada que hoy queda solo en cada teléfono se **envíe al backend y quede anidado a la solicitud / cita**, para verlo desde cualquiera de los dos teléfonos, desde el Hub y en disputas.
- **Hacer:** `PUT /api/appointments/:id/video/transcript` (dueño o técnico de esa cita; otro → 403) con `{ language, lines: [{ id, role, name?, text, at }] }`, idempotente por `id` de línea y combinando las líneas de los dos teléfonos sin repetirlas; solo con los consentimientos registrados (Q, si no 409 `consent_required`); `GET …/video/transcript` devuelve el texto combinado. Detalle en el brief §5.12 ("Pedido adicional").
- **Relación con P:** P toma la transcripción de Daily en el servidor; U es el envío desde la app. Pueden convivir (el servidor deduplica por `id`) o U puede ir primero si P tarda.
- **Cómo lo verificamos:** hacer una llamada con subtítulos, terminarla y ver que la transcripción aparece en la cita desde el otro teléfono, aunque ese no haya tenido los subtítulos encendidos.

### [ ] V — Traducción de los subtítulos de la llamada (§5.15)
- **Qué se quiere (19-nov):** que quien habla español y quien habla inglés se entiendan en la videollamada: cada uno lee los subtítulos **en su propio idioma**. Daily no traduce (su transcripción, de Deepgram, solo pasa voz a texto); hay que armarlo encima.
- **Hacer:** `POST /api/appointments/:id/video/translate` (dueño o técnico de la cita; otro → 403) con `{ from, to, lines: [{ id, text }] }` → `{ lines: [{ id, text }] }` traducidas, usando el modelo de lenguaje que defina producto. Solo con los consentimientos de la llamada registrados (Q) **y** una aceptación nueva de ambos de que el texto se envía a un tercero para traducirlo (`kind: 'translation'` en el registro de consentimientos). Límite por minuto por persona y por llamada; sin guardar el texto traducido salvo que la transcripción (P/U) ya lo guarde.
- **Costo:** se suma a la transcripción de Daily (USD 0.0059 por minuto con micrófono activo). Estimar el costo por minuto de llamada antes de ofrecerlo, y decidir si es de pago o parte del servicio.
- **La app:** recibe cada frase final (`transcription-message`), la manda a este endpoint y muestra la traducción en la barra de subtítulos; ya tiene el selector de idioma de los subtítulos.
- **Definir con legal/producto:** consentimiento adicional, retención, y si el original y la traducción se guardan en la transcripción.
- **Cómo lo verificamos:** una llamada con un teléfono en español y otro en inglés; cada uno ve los subtítulos en su idioma con un retraso de segundos.

### [ ] W — Agente de recomendaciones de cuidado del vehículo (§5.16)
- **Qué se quiere (19-nov):** en la home del dueño, sección "Vehicle care & activity", mostrar **recomendaciones de mantenimiento por vehículo** (cambio de aceite, frenos, neumáticos, batería, etc.) calculadas por un **agente** en el backend, en lugar de reglas fijas escritas a mano en la app.
- **Datos que ya existen para alimentarlo:** marca, modelo, año, VIN, kilometraje (que el dueño actualiza), historial de servicios completados (`appointments`), reportes OBD que sube el dueño (códigos leídos) y los pagos asociados.
- **Hacer:**
  - `GET /api/vehicles/:id/care-recommendations` → `{ items: [{ id, title, reason, category, urgency: 'now'|'soon'|'later', dueAtMileage?, dueAt?, suggestedService?: { assistanceTypeId, issueId? }, estimateRange?, source: 'schedule'|'history'|'obd'|'agent', updatedAt }] }` (máximo 5, ordenadas por urgencia). Solo el dueño del vehículo; otro → 403.
  - `POST /api/vehicles/:id/care-recommendations/:recId/{dismiss|snooze|done}` (`snooze` con `days`). Lo que el dueño descarta no vuelve a aparecer hasta que cambie el motivo.
  - Guardar el **historial de kilometraje con fecha** (hoy `PATCH /vehicles/:id { mileage }` solo guarda el último valor): el agente lo necesita para estimar cuánto maneja la persona.
  - El agente corre **por evento** (servicio completado, kilometraje actualizado, reporte OBD recibido, vehículo agregado) y **una vez por semana**; el resultado se guarda y la app solo lo lee (nunca se calcula al abrir la pantalla).
  - Avisar por push (notifications-service) cuando una recomendación pasa a `now`, con tope de un aviso por vehículo por semana y respetando los permisos de notificación.
- **Reglas del agente (definir con producto):** apoyarse en el plan de mantenimiento del fabricante (fuente de datos a elegir) y en el historial real; **no inventar** datos que no tenga (si falta el kilometraje o el modelo, pedirlo en vez de adivinar); nunca decir que algo "es seguro" ni diagnosticar, solo recomendar revisar; textos en el idioma de la app (`Accept-Language`); sin datos personales (nombre, teléfono, dirección) en lo que se envíe al modelo, solo datos del vehículo.
- **Costo y límites:** estimar el costo por vehículo por mes; límite de corridas por vehículo por día; si el agente falla, la app muestra lo último guardado (o nada), nunca un error.
- **La app:** debajo de la tarjeta del vehículo, hasta 3 recomendaciones con su urgencia; tocar una abre "Pedir asistencia" con el servicio sugerido ya elegido; opciones para descartar o posponer. Mientras el endpoint no exista, la sección no se muestra.
- **Cómo lo verificamos:** un vehículo con 60.000 km y sin cambio de aceite en el historial recibe esa recomendación; al cargar el servicio completado o descartarla, desaparece; sin kilometraje, pide cargarlo.

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
1. **B** (desbloquea el precio; con **T** se comprueba la duración de 60 min) → 2. **N** y **O** (agendar 24/7 sin errores de hora) y **S** (aviso cuando otro técnico toma la solicitud) → 3. **Q** (con legal) → 4. **P**, **U**, **L** (y, si producto lo quiere, **V**) → **W** (agente de recomendaciones; necesita decisiones de producto antes de empezar) → 5. **M**, **K**, **J** → 6. **E** y documentación.
