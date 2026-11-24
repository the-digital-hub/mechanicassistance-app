# Pendientes de backend (Alejandro)

**Fecha:** 24 de noviembre de 2026 · **De:** equipo de la app · **Base:** la devolución de backend del 24-nov y los pedidos de la app (`docs/backlog-backend.md`).

La devolución del 24-nov contesta los puntos del backlog del 20-nov (A a AD) y el 403 de reseñas y certificaciones (nuestro ítem AJ). **Los ítems AI y AK a AV no tienen respuesta todavía**: van abajo como pendientes hasta que digas lo contrario. Si alguno ya está hecho, marcalo y lo sacamos.

Marcas: 🔴 bloquea algo hoy · 🟡 importante, no bloquea · ⚪ mejora · 🧭 decisión de producto, no es código.

---

## 1. Para construir (código de backend)

| # | Ítem | Qué hace falta | Por qué / qué pasa hoy |
|---|---|---|---|
| 🔴 | **AN · Membresía** | Servicio con `GET /api/membership/me`, `POST /pay`, `POST /promo-code`, `PATCH /me` (renovación automática) y `POST /cancel`, ruteado en el gateway. Plan del técnico US$ 120 al año; plan del dueño **por vehículo con VIN** (US$ 15, 12, 12, 9 desde el cuarto) con fecha de renovación propia por vehículo; el servidor calcula los escalones y cobra solo lo pendiente. Cupones reales por rol (`MIAMI` 10 %, `MEKA` 25 %, `INSURANCE` 100 %). Pago con tarjeta guardada o con ganancias (descuenta del saldo o del próximo payout, y deja línea en el historial y en el PDF). Renovación automática con aviso 7 días antes | Hoy todo está simulado en la app, nada se cobra. Análisis completo: `servicios/billing/07-membresia-analisis.md` del repo de análisis |
| 🟡 | **AU · Política de privacidad** | `GET /api/users/me` (o `/api/legal/privacy`) con `privacyPolicyVersion` y `privacyAcceptedVersion`, y `POST /api/legal/privacy/accept { version }` | La app no puede avisar «Update» en el perfil cuando cambia la política |
| 🟡 | **AV · PDF del estado de cuenta del dueño** | `GET /api/payments/me/statement?from&to`: pagos de servicio, movimientos del wallet y cobros de Assistance Pass por vehículo | El botón ya está en la app y dice «Muy pronto». Solo existe el del técnico (`/api/earnings/me/statement`) |
| 🟡 | **AQ · Logo en el PDF del estado de cuenta** | El logo de la marca **a color** arriba de la primera página (aro de 34 px y nombre de 15 px de alto). Archivos: `assets/images/brand_ring_color.png` y `brand_wordmark_color.png` | El PDF lo genera el servicio; la app solo lo descarga |
| 🟡 | **AR · `summaries` para el prestador** | `POST /api/assistance/summaries` tiene que devolver también los pedidos que atendió el prestador (título, dirección, fecha, `refCode`) | En Ganancias las filas del técnico dicen «Request details unavailable» y muestran el id largo |
| 🟡 | **AS · `assistance-types` sin sesión** | `GET /api/assistance-types?scope=app` sin autenticar (es un catálogo público) | Responde 401 y la app arranca con una lista de respaldo que puede quedar vieja |
| 🟡 | **AT · Incidencias por lote** | `POST /api/pricing/requests/issues { ids: [] }` → `{ [id]: incidencias }` (o incluirlas en `GET /api/assistance` y `GET /api/appointments`). Revisar además por qué ese servicio rechaza con 401 el token que el resto acepta | Son unas 340 llamadas por carga. La app lo mitigó (muestra la lista antes y las pide de a 8), pero siguen siendo demasiadas |
| 🟡 | **AO · Registro del técnico** | Permitir a los tokens de registro `POST /api/ase-membership/verify` y `GET /api/ase-membership/lookup/:aseId` | 403 «Token not valid for this route»: el técnico no puede validar su ID ASE durante el alta |
| 🟡 | **AP · Diagnóstico sin fotos** | Aceptar `POST /appointments/:id/on-site/diagnostic` sin las fotos de patente y tablero cuando se indica (`photosSkipped: true`) y dejarlo marcado en la visita | Hoy la app ignora el error, pero el reporte no dice que se hizo sin fotos |
| 🟡 | **AI · `experienceTags`** | Aceptar `experienceTags` en `POST /appointments/:id/client-review` | La app no los envía (`SEND_CLIENT_REVIEW_TAGS=false`) por miedo a un 400 del DTO |
| 🟡 | **AW · Monto del tiempo extra** | `providerAmount` en `pendingRequest` de `GET …/video/extensions` (solo para el técnico): lo que le queda por esos minutos | El técnico acepta tiempo extra sin saber cuánto cobra; la tarjeta ya muestra «Ganás $X» cuando llegue |
| 🟡 | **AX · OBD «no lo voy a enviar»** | Estado `skipped` en el reporte OBD de la solicitud (`POST /api/assistance/:id/obd/skip`, `status: 'skipped'` y evento `obd_update`) | Dueño y técnico pueden cerrar el pedido de escaneo, pero hoy solo se guarda en cada teléfono |
| 🔴 | **AY · Disponibilidad estructurada** | `availability { from, to, windowStart, windowEnd, timezone }` en `marketplace/requests`; `date` = día de servicio, no de publicación | Un pedido del 25–26 le llegó al técnico como 24 y sin horarios; la app ya tolera más formatos, pero depende del texto |
| ⚪ | **AK y AL · Campos en `marketplace/requests`** | `refCode` en `summaries` y en `GET /marketplace/requests`; `createdAt` y `myOffer.createdAt` en `GET /marketplace/requests` | «Your quotes» muestra el código y ordena por fecha de envío; sin esto los quotes quedan al final |
| ⚪ | **AM · Eventos de la visita** | Eventos de los pasos intermedios de la visita y `vehicleCondition` en las filas de cita | La línea de tiempo del dueño |
| 🟡 | **Notificaciones e idioma** | Confirmar si la bandeja traduce según el `locale` que manda la app o usa el texto guardado al crear la notificación. Actualizar el idioma del dispositivo cuando la persona lo cambia | Con la app en español llegan notificaciones en inglés (por ejemplo «Your video call is ready») |
| ⚪ | **P · Transcripción por webhook** | Traer la transcripción desde Daily por webhook | Cuando esté habilitado L |
| ⚪ | **E · `serverNow` en el listado de pedidos** | Solo si la app lo pide, para corregir el reloj de la cuenta regresiva | |

