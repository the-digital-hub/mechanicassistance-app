# Tarea pendiente: Persistir `issues` en las solicitudes de asistencia

**Estado:** Pendiente
**Prioridad:** Media
**Creado:** 2026-07-13

---

## Problema

Cuando un usuario crea una solicitud de asistencia, en el paso
`issue-selection.tsx` selecciona una o más **categorías de problema mecánico**
de una lista fija:

| id | label |
|----|-------|
| `battery` | Battery / Starting issue |
| `electrical` | Electrical system |
| `starter` | Starter motor |
| `warning` | Warning light |
| `other` | Other |

Estas categorías se pasan por navegación (`params.issues`, string separado por
comas) a través de todo el wizard, pero **nunca se guardan** al crear la
solicitud. Se pierden en `confirmation.tsx`.

Actualmente el card del mecánico (dashboard) muestra
`request.notes || request.title`, que son **solo campos de texto libre**:

- `title` ← `description` (texto libre escrito en issue-selection)
- `notes` ← `details` (texto libre escrito en add-details)

Es decir, el mecánico **no ve** las categorías estructuradas de problema que el
usuario seleccionó.

---

## Verificación del estado actual (3 capas)

| Capa | Archivo | ¿Soporta `issues`? |
|------|---------|--------------------|
| DAO cliente | `lib/dao/AssistanceDAO.ts` (`create()`) | ⚠️ Passthrough — envía cualquier campo del objeto, pero no lo declara |
| Interface | `lib/dao/interfaces.ts` (`AssistanceRequest`) | ❌ No existe el campo `issues` |
| Esquema DB | `DB.MD` → tabla `assistance_requests` | ❌ No existe la columna `issues` |

Conclusión: aunque el DAO reenviaría el campo, el backend lo ignora en el
`INSERT` porque no hay columna donde guardarlo.

---

## Cambios necesarios

### 1. Backend (repo del server — NO está en este workspace)
- **DB / migración:** agregar columna `issues` (TEXT) a `assistance_requests`.
  Guardar como string separado por comas o JSON array.
- **`server/dao/AssistanceDAO.js`:** incluir `issues` en el `INSERT` de `create`
  y en los `SELECT` de `getAll` / `getById`.
- Actualizar `DB.MD` documentando la nueva columna.

### 2. App (este repo)
- **`lib/dao/interfaces.ts`:** agregar `issues?: string` a `AssistanceRequest`.
- **`app/(tabs)/request-assistance/confirmation.tsx`:** pasar `issues` en la
  llamada a `assistanceDAO.create({ ..., issues })`.
  El valor ya llega por `params` en toda la cadena del wizard.
- **`app/(tabs)/dashboard/index.tsx`:** mostrar las categorías en el card
  (ej: mapear ids → labels y renderizar bajo el vehículo, o como chips).

---

## Orden recomendado

1. Coordinar y aplicar los cambios del backend (columna + DAO) primero.
2. Luego los cambios de la app (interface + confirmation + dashboard).

> ⚠️ El backend vive en un repo separado. Los cambios 1 no se pueden hacer
> desde este workspace.
