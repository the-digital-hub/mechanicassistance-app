# Backend: pendientes y contrato con la app (para Alejandro)

**Fecha:** 20-nov-2026 · **De:** app mobile · **Documento único:** reemplaza al backlog y al brief anteriores. Primero lo pendiente,
agrupado por área; al final, los anexos con lo que la app consume hoy, las decisiones de producto y el contrato ya implementado de
las extensiones.

Los temas están **agrupados por área** (videollamada, solicitudes del técnico, perfil, cuidado del vehículo, notificaciones) para
poder revisarlos de a uno. Dentro de cada área, primero lo **ya hecho según su documentación** (solo falta confirmar que esté
desplegado) y después lo **pendiente**.

Cuando estén hechos, avisar a la app: cada punto dice **cómo lo vamos a verificar** (contra producción, no solo contra la documentación;
ya pasó que algo figuraba como hecho en el README y producción lo rechazaba).

Leyenda: ✅ hecho según el repo de análisis (a confirmar en producción) · ⬜ pendiente.

---

## Resumen por área

| Área | Hecho (confirmar en producción) | Pendiente |
|---|---|---|
| **1. Videollamada: precio, duración y reserva** | AA sin impuestos · B cotización con duración · N agendar 24/7 · O zona horaria | **X** descuento de agendadas (pantalla del Hub y valor) · **T** confirmar 60 min |
| **2. Videollamada: durante y después** | Q consentimientos · P/U transcripción · J presencia · K ganancia por extensión · M push de tiempo extra | **L** transcripción en la cuenta de Daily · **V** traducción de subtítulos |
| **3. Solicitudes y feed del técnico** | — | **S** solicitud tomada por otro · **E** `offerExpiresAt` en el listado · **AE** `refCode` en la vista del prestador · **AF** `new_request` fuera de la bandeja · **AG** identidad del técnico solo al aceptar · **AH** chat cerrado al finalizar · **R** entrada "Other" en el catálogo |
| **4. Perfil y reputación** | Y reseñas del perfil · Z otras certificaciones | Pantalla de revisión de certificaciones en el Hub, permisos del admin y push de vencimiento |
| **5. Cuidado del vehículo** | — | **W** agente de recomendaciones |
| **6. Notificaciones** | — | **AB** textos más completos |
| **7. Citas y otros** | — | **AC** ocultar citas canceladas · **AD** actualizar la documentación |

---

## 1. Videollamada: precio, duración y reserva

### ✅ Hecho según su documentación (confirmar en producción)
| Punto | Qué | Cómo lo confirmamos |
|---|---|---|
| **AA** | La videollamada no lleva impuestos: el dueño paga el precio de la llamada y el platform fee sale de lo que gana el técnico | Una videollamada de 30 min muestra **el mismo total** en el plan, la oferta, lo retenido y el recibo, sin línea de impuestos |
| **B** | `POST /api/pricing/calculate` y `…/requests/:id/price` aceptan `duration_minutes` | Elegir 15/30/45 min en "Plan your video call" y ver el precio de esa duración (sin el 400 que daba el 18-nov) |
| **N** | Se agenda a cualquier hora, aunque no haya técnicos cargados (`no_mechanics` ya no rechaza); si nadie acepta, se cancela sin cargo a los 10 min | Agendar un turno de madrugada y que se cree la solicitud |
| **O** | `timezone` (IANA) se guarda y se devuelve en pedidos y citas | Pedir una videollamada agendada desde otra zona y ver el aviso con las dos horas; **después la app deja de reintentar sin ese campo** |

### ⬜ Pendiente
### [ ] X — Precio diferenciado para videollamadas agendadas, con asignador de descuento
- **Qué se quiere (19-nov):** las videollamadas **agendadas** van a costar **un poco menos** que las de "ahora" (el técnico se organiza con anticipación y no hay urgencia). Hoy el precio sale de la misma tarifa para las dos.
- **Hacer:**
  - Que `POST /api/pricing/calculate` y `POST /api/pricing/requests/:id/price` distingan una videollamada agendada (`service_at` en el futuro) de una inmediata y le apliquen el **ajuste de precio de agendada**, además de la duración (B) y la franja horaria.
  - Un **asignador de descuento/precio configurable desde el Hub**, sin desplegar: por tipo de servicio (hoy `videocall`) y modo (`scheduled`), con valor **porcentual o monto fijo**, vigencia opcional (desde/hasta) y, si se quiere, distinto por duración (15/30/45/60). Debe quedar claro **quién lo financia**: si baja lo que cobra el dueño, ¿baja lo que gana el técnico o lo absorbe la plataforma?
  - El desglose (`pricing_breakdown`) debe mostrar el descuento como línea propia (precio de lista, descuento, precio final) para que la app y el recibo lo expliquen.
  - Los precios de **horarios agendados** se calculan en el momento de agendar y quedan **congelados** en la solicitud (el cambio de tarifa no toca lo ya agendado).
  - Devolver el mismo cálculo en `GET /api/video-call/now` / `durations` y en el listado de turnos (`/video-call/slots`) para que la app pueda mostrar, antes de elegir, "ahora" vs "agendada" con sus precios.
- **Definir con producto:** el porcentaje o monto, a quién se le descuenta (plataforma o técnico), si se muestra como "ahorrás $X" en la app, y si aplica a las extensiones de tiempo de una llamada agendada.
- **La app:** hoy muestra el precio que devuelve el backend; con esto agrega la línea de descuento en "Plan your video call", en la oferta y en el recibo. Hasta que exista, no se muestra ningún descuento.
- **Cómo lo verificamos:** la misma llamada de 30 min cotizada "ahora" y agendada para mañana da dos precios distintos; el desglose muestra la línea de descuento; cambiar el valor en el Hub se refleja en la siguiente cotización sin desplegar.

### [ ] T — Confirmar que una duración nueva del menú (ej. 60 min) funciona de punta a punta
- **Contexto:** el menú de duraciones sale del Hub (`videocall_settings.duration_options`, 1 a 6 opciones) y llega a la app en `durations` de `GET /api/video-call/now`. El 18-nov se agregó una opción de **60 min** en el Hub y, pasado el caché de 60 s de `VideoCallPricingClient`, ya aparece en la app (15/30/45/60). Falta confirmar el resto de la cadena.
- **Hacer:** con una opción nueva en el menú, comprobar que (a) `GET /api/video-call/now` la devuelve con su precio (ya se ve en la app), (b) `POST /api/assistance` acepta `durationMinutes: 60` (no `invalid_duration`), (c) `POST /api/pricing/calculate` devuelve el precio de esa duración (ver B, ya hecho), (d) la sala de Daily y `baseMinutes` quedan en 60 y el contador arranca en 60:00.
- **Cómo lo verificamos:** en "Plan your video call" aparece "60 min" y el resumen muestra su precio; al pedir la llamada, el técnico ve la duración de 60 min antes de aceptar.

---

## 2. Videollamada: durante y después de la llamada

