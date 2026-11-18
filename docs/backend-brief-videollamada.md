# Brief para backend — videollamada: duración elegida, extensiones con aprobación del técnico y puntos abiertos

**Para:** desarrollador/a de backend (`appointments-service`, `mechanicassistance-service-price`, billing, `api-gateway`).
**De:** app mobile (Expo / React Native). **Fecha:** 17-nov-2026.
**Fuentes revisadas:** repo de análisis `the-digital-hub/mechanicassistance-analisis` (`servicios/appointments/README.md`,
`servicios/price/README.md`, `servicios/billing/01-logica-de-pagos.md`, `portales/app/README.md`) y el código de la app.
Todo lo que sigue se contrastó contra esos documentos; donde algo **no se pudo comprobar** está marcado como *verificar*.

---

## 0. Resumen y prioridades

| # | Tema | Estado | Qué se pide | Prioridad |
|---|---|---|---|---|
| **A** | El técnico aprueba las extensiones | **Hecho en backend (docs 18-nov) y en la app.** Falta verificar el despliegue y prender el flag | Confirmar que está desplegado (§3.10) | Alta |
| B | Cotización con `duration_minutes` | **Documentado como hecho (price README §5), pero SIGUE FALLANDO en producción: re-verificado el 18-nov 16:14 UTC, `POST /api/pricing/calculate` con `duration_minutes` → 400 "property duration_minutes should not exist"** | Desplegar/confirmar price-service con el campo (§4.1) | **Bloqueante** |
| C | `durationMinutes` en el detalle del pedido que ve el técnico | **Documentado como hecho** (appointments README: "el detalle de la solicitud lo devuelve"). Falta verificar en prod | Solo verificar el despliegue (§4.2) | Media |
| D | `baseMinutes` del estado de la llamada = duración elegida | **Documentado como hecho** (`baseMinutes` = duración elegida de esa llamada; sala de Daily con `exp` de esa duración). Falta verificar en prod | Solo verificar el despliegue (§4.3) | Media |
| E | `offerExpiresAt` en el listado de pedidos | **Sigue abierto:** la documentación solo lo muestra en `GET /assistance/:id/offer-summary` y como columna, no en el listado | Confirmar o agregarlo al listado (§5.1) | Media |
| F | Movimientos de wallet con el servicio al que pertenecen | **Hecho en backend (docs 18-nov) y en la app** | Verificar el despliegue (§5.2) | Baja |
| G | Radio de servicio | **Casi cerrado:** presencial con tope 100 mi (docs 16-nov); la videollamada "no tiene ubicación" y `latitude`/`longitude` son opcionales, así que no usa radio. No hay una frase explícita sobre el emparejamiento | Solo confirmar que no filtra por distancia (§5.3) | Baja |
| I | Horarios para agendar: solo 08:00–19:30; la videollamada se pide 24/7 | **Hecho en producción (verificado el 18-nov en `GET /api/video-call/slots`):** 48 turnos por día, 00:00–23:30, con `period` `night`/`morning`/`afternoon`/`evening`. La documentación aún dice 08:00–19:30. Queda una decisión: `available` hoy solo es true de 07:00 a 18:00 (EST) porque sigue la disponibilidad de los técnicos | Actualizar la documentación; decidir si de noche se puede agendar sin técnicos cargados (§5.5) | Media |
| H | Corte anticipado por el técnico → disputa del dueño | **Documentado como hecho:** el técnico finaliza → `awaiting_confirmation` → el dueño puede reclamar (`POST …/video/dispute`); la lista de disputas del Hub trae `callStartedAt`, `finishedAt` y `contractedMinutes` | Nada que hacer; solo verificar (§5.4) | Baja |
| R | Un problema "Otro" que se pueda cotizar (asistencia inmediata y videollamada) | **Nuevo, falta backend** | Un issue "Other" real en el catálogo, con precio, y un campo para el texto libre (§5.14) | **Alta** |
| Q | Registro de consentimientos de la videollamada (cumplimiento) | **Nuevo, falta backend; revisar con legal** | `POST …/video/consent`, guardarlo y exigirlo antes de transcribir (§5.13) | **Alta** |
| P | Guardar la transcripción de la llamada y mostrarla en la cita | **Nuevo, falta backend** | Guardar la transcripción de Daily y exponer `GET …/video/transcript` (§5.12) | Media |
| O | Zona horaria del dueño en la videollamada agendada | **Nuevo, falta backend** | Aceptar y devolver `timezone` (IANA) en la solicitud (§5.11) | **Alta** |
| N | Agendar videollamada en turnos sin técnicos de guardia | **Nuevo, falta backend (producto lo pide)** | Que `create()` acepte turnos `no_mechanics`; `available` o equivalente en `/slots` (§5.10) | **Alta** |
| J | Saber si el cliente ya está en la sala de video | **Abierto:** no está en la documentación (solo `video_room_ready` a la otra parte) | Informar quién está conectado en la sala (§5.6) | Media |
| K | Cuánto gana el técnico por cada extensión | **Abierto:** la documentación dice que el técnico ve las extensiones "sin monto" | Exponer el pago al técnico por extensión (§5.7) | Media |
| M | Push al técnico cuando el dueño pide más tiempo | **Abierto:** la documentación dice "sin push" para `video_call_update` | Enviar push con el pedido de extensión (§5.9) | Media |
| L | Subtítulos / transcripción en vivo | **Abierto:** la documentación no menciona transcripción; app lista | Habilitar transcripción y permisos en el token; decidir guardado (§5.8) | Media |

Lo que **ya está hecho y la app ya usa** (no hay que tocar): `durationMinutes` en `POST /api/assistance`,
`durations` en `GET /api/video-call/now`, `duration_minutes` en `POST /api/pricing/calculate` y
`POST /api/pricing/requests/:id/price`, error `400 invalid_duration`, precios base 60/70/80 con recargo por franja,
extensiones por bloques de USD 15 base con banda e impuesto.

