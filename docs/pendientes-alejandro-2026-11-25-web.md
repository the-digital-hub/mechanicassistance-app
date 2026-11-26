# Pedidos de backend para la web del dueño del vehículo

**Fecha:** 25 de noviembre de 2026 · **De:** equipo de la app · **Para:** Alejandro (backend) · **Copia:** Juan Pablo (web)

Juan Pablo empieza la **web del dueño del vehículo** sobre el mismo backend que la app. Para eso documentamos todas las pantallas del dueño (`portales/web-vehicle-owner/` en el repo de análisis). Leyendo el código salieron estos pedidos y dudas. **Los de la sección 1 bloquean la web desde el primer día**; el resto se puede ir resolviendo mientras se construye.

Marcas: 🔴 bloquea la web · 🟡 importante, no bloquea el inicio · ⚪ mejora · ❓ solo hace falta que confirmen.

## 1. Para que la web pueda funcionar

| # | Pedido | Qué hace falta | Por qué |
|---|---|---|---|
| 🔴 **W1** | **Orígenes web (CORS)** en el gateway y en el WebSocket | Confirmar o habilitar CORS en `api-gateway` y en `wss://ws.mechanicassistance.com` para los dominios de la web (producción y pruebas), con `Authorization` y `Content-Type`, incluida la subida de archivos (multipart) | Hoy solo hablan con la app móvil; no consta que un navegador pueda llamarlos |
| 🔴 **W2** | **Sesión en navegador** | Confirmar si el refresco de sesión puede ir en una cookie `HttpOnly` + `Secure` (y con qué dominio) o si la web debe guardar el refresh token en el navegador | Define cómo se mantiene la sesión sin exponer el token |
| 🔴 **W3** | **Registro y login desde la web** | Confirmar si `auth-service` acepta el token de Firebase de una app web (teléfono con código SMS, Google, Apple) y qué hace el alta con Google o Apple (hoy esos dos solo inician sesión en cuentas que ya existen) | La app da de alta solo por teléfono con SMS; la web necesita saber qué caminos tiene |
| 🔴 **W4** | **Verificación de identidad (Didit) en navegador** | `POST /api/verification/session` hoy devuelve solo `sessionToken` y la app usa el SDK nativo: indicar cómo se completa en web (URL de verificación, redirección de vuelta) | Sin esto el dueño no puede verificar su identidad desde la web |
| 🟡 **W5** | **Notificaciones web** | Aceptar `platform: "web"` en `POST /api/notifications/devices` (Web Push o FCM web) | Hoy solo admite `ios` y `android` |
| 🟡 **W6** | **Eventos de tiempo real que faltan** | Que `cancellation_disputed`, `review_requested` y `payment_failed` también lleguen por el socket (hoy solo por push y por la bandeja) y publicar los esquemas de `assistance_update`, `appointment_update` y `video_call_update` | En web, sin push, el dueño no se entera; hoy se leen los campos que el código usa |

## 2. Cambios que mejoran la web y también la app

| # | Pedido | Qué hace falta | Por qué |
|---|---|---|---|
| 🟡 **W7** | **Eliminar cuenta** | Endpoint para que la persona borre su propia cuenta (confirmar si `DELETE /api/users/:id` lo permite) y, si entró con Apple, revocar el token de Sign in with Apple | La pantalla «Eliminar cuenta» de la app hoy no llama a nada; Apple lo exige para publicar |
| 🟡 **W8** | **Política de privacidad y términos** | Usar `/api/legal/policies` ya publicado para mostrar el texto y registrar la aceptación (ver también AU) | La pantalla de la app tiene texto de relleno y el botón Aceptar no guarda nada |
| 🟡 **W9** | **Idempotencia al crear el pedido** | Aceptar una clave de idempotencia en `POST /api/assistance` y que `POST /api/pricing/requests/:id/price` no deje un pedido sin publicar si falla | Si el precio falla justo después de crear, el pedido queda sin ofrecerse a los técnicos |
| 🟡 **W10** | **Disponibilidad estructurada de los pedidos agendados** | Es el ítem **AY** de siempre: `availability { from, to, windowStart, windowEnd, timezone }`. Hoy el modo taller, el radio y la franja viajan solo como texto en `notes` | La web tendría que reproducir ese texto idéntico; ya hubo un caso (25–26 que llegó como 24) |
| 🟡 **W11** | **Orden y unicidad de vehículos** | Devolver los vehículos en un orden estable (por fecha de alta) y garantizar un VIN único por cuenta | El precio de Assistance Pass por vehículo depende del lugar en la flota |
| 🟡 **W12** | **Actualizar perfil sin recrear direcciones** | Que `PATCH` del perfil no recree las direcciones con ids nuevos (hoy la app las reenvía todas) | Rompe referencias y hay que mandar solo lo que cambió |
| 🟡 **W13** | **Transcripción de la videollamada** | Confirmar que la cuenta de Daily tenga la transcripción habilitada y que el token del dueño permita iniciarla (ítem L); aceptar subidas parciales (el `PUT` ya es idempotente por `id`) | En navegador no se puede subir todo al salir de la pantalla |
| 🟡 **W14** | **Cancelación del dueño** | Un solo endpoint para cancelar (hoy `PATCH /api/appointments/:id` para pendientes/ofertadas y `/api/assistance/:id` para el resto) y los motivos propios del dueño | La app mezcla motivos escritos para el técnico y la lista ofrece cancelar en estados que el detalle no permite |
| ⚪ **W15** | **Notificaciones: preferencias** | Guardar «General» y «Ofertas especiales» en el servidor | Hoy los interruptores de la app no hacen nada |

## 3. Cosas que ya estaban pedidas y la web también necesita

- **AN · Membresía (Assistance Pass por vehículo):** sin esos endpoints la web no puede cobrarla. Análisis: `servicios/billing/07-membresia-analisis.md`.
- **AV · PDF del estado de cuenta del dueño:** ya existe (`GET /api/payments/me/statement`); falta el bloque de Assistance Pass.
- **AU · Política de privacidad:** versión vigente y aceptación.

## 4. Decisiones de producto (no son código)

- **Grúa y cerrajería:** el backend las maneja con ofertas de varios técnicos, pero la app las pasa por el flujo de un técnico. ¿La web las soporta?
- **Alta con Google o Apple en la web:** ¿se permite crear cuenta o solo entrar?
- **Contraseña de la cuenta:** el registro la pide pero no entra en `POST /api/users`; el login por email dice servir solo a cuentas creadas por un operador. ¿La web la pide o no?

## 5. Qué necesitamos de ustedes para cerrar

1. Respuesta a **W1, W2, W3, W4** esta semana (bloquean el inicio).
2. Fecha estimada para **W5, W6 y W7**.
3. Confirmar si hay un entorno de pruebas (con CORS abierto para la web) donde Juan Pablo pueda trabajar sin tocar producción.