### ✅ Hecho según su documentación (confirmar en producción)
| Punto | Qué | Cómo lo confirmamos |
|---|---|---|
| **Q** | `POST /appointments/:id/video/consent` y exigencia del lado servidor (sin consentimientos completos no se guarda transcripción: 409 `consent_required`) | Aceptar en los dos teléfonos y ver las filas; transcribir sin aceptación y que no se guarde nada. **Textos con legal: el de la app es un borrador** |
| **P y U** | `PUT\|GET …/video/transcript` (combina los dos teléfonos sin repetir) y `hasTranscript`, `transcriptLines`, `extendedMinutes` en la lista de citas | Hacer una llamada con subtítulos y ver la transcripción desde el otro teléfono; la fila "Call transcript" aparece sin consultar tarjeta por tarjeta. Falta aún: traerla desde Daily por webhook (hoy solo la suben las apps) |
| **J** | Presencia: `participants` y `POST /video-room/:id/presence` | "El cliente ya está en la sala" aparece y desaparece en vivo |
| **K** | `providerAmount` por extensión y `providerAmountTotal` | En el Budget del técnico, "Extended time" muestra el dato del servidor |
| **M** | Push `video_extension_requested` al técnico, sin monto ni medio de pago | Pedir tiempo extra con la app del técnico cerrada y recibir el push |

### ⬜ Pendiente
### [ ] L — Habilitar la transcripción en la cuenta de Daily
- **Hacer:** confirmar transcripción habilitada en el dominio de Daily (plan, ya funciona en pruebas) y que el **meeting token del dueño** (no solo el del técnico, que ya es `is_owner`) permita iniciar la transcripción. Precios Daily al 18-nov: USD 0.0059/min por participante con micrófono activo (tiempo real).
- **Cómo lo verificamos:** que el dueño pueda activar los subtítulos desde su teléfono.

### [ ] V — Traducción de los subtítulos de la llamada
- **Qué se quiere (19-nov):** que quien habla español y quien habla inglés se entiendan en la videollamada: cada uno lee los subtítulos **en su propio idioma**. Daily no traduce (su transcripción, de Deepgram, solo pasa voz a texto); hay que armarlo encima.
- **Hacer:** `POST /api/appointments/:id/video/translate` (dueño o técnico de la cita; otro → 403) con `{ from, to, lines: [{ id, text }] }` → `{ lines: [{ id, text }] }` traducidas, usando el modelo de lenguaje que defina producto. Solo con los consentimientos de la llamada registrados (Q) **y** una aceptación nueva de ambos de que el texto se envía a un tercero para traducirlo (`kind: 'translation'` en el registro de consentimientos). Límite por minuto por persona y por llamada; sin guardar el texto traducido salvo que la transcripción (P/U) ya lo guarde.
- **Costo:** se suma a la transcripción de Daily (USD 0.0059 por minuto con micrófono activo). Estimar el costo por minuto de llamada antes de ofrecerlo, y decidir si es de pago o parte del servicio.
- **La app:** recibe cada frase final (`transcription-message`), la manda a este endpoint y muestra la traducción en la barra de subtítulos; ya tiene el selector de idioma de los subtítulos.
- **Definir con legal/producto:** consentimiento adicional, retención, y si el original y la traducción se guardan en la transcripción.
- **Cómo lo verificamos:** una llamada con un teléfono en español y otro en inglés; cada uno ve los subtítulos en su idioma con un retraso de segundos.

---

## 3. Solicitudes y feed del técnico

### ⬜ Pendiente
### [ ] S — Avisar al técnico cuando otro técnico ya tomó la solicitud
- **Problema (visto el 18-nov):** un técnico estaba por ofertar en una videollamada; el cliente confirmó a otro técnico y el primero se quedó en la pantalla de la oferta, sin aviso. La app ahora vuelve a consultar la solicitud (al abrir, cada 15 s, al volver a la app y antes de enviar), pero eso es un parche: el servidor no le avisa.
- **Hacer:**
  1. **Evento en tiempo real.** Cuando una solicitud deja de estar abierta (el cliente confirma a un técnico, se cancela o vence), publicar `assistance_update` (o un `request_taken`) a **los demás técnicos que la tienen en su feed o abierta**, con `{ requestId, status, mechanicId? }`. Hoy el feed solo se entera si el técnico vuelve a cargar.
  2. **Error claro al ofertar sobre una solicitud ya cerrada.** `PATCH /api/assistance/:id` con `status: 'offered'` sobre una solicitud ya tomada o cancelada debe responder **409** con `error.code: 'request_unavailable'` y el `status` actual (hoy la app no distingue ese caso de un error cualquiera).
  3. **Qué ve el técnico que no ganó.** `GET /api/assistance/:id` para un técnico que no es el asignado: documentar si responde 200 con el estado nuevo, 403 o 404 (la app trata 403/404/409 como "la tomó otro"; con 200 usa `status` y `mechanicId`).
  4. Sacar la solicitud del listado `GET /api/assistance` (feed) de los otros técnicos apenas se toma.
- **Cómo lo verificamos:** con dos técnicos viendo la misma videollamada, el cliente confirma a uno; el otro recibe el aviso "Otro técnico tomó esta videollamada" al instante y no puede ofertar; y si intenta ofertar justo en ese momento, recibe el 409 `request_unavailable`.

### [ ] E — `offerExpiresAt` en el listado de pedidos
- Hoy solo está en `GET /assistance/:id/offer-summary` y como columna. Agregarlo a `GET /api/assistance` (listado/feed).

### [ ] AF — No guardar `new_request` en la bandeja de notificaciones
- **Problema:** cada solicitud nueva queda como notificación en la bandeja del técnico (`GET /api/notifications/inbox`), y se acumula (decenas). Es una oportunidad que caduca: si otro técnico la toma o vence, tocarla lleva a una solicitud que ya no está. El técnico ya la ve en vivo en el feed de solicitudes y en el aviso dentro de la app.
- **Hacer:** que `new_request` siga saliendo como **push** pero **no se guarde en la bandeja** (ni cuente en `total` / `unread` ni en el número del ícono).
- **Mientras tanto:** la app ya no las lista y descuenta las que alcanza a ver de `total` y `unread`; con el cambio del backend ese ajuste queda sin efecto y se puede quitar.
- **Cómo lo verificamos:** crear dos solicitudes con un técnico disponible: llegan los dos push, y la bandeja del técnico no suma ninguna.

### [ ] AH — Cerrar el chat cuando el técnico termina (`awaiting_confirmation`), no solo al completarse
- **Problema:** la app ya deja el chat en solo lectura apenas el técnico marca el servicio como finalizado (aunque falte la confirmación del dueño y las calificaciones), pero `GET /chat/conversations/:id` sigue devolviendo `canWrite: true` hasta que la cita se completa o se cancela. Quien use otro cliente (o una versión vieja de la app) todavía puede escribir.
- **Hacer:** que chat-service trate `awaiting_confirmation` como cerrado: `canWrite: false` y rechazar `POST …/messages` con el mismo error que ya devuelve para `completed`/`cancelled`.
- **Cómo lo verificamos:** finalizar un servicio como técnico y comprobar que, sin que el dueño confirme, ambos reciben `canWrite: false` y no pueden enviar.