### Revisión 18-nov-2026 contra el repo de análisis (commit `743b677`)
Desde `8b3ec32` el repo solo sumó documentación del servicio de chat: **no hay cambios nuevos de videollamada**. Resultado de
contrastar cada punto con `servicios/appointments/README.md`, `servicios/price/README.md` y `servicios/billing/`:
- **Ya documentados como hechos por backend (solo falta verificar el despliegue):** A, C, D, F, H.
- **Casi cerrado:** G (la videollamada no usa ubicación ni radio).
- **Verificado en producción (18-nov):** I (grilla de 24 h, hecho), B (sigue fallando con 400) y N (los turnos nocturnos siguen `available: false`, `no_mechanics`).
- **Siguen abiertos:** B (en prod), E, J, K, L, M.
- Ojo: "documentado" no es "desplegado"; el 17-nov B figuraba en el README y producción igual lo rechazaba.

### Actualización 18-nov-2026 (tras revisar el repo de análisis, commit `8b3ec32`)
Backend publicó en la documentación: aprobación del técnico para extensiones (§3 completo, con `requireApproval`,
`accept`/`decline`, `pendingRequest` y los cinco `stage`), `assistanceRequestId` en `walletMovements`, tope de radio de 100 mi
y la lista de disputas con `contractedMinutes`. **La app ya implementa** la aprobación (panel del dueño "Esperando al
técnico…", tarjeta Aceptar/Rechazar del técnico, reintento) y usa `assistanceRequestId`.

**Pendiente de verificar en producción (la documentación y el despliegue no siempre coinciden):**
1. **B sigue sin cumplirse en prod:** `price-service` rechaza `duration_minutes` (ver §4.1) aunque el README dice que sí.
2. Que el despliegue de appointments incluya el flujo de aprobación (`requireApproval` en el DTO). Si no, la app hace
   fallback a compra directa al recibir `400 … should not exist`.
3. Que el flag `extension_approval_enabled` quede en `false` hasta publicar la app del técnico (la app nueva ya sabe
   aceptar/rechazar; las viejas no).

---

## 1. Qué hace la app hoy (contrato que consume)

### 1.1 Selector de duración — `app/(tabs)/request-assistance/when.tsx`
- Pide `GET /api/video-call/now` y pinta tres tarjetas con `durations[]` (`minutes`, `price` base). Sin `durations`
  usa 15/30/45 a 60/70/80 como respaldo.
- La duración **es obligatoria y no tiene opción preseleccionada**: sin elegirla, el botón queda bloqueado
  ("Elegí la duración").
- Con duración elegida cotiza: `POST /api/pricing/calculate`
  ```json
  { "assistance_type": "videocall", "timezone": "America/New_York", "duration_minutes": 30, "service_at": "<ISO, solo si agenda>" }
  ```
  y muestra `pricing_breakdown.final_price` tal cual.
- Crea el pedido con `durationMinutes` (`POST /api/assistance`, `assistanceType: "videocall"`) y luego persiste
  `POST /api/pricing/requests/:id/price` con el mismo `duration_minutes`.
- Aclara en pantalla que el precio es base y que puede llevar recargo por franja horaria e impuestos.

### 1.2 Agendar
Usa `GET /api/video-call/slots?timezone=<IANA>&days=14`. Solo se muestran turnos con `available: true`; la app
**no** muestra cupos tomados ni "turnos disponibles".

### 1.3 Durante la llamada
- Indicador, aviso de "quedan 5 minutos", corte automático, lobby y tarjeta de tiempo leen
  `baseMinutes` / `contractedMinutes` del estado de la llamada (`GET /api/appointments/:id/video`) y de
  `GET …/video/extensions`. La app **no** calcula tiempo por su cuenta: usa `elapsedSeconds` del servidor.
- El dueño compra tiempo con `POST /api/appointments/:id/video/extensions { minutes, idempotencyKey, paymentMethodId? }`.
- Ante `video_call_update` (cualquier `stage`) ambos teléfonos recargan el estado.

### 1.4 Técnico
En el detalle del pedido (`GET /api/assistance/:id`) la app muestra "La llamada dura N min" con
`durationMinutes`; si falta, cae a `baseMinutes` de `GET /video-call/now`.

---

## 2. Decisiones de producto ya tomadas (no reabrir)

1. Duraciones 15 / 30 / 45 min a USD 60 / 70 / 80 **base**; **llevan recargo por franja horaria** (igual que hoy).
2. Cada extensión: **USD 15** (base); el recargo por franja **también aplica** a las extensiones.
3. El técnico **ve la duración elegida antes de aceptar** el pedido.
4. Si la llamada se corta antes de tiempo por parte de quien **no paga** (el técnico): sin prorrateo ni reembolso
   automático; **va a disputa** (flujo existente).
5. **Cuando el dueño pide más tiempo, el técnico lo tiene que aceptar en su pantalla** → §3.

---

## 3. A — Aprobación del técnico para las extensiones (backend documentado el 18-nov; app implementada)

### 3.1 Comportamiento actual (por qué hay que cambiarlo)
Según `servicios/appointments/README.md` ("Tiempo extra", `video-extensions.service.ts`):
- Solo el **dueño** (o admin) compra; el mecánico recibe 403.
- `POST …/video/extensions` hace `holdExtra` (`purpose: scope_change`, clave
  `hold:{id}:scope:video-ext:{idempotencyKey}`); si retiene: `held`, sube `assistance_requests.price` y
  `provider_payout`, extiende la sala de Daily (`POST /v1/rooms/:name` con nuevo `exp`) y publica
  `video_call_update` `stage: extended` **a ambas partes**.
- Si el dinero se rechaza: `failed`, 402; con pagos apagados o sin medio: `unpaid` y el tiempo se suma igual.
- Tope: `maxExtensions` extensiones que suman (`held`, `captured`, `released`, `unpaid`) → 409.
- Una extensión por vez (`SELECT … FOR UPDATE` sobre la cita).
- El mecánico **no interviene**: solo ve moverse el límite.

### 3.2 Requerimiento
Antes de cobrar y sumar el tiempo, el técnico debe **aceptar** en su pantalla. Si rechaza o no responde, no se
cobra ni se suma nada.

### 3.3 Máquina de estados de una extensión
Hoy: `held | captured | released | unpaid | failed | pending`. Se agregan `requested`, `declined`, `expired`.

| Estado | Significado | Suma tiempo | Cuenta para `maxExtensions` | Cobro |
|---|---|---|---|---|
| `requested` | Pedida por el dueño; esperando al técnico | No | **No** | Ninguno |
| `declined` | Rechazada por el técnico | No | No | Ninguno |
| `expired` | Venció sin respuesta, o terminó la llamada | No | No | Ninguno |
| `failed` | Aceptada pero el dinero fue rechazado | No | No | Ninguno |
| `held` / `captured` / `released` / `unpaid` | Igual que hoy | Sí | Sí | Igual que hoy |

Transiciones permitidas (cada una como `UPDATE … WHERE status = '<anterior>'`, como el resto del módulo):

```
(nueva) → requested ──accept──► [holdExtra] ──ok──► held (o unpaid sin pagos)
                │                         └─402──► failed
                ├──decline──► declined
                ├──vence (expiresAt) ──► expired
                └──termina la llamada ──► expired
```

### 3.4 Endpoints

**1) Pedir (cambia el comportamiento del existente)**
`POST /api/appointments/:id/video/extensions` — mismo body `{ minutes, idempotencyKey, paymentMethodId? }`.
- Valida igual que hoy: dueño, llamada en curso (409 si no), `minutes` entre las opciones (400), tope (409).
- **Nuevo:** si ya hay una `requested` para esa llamada → `409` con `code: "extension_pending"`.
- Crea la extensión con `status: "requested"`, `requestedAt`, `expiresAt = min(now + extension_response_seconds, fin de la llamada)`.
- **No** retiene dinero, **no** cambia `contractedMinutes`, **no** toca Daily.
- Responde `201` con la extensión: `{ id, minutes, status: "requested", expiresAt, … }`.
- Misma `idempotencyKey` → misma extensión (sin duplicar).
- *Recomendado (fallar rápido):* chequeo **no vinculante** del medio de pago al pedir (wallet con
  `availableBalance ≥ precio` o tarjeta propia existente). Si claramente no alcanza → `402` y **no** se crea la
  solicitud (así el técnico no recibe un pedido que va a fallar). La retención real sigue ocurriendo al aceptar.

