# Auditoría: persistencia de campos de assistance requests

**Última verificación:** 2026-08-11
**Alcance:** wizard `app/(tabs)/request-assistance/` → `AssistanceDAO` → api-gateway →
`appointments-service` + `mechanicassistance-service-price` → Postgres.

Reemplaza a `PENDING-persist-assistance-issues.md`, que quedó obsoleto en dos puntos:
los `issues` **sí** se persisten (en `assistance_request_issues`, vía el pricing
service) y el backend **ya no vive en otro repo**.

---

## Ruta del dato

```
confirmation.tsx  →  POST /api/assistance                 →  appointments-service (3004)
                     (api-gateway 3000, bodyParser:false, body sin transformar)
                  →  POST /api/pricing/requests/:id/price  →  pricing service (3007)
```

El create **no** lleva los issues ni el precio. Inmediatamente después, el pricing
service escribe el breakdown, el pivot de issues y `budget`/`price`.

## Estado por campo

| Campo del wizard | Columna / tabla | Estado |
|---|---|---|
| `type` | `type` + `assistanceType` | ✅ duplicado a propósito |
| `vehicleId` | `vehicleId` | ✅ con FK real a `user_vehicles.id` (`ON DELETE SET NULL`) |
| `vehicleName` | `car` | ✅ |
| `description` (issue-selection) | `title` | ✅ |
| `details` (add-details) | `notes` | ✅ |
| `photos` | `photos` (JSON string) | ✅ subidas a `/api/photos/upload` primero |
| `latitude`/`longitude` | `locationLat`/`locationLng` | ✅ requeridos por el DTO |
| `finalAddress`/`addressLabel` | `address` | ✅ |
| `locationZip` | `zip` | ✅ fallback regex `\b\d{5}\b` sobre el address |
| `issues` | `assistance_request_issues` | ✅ con `price_snapshot` + `name_snapshot` |
| precio | `budget` (`$149.99`) + `price` (`149.99`) | ✅ ambos, los escribe el pricing |
| `date` | `date` (ISO-8601) | ✅ solo `scheduled`/`videocall`, obligatorio |
| `distance` | — | ✅ ya no se guarda: se calcula al leer |

## Decisiones tomadas (2026-08-11)

- **`description` no existe más como campo.** El DTO lo aceptaba y el service lo
  descartaba (no había columna). La semántica final es `title` = problema,
  `notes` = detalles.
  ⚠️ **Orden de despliegue:** backend primero. Con `forbidNonWhitelisted: true`,
  una app vieja que siga mandando `description` recibe **400**.
- **`date` es obligatoria para `scheduled` y `videocall`**, validada en
  `AssistanceRequestsService.create()` (la regla depende de otro campo, no se puede
  con decoradores del DTO). Mismo cuidado de despliegue: una app vieja que cree un
  request `scheduled` sin fecha ahora recibe 400.
- **`distance` se calcula al leer** con `haversineKm` en `findAll`, desde las
  coordenadas del que consulta. La columna queda legacy (la lee la flota Laravel).
- **`budget`/`distance` ya no se hardcodean** en la app (`'TBD'` / `'0 km'`).
- **El fallo del pricing ya no es silencioso.** `persistForRequest` devuelve
  `persisted: { breakdown, issues, budget }` y la app avisa al usuario. Además
  filtra ids no-UUID antes de llamar: los `FALLBACK_ISSUES` de `issue-selection.tsx`
  no son UUIDs y el pricing los rechaza con 400.

---

## Resuelto: FK de `vehicleId` (2026-08-11)

`assistance_requests.vehicleId` ahora tiene integridad referencial real contra
`user_vehicles.id`.

### Lo que se encontró

RDS alcanzable ese día. Tipos reales de columna (todo solo lectura antes de decidir):

```
assistance_requests.vehicleId     = uuid   (única columna uuid del grupo — el resto es text)
user_vehicles.id                  = text
vehicle_custom_fields.vehicleId   = text   (ya tenía FK real: vehicle_custom_fields_vehicleId_fkey)
appointments.vehicleId            = text
```