### [ ] AG — No enviar identidad del técnico mientras la oferta no está aceptada
- **Problema:** la app oculta nombre y foto del técnico (foto borrosa, candado) hasta que el dueño confirma la oferta, pero la respuesta de `GET /api/assistance/:id/offer` (`mechanic.displayName`, `profileImage`, `initials`) los trae completos. Quien mire el tráfico de red los ve antes de confirmar.
- **Hacer:** mientras la solicitud está `offered`, no incluir `displayName`, `profileImage` ni `initials` (sí `avgRating`, `servicesCount`, `aseCertified`, `idVerified`); enviarlos una vez `accepted`.
- **Cómo lo verificamos:** pedir una asistencia, recibir la oferta y ver que la respuesta no trae nombre ni foto; tras confirmar, sí.

### [ ] AE — `refCode` en la vista reducida del prestador (`GET /marketplace/requests[/:id]`)
- **Problema:** la lista blanca de campos del prestador (`id`, `assistanceType`, `title`, …) no trae `refCode`. Las pantallas de cotización del técnico muestran hoy el comienzo del `id` (ej. `#3F9A1C2B`) y no el código corto que ve el cliente y soporte (`AS-XXXXXX`).
- **Hacer:** agregar `refCode` a esa vista (no identifica a nadie). La app ya lo usa si llega y, si no, cae al `id` como antes.
- **Cómo lo verificamos:** abrir una solicitud agendada como técnico y ver el mismo código `AS-XXXXXX` que ve el cliente.

### [ ] R — Entrada "Other" cotizable en el catálogo
- **Problema:** la app ya tiene una tarjeta "Other" en la pantalla de problemas (inmediata y videollamada) con texto libre, pero sin un issue de catálogo la solicitud no se puede cotizar (queda `TBD`) y el texto viaja mezclado en el título.
- **Hacer:** un issue "Other" en `vehicle-issue-catalog` (UUID, traducciones, precio por defecto definido por producto) y un campo opcional `customIssue` (≤ 200) en `POST /api/assistance`, detalle y listado.
- **Cómo lo verificamos:** pedir una asistencia solo con "Other" y ver que tenga precio y que el técnico lea el texto en la oferta.

---

## 4. Perfil y reputación

### ✅ Hecho según su documentación (confirmar en producción)
| Punto | Qué | Cómo lo confirmamos |
|---|---|---|
| **Y** | `GET /api/reviews/me?page=&limit=` con comentario, etiquetas y fecha (técnico: lo que escribieron sus clientes; dueño: lo que escribieron los técnicos) | Tocar las estrellas del perfil y ver la lista, **sin el 403**. La app ya lee este endpoint y pagina. **Sigue fallando en producción (22-nov-2026):** `GET /api/reviews/me` con sesión válida responde `403 "Call this through the API gateway (/api/...)."`, el mismo síntoma de AJ. La tabla de ruteo del gateway (`servicios/gateway/README.md` §4) no lista `/api/reviews` (solo `/api/appointments`), aunque `servicios/appointments/README.md` dice que sí. Probado desde la app: `/api/appointments/stats/me` responde 200; `/api/appointments/reviews/me` y `/api/appointments/me/reviews` responden 404. **Pedido:** agregar `/api/reviews` → `APPOINTMENTS_SERVICE_URL` en el gateway (junto a `/api/appointments`) y desplegar, o exponer la lista en una ruta ya ruteada. Mientras tanto la app muestra las estrellas leídas de las citas recientes (sin comentarios) y avisa que la lista completa no se pudo cargar |
| **Z** | `GET\|POST\|PATCH\|DELETE /api/mechanic-certifications` con revisión en el Hub; `mechanic.certifications` en el resumen de la oferta (verificadas y vigentes) | Cargar una certificación desde el perfil del técnico y verla "Pending"; que aparezca en la oferta del dueño una vez verificada |

### ⬜ Pendiente (lo que su documentación marca como "pendiente")
- **Pantalla de revisión de certificaciones en el Hub** (aprobar o rechazar con motivo).
- **Permisos del admin en auth-service:** agregar `certifications.read.any` y `certifications.verify.any` a `SEEDED_PERMISSIONS`, o los tokens de admin viejos reciben 403 en la revisión.
- **Aviso push 30 días antes del vencimiento** de una certificación verificada, y definir si cuenta para el matching.

---

## 5. Cuidado del vehículo

### ⬜ Pendiente
### [ ] W — Agente de recomendaciones de cuidado del vehículo
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

---

## 6. Notificaciones

### ⬜ Pendiente
### [ ] AB — Textos de las notificaciones push más completos
- **Qué se quiere (20-nov):** que lo que aparece en el centro de notificaciones del teléfono diga **una línea más**: hoy los avisos son muy cortos y la persona tiene que abrir la app para entender de qué se trata. El texto lo arma **notifications-service** (la app solo muestra `title` y `body` tal como llegan), así que el cambio es del lado del back.
- **Pauta:** título de hasta ~40 caracteres que diga el hecho; cuerpo de **dos líneas** (~90–120 caracteres) con el dato útil (quién, cuánto dura, qué hacer ahora). Sin montos para el técnico (ni comisiones ni impuestos); sin datos sensibles en la pantalla de bloqueo (nada de direcciones exactas ni teléfonos). Español e inglés, según el idioma del teléfono.
- **Propuesta de textos** (entre `{{ }}` va el dato que ya tiene el servicio):

| `kind` | Título (EN / ES) | Cuerpo (EN / ES) |
|---|---|---|
| `new_request` (técnico) | New request near you / Nueva solicitud cerca tuyo | A customer needs help about {{distance}} mi away: {{issue}}. Open the app to review it and send your offer. / Un cliente necesita ayuda a unas {{distance}} millas: {{issue}}. Abrí la app, revisala y enviá tu oferta. |
| `offer_accepted` (técnico) | Your offer was accepted / Aceptaron tu oferta | {{name}} chose you for this job. Open the details and get ready to start. / {{name}} te eligió para este trabajo. Mirá los detalles y prepará el inicio. |
| `mechanic_found` (dueño) | A technician offered to help / Un técnico te ofrece ayuda | {{name}} can take your request. Review the offer and confirm to continue. / {{name}} puede tomar tu solicitud. Revisá la oferta y confirmá para continuar. |
| `request_status` en camino (dueño) | Your technician is on the way / Tu técnico va en camino | {{name}} left for your location. We'll notify you again when they arrive. / {{name}} salió hacia tu ubicación. Te avisamos de nuevo cuando llegue. |
| `request_status` llegó (dueño) | Your technician has arrived / Tu técnico llegó | {{name}} is at your location. Open the app to follow the visit. / {{name}} está en tu ubicación. Abrí la app para seguir la visita. |
| `video_call` (sala lista) | Your video call is ready / Tu videollamada está lista | {{name}} is waiting for you. Tap to join: the call lasts {{minutes}} minutes. / {{name}} te está esperando. Tocá para entrar: la llamada dura {{minutes}} minutos. |
| `video_call_reminder` | Your video call starts in 10 minutes / Tu videollamada empieza en 10 minutos | Scheduled for {{time}} with {{name}}. Have your vehicle and good light ready. / Agendada para las {{time}} con {{name}}. Tené a mano el vehículo y buena luz. |
| `video_call_finished` (dueño) | Your video call has ended / Terminó tu videollamada | Confirm it was resolved, or tell us what went wrong. If you don't reply, it confirms itself in 24 hours. / Confirmá si se resolvió o contanos qué falló. Si no respondés, se confirma sola en 24 horas. |
| `video_call_confirmed` (técnico) | Your video call was confirmed / Confirmaron tu videollamada | The customer confirmed the call. Your earnings will show in Payments. / El cliente confirmó la llamada. Tus ganancias van a aparecer en Pagos. |
| `review_requested` | How did it go? / ¿Cómo te fue? | Rate {{name}} and tell others about your experience. It takes a few seconds. / Calificá a {{name}} y contá tu experiencia. Lleva unos segundos. |
| `chat_message_created` | (nombre de quien escribe) | Subir el recorte del mensaje de 100 a **140 caracteres** (hoy "Te envió una foto" para imágenes está bien). |