**2) Aceptar**
`POST /api/appointments/:id/video/extensions/:extensionId/accept` (sin body).
- Solo el **mecánico asignado** (o admin). Dueño → `403`.
- Llamada en curso (si no, `409`). Extensión `requested` y no vencida (si venció → `409` `code: "extension_expired"`).
- Ejecuta ahora la lógica actual: `holdExtra` con la clave original, sube `price` y `provider_payout`,
  extiende la sala de Daily, publica `video_call_update` `stage: "extended"` a ambas partes.
- `402` del dinero → `failed`, publica `stage: "extension_failed"` a ambas partes y devuelve la extensión en `failed`
  (el timer no cambia; el dueño puede pedir otra con **clave nueva**).
- **Idempotente:** repetir `accept` sobre una `held` devuelve `200` con el estado final **sin** repetir el cobro.

**3) Rechazar**
`POST /api/appointments/:id/video/extensions/:extensionId/decline` (body opcional `{ reason? }`, ≤ 200 caracteres).
- Mismas reglas de acceso. `requested` → `declined`; publica `stage: "extension_declined"` al dueño.
- Idempotente.

**4) Vencimiento**
Job o vencimiento perezoso al leer (lo que ya use `autoFinishOverdue`): `requested` con `expiresAt` pasado →
`expired`, publica `stage: "extension_expired"` al dueño (y al técnico para cerrar su tarjeta).
Al terminar la llamada (timer en cero, fin del técnico, confirmación o cancelación) toda `requested` → `expired`.

**5) Lectura**
`GET /api/appointments/:id/video/extensions`:
- Incluir los estados nuevos en `extensions[]`.
- Agregar al nivel superior `pendingRequest: { extensionId, minutes, expiresAt, requestedAt } | null`
  (la solicitud `requested` vigente) para que la app reconstruya su pantalla al abrir o reconectar.
- **Al técnico**: ve `pendingRequest` y las extensiones **sin monto ni medio de pago** (como hoy). `options` sigue vacío.
- **Al dueño**: ve todo como hoy y además su `pendingRequest`; mientras haya una `requested`, `options` puede venir
  vacío o marcado `disabled` para impedir otro pedido.

### 3.5 Eventos WebSocket (`video_call_update`)
Hoy: `stage` ∈ `…, extended`. Se agregan (todos con `{ appointmentId, stage }` + lo indicado):

| `stage` | Destinatario | Payload extra |
|---|---|---|
| `extension_requested` | Técnico | `extensionId`, `minutes`, `expiresAt` (**sin precio ni medio de pago**) |
| `extended` | Ambos | ya existe |
| `extension_declined` | Dueño | `extensionId` |
| `extension_expired` | Dueño y técnico | `extensionId` |
| `extension_failed` | Ambos | `extensionId`, `code` (`insufficient_funds` / `card_declined`) |

Sin push: ambos están dentro de la llamada. La app recarga estado en cualquier `video_call_update`; los `stage`
nuevos solo cambian qué muestra.

