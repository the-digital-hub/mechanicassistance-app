**Asunto:** Backend: pendientes de la app

Hola Alejandro,

Lo que necesito, por tema. Detalle y capturas en `docs/para-alejandro-2026-11-23.md`; cuando cierres un punto, avisame la letra.

**Fallan hoy en producción**
- AJ: rutear `/api/mechanic-certifications` en el gateway.
- Y: rutear `/api/reviews` (`GET /api/reviews/me` da 403).
- AO: permitir `POST /api/ase-membership/verify` y `lookup/:aseId` al token de registro.

**Membership (nuevo)**
- AN: `GET /api/membership/me`, `POST …/promo-code`, `PATCH …/me`, `POST …/cancel`.
- Rutear `/api/membership` en el gateway.

**Campos que la app ya espera**
- `refCode` en `summaries` y `marketplace/requests` (AK, AE).
- `createdAt` y `myOffer.createdAt` en `marketplace/requests` (AL).
- `offerExpiresAt` en `GET /api/assistance` (E).
- `experienceTags` como array en las calificaciones (AI). Desplegar el backend antes que la app.
- `vehicleCondition` en las citas y evento por paso de la visita (AM).

**Seguridad y reglas**
- No enviar nombre ni foto del técnico hasta aceptar la oferta (AG).
- Chat cerrado en `awaiting_confirmation` (AH).
- `new_request` solo como push, sin bandeja (AF).

**Solicitudes y citas**
- Aviso cuando otro técnico toma la solicitud, y 409 `request_unavailable` (S).
- "Other" cotizable en el catálogo (R).
- Ocultar citas canceladas (AC).

**Más adelante**
- X (descuento de agendadas), T (60 min), L (transcripción), V (subtítulos), W (cuidado del vehículo), AB (textos de push).
- Hub: revisión de certificaciones, permisos y aviso de vencimiento.

**Preguntas**
- ¿Se puede marcar como leída una sola notificación?
- ¿Largo máximo de `workNotes`?
- Un dueño nuevo agregó su tarjeta en el pedido y no la vi en el wallet: ¿se guardó en billing y aparece el pago en el historial?
- ¿Probás en producción los puntos que figuran como hechos (AA, B, N, O, Q, P/U, J, K, M, Z)?

Gracias,
Diego