- **Hecho cuando:** los diez tipos de arriba salen con título y cuerpo en los dos idiomas, y ningún texto pasa de dos líneas en el centro de notificaciones de un iPhone (el cuerpo se corta en ~4 líneas al expandir).
- **Cómo lo verificamos:** disparar cada tipo contra un teléfono de prueba (iOS y Android) en español e inglés y mirar el centro de notificaciones. La app no cambia.

---

## 7. Citas y otros

### ⬜ Pendiente

### [ ] AC — Ocultar una cita cancelada para el usuario
- **Qué se quiere (20-nov):** en la pestaña "Past" de las citas, el usuario puede **eliminar una cita cancelada** para no verla más. Hoy la app solo la oculta **en ese teléfono** (por cuenta): al reinstalar o entrar desde otro teléfono vuelve a aparecer. El servidor no tiene forma de ocultar una cita, y la otra parte y los registros deben seguir viéndola.
- **Hacer:** un endpoint para que cada usuario oculte (soft delete por usuario) una cita **cancelada**, por ejemplo `POST /api/appointments/:id/hide` (y `DELETE …/hide` para deshacer); `GET /api/appointments` no devuelve las ocultas del usuario que las ocultó. Solo para citas canceladas; otro estado → 409.
- **Cómo lo verificamos:** ocultar una cita cancelada, reinstalar la app o entrar desde otro teléfono y que no aparezca; la otra parte la sigue viendo.

### [ ] AD — Actualizar la documentación (repo de análisis)
- Documentar lo que se agregue de los puntos pendientes (S, E, R, V, W, AB, AC).
- **`kind: 'translation'`** en el registro de consentimientos, si se hace V (hoy el endpoint acepta `precall|captions-request|captions-answer`).
- Turnos de `/video-call/slots`: ya figuran 24 h y `period: night`; confirmar que el README refleje los 48 por día.

---

## ✅ Otros puntos hechos según la documentación — solo confirmar que están desplegados

| Punto | Qué | Cómo lo confirmamos |
|---|---|---|
| **A** | El técnico aprueba las extensiones (`requireApproval`, accept/decline, `pendingRequest`, eventos) y flag `extension_approval_enabled` (contrato en el Anexo 3) | Con el flag prendido, el dueño pide tiempo y al técnico le aparece Aceptar/Rechazar |
| **C** | `GET /api/assistance/:id` devuelve `durationMinutes` | La oferta del técnico muestra la duración antes de aceptar |
| **D** | `baseMinutes` = duración elegida de esa llamada; sala de Daily con esa duración | El contador arranca en 15/30/45 según lo elegido |
| **F** | `assistanceRequestId` en `walletMovements` | La actividad del wallet muestra el servicio |
| **G** | La videollamada no usa radio de servicio | Un técnico lejano recibe la oferta de videollamada |
| **H** | Corte anticipado → disputa del dueño; lista de disputas del Hub con `contractedMinutes` | El técnico finaliza antes y el dueño puede reclamar |
| **I** | Grilla de turnos de 24 h | ✅ Verificado en producción el 18-nov |

---

## Orden sugerido
1. **Confirmar en producción** lo que figura hecho (áreas 1, 2 y 4): una videollamada de punta a punta (AA, B, N, O, Q, P/U) y el perfil (Y, Z).
2. **S** (aviso cuando otro técnico toma la solicitud) y **X** (valor del descuento de agendadas).
3. **L** y **V** (si producto lo quiere), **AB** (textos de las notificaciones).
4. **W**, **E**, **R**, **AC** cuando haya capacidad.

---

## Anexo 1 — Qué hace la app hoy (contrato que consume)

### 1.1 Pedir una videollamada — `request-assistance/when.tsx`
- Pide `GET /api/video-call/now` y muestra el menú `durations[]` (`minutes`, `price` base): las duraciones a la vista, de a dos por fila
  (tres juntas si son tres). Sin menú usa el flujo antiguo de tarifa fija.
- La duración **es obligatoria y no tiene opción preseleccionada**; tocar de nuevo la elegida la suelta. El botón pide lo que falta.
- Dos pasos en la misma pantalla: **1) elegir duración y "Now" o "Schedule" → Continue; 2) revisar el resumen → "Confirm and request"**
  (o "Schedule for [hora]").
- Con la duración cotiza `POST /api/pricing/calculate`
  ```json
  { "assistance_type": "videocall", "timezone": "America/New_York", "duration_minutes": 30, "service_at": "<ISO, solo si agenda>" }
  ```
  y muestra `pricing_breakdown.final_price` tal cual (sin impuestos).
- Crea el pedido con `POST /api/assistance` (`assistanceType: "videocall"`, `durationMinutes`, `timezone`; si falla por `timezone` desconocido
  reintenta sin él) y persiste `POST /api/pricing/requests/:id/price` con el mismo `duration_minutes`.
- Cuando el técnico ofrece y el dueño confirma, el dueño abre **la cita** (con "Join video call"); no entra directo a la llamada.

### 1.2 Agendar
Usa `GET /api/video-call/slots?timezone=<IANA>&days=14`. Los turnos `no_mechanics` se tratan como reservables (desde N); la app no muestra cupos
tomados.

### 1.3 Durante la llamada
- Indicador, aviso de "quedan 5 minutos", corte automático y tarjeta de tiempo leen `baseMinutes` / `contractedMinutes` del estado
  (`GET /api/appointments/:id/video`) y de `GET …/video/extensions`; usa `elapsedSeconds` del servidor, no calcula el tiempo por su cuenta.
- El dueño compra tiempo con `POST …/video/extensions { minutes, idempotencyKey, paymentMethodId?, requireApproval: true }`.
- Ante `video_call_update` (cualquier `stage`) ambos teléfonos recargan el estado.
- Subtítulos: `startTranscription()` de Daily; al terminar la llamada cada teléfono envía su transcripción con `PUT …/video/transcript`
  (`speakerId`, `role`, `name`, `text`, `at`) y registra los consentimientos con `POST …/video/consent`.