### 3.6 Configuración (Hub)
Agregar a `videocall_settings` (tabla de una fila) `extension_response_seconds`: **default 60, rango 5–300**, editable
desde Pricing → Video Calls, expuesta en `GET /pricing/videocall/settings` y aceptada (opcional) en `PUT`.
Agregar `extension_approval_enabled` (**boolean, default `false`**): ver 3.8.

### 3.7 Reglas y casos borde
1. **El timer no se pausa** mientras se espera: la llamada sigue corriendo. Por eso `expiresAt` no puede pasar del fin
   de la llamada, y `accept` sobre una llamada ya terminada → `409`.
2. **Aceptar cerca del final:** si al aceptar quedan pocos segundos, la extensión suma sobre `contractedMinutes` igual
   (mientras la llamada no haya terminado); `callStartedAt` y `elapsedSeconds` no cambian.
3. **Una sola `requested` por llamada.** Rechazada o vencida, el dueño puede pedir otra (clave nueva).
4. **`maxExtensions`** solo cuenta las que suman; una `requested`/`declined`/`expired`/`failed` no gasta cupo.
5. **Concurrencia:** `accept`, `decline` y vencimiento compiten por la misma fila → cada uno es un update condicionado a
   `status = 'requested'`; gana uno solo. Mantener el `SELECT … FOR UPDATE` sobre la cita.
6. **Reconexión:** si el técnico entra tarde, `GET …/extensions` devuelve la `requested` vigente con su `expiresAt`.
7. **Precio:** sin cambios (bloques de USD 15 base + banda de la solicitud + impuesto). El técnico **no ve montos**.
8. **Auditoría:** guardar `requestedAt`, `respondedAt`, `respondedBy` y, si hay, el motivo del rechazo.
9. **Migración:** ampliar el dominio de `status` en `appointment_video_extensions`
   (`manual-migrations/2026-10-20_appointment_video_extension.sql` es la tabla actual) y agregar
   `expires_at`, `requested_at`, `responded_at`, `responded_by`, `decline_reason`.

### 3.8 Compatibilidad con builds viejas (importante)
Una app **vieja** del dueño que llame al `POST` esperaría que el tiempo se sume al instante; una app **vieja** del técnico
no tiene pantalla para aceptar. Con el cambio a secas, las extensiones quedarían en `requested` y vencerían.

Propuesta: **feature flag + opt-in explícito.**
- `extension_approval_enabled` (Hub) en `false` = comportamiento actual (compra directa).
- Con el flag en `true`, el flujo con aprobación solo se aplica si el body del `POST` trae
  `"requireApproval": true` (la app nueva lo manda siempre). Sin ese campo → compra directa como hoy.
- Se activa el flag cuando la app nueva esté publicada y adoptada por técnicos (idealmente con versión mínima forzada).

Si prefieren otro mecanismo (header de versión, versión mínima), la app se adapta: solo necesita saber **cuándo** debe
esperar aprobación.

### 3.10 Estado
Diseño aceptado por backend tal como está en este documento (ver README de `appointments`, "Aprobación del técnico"). Dos matices de su implementación: no hay chequeo previo del medio de pago al pedir (un pedido que va a fallar llega igual al técnico y falla al aceptar), y `GET …/extensions` devuelve `pendingRequest` a ambas partes. La app cubre ambos casos.

### 3.9 Pruebas de aceptación sugeridas
1. Pedir con flag activo → `201 requested`; sin cargo; `contractedMinutes` igual; Daily sin cambios.
2. Pedir una segunda mientras hay `requested` → `409 extension_pending`.
3. Aceptar → `held`, `price`/`provider_payout` suben, `contractedMinutes` suma, evento `extended` a ambos.
4. Aceptar dos veces → una sola retención.
5. Aceptar con saldo insuficiente → `failed`, `extension_failed`, no cuenta para el tope, se puede pedir otra.
6. Rechazar → `declined`, sin cargo, evento al dueño, se puede volver a pedir.
7. No responder `extension_response_seconds` → `expired`, evento al dueño.
8. Terminar la llamada con una `requested` → `expired`.
9. Dueño intenta aceptar → `403`; técnico intenta pedir → `403`.
10. Aceptar sobre llamada ya terminada → `409`.
11. `GET …/extensions` al técnico: sin montos, con `pendingRequest`.
12. Carrera `accept` vs vencimiento: exactamente un resultado.
13. Sin flag / sin `requireApproval`: se comporta como hoy (regresión).

---

## 4. B / C / D — Verificaciones sobre la duración elegida

### 4.1 B — Cotización con duración: **price-service en producción la rechaza** (confirmado)
**Reproducido el 17-nov-2026 en producción** (`https://t9smggmz3a.us-east-1.awsapprunner.com`), autenticado como dueño:
```http
POST /api/pricing/calculate
{ "assistance_type": "videocall", "timezone": "America/New_York", "duration_minutes": 30 }

400 { "code": "VALIDATION_ERROR", "path": "/pricing/calculate",
      "message": "property duration_minutes should not exist" }
```
Con el alias `durationMinutes` responde lo mismo (`property durationMinutes should not exist`). Es decir, **el DTO de
`price-service` desplegado todavía no acepta la duración** (el README dice que sí, desde el 17-nov: probablemente falta
desplegar `mechanicassistance-service-price`). En cambio `GET /api/video-call/now` **sí** devuelve `durations`
(appointments-service ya está actualizado), así que la app ve el menú pero no puede cotizar.

**Efecto en la app hoy:** el resumen no puede mostrar el precio final y muestra el **precio base del menú** (60/70/80) como
referencia. Al confirmar, `POST /api/assistance` lleva `durationMinutes` (appointments lo acepta) pero
`POST /api/pricing/requests/:id/price` con `duration_minutes` también daría 400, y el precio no se guardaría en la solicitud.

