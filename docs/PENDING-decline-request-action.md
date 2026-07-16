# Tarea pendiente: Acción del botón "Decline" en los cards de asistencia

**Estado:** Pendiente (requiere revisar API)
**Prioridad:** Media
**Creado:** 2026-07-13

---

## Problema

El botón **"Decline"** en los cards de asistencia no tiene ninguna acción
(`onPress` vacío). Al presionarlo no ocurre nada.

Aparece en dos pantallas con el mismo card:

- `app/(tabs)/dashboard/index.tsx` (dashboard de mecánicos)
- `app/(tabs)/assist/index.tsx` (sección Request)

---

## Qué falta definir / revisar

1. **Comportamiento esperado del Decline:**
   - ¿Solo ocultar la solicitud del listado localmente (por mecánico)?
   - ¿O registrar el rechazo en el backend (para métricas / no volver a
     mostrarla a ese mecánico)?

2. **Soporte en la API (a revisar):**
   - ¿Existe un endpoint para que un mecánico rechace/descarte una solicitud
     sin cambiar el estado global a `canceled`?
   - Rechazar NO debería marcar la solicitud como `canceled` global — la
     solicitud debe seguir disponible para otros mecánicos.
   - Posible necesidad de una tabla/relación tipo `declined_requests`
     (mechanicId + requestId) para filtrar por mecánico en `getAll`.

3. **Impacto en la app (una vez definida la API):**
   - `lib/dao/AssistanceDAO.ts`: agregar método `decline(requestId, mechanicId)`.
   - Cards en dashboard y assist: implementar `onPress` del botón Decline.
   - Filtrar en `getAll` las solicitudes ya rechazadas por ese mecánico.

---

## Nota

El backend vive en un repo separado (no está en este workspace). Primero hay que
**revisar qué soporta la API** para rechazar solicitudes antes de implementar el
lado de la app.