Una FK exige tipos compatibles en ambos lados — un `ALTER TABLE ADD CONSTRAINT` tal
cual habría fallado (`operator does not exist: text = uuid`). Datos verificados
antes de tocar nada: 16 requests con `vehicleId`, 0 huérfanos, 0 formato no-UUID;
mismo resultado en `appointments` (6 filas) y `user_vehicles` (14 filas).

### Decisión: convertir la columna impar, no el resto del ecosistema

Se descartó convertir `user_vehicles.id` a `uuid` (cascada a `vehicle_custom_fields`
y `appointments`, dropear/recrear una FK ya viva en prod, tocar una tabla que
Laravel puede leer/escribir vía SQL crudo — riesgo no verificable sin acceso a ese
repo). En cambio se bajó `assistance_requests.vehicleId` a `text`: es la única
columna de las 4 que vive en una tabla no-Laravel, la escribe un solo servicio
(`appointments-service`), y no tenía ninguna FK previa que romper. Bonus: el DTO
(`create-assistance-request.dto.ts`) valida `vehicleId` con `@IsString()` sin
`@IsUUID()` — el tipo `uuid` de columna era un mismatch latente contra eso.

### Migración aplicada (SQL manual — ningún servicio tiene `prisma/migrations/`,
`assistance_requests` está modelada en 5 schemas sobre la misma RDS compartida con
Laravel, así que nunca `prisma db push`/`migrate dev`)

```sql
BEGIN;
ALTER TABLE assistance_requests
  ALTER COLUMN "vehicleId" TYPE text USING "vehicleId"::text;
ALTER TABLE assistance_requests
  ADD CONSTRAINT assistance_requests_vehicle_fk
  FOREIGN KEY ("vehicleId") REFERENCES user_vehicles(id) ON DELETE SET NULL;
COMMIT;
```

Confirmado post-migración: FK `assistance_requests_vehicle_fk` viva
(`pg_constraint`), columna `vehicleId` ahora `text`, 16 filas intactas. Smoke test
end-to-end (create + `include: { vehicle: true }` + cleanup del registro de prueba)
pasó — la relación carga bien.

`appointments-service/prisma/schema.prisma` actualizado: `AssistanceRequest.vehicle`
(relación opcional a `Vehicle`) y `Vehicle.assistanceRequests` (back-relation).
`npx prisma generate` corrido (no `db push`). Los otros 4 schemas que modelan
`assistance_requests` no necesitaron tocarse — ninguno declaraba `vehicleId` con
`@db.Uuid`.

---

## Verificación contra prod

⚠️ `pg-ma-01...us-east-1.rds.amazonaws.com:5432` da **TCP timeout** desde una máquina
de desarrollo sin allowlist/VPN. Correr desde un host habilitado, con las credenciales
de `appointments-service/.env`:

```sql
-- cobertura por columna
SELECT count(*) total,
  count(title) title, count(notes) notes, count(car) car, count(address) address,
  count(zip) zip, count("vehicleId") vehicle_id, count("locationLat") lat,
  count(date) date, count(price) price, count(budget) budget,
  count(NULLIF(photos, '[]')) photos_no_vacio
FROM assistance_requests;

-- date y price por tipo
SELECT "assistanceType", count(*) n, count(date) con_date, count(price) con_price,
       count(budget) con_budget
FROM assistance_requests GROUP BY 1;

-- requests que perdieron sus síntomas
SELECT count(*) FROM assistance_requests ar
WHERE NOT EXISTS (SELECT 1 FROM assistance_request_issues i
                  WHERE i.assistance_request_id = ar.id::text);
```

Baseline esperado **antes** de estos cambios: `date = 0` y `price = 0` en todos los
tipos. Después, todo request nuevo `scheduled`/`videocall` debe traer `date`, y todo
request con issues válidos debe traer `price` + filas en el pivot.

## Tests

```bash
cd appointments-service && npx jest src/assistance-requests          # 13 tests
cd mechanicassistance-service-price && npx jest src/pricing          # 9 tests
```