**Pedido:** desplegar price-service con `duration_minutes` / `durationMinutes` en `calculate` y `requests/:id/price`, y
confirmar con el mismo request de arriba que responde `200` con `pricing_breakdown.final_price` ≈ 70 × banda (+ impuesto
si aplica). También confirmar que `timezone` sin `latitude/longitude` está permitido para videollamada y qué responde con
`service_at` (agendado). **No publicar el build de la app hasta que esto esté desplegado.**

### 4.2 C — `durationMinutes` en el detalle del pedido
`servicios/appointments/README.md` dice que el detalle lo devuelve. Confirmar que `GET /api/assistance/:id` (ruta del
gateway que usa la app) trae `durationMinutes` para el **mecánico** antes de aceptar y para el dueño. Si el listado
`GET /api/assistance` también lo puede traer, mejor (hoy la app lo pide por id cuando falta).

### 4.3 D — `baseMinutes` = duración elegida
La app asume que, para una llamada con duración elegida:
- `GET /api/appointments/:id/video` → `baseMinutes` = elegida y `contractedMinutes` = elegida + extensiones que suman;
- `GET …/video/extensions` → ídem;
- el timer del servidor que expulsa de la sala (`autoFinishOverdue`, `exp` de Daily) usa `contractedMinutes`.

Confirmar con una llamada de 15 min que el corte automático ocurre a los 15 (no a los 45).

---

## 5. Otros puntos que dependen de backend

### 5.1 E — `offerExpiresAt` en el listado
La app muestra "Oferta reservada por m:ss" en la tarjeta de Pendientes del técnico (`AppointmentCard`), leyendo
`offerExpiresAt` de cada pedido en estado `offered` del listado (`GET /api/assistance`). El dueño ya lo recibe en
`GET /api/assistance/:id/offer-summary` (`offerExpiresAt` + `serverNow`). **Confirmar que el listado del mecánico
incluye `offerExpiresAt`** (y, si es posible, `serverNow` para corregir el reloj). Si no, la tarjeta no muestra la cuenta.

### 5.2 F — Servicio en los movimientos de wallet
La pantalla "Recent activity" de la wallet del dueño ahora muestra, bajo "Pago de servicio", cuál fue el servicio.
Hoy `walletMovements[]` trae `{ id, type, amount, method, paymentId, createdAt }`; la app tiene que cruzar
`paymentId` → `payments.items[]` → `assistanceRequestId` → `POST /api/assistance/summaries`. Limitaciones: depende de que
el pago esté en la página cargada y son dos llamadas extra.
**Mejora pedida:** incluir `assistanceRequestId` (y opcionalmente `title`) en cada `walletMovement` de
`GET /api/payments/me/history`. La app ya funciona sin esto.

### 5.3 G — Radio de servicio del técnico (solo asistencia presencial)
**La videollamada no tiene radio de servicio: es remota y no tiene ubicación, así que el alcance es ilimitado.** Un
técnico habilitado para videollamadas debe poder recibir pedidos de cualquier lugar, sin filtro por distancia ni por
el `serviceRadiusMiles` de su perfil. **Confirmar que el matching y el feed de videollamadas no aplican ese filtro**
(ni el tope de 25 millas del marketplace).

Para la asistencia presencial hay una inconsistencia aparte: `app/setup/availability.tsx` deja elegir **1–100 millas**,
y `habilitacion-automatica.md` dice que el radio **topa en 25**. **Decidir:** (a) subir el tope del backend, o
(b) limitar la app a 25. Confirmar además que `mechanic_details.serviceRadiusMiles` acepta hasta 100 sin 400.

### 5.4 H — Corte anticipado por el técnico
Decisión de producto: si el técnico corta antes de tiempo, el dueño va a **disputa** (sin reembolso automático).
Confirmar que, tras un fin anticipado del técnico (`awaiting_confirmation`), el dueño puede usar **No se resolvió**
(`dispute`) y que el detalle de la disputa refleja que la llamada no cumplió la duración contratada
(`elapsed` vs `contractedMinutes`) para que soporte decida. Sin cambios de contrato si ya es así.

### 5.5 I — Los turnos de "Agendar" deberían cubrir las 24 horas
`GET /api/video-call/slots` hoy arma **turnos de 30 min de 08:00 a 19:30 (hora local del dueño)**, 14 días,
que empiecen ≥ 60 min después de ahora (`servicios/appointments/README.md`, "Agendar"). Por eso en la app la franja
**Evening** termina a las 6 PM y no hay nada de madrugada ni de noche. Producto: **la videollamada se puede pedir 24/7**
("Ahora" ya no tiene horario).

**Pedido:** ampliar la grilla a las 24 h (00:00–23:30) en la zona del dueño, manteniendo turnos de 30 min, los
14 días y el margen de 60 min. Revisar que:
- `period` cubra todo el día (hoy `morning` / `afternoon` / `evening`; la madrugada necesita un valor propio, por ejemplo
  `night`, o reasignar las franjas: la app tiene que conocer el valor nuevo);
- la disponibilidad por turno (`available`, `no_mechanics`, `full`) siga calculándose con los técnicos
  realmente disponibles en esa hora (hoy depende de la disponibilidad/horario que cargan los técnicos);
- el recargo por franja nocturna (×1.5 de noche según price-service) se aplique en la cotización de cada turno
  (`service_at`), que es lo que la app muestra en el resumen.
Si se agrega un valor de `period`, avisar para que la app muestre la franja.

### 5.6 J — Saber si el cliente ya está en la sala de video (nuevo, 18-nov)
**Qué hace la app:** en el detalle de la asistencia del técnico, arriba del botón "Join video call", muestra una tarjeta
"El cliente ya está en la sala de video — te está esperando" cuando el dueño entró primero.

