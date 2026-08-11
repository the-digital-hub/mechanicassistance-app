# CERRADO: Persistir `issues` en las solicitudes de asistencia

**Estado:** Cerrado (2026-08-11)
**Creado:** 2026-07-13

---

Esta tarea ya no aplica. La auditoría del 2026-08-11 confirmó que los `issues`
seleccionados **sí se persisten**: el pricing service
(`mechanicassistance-service-price`, puerto 3007) escribe una fila por issue en
`assistance_request_issues`, con `price_snapshot` y `name_snapshot`, y la app las lee
de vuelta con `GET /api/pricing/requests/:id/issues`.

El documento original también asumía que el backend vivía en un repo separado. Ya no:
`appointments-service` y `mechanicassistance-service-price` están en este monorepo.

Lo que sí quedaba roto y se arregló en la misma pasada: si el catálogo de issues no
cargaba, `issue-selection.tsx` caía a `FALLBACK_ISSUES` con ids que no son UUID, el
pricing los rechazaba con 400 y los síntomas se perdían **en silencio**. Ahora se
filtran esos ids, se avisa al usuario, y el endpoint reporta qué persistió.

→ Estado completo campo por campo, decisiones y pendientes:
[assistance-request-field-persistence.md](assistance-request-field-persistence.md)