### 1.4 Técnico — "Review before you accept"
Muestra, en un solo card, precio, duración, **cuándo** (con la nota de zona horaria), vehículo y asistencia; "Offer to take this call" a todo el
ancho y "Decline" debajo. Usa `durationMinutes` de `GET /api/assistance/:id` (si falta, `baseMinutes`). Nunca ve comisiones ni impuestos.

### 1.5 Otros endpoints que la app consume ahora
`GET /api/reviews/me` (reseñas del perfil, paginado) · `GET|POST|PATCH|DELETE /api/mechanic-certifications` · `PUT /api/addresses/:id/service-base`
(dirección base; respuestas `address_not_for_service` y `address_without_location`) · `hasTranscript`, `transcriptLines`, `extendedMinutes` en la lista de
citas · `mechanic.certifications` en el resumen de la oferta.

---

## Anexo 2 — Decisiones de producto ya tomadas (no reabrir)

1. Las duraciones salen del Hub (`videocall_settings.duration_options`, 1 a 6); llevan **recargo por franja horaria**.
2. Cada extensión es un bloque de **USD 15** base; el recargo por franja **también aplica** a las extensiones; las extensiones **no llevan descuento**.
3. **Una videollamada no lleva impuestos:** el dueño paga el precio de la llamada y el platform fee se descuenta de lo que gana el técnico.
4. El técnico **ve la duración elegida antes de aceptar**, y solo ve lo que es suyo (nunca comisiones ni impuestos).
5. Si la llamada se corta antes de tiempo por parte de quien **no paga** (el técnico): sin prorrateo ni reembolso automático; **va a disputa** (flujo existente).
6. **Cuando el dueño pide más tiempo, el técnico lo tiene que aceptar** en su pantalla (Anexo 3).
7. La videollamada se pide **a cualquier hora (24/7)**; si nadie la acepta, se cancela sin cargo.
8. Las videollamadas **agendadas costarán un poco menos** que las de "ahora" (el valor y quién lo financia siguen por definir: punto X).
9. Los textos de consentimiento de la llamada son un **borrador**, no asesoría legal: falta revisión de legal (punto Q).

---

## Anexo 3 — Aprobación del técnico para las extensiones (implementado en backend y app)

Referencia del contrato ya acordado, útil para confirmar el despliegue.

### 3.1 Máquina de estados de una extensión
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

### 3.2 Endpoints

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

### 3.3 Eventos WebSocket (`video_call_update`)
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

### 3.4 Configuración (Hub)
Agregar a `videocall_settings` (tabla de una fila) `extension_response_seconds`: **default 60, rango 5–300**, editable
desde Pricing → Video Calls, expuesta en `GET /pricing/videocall/settings` y aceptada (opcional) en `PUT`.
Agregar `extension_approval_enabled` (**boolean, default `false`**): ver 3.8.

### 3.5 Reglas y casos borde
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

### 3.6 Compatibilidad con builds viejas (importante)
Una app **vieja** del dueño que llame al `POST` esperaría que el tiempo se sume al instante; una app **vieja** del técnico
no tiene pantalla para aceptar. Con el cambio a secas, las extensiones quedarían en `requested` y vencerían.

Propuesta: **feature flag + opt-in explícito.**
- `extension_approval_enabled` (Hub) en `false` = comportamiento actual (compra directa).
- Con el flag en `true`, el flujo con aprobación solo se aplica si el body del `POST` trae
  `"requireApproval": true` (la app nueva lo manda siempre). Sin ese campo → compra directa como hoy.
- Se activa el flag cuando la app nueva esté publicada y adoptada por técnicos (idealmente con versión mínima forzada).

Si prefieren otro mecanismo (header de versión, versión mínima), la app se adapta: solo necesita saber **cuándo** debe
esperar aprobación.

### 3.7 Pruebas de aceptación sugeridas
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

### 3.8 Qué hace la app con esto
- **Dueño:** al pedir tiempo ve "Esperando al técnico…" con cuenta regresiva hasta `expiresAt`; se le avisa si rechaza,
  vence o falla el pago, y puede reintentar.
- **Técnico:** tarjeta sobre la llamada con los minutos, cuenta regresiva y **Aceptar / Rechazar**. No ve montos.
- Ambos: al aceptar, el límite del indicador se mueve (ya funciona) y se muestra el aviso de "tiempo agregado".

---

## Anexo 4 — Reglas de despliegue y referencias

- **Backend primero.** El backend rechaza campos desconocidos (`forbidNonWhitelisted`): cualquier campo nuevo que la app mande
  (`requireApproval`, `timezone`, `customIssue`, …) tiene que existir en el DTO **antes** de publicar el build.
- **App:** `app/(tabs)/request-assistance/when.tsx`, `lib/dao/VideoCallDAO.ts`, `components/video/ExtendCallSheet.tsx`, `components/video/CallTimeAddedToast.tsx`,
  `lib/video/callLength.ts`, `lib/video/transcriptSync.ts`, `app/(tabs)/assist/[id].tsx`, `context/SocketContext.tsx` (eventos).
- **Backend (repo de análisis `the-digital-hub/mechanicassistance-analisis`):** `servicios/appointments/README.md` (Videollamada, Tiempo extra,
  Consentimientos y transcripción), `servicios/price/README.md`, `servicios/billing/01-logica-de-pagos.md`, `servicios/users/README.md` (certificaciones,
  dirección base), `servicios/notifications/README.md`.

## AI — Calificaciones: `experienceTags` en `client-review` y formato unificado
- `POST /appointments/:id/client-review` hoy documenta solo `{rating, review?}`. La app ya muestra opciones prearmadas al técnico (puntual, descripción clara, trato respetuoso, fácil acceso) pero **no las envía** (`SEND_CLIENT_REVIEW_TAGS=false` en `lib/reviews/tags.ts`) porque el DTO con `forbidNonWhitelisted` podría devolver 400. Pedido: aceptar `experienceTags: string[]` (claves) y devolverlas en `clientReview`. Luego se activa el flag.
- `POST /appointments/:id/review` (dueño) recibe `experienceTags` como string separado por comas, mientras `GET /reviews/me` lo devuelve como array. Pedido: aceptar array en ambos y normalizar; la app pasará a array.
- `isReviewSubmitted` lo prenden ambas calificaciones; la app ya no lo usa para decidir si el dueño debe calificar (solo `reviewRating == null`).

## AJ — Gateway: falta rutear `/api/mechanic-certifications` (bloquea "Other certifications")
**Resuelto el 24-nov (devolución de backend):** el 403 venía del gateway, que no pasaba el token interno en `/api/reviews` ni en `/api/mechanic-certifications`. Corregido y desplegado; falta reintentar «Other certifications» y «My reviews» en la app.

Guardar una certificación devuelve `403 "Call this through the API gateway (/api/...)"`. La tabla de ruteo del gateway (`mechanicassistance-gateway/src/main.ts`, ver `servicios/gateway/README.md` §4) no lista el prefijo `/api/mechanic-certifications`, así que la petición no llega a users-service. Pedido: agregarlo junto a `/api/mechanic-documents` → `USERS_SERVICE_URL` y desplegar el gateway. La app ya manda a `/api/mechanic-certifications` (GET/POST/PATCH/DELETE) y muestra el error del servidor en el formulario.

## AK — `refCode` en `POST /api/assistance/summaries` y `GET /marketplace/requests`
La app muestra el código del pedido (`AS-XXXXXX`) al pie de cada pago, cobro y movimiento de wallet. `summaries` devuelve título, dirección y fecha pero no `refCode`, así que hoy se ve el inicio del id (`#a1b2c3d4`). Pedido: agregar `refCode` a la respuesta (opcional en la app: `AssistanceSummary.refCode?`).
También en `GET /marketplace/requests` (vista del prestador): la tarjeta «Your quotes» muestra el código del pedido.

## AL — `createdAt` en `GET /marketplace/requests` (y `myOffer.createdAt`)
La tarjeta de «New requests» del técnico muestra cuánto hace que el cliente publicó el pedido («5 min ago», «2 h ago», «1 d ago»), como el feed inmediato. `GET /marketplace/requests` no devuelve la fecha de publicación (`date` es el día del servicio pedido, futuro), así que hoy la app no puede mostrar esa línea. Pedido: agregar `createdAt` (ISO) a cada request de la vista del prestador. La app ya lo lee (`MarketplaceRequest.createdAt` → `AssistanceRequest.createdAt`) y mostrará el tiempo apenas llegue.
Además `myOffer.createdAt` (cuándo se envió el quote): la app lo usa para ordenar «Your quotes» por fecha de envío; si falta, esos quotes quedan al final.

## AM — Eventos de los pasos intermedios de la visita y `vehicleCondition` en las filas de cita
- **Pasos de la visita en vivo.** El dueño ve una línea de tiempo (aceptada, en camino, llegó, inspeccionando, reparando, cierre). La app la arma sondeando `GET /appointments/:id/on-site` cada 15 s, porque el servidor solo avisa por socket al salir, al hacer check-in y al cerrar/confirmar. Pedido: emitir un `appointment_update` (o un `on_site_update`) cuando el técnico avanza de paso (`step`), para quitar el sondeo y que la línea de tiempo cambie al instante.
- **`vehicleCondition` en `GET /appointments`.** La app lo muestra al técnico (tarjetas, trabajo activo, pestaña Details). Hoy lo completa desde la solicitud (`assistance_requests`) cuando la fila de la cita no lo trae. Pedido: confirmar que las filas de cita lo devuelvan siempre (`drivable` · `unsafe_to_drive` · `pushable_only`).