**Cómo lo resuelve hoy (y por qué no alcanza):** la app usa el evento `video_room_ready` (se manda a la *otra* parte
cuando alguien abre la sala) y, al abrir la pantalla, consulta `GET /api/video-room/:appointmentId` (si hay `roomUrl`
vigente, asume que el cliente está esperando). Pero el servidor **no dice quién abrió la sala ni quién está conectado**:
si el técnico abre la sala, sale y vuelve, la app le diría que el cliente lo espera sin ser cierto. Tampoco se entera
si el cliente se va de la sala antes de que el técnico entre.

**Pedido:** en `GET /api/video-room/:id` (o en `GET /appointments/:id/video`) devolver quién está conectado, por ejemplo
`participants: { owner: boolean, mechanic: boolean }` o `ownerInRoom` / `mechanicInRoom` (alimentado por los webhooks de
Daily `participant.joined` / `participant.left`), y publicar `video_call_update` con `stage: 'participant_joined'` /
`'participant_left'` (`{ appointmentId, role }`) para que la tarjeta aparezca y desaparezca en vivo. Sin montos ni datos
personales. Cuando exista, la app deja de inferirlo de la existencia de la sala.

### 5.7 K — Cuánto gana el técnico por cada extensión (nuevo, 18-nov)
**Qué se acordó (producto):** al extender, el técnico recibe el valor de la extensión **menos el platform fee**, con la
misma regla que el servicio de videollamada (`providerPayout = precio − platform fee`). No es un 85 % fijo: depende del
fee activo (`fee_type = 'platform'`) en el Hub.

**Qué ya hace el backend (según docs):** al retener la extensión sube `assistance_requests.price` y `provider_payout`
"en la misma proporción que el servicio". Por eso el total que ve el técnico en la pestaña **Budget** (`budget`, que ya es
lo que gana) incluye el tiempo extra. Hay que **confirmar** que, con la aprobación del técnico, `provider_payout` se
actualiza recién al **aceptar** (extensión `held`) y no al pedirla, y que el platform fee se descuenta también del bloque.

**Qué falta:** `GET /appointments/:id/video/extensions` le devuelve al técnico las extensiones **sin monto**. La app
muestra "Extended time: +X min added" pero no cuánto gana por ese tiempo. Pedido: para el técnico, agregar a cada
extensión `providerAmount` (decimal string, ya neto del fee, sin impuestos ni datos del medio de pago del cliente) y
`providerAmountTotal` en la respuesta (suma de las que cuentan). La app no calcula comisiones por su cuenta: mostrará
exactamente ese valor en el Budget ("Extended time · +15 min · $X").