---

## 2. Decisiones de producto 🧭
Estas no son código: hay que decidirlas antes de seguir.

- **X · Descuento de videollamadas agendadas:** el valor (la pantalla del Hub sale sin reglas) y si las extensiones de una llamada agendada llevan descuento.
- **R · Problema «Other» cotizable:** crear el issue «Other» en el Hub con su grupo de precio y precio base. **El servidor ya acepta `customIssue`; cuando exista el issue, la app agrega el campo.**
- **L · Transcripción en Daily:** habilitarla en la cuenta y aprobar el costo.
- **W · Agente de cuidado del vehículo:** fuente del plan del fabricante, si lleva estimado de precio, quién lo ve y el costo mensual por vehículo.
- **Z · Certificaciones:** si la certificación cuenta para el emparejamiento.
- **Membresía (detalle en el análisis):**
  - ¿El técnico puede ofertar sin haber pagado?
  - ¿Qué pasa con la bonificación si el dueño borra un vehículo?
  - ¿Qué pasa si el mismo VIN está en otra cuenta?
  - Los vehículos «cubiertos» por un cupón del 100 %: ¿se renuevan y tienen fecha?
  - ¿Se permite pagar con ganancias parciales más tarjeta?
  - Vencimiento y usos de los cupones; impuestos y comisión; reembolso a mitad de año; revisión legal de la renovación automática.

---

## 3. Hecho por backend: para verificar en producción

| Punto | Qué probar |
|---|---|
| Y y Z | `GET /api/reviews/me` con un técnico y con un dueño, sin 403; cargar una certificación y revisarla en el Hub |
| S | Dos técnicos viendo la misma videollamada: el cliente confirma a uno y el otro recibe el evento (y el 409 `request_unavailable` si ofertó) |
| AC | Ocultar una cita cancelada y comprobar que no aparece en otro teléfono. **La app ya manda el pedido desde el build 138** |
| AB | Los once tipos de notificación en iOS y Android, en los dos idiomas |
| T | Una opción de 60 minutos: aparece en el menú, `durationMinutes: 60` se acepta, el contador arranca en 60:00 y el técnico ve la duración antes de aceptar |
| Anteriores | AA, B, N, O, Q, P y U, J, K, M, A, C, D y F |

---

## 4. Lo que la app ya hizo de su lado
Para que no se duplique trabajo:
- **S:** un 409 `request_unavailable` saca la solicitud de la pantalla del técnico al instante.
- **AC:** al quitar una cita cancelada, la app llama a `POST /api/appointments/:id/hide` y manda una vez lo que ya había ocultado en el teléfono.
- **AT (mitigado):** la lista se muestra antes de pedir las incidencias, se piden de a 8 y se guardan 5 minutos.
- **Membresía:** pantalla completa, simulada, lista para cambiar a los endpoints reales sin tocar la interfaz.
- **AV:** el botón del PDF del dueño ya está en la app y espera el endpoint.