## AN — Membership plan (billing de la membresía): endpoints para reemplazar el mock
La app ya tiene la pantalla **Profile → Account → Membership plan** (técnico y dueño del vehículo, `app/(tabs)/membership.tsx`). Hoy muestra datos **simulados** desde `lib/membership/plan.ts` (plan «All-access», $0.00/mes, estado «Startup · fee waived»). Cuando existan los endpoints, solo cambian `loadMembership` y `applyPromoCode`; la pantalla lee esa forma y nada más. Pedido (los endpoints definitivos llegan esta semana, esto es lo que la pantalla necesita):
**Precio del plan del técnico (24-nov):** «All-access» cuesta **US$ 120 por año** para el técnico (la app lo muestra así, simulado: `amount: 120`, `period: 'year'`, `status: 'active'`); el dueño sigue gratis en la etapa de lanzamiento. `GET /api/membership/me` debe devolver ese precio y período por rol, y `periodsOffered` con un solo período (`year`) para el técnico.
**Cobro del plan (24-nov, simulado):** la sección Billing de la app ya muestra el monto, el período, la fecha de renovación y, al técnico, el botón «Pay $X» con su confirmación y el recibo; hoy el pago es simulado (no se cobra nada, queda guardado en el teléfono). Pedido: `POST /api/membership/pay` (cobra el plan con la tarjeta guardada del técnico en billing, o la que agregue con el setup-intent de siempre, aplicando el cupón) → `{ status, paidAt, amount, couponCode, nextPaymentAt }`; `GET /api/membership/me` devuelve `payment` y `nextPaymentAt` (un año después). Errores a mapear: `402` tarjeta rechazada (cambiar tarjeta), `409` ya pagado. Falta decidir si el técnico puede ofertar sin haber pagado.
**Pagar con earnings o tarjeta, wallet y renovación (24-nov, simulado):** el técnico elige en «How do you want to pay?» entre una tarjeta guardada (`GET /api/payment-methods`), agregar una (queda guardada en su wallet para la renovación) o sus **earnings** (solo si el saldo «ready» cubre el monto completo; el que arranca en cero paga con tarjeta, sin Zelle por ahora y ACH más adelante). Pedido: `POST /api/membership/pay` con `{ source: 'earnings' | 'card', paymentMethodId?, autoRenew? }`; con `earnings` el servicio **descuenta el monto del saldo disponible / del próximo payout** y registra el movimiento como línea saliente en `GET /api/payments/me/history` y en el PDF del estado de cuenta («Membership · All-access», −$X, medio usado, cupón). `autoRenew` solo con tarjeta: el servicio renueva un año después con la tarjeta guardada y avisa al técnico **7 días antes** (push + inbox); la app muestra el interruptor en Billing (`PATCH /api/membership/me { autoRenew }`). En Earnings la app muestra estado (pendiente/pagada y renovación), «Payment methods» (cantidad de tarjetas, abre `/payment-cards`) y la línea del pago en la actividad. Pregunta de producto: ¿se permite pagar con earnings parciales + tarjeta? (hoy no).
**Dueño del vehículo (24-nov, simulado):** la misma pantalla y el mismo cobro valen para el dueño, con su propio plan: «All-access» a **US$ 15 por año** (ya no es gratis en el lanzamiento), pago solo con tarjeta guardada (no tiene earnings), con renovación automática y el mismo aviso 7 días antes. Los cupones van **por rol**: `MIAMI` (10 %) y `MEKA` (25 %) son solo del técnico; el del dueño es `INSURANCE`, **100 % de descuento** (US$ 0: no hay nada que cobrar, la app no muestra «Pay» y marca el plan como cubierto). Un código de un rol aplicado al otro debe devolver `not_eligible`, uno desconocido `invalid`. Una misma persona puede tener los dos planes (técnico y dueño), cada uno con su cupón, su pago y su renovación: `GET /api/membership/me` y `POST /api/membership/pay` tienen que distinguir el rol activo. El pago del dueño debería verse en su wallet (Payments) igual que el del técnico en Earnings.
**Dueño: plan por vehículo con VIN y bonificación por flota (24-nov, simulado):** el plan del dueño ya no es un precio único: se cobra **por vehículo con VIN, por año**, y cada vehículo tiene **su propia fecha** (un año desde su pago, renovación propia). Precio por lugar en la flota (en el orden en que se cargaron): **1.º US$ 15, 2.º y 3.º US$ 12, del 4.º en adelante US$ 9**; el cupón (`INSURANCE` 100 %) se aplica sobre cada vehículo. Un vehículo sin VIN no entra al plan. Pedido: `GET /api/membership/me` (rol dueño) devuelve `vehicles: [{ vehicleId, listPrice, price, paidAt, renewsAt, autoRenew }]`, `fleetDiscount` y el total pendiente (el servidor calcula los escalones; la app no). `POST /api/membership/pay` cobra **solo los vehículos pendientes** (`vehicleIds` opcional) y devuelve el pago por vehículo; al agregar un vehículo nuevo queda pendiente a su precio de escalón y los pagados no cambian. El plan del dueño se llama **«Assistance Pass»** (el del técnico sigue siendo «All-access»): `planName` tiene que venir por rol. Reglas a definir: qué pasa con la bonificación si se borra un vehículo (el precio de los que ya pagaron no cambia; el lugar de los pendientes sí) y VIN repetido en otra cuenta (ya pedido: VIN único).
**Cupones de prueba (24-nov, simulados):** `MIAMI` da **10 %** de descuento y `MEKA` da **25 %** sobre el plan del técnico (US$ 108 y US$ 90 por año; el precio de lista US$ 120 se muestra tachado y una etiqueta «Coupon applied · N % off» va arriba de la tarjeta). Con los endpoints reales, `POST /api/membership/promo-code` debe devolver `{ applied, code, percentOff }` y `GET /api/membership/me` el `coupon` aplicado, el monto final y el de lista.
- **`GET /api/membership/me`** → `{ status: 'startup_waived' | 'active' | 'past_due' | 'cancelled', planName, amount, period: 'month' | 'year', periodsOffered: ('month'|'year')[], nextPaymentAt: ISO | null, promoAvailable: boolean, memberSince: ISO | null }`. Por rol: el técnico y el dueño pueden tener planes distintos; la app solo muestra el que corresponde al rol activo.
- **`POST /api/membership/promo-code`** `{ code }` → `{ applied: true, ... }` o error con código: `invalid`, `expired`, `not_eligible`. La app mapea esos tres a mensajes; cualquier otro lo trata como no válido.
- **`PATCH /api/membership/me`** `{ period: 'month' | 'year' }` para cambiar la frecuencia cuando se lancen los planes (hoy el selector no existe: la tarjeta «Billing» dice «Coming soon»).
- **`POST /api/membership/cancel`**: la pantalla ya tiene el link «Cancel plan» (ahora solo avisa que los planes todavía no se lanzaron). Cancelar mantiene el acceso hasta el fin del período actual; hace falta `status` `cancelled` y la fecha de fin (`accessUntil`) en `GET /api/membership/me`.
- Rutear el prefijo `/api/membership` en el gateway (ver AJ: pasó con otro prefijo) y avisar por notificación antes de cualquier cambio de plan o de precio (la pantalla lo promete: «We'll notify you before any future plan or pricing change takes effect»).

## AO — El token de registro (signup-scoped) no puede llamar `POST /api/ase-membership/verify`: 403 «Token not valid for this route»
En el paso **ASE Certifications** del registro del técnico, «Search ASE records» devuelve `403 {"message":"Token not valid for this route"}`. La app llama con el token de alcance de registro (el mismo que usa el resto del asistente, válido 30 min); el gateway lo rechaza en `/api/ase-membership/verify`, así que el técnico no puede validar su ID ASE durante el alta. Hoy la app muestra «ASE verification is not available during sign-up right now… Verify later» y deja seguir (puede vincular el ID después desde el perfil, donde ya tiene sesión completa). Pedido: permitir `POST /api/ase-membership/verify` (y `GET /api/ase-membership/lookup/:aseId`) a los tokens de registro, en la lista de rutas del alcance `signup` del gateway, junto a `/api/users/check-email`, `/api/setup-progress`, etc. La respuesta no revela el nombre del titular (ya está diseñada así), así que no filtra datos. Reproducción: registro de técnico → paso de credenciales → un ID ASE completo con el nombre/apellido cargados.

## AP — `POST /appointments/:id/on-site/diagnostic` rechaza el diagnóstico sin las fotos de patente y tablero
La app deja al técnico elegir «Continue without the photos (not recommended)» en el paso 2 del check-in (por si la cámara falla). Al terminar el paso del OBD la app envía el diagnóstico y el servidor responde error por las fotos que faltan. Hoy la app lo tolera: si el técnico eligió seguir sin fotos, ignora ese error y pasa a la factibilidad. Pedido: aceptar el diagnóstico sin esas fotos cuando se indica (por ejemplo `photosSkipped: true`) y dejarlo marcado en la visita, para que el reporte del servicio diga que se hizo sin fotos del estado del vehículo.

## AQ — Logo de Mechanic Assistance (a color) arriba del PDF del estado de cuenta
`GET /api/earnings/me/statement` (billing) devuelve el PDF del estado de cuenta del wallet del técnico; la app solo lo descarga y lo comparte, así que el logo tiene que salir del PDF que genera el servicio. Pedido: poner arriba de la primera página el logo de la marca **a color** (el aro azul/celeste y el nombre a su lado, no el blanco), con la misma altura y márgenes que el reporte del servicio de la app (aro de 34 px y nombre de 15 px de alto). Los archivos están en el repo de la app: `assets/images/brand_ring_color.png` y `assets/images/brand_wordmark_color.png`. Lo mismo vale para el estado de cuenta del dueño si el servicio lo genera (misma plantilla).

## AR — `POST /api/assistance/summaries` para el prestador: hoy no devuelve los pedidos que atendió
En «Earnings activity» del técnico (y en el historial de pagos), cada fila busca el título, el vehículo y el código del pedido con `POST /api/assistance/summaries`. Para el técnico la fila sale con «Request details unavailable» y con el comienzo largo del id (`#1129427b`) en lugar del código corto (`AS-XXXXXX`): señal de que el endpoint no está devolviendo esos pedidos para quien los atendió (probablemente solo responde por los pedidos del dueño). Pedido: que `summaries` devuelva `id`, `title`, `address`, fecha y `refCode` también de los pedidos en los que el usuario es el prestador asignado (sin datos que no deba ver, igual que la vista reducida del prestador, ver AE y AK). Hipótesis sin confirmar contra producción; para verificar: con una cuenta de técnico con pagos, `POST /api/assistance/summaries` con los `assistanceRequestId` de `GET /api/payments/me/history` debería traer cada pedido.

## AS — `GET /api/assistance-types?scope=app` responde 401 sin sesión: la app arranca con la lista de respaldo
Al abrir la app sin sesión (bienvenida, login, registro), `GET /api/assistance-types?scope=app` devuelve `401 Missing or malformed Authorization header`, y la app avisa «Could not load the assistance type catalog; using fallback list» (se ve en Metro y en `adb logcat`, igual en iOS y Android). Con sesión se vuelve a pedir, pero hasta entonces el catálogo viene de la lista fija del cliente, que puede quedar desactualizada respecto del backend. Pedido: permitir ese `GET` sin autenticar (es un catálogo público, sin datos del usuario) o confirmar que la lista de respaldo es la fuente a usar antes del login. Para verificar: `curl https://t9smggmz3a.us-east-1.awsapprunner.com/api/assistance-types?scope=app` debe devolver 200 sin cabecera `Authorization`.

## AT — Incidencias del pedido por lote (`/api/pricing/requests/:id/issues` se pide una por una)
**Mitigado en la app el 24-nov:** la lista de citas y pedidos se muestra apenas llegan las dos listas; las incidencias se piden después, de a 8 en paralelo, y se guardan 5 minutos (antes la lista esperaba a las ~340 llamadas y el detalle abierto desde una notificación se quedaba cargando). El pedido al backend (endpoint por lote) sigue en pie: son demasiadas llamadas igual.
Al abrir la app, `AppointmentsContext` pide las incidencias de cada pedido y cita con un `GET /api/pricing/requests/:id/issues` por id. En una cuenta con ~170 pedidos son ≈340 llamadas por carga y ≈670 en los primeros segundos (hay recargas por socket y foco); en Android el dashboard del dueño tardó más de 1 minuto en salir del spinner. Además todas esas llamadas respondieron `401 Missing or malformed Authorization header` en esa corrida. Pedido: un endpoint por lote, por ejemplo `POST /api/pricing/requests/issues` con `{ ids: string[] }` → `{ [id]: VehicleIssueSnapshot[] }`, o incluir las incidencias en `GET /api/assistance` y `GET /api/appointments`; y revisar por qué ese servicio rechaza el token que el resto de la API acepta. Para verificar: abrir la app con una cuenta con historial largo y contar las llamadas (`adb logcat | grep -c pricing/requests`).

## AU — Versión de la política de privacidad y quién ya la aceptó (para avisar «Update» en el perfil)
El menú del perfil ya marca lo pendiente (identidad, ASE, documentos legales, membresía) con una pastilla en el grupo que lo contiene y una etiqueta en la fila. Falta uno: **la política de privacidad actualizada**. Hoy la pantalla `app/(tabs)/privacy.tsx` no guarda qué versión se aceptó (el guardado de `privacy_accepted` está comentado) y no hay dato de la versión vigente. Pedido: `GET /api/users/me` (o `/api/legal/privacy`) debe devolver `{ privacyPolicyVersion: string, privacyAcceptedVersion: string | null }`, y `POST /api/legal/privacy/accept { version }` registrar la aceptación con fecha. Con eso la app muestra la etiqueta «Update» en la fila «Privacy Policy» (grupo Account) cuando `privacyAcceptedVersion !== privacyPolicyVersion`, y la fila vuelve a lo normal al aceptar. Lo mismo valdría para los términos de uso si tienen versión propia.

## AV — Estado de cuenta (PDF) del dueño del vehículo: hoy solo existe el del técnico
El técnico baja el PDF del estado de cuenta desde Earnings → Activity → filtros (`GET /api/earnings/me/statement?from&to`, billing). El dueño tiene la misma pantalla de actividad («Recent payment activity», con el mismo filtro de fechas) pero **no tiene PDF**: el endpoint es de earnings y no incluye sus pagos. Pedido: `GET /api/payments/me/statement?from=YYYY-MM-DD&to=YYYY-MM-DD` → PDF con los pagos de servicio, los movimientos del wallet y los cobros del plan (cada vehículo de Assistance Pass con su fecha), con el logo a color (ver AQ). Con el endpoint, la app agrega la sección «Account statement» a la hoja de filtros de la actividad del dueño (el componente ya lo admite: `EarningsFiltersBar` recibe `statement`).

---

## AW — `providerAmount` en `pendingRequest` de las extensiones (lo que gana el técnico por el tiempo extra)

- **Qué hace falta:** `GET /api/appointments/:id/video/extensions` (y el evento `extension_requested`), cuando lo consulta el técnico, devuelve en `pendingRequest` el campo `providerAmount` (decimal, "12.75"): lo que gana por esos minutos, ya con el recargo por franja y **sin** la comisión ni el precio del dueño. Al dueño no se le manda.
- **Por qué:** el técnico acepta o rechaza el tiempo extra sin saber cuánto cobra. La app ya muestra «Ganás $X» en la tarjeta cuando el campo existe y, mientras no llegue, la tarjeta sale sin monto.
- **Prueba:** el dueño pide 15 minutos; en el teléfono del técnico la tarjeta dice el monto y, al aceptar, coincide con la línea que queda en Ganancias.

---

## AX — El dueño avisa que no va a enviar el escaneo OBD (cerrar el pedido de OBD)

- **Qué hace falta:** un estado `skipped` en el reporte OBD de la solicitud: `POST /api/assistance/:id/obd/skip` (solo el dueño; se deshace al adjuntar un archivo) y `status: 'skipped'` en `GET /api/assistance/:id/obd`, con el evento `obd_update`.
- **Por qué:** la app ya ofrece, muy discreto, «No lo tengo, no lo voy a enviar» debajo de la carga del archivo, pero hoy solo se guarda en el teléfono del dueño: el técnico no se entera y sigue viendo «sin escaneo». Cuando exista el estado, la app lo envía y el técnico lee «El cliente no va a enviar el escaneo».
- **Prueba:** el dueño toca el enlace y confirma; en el teléfono del técnico el panel OBD dice que no hay escaneo y por qué.


---

## AY — Disponibilidad estructurada en los pedidos agendados (hoy viaja como texto libre)

- **Qué hace falta:** que `GET /marketplace/requests` (y `/:id`) devuelva la disponibilidad del dueño como datos, no solo dentro de `notes`: `availability: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', windowStart: 'HH:mm', windowEnd: 'HH:mm', timezone: 'America/New_York' }`. La fecha `date` tiene que ser el día de servicio pedido (no el día de publicación) y, si es solo un día, no puede venir como medianoche UTC.
- **Por qué:** la app del técnico arma los días y los horarios de llegada leyendo una línea de `notes` con un formato fijo («Wed, Nov 25 – Thu, Nov 26 · 10:00 AM – 7:00 PM»). Un pedido llegó con otro formato («Rango 2026-11-25 al 2026-11-26 (10:00 AM - 7:00 PM EST)»): el técnico vio solo el 24, sin horarios para elegir y sin poder enviar la cotización. El Hub sí mostraba bien el 25 al 26, así que el dato existe del lado del servidor.
- **Qué hizo la app mientras tanto:** lee también ese formato, acepta guion simple en el horario y ya no corre un día las fechas sin hora. Cuando llegue `availability`, la app lo usa primero y deja el texto como respaldo.
- **Prueba:** crear un pedido agendado del 25 al 26, 10:00 AM a 7:00 PM, desde cada cliente (app, web, bot); en el teléfono del técnico los días y los horarios salen iguales que en el Hub.