### 5.8 L — Subtítulos y transcripción en la videollamada (nuevo, 18-nov)
**Qué hace la app:** un botón de subtítulos en la llamada. Quien lo toca confirma un aviso ("lo que digan ambos se transcribirá,
la otra persona será avisada") y la app llama `startTranscription()` de Daily; los dos teléfonos reciben `transcription-message`
y muestran la última frase como subtítulo. A la otra persona se le avisa con un diálogo cuando se activan. Si Daily rechaza,
la app muestra "Subtítulos no disponibles" y no pasa nada más.

**Qué hace falta del lado de Daily / backend:**
- Habilitar la transcripción en el dominio de Daily (plan de pago; precios al 18-nov: **USD 0.0059 por minuto de participante
  con micrófono activo** en tiempo real; posterior a la llamada **USD 0.0043 por minuto grabado**, ver página de precios de Daily).
- Que el **meeting token** de ambos permita iniciar la transcripción (`permissions.canAdmin` incluye `transcription`, o
  `is_owner`; hoy el mecánico recibe `is_owner: true`, el dueño no). Si el dueño debe poder activarla, hay que darle ese permiso.
- *Decisión de producto/legal:* consentimiento (la app ya avisa, pero no guarda aceptación) y **si se guarda el texto**. Hoy
  la app **no guarda nada**: los subtítulos son efímeros. Si se quiere un resumen o evidencia para disputas, se necesita un
  endpoint (`POST /appointments/:id/video/transcript`) o webhook de Daily (`transcript.ready-to-download`) que lo asocie a la cita.

**Otras funciones nuevas que no requieren backend** (peer to peer, no se guardan): dibujar sobre la imagen (solo el técnico
marca la cámara del dueño), chat de texto durante la llamada, intercambiar imagen grande/chica y aviso de conexión débil.

### 5.9 M — Push al técnico cuando el dueño pide más tiempo (nuevo, 18-nov)
La aprobación del técnico (§3) hoy solo llega por WebSocket (`video_call_update` con `stage: extension_requested`, "sin push").
La app ya muestra la tarjeta Aceptar / Rechazar dentro de la llamada y en el detalle de la asistencia, pero si el técnico tiene la
app en segundo plano o cerrada **no se entera** y el pedido vence (`extension_response_seconds`, 60 s por defecto).

**Pedido:** al crear una extensión `requested`, mandar además un **push** al técnico (notifications-service) con el título
"Tiempo extra pedido" y los minutos, sin monto ni medio de pago, que al tocarlo abra el detalle de la asistencia
(`/appointments/:id`). Si el técnico responde desde otro lado, no hace falta cancelar el push. Considerar subir
`extension_response_seconds` si se confirma que muchos pedidos vencen porque la app estaba cerrada.

### 5.10 N — Se puede agendar a cualquier hora, aunque no haya técnicos cargados (nuevo, 18-nov)
**Regla de producto:** la videollamada se puede pedir **24/7**. Si el dueño agenda un turno en el que ningún técnico tiene
horario cargado, el pedido igual se crea; en el peor caso nadie lo acepta y se cancela sin cargo.

**Hoy (verificado en producción el 18-nov):** `GET /api/video-call/slots` ya devuelve la grilla de 24 h, pero marca `available: false`
con `reason: 'no_mechanics'` fuera de las 07:00–18:00 (EST) porque sigue `mechanic_availability`; y `create()` (`assertBookable`)
**rechaza** esos turnos con `409 slot_unavailable` (`reason: no_mechanics`).

**Pedido:**
- `POST /api/assistance` (videocall agendada): **no rechazar** por `no_mechanics`. Seguir rechazando `past`, "demasiado próximo" y
  `full` (turno tomado), y fuera de la grilla de medias horas.
- `GET /video-call/slots`: para esos turnos devolver `available: true` y un campo informativo aparte (por ejemplo
  `staffed: false`) en lugar de `available: false`, o dejar `available: false` con `reason: 'no_mechanics'` y que la app los trate
  como reservables (la app ya lo hace, ver abajo). Avisar cuál de las dos opciones se elige.
- Definir qué pasa con un pedido agendado que nadie aceptó al llegar la hora (cancelación automática sin cargo, y aviso al dueño).

**Qué hace la app:** muestra como reservables los turnos `available` **y** los `no_mechanics`; oculta solo `past` y `full`. Hasta que
backend cambie `create()`, agendar un turno sin técnicos devolverá `slot_unavailable` y la app lo informa.

### 5.11 O — Zona horaria del dueño en la videollamada agendada (nuevo, 18-nov)
**Problema:** el turno se guarda en UTC (`date`), y cada teléfono lo muestra en su hora local. Si el técnico está en otra zona
que el dueño, los dos leen horas distintas del mismo turno y es fácil equivocarse por una o más horas. Producto pide que, cuando
llega la oferta al técnico, **se vea la hora en la zona del técnico, con su nombre (por ejemplo "3:00 PM EST"), y si el dueño está
en otra zona, que se muestren las dos horas** ("Para vos: 3:00 PM EST · Para el cliente: 12:00 PM PST").

**Qué hace la app (ya hecho):** muestra siempre la hora con la zona del propio teléfono en la oferta, el detalle y las tarjetas del
técnico; si recibe `timezone` de la solicitud y difiere, agrega un aviso con las dos horas. Al agendar, la app manda `timezone` (la
zona IANA del dueño, la misma que ya manda a `/video-call/slots` y a la cotización) en `POST /api/assistance`. Si el backend todavía
no conoce el campo (`forbidNonWhitelisted`: 400 "should not exist"), la app reintenta sin él: no se rompe nada, pero el aviso de
doble hora no aparece.

**Pedido:**
- `POST /api/assistance` (videocall agendada): aceptar `timezone` (nombre IANA válido; si no, 400) y guardarlo en
  `assistance_requests.timezone` (columna nullable). Para "Ahora" no hace falta.
- Devolverlo como `timezone` en `GET /api/assistance` (listado/feed del técnico), `GET /api/assistance/:id` y en las citas
  (`GET /appointments`, `/appointments/:id`), para que la oferta del técnico lo traiga sin otra llamada.
- Opcional: que el recordatorio previo al turno (push) nombre la zona del destinatario.

### 5.12 P — Guardar la transcripción de la llamada como dato de la cita (nuevo, 18-nov)
**Qué se quiere:** que lo dicho en la videollamada quede como dato de la cita, y que el dueño y el técnico lo vean en un botón
"Transcripción de la llamada" de la pestaña Status. Es también evidencia para soporte en las disputas (§5.4).

**Qué hace la app hoy (ya hecho, sin backend):** cada teléfono guarda en su almacenamiento local las frases que recibe de Daily
(`transcription-message`) mientras los subtítulos están activos, y el botón las muestra con el aviso "Guardada solo en este teléfono".
Limitaciones: es una copia por teléfono, solo existe si los subtítulos estuvieron encendidos y se pierde si se desinstala la app.

**Pedido (fuente de verdad en el servidor):**
- Al terminar la transcripción de una sala, tomar el archivo de Daily (webhook `transcript.ready-to-download` o
  `GET https://api.daily.co/v1/transcript?roomName=…` y `/transcript/:id/access-link`, formato WebVTT/texto) y guardarlo asociado a
  la cita (`video_call_transcripts`: `appointmentId`, `language`, `lines[]` con `role` owner/mechanic, `name`, `text`, `at`).
  *Verificar con Daily que la transcripción en tiempo real deja archivo en la cuenta actual (almacenamiento propio o de Daily).*
- `GET /api/appointments/:id/video/transcript` (dueño, técnico de la cita y admin; otro → 403; sin transcripción → 404):
  `{ appointmentId, language, lines: [{ id, role: 'owner'|'mechanic', name?, text, at (ISO) }] }`. La app ya llama a este endpoint
  primero y usa su copia local solo si da 404.
- Definir **retención y consentimiento**: la app avisa antes de activar los subtítulos, pero no guarda la aceptación. Si se guarda
  el texto, conviene registrar quién activó la transcripción y cuándo (`transcript_started_by`, `started_at`) y cuántos días se
  conserva. Los datos de salud o personales que se digan en la llamada pasan a ser datos guardados.
- Opcional: mostrar la transcripción a staff en la lista de disputas del Hub.

### 5.13 Q — Registro de consentimientos y cumplimiento (nuevo, 18-nov)
**Objetivo:** estar en cumplimiento. Los **dos** lados aceptan las condiciones **antes** de la videollamada, y de nuevo, uno al otro, en el momento
de activar subtítulos y transcripción; todo queda registrado y la transcripción solo existe si ambos aceptaron.

**Qué hace la app (ya hecho):**
1. **Antes de entrar** (pantalla previa a la llamada, dueño y técnico): casilla obligatoria "Leí y acepto estas condiciones" con tres puntos
   (subtítulos y transcripción solo si ambos aceptan durante la llamada; si se crean se guardan con la cita y ambos pueden leerlos y
   descargarlos, y soporte puede usarlos en un reclamo; se puede decir que no en cualquier momento). Sin marcarla no se puede entrar.
2. **Durante la llamada**: quien activa los subtítulos manda una solicitud; la otra persona recibe un diálogo (Aceptar / Rechazar). **Solo si
   acepta** se llama a `startTranscription()` de Daily. Si rechaza o no responde en 30 s, no se transcribe nada.
3. Antes de pedir la llamada (dueño) y en la oferta (técnico) hay un aviso de estas condiciones.
4. Cada respuesta se guarda en el teléfono con hora y versión del texto (`CONSENT_VERSION = 2026-11-18`) y se **intenta** enviar a
   `POST /api/appointments/:id/video/consent` (hoy no existe: se ignora el error).
5. El PDF de la transcripción incluye el **registro de consentimientos** y un aviso de uso confidencial.

**Pedido:**
- `POST /api/appointments/:id/video/consent` `{ version, kind: 'precall'|'captions-request'|'captions-answer', role, accepted, at }`
  (el rol sale de la sesión, no del cuerpo; solo el dueño y el técnico de la cita; otro → 403). Guardar con la hora del servidor, IP/dispositivo
  si corresponde, y la versión del texto. Idempotente por `(appointmentId, role, kind, at)`.
- **Exigirlo del lado servidor:** no emitir ni guardar la transcripción (§5.12) si no hay `precall` aceptado de ambos y `captions-answer`
  aceptado de quien no pidió. Si Daily transcribe igual (token con permisos), descartar el archivo.
- Devolver el registro en `GET …/video/transcript` (`consents[]`) para que el PDF use el del servidor y no el del teléfono.
- Publicar los textos de condiciones con versión (para que soporte sepa exactamente qué se aceptó) y definir **retención** del texto y del registro.
- **Revisión legal (importante):** el texto actual es un borrador de producto, no asesoría legal. Hay estados y países donde grabar o transcribir
  una llamada exige el consentimiento de **todas** las partes y avisos específicos (por ejemplo, términos de uso y política de privacidad que lo mencionen,
  y datos sensibles dichos en la llamada). Legal debe aprobar el texto, la versión y el tiempo de retención antes de activarlo en producción.

### 5.14 R — Un problema "Otro" que se pueda cotizar (nuevo, 18-nov)
**Qué se quiere:** en la pantalla "Indicate the issue" de asistencia inmediata y videollamada, una tarjeta **Other** al final donde el dueño describe con sus
palabras un problema que no está en el catálogo. (Scheduled ya tiene "Other service (optional)" y lo manda como `customRequest`.)

**Qué hace la app (ya hecho):** la tarjeta "Other" abre un campo de texto (200 caracteres); lo escrito aparece como badge y habilita Continue aunque no se haya elegido
nada del catálogo. El texto viaja en el **título** de la solicitud como `Other: <texto>` (junto a los nombres de los problemas elegidos), que es lo que leen los técnicos en el
push y en su feed. No se manda ningún id de catálogo para "Other".

**Problema:** una solicitud que solo tiene "Other" no lleva `vehicle_issue_ids`, así que `service-price` no puede cotizarla (queda `TBD`; la app registra el aviso y sigue).
Tampoco hay un campo propio para el texto: hoy se mezcla con el título.

**Pedido:**
- Agregar al catálogo (`GET /api/pricing/vehicle-issue-catalog`) un issue **"Other"** (con UUID, traducciones y regla de precio/diagnóstico por defecto) para que la app lo mande en
  `vehicle_issue_ids` y la solicitud tenga precio. Producto define el precio base del "Otro".
- Un campo opcional `customIssue` (string, ≤ 200) en `POST /api/assistance` y en el detalle/listado, para guardar el texto libre sin depender del título. La app lo mandará cuando
  exista (con el reintento sin el campo si el backend todavía lo rechaza, como con `timezone`).
- Que el técnico vea `customIssue` en la oferta y en el detalle de la asistencia.

---

## 6. Orden de entrega sugerido
1. **B, C, D, E** — verificaciones (rápidas, desbloquean pruebas de la app).
2. **A** — endpoints, estados, eventos, flag (§3.4–3.8) y despliegue **antes** que la app nueva.
3. Publicar la app con `requireApproval: true` y la pantalla de aceptar/rechazar.
4. Activar `extension_approval_enabled` cuando los técnicos estén actualizados.
5. **N** (alta, desbloquea agendar 24/7), **O** (alta, evita citas a la hora equivocada) **Q** (alta, cumplimiento) y luego **P, F, G, H, J, K, L, M** — cuando haya capacidad.

**Regla de despliegue:** backend primero. El backend rechaza campos desconocidos (`forbidNonWhitelisted`), así que
cualquier campo nuevo que la app mande (`requireApproval`) tiene que existir en el DTO antes de publicar el build.

## 7. Qué hará la app cuando A esté listo
- **Dueño:** al pedir tiempo ve "Esperando al técnico…" con cuenta regresiva hasta `expiresAt`; se le avisa si rechaza,
  vence o falla el pago, y puede reintentar.
- **Técnico:** tarjeta sobre la llamada con los minutos, cuenta regresiva y **Aceptar / Rechazar**. No ve montos.
- Ambos: al aceptar, el límite del indicador se mueve (ya funciona) y se muestra el aviso de "tiempo agregado".

## 8. Referencias
- App: `app/(tabs)/request-assistance/when.tsx`, `lib/dao/VideoCallDAO.ts`, `components/video/ExtendCallSheet.tsx`,
  `components/video/CallTimeAddedToast.tsx`, `lib/video/callLength.ts`, `app/(tabs)/assist/[id].tsx`,
  `context/SocketContext.tsx` (eventos).
- Backend (repo de análisis): `servicios/appointments/README.md` (Videollamada, Tiempo extra),
  `servicios/price/README.md` §5, `servicios/billing/01-logica-de-pagos.md` (paso 7, tiempo extra),
  `portales/app/README.md` (flujo de videollamada).