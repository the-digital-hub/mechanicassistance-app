# Publicar «Mechanic Assistance» en App Store Connect

> Preparación del 25-nov-2026, sobre la rama `development` (commit `8f08c09`, Expo SDK 58 / RN 0.88, versión `1.0.1`, bundle `com.mechanicassistance.app`, ASC app id `6817447116`, último build en TestFlight: 142).
> Esto es solo auditoría y borradores: no se envió nada a Apple ni se tocó App Store Connect / EAS. Leyenda: ✅ cumple · ⚠️ revisar / decisión · ❌ falta (bloquea o probablemente bloquee la revisión).

---

## 0. Resumen: qué bloquea y qué decide Diego

**Bloqueantes de código/contenido (hay que resolverlos antes de enviar a revisión):**

1. ❌ **Borrar cuenta no hace nada** (guía 5.1.1(v)). `app/(tabs)/settings/delete-account.tsx` solo hace `console.log` y vuelve al onboarding; no llama a ningún endpoint. Hace falta el endpoint en el backend y conectarlo. Si la cuenta entró con Apple, el backend además tiene que revocar el token de Sign in with Apple.
2. ❌ **Pantalla «Privacy Policy» con lorem ipsum** (`app/(tabs)/privacy.tsx` + claves `privacy.*` en `lib/i18n/locales/*.json`, alcanzable desde el menú del perfil). Apple lo rechaza como contenido de relleno (2.1/2.3.1). Reemplazarla por un link a la política real o quitar la entrada del menú.
3. ❌ **Link de «Terms» roto**: `lib/config/legal.ts` apunta a `https://mechanicassistance.com/terms-conditions/` → **404**. La URL que existe es `https://mechanicassistance.com/terms/`. Se muestra en el login (`SmsConsent`). La de privacidad (`/privacy-policy/`) responde 200.
4. ❌ **Contenido generado por usuarios sin reportar/bloquear** (guía 1.2): hay chat entre dueño y técnico y reseñas, y no encontré en el app ninguna acción de «Reportar» ni «Bloquear», ni aceptación de EULA con cláusula de «cero tolerancia». Ver §1.9.
5. ❌ **Cuenta de demostración** para el revisor (§2.6): el login por SMS no se puede reproducir. Por suerte el login por **email + contraseña** existe (`app/login.tsx`, método «email»), así que alcanza con cuentas de prueba en producción.
6. ⚠️ **Membresía «Assistance Pass» / «All-access»** (guía 3.1.1): hoy es simulada y no cobra, pero la UI muestra precios (US$15 / US$120 al año) y un botón «Pagar» con tarjeta Stripe o saldo de ganancias. Si en la versión que revisa Apple se puede pagar o ver un precio por funciones de la app, Apple lo va a considerar compra digital → In-App Purchase. Ver §1.6 y decisión A.

**Decisiones que le tocan a Diego:**

- **A.** Membresía en v1.0: (a) ocultarla/mostrarla como «gratis en etapa de lanzamiento» sin botón de pago ni precios en iOS (recomendado, 0 riesgo, cambio chico), (b) implementar IAP/StoreKit (semanas, comisión 15–30 %), o (c) mantenerla y defender 3.1.3 (riesgo alto, no recomendado).
- **B.** iPad: `supportsTablet: true` obliga a subir capturas de iPad y a que la app se vea bien en iPad. Recomendado para v1: `supportsTablet: false` (solo iPhone) salvo que ya la hayan probado en iPad.
- **C.** Cuenta demo: crear en producción (o en un entorno que Apple pueda alcanzar) las cuentas de revisión y cómo mostrar el flujo de dos puntas (técnico que acepta, videollamada). Ver §2.6.
- **D.** Categoría y clasificación por edad (propuesta en §2.1).
- **E.** Si el chat/reseñas se moderan con «Reportar + Bloquear» (recomendado) y quién atiende los reportes en 24 h (Apple lo exige a quien publica).
- **F.** Ubicación en segundo plano para técnicos («Always»): decidir si se mantiene en v1.0 (más fricción en la revisión) o se deja solo «While using» con la app abierta. Ver §1.3.

---

## 1. Auditoría contra los requisitos de revisión

### 1.1 Configuración (`app.json`, `app.config.js`, `eas.json`, `plugins/`)

| Ítem | Estado | Detalle |
|---|---|---|
| Bundle ID / nombre / versión | ✅ | `com.mechanicassistance.app`, nombre «Mechanic Assistance», `1.0.1`; `appVersionSource: remote` + `autoIncrement` en `production`. |
| `ascAppId`, team en `submit` | ✅ | `ascAppId 6817447116`, team `54CB7356AZ` en `eas.json`. (La app ya existe en ASC.) |
| Ícono | ✅ | `assets/images/mechanic-icon.png`, 1024×1024, PNG RGB sin canal alfa. Mirarlo una vez a ojo en ASC (esquinas: Apple las redondea). |
| `ITSAppUsesNonExemptEncryption` | ✅ | `false` en `infoPlist`. Correcto: solo HTTPS/TLS estándar y librerías del sistema; no hay cifrado propio. Con esto no se pide documentación de exportación. Si se agrega cifrado propio, revisar. |
| `aps-environment` | ✅ | `app.config.js` lo pone `production` fuera de los perfiles de desarrollo (TestFlight y tienda). |
| Push (APNs/FCM) | ✅ | `@react-native-firebase/messaging`, `plugins/withFirebaseAuthAPNS.js` agrega `UIBackgroundModes: remote-notification`. El permiso se pide con `requestPermission` (`lib/notifications/push.ts`); hay que dar la clave APNs en Firebase (ya funciona en TestFlight). |
| `usesAppleSignIn` | ✅ | `true`. |
| Orientación | ⚠️ | `orientation: "default"` pero el plugin `expo-screen-orientation` arranca en `PORTRAIT_UP`. Con `supportsTablet: true` Apple exige que iPad soporte todas las orientaciones (o `UIRequiresFullScreen`). Ver decisión B. |
| `NSAppTransportSecurity → NSAllowsArbitraryLoads: true` | ⚠️ | Desactiva ATS para toda la app. Apple lo permite pero puede pedir justificación. `ConfigService` ya exige `https://` en la API y Daily/Stripe/Google son HTTPS. **Propuesta**: quitarlo (ver §4). Verificar antes que ningún recurso `http://` (imágenes de mapas, fotos del backend) dependa de él. |
| URL scheme | ✅ | `mechanic` y `com.mechanicassistance.app` (Stripe 3-D Secure vuelve por `mechanic`). |
| Cuenta de ASC en `eas.json` | ⚠️ | `appleId` es `dm@elpixel.com`: confirmar que ese Apple ID tiene rol que permita enviar a revisión (Admin/App Manager). |

### 1.2 Textos de permisos (`NS*UsageDescription`)

Se generan en el prebuild por los config plugins (no hay carpeta `ios/` versionada). Revisión de cada uno:

| Clave | Fuente | Estado | Comentario |
|---|---|---|---|
| `NSCameraUsageDescription` | `expo-camera` y `react-native-webrtc` (plugin) | ✅ / ⚠️ | Existen dos plugins que la definen; gana el último en aplicarse (`@config-plugins/react-native-webrtc`: «…video calls and to verify your identity by scanning your ID document»), que **no menciona** escanear el QR de check-in ni el VIN, que sí aparecen en el texto de `expo-camera`. Unificar en un solo texto (ver §4) y que cubra: videollamadas, verificación de identidad, QR de check-in, VIN, fotos del vehículo. |
| `NSMicrophoneUsageDescription` | webrtc | ✅ | «…microphone for video calls.» Correcto. Falta también por video del vehículo (`launchCameraAsync` con video en `vehicle-documentation.tsx`): agregar «y para grabar el video del problema del vehículo». |
| `NSLocationWhenInUseUsageDescription` | `expo-location` | ✅ | Texto claro. |
| `NSLocationAlwaysAndWhenInUseUsageDescription` / `NSLocationAlwaysUsageDescription` | `expo-location` + `isIosBackgroundLocationEnabled` | ⚠️ | Explica el motivo (el cliente sigue al técnico en el mapa) — bien redactado. Pero «Always» + `UIBackgroundModes: location` es de las cosas que más preguntas genera en revisión (2.5.4). Hay que justificarlo en las notas de revisión (§3.7) y demostrar que solo se activa para el técnico con un trabajo en curso (`startBackgroundLocation(appointmentId)`, indicador azul activo, se detiene al terminar). |
| `NSPhotoLibraryUsageDescription` | — | ⚠️ | `expo-image-picker` **no figura en los plugins**; en iOS 14+ el selector de fotos (PHPicker) no pide permiso, pero algunas rutas (guardar/leer `ph://`) sí. Agregar el plugin con texto propio es barato y evita el rechazo 5.1.1 por «purpose string» faltante (ver §4). |
| `NSPhotoLibraryAddUsageDescription` | — | ✅ | No se guardan fotos en la galería (verificar: no hay `MediaLibrary`). |
| `NSFaceIDUsageDescription`, `NSContactsUsageDescription`, `NSBluetooth…`, `NSNFC…` | — | ✅ | No se usan. Didit SDK con `iosNfcEnabled: false`. Si ASC/Xcode avisa de alguna clave faltante que arrastra Didit, agregarla. |
| Español de los permisos | ⚠️ | Los strings están **solo en inglés** en `app.json` (los `InfoPlist.strings` no están localizados). Apple acepta inglés si la app tiene localización base inglesa. Si se quiere mostrar en español a usuarios en español, hace falta `expo-localization` + `locales` en `app.json` con archivos `InfoPlist` por idioma (cambio mediano, **opcional** para v1). |

Cada permiso se corresponde con una función real: cámara (videollamada, ID, QR, VIN, fotos), micrófono (videollamada, video del vehículo), ubicación (buscar asistencia, seguimiento del técnico), notificaciones.

### 1.3 Ubicación

- ✅ Uso legítimo y explicado en la UI (dueño: dirección/ubicación de la solicitud; técnico: transmisión al cliente durante el trabajo).
- ⚠️ Background «Always»: ver arriba. Alternativa conservadora para v1.0: no pedir «Always» y avisar al técnico que mantenga la app abierta. Decisión F.
- ✅ Direcciones tipeadas por el usuario se envían a Google Places (y a `photon.komoot.io` como fallback) para autocompletar: declararlo en la privacidad y la política (datos compartidos con terceros).

### 1.4 Privacy manifest / «required reason APIs»

- ✅ Sin carpeta `ios/` (Continuous Native Generation): el manifiesto de la app lo genera el prebuild de Expo/React Native (incluye los motivos de `UserDefaults`, `FileTimestamp`, `SystemBootTime`, `DiskSpace` que usan RN/Expo) y los SDKs de terceros (Firebase, Stripe, Google Maps/Sign-In, Daily/WebRTC) traen su propio `PrivacyInfo.xcprivacy` en versiones actuales.
- ⚠️ No hay `ios.privacyManifests` en `app.json`; no lo necesita si el build 142 se procesó sin avisos «ITMS-91053 / Missing API declaration». **Verificar** el correo de Apple de ese build y la pestaña «Build» en ASC. Si aparece alguna advertencia, agregar el motivo en `ios.privacyManifests.NSPrivacyAccessedAPITypes` de `app.json`.
- ✅ Tracking: no hay SDK de analytics/publicidad en `package.json` (solo Firebase app/auth/messaging). **No se usa ATT** ni hace falta `NSUserTrackingUsageDescription`. «Datos usados para rastrearte»: ninguno.

### 1.5 Login: Sign in with Apple (guía 4.8)

- ✅ La app ofrece login con Google **y** Sign in with Apple (botón solo en iOS, `app/login.tsx`, `usesAppleSignIn: true`, `lib/firebase/auth.ts`). Cumple 4.8 aunque también existe teléfono/email.
- ⚠️ El login con proveedor devuelve «No account registered… sign up first» si la cuenta no existe: probar el camino Apple completo con una cuenta nueva (crear cuenta con Apple, incluido «ocultar mi correo»).
- ⚠️ Al borrar la cuenta hay que revocar el token de Apple (requisito de Apple desde 2022; hay que hacerlo en el backend con el `authorizationCode`/refresh token).

### 1.6 Pagos y membresía (guías 3.1.1 / 3.1.3)

**Cobro por servicio (Stripe)** — ✅ permitido sin IAP: el dueño paga a un técnico un **servicio físico y presencial** («asistencia en el lugar», o una consulta en vivo). Guía 3.1.3(e) (bienes y servicios consumidos fuera de la app) y 3.1.3(d) (servicios persona a persona; las videollamadas 1 a 1 entre un cliente y un técnico, de pago, entran acá siempre que sean de persona a persona y no de múltiples personas). Stripe se usa solo con `CardField` (el número va directo a Stripe, la app guarda marca, últimos 4 y vencimiento). No hay Apple Pay ni tarjetas guardadas distintas de Stripe. Los técnicos cobran por Stripe Connect (payouts).

**Membresía «Assistance Pass» (dueño, US$15 al año por vehículo con VIN; 15/12/12/9) y «All-access» (técnico, US$120 al año)** — ⚠️ riesgo alto de rechazo 3.1.1 **si se puede pagar dentro de la versión revisada**:
- Hoy es **simulada** (`lib/membership/plan.ts`: los pagos se guardan en `AsyncStorage`, no se cobra nada) y los textos dicen «gratis durante nuestra etapa de lanzamiento».
- Pero el flujo muestra precio anual, botón «Pagar», renovación automática y cupones (`INSURANCE`, `MIAMI`, `MEKA`), y el plan «incluye» funciones digitales de la app («solicitudes, seguimiento en vivo, videollamadas, aplicar a cada solicitud»). Apple considera esto **desbloqueo de funciones dentro de la app** → exige IAP; un cobro vía Stripe/saldo de ganancias es motivo de rechazo. Además un revisor que ve un «Pagar US$120» simulado puede decir que la app «no está completa» (2.1) o que es engañosa (2.3).
- Cupones/promos: los códigos hardcodeados en el cliente son datos de prueba: no deben llegar a producción.

Opciones (decisión A): **(a)** en iOS, mostrar la membresía como «Incluida sin costo durante el lanzamiento» y ocultar precio, botón de pago, cupones y renovación; los precios solo cuando exista el backend y se haya decidido el modelo (con IAP o fuera de la app para el técnico, ver 3.1.3(c)); **(b)** IAP real (productos de suscripción anual en ASC, StoreKit, recibos validados por el backend); **(c)** mantener Stripe y defenderlo, no recomendado. Si el técnico es «Business» (enterprise/B2B) 3.1.3(c) puede aplicar solo a organizaciones, no a individuos.

### 1.7 Eliminación de cuenta (5.1.1(v))

❌ Ver §0.1. Requisitos para que cumpla:
1. La opción existe y es fácil de encontrar (ya: Configuración → «Eliminar cuenta»).
2. Inicia el borrado **real** (no un correo ni un link a la web): endpoint en el backend que elimine o anonimice la cuenta y datos personales (conservando lo que la ley exija, p. ej. registros de pagos, y decirlo en la política).
3. Qué pasa con solicitudes activas, saldo de ganancias pendiente y cuenta Stripe Connect del técnico (bloquear con mensaje claro mientras haya trabajos en curso o pagos pendientes es aceptable).
4. Revocar el token de Sign in with Apple si la cuenta se creó con Apple.
5. Cerrar sesión, borrar `AsyncStorage`/SecureStore y desregistrar el token push (`NotificationDAO.unregisterDevice`).
6. Textos: la pantalla actual dice «todos tus datos serán eliminados permanentemente»: tiene que ser verdad o ajustarse.

### 1.8 Notificaciones push

✅ Permiso solicitado por flujo propio (`lib/notifications/push.ts`), con `hasPermission` antes; las notificaciones son transaccionales (estado del pedido, mensajes, videollamada). Sin marketing: si se mandan promociones hace falta un opt-in aparte (guía 4.5.4). `settingsNotifications` permite apagarlas.

### 1.9 Contenido generado por usuarios (1.2)

Hay: chat dueño↔técnico (texto e imágenes), reseñas con etiquetas y comentario, foto de perfil, fotos/videos del vehículo, nombres.
- ❌ No encontré: «Reportar mensaje/usuario/reseña», «Bloquear usuario», ni aceptación de EULA con cláusula de contenido inaceptable.
- ✅ Atenúa: el chat existe solo entre dos personas con un trabajo en común, se bloquea al terminar (`lib/chat/chatAvailability.ts`), los técnicos están verificados (identidad Didit + certificaciones) y hay soporte por chat en vivo y Centro de ayuda.
- Mínimo recomendado para evitar el rechazo 1.2: (1) botón «Reportar» en cada chat y reseña (envía a soporte/backend), (2) «Bloquear» (impide nuevas solicitudes/ofertas entre esas dos personas), (3) cláusula en Términos de uso (sin tolerancia a contenido ofensivo, con 24 h de respuesta) y aceptación en el registro, (4) correo/URL de contacto publicado. En las notas de revisión explicar que no es una red social y cómo se reporta.
- Necesita endpoints del backend (fuera del repo).

### 1.10 Videollamadas, transcripción y grabación

- ✅ Daily.co dentro de la app (`@daily-co/react-native-daily-js`). **No se graba el video.**
- ✅ Consentimiento: ambas partes aceptan las condiciones antes de la llamada y vuelven a aceptar, una a la otra, al activar subtítulos en vivo/transcripción (`lib/video/consent.ts`, versión `2026-11-18`, la transcripción se guarda con el turno). Lo registra en el teléfono y lo manda al backend «best effort» (el endpoint puede no existir; confirmar con backend, importa para evidencia).
- ⚠️ Los subtítulos/traducción usan un servicio de terceros (`translateCaption`): declararlo en la política de privacidad y la sección «Datos del usuario» si el audio o el texto salen de Daily.
- ⚠️ Revisor sin otra persona: no puede probar la llamada. Ver notas de revisión (video de demostración).

### 1.11 Otras áreas

| Ítem | Estado | Detalle |
|---|---|---|
| Verificación de identidad (Didit, DNI + selfie) | ⚠️ | Cubre al técnico. Declarar en «App Privacy» (fotos/ID, datos de rostro tratados por el proveedor), pantalla con consentimiento ya existe (`IdentityConsent`). La política debe nombrar a Didit. |
| Contenido de relleno / pantallas incompletas | ❌ | Lorem en `privacy` (ver §0). Revisar que no queden pantallas «próximamente» visibles (`actions.upgradeSoon`, `not_available_yet`). |
| Enlaces externos y legales dentro de la app | ⚠️ | Terms 404, no hay política de privacidad dentro de Configuración/Perfil (solo la pantalla lorem). Agregar «Política de privacidad» y «Términos» (links a `mechanicassistance.com`). |
| Soporte | ✅ | Centro de ayuda (`app/(tabs)/help.tsx`), chat en vivo (`live-chat.tsx`). Falta URL de soporte pública: `https://mechanicassistance.com/contact/` responde 200 (no existe `/support/`). |
| Emergencias | ⚠️ | El Centro de ayuda ya dice que ante peligro hay que llamar a emergencias. Para evitar el rechazo 1.4.1 (seguridad física) dejar claro en la descripción que **no** es un servicio de emergencias (911). |
| Idiomas | ✅ | `es.json` y `en.json`, voseo en español. |
| Sin mención de otras plataformas / precios Android | ✅ | No detecté referencias en el listado propuesto. |
| Maps | ✅ | `react-native-maps` (Apple Maps si no hay `GOOGLE_MAPS_IOS_API_KEY`; con clave, Google Maps). Confirmar la clave como secreto de EAS en el perfil `production`. |

---

## 2. Lista de verificación de App Store Connect (en orden)

### 2.1 Datos de la app

- [ ] **Nombre**: «Mechanic Assistance» (hasta 30; comprobar disponibilidad en ASC). 
- [ ] **Subtítulo** (≤30): ver §3.
- [ ] **Categoría principal**: *Utilities* (alternativas: *Travel*, *Business*). Propuesta: Primaria **Utilities**, secundaria **Business**. (Decisión D.)
- [ ] **Clasificación por edad**: responder el cuestionario nuevo; con chat entre usuarios y sin contenido sensible, se espera 4+–13+ según cómo se conteste «mensajería/UGC»; no declarar «acceso web sin restricciones» (no hay navegador abierto). Responder: sin violencia, sin apuestas, sin alcohol, sin contenido sexual, **sí** funciones de comunicación entre usuarios.
- [ ] **Disponibilidad**: países (¿solo Estados Unidos / Argentina?). La app opera en inglés y español; elegir región coherente con el backend.
- [ ] **Precio**: gratis. Sin compras dentro de la app (hasta decisión A).
- [ ] **Derechos de contenido de terceros**: «No contiene contenido de terceros» (Google Maps y Stripe son SDKs, no contenido). Responder en consecuencia.
- [ ] **Versión**: `1.0.1` / marketing version; el build lo asigna EAS (`autoIncrement`, remoto). Elegir en ASC el build más reciente del TestFlight **después** de cerrar los bloqueantes (el 142 es anterior a los arreglos).

### 2.2 Privacidad de la app («App Privacy»)

URL de política: `https://mechanicassistance.com/privacy-policy/` (200 OK; confirmar que mencione Stripe, Didit, Daily.co, Firebase, Google Maps/Places y el borrado de cuenta). Respuesta propuesta (**confirmar contra lo que el backend realmente guarda**):

| Tipo de dato | ¿Se recopila? | Vinculado a la identidad | Para qué | Tracking |
|---|---|---|---|---|
| Nombre, email, teléfono, dirección física | Sí | Sí | Funcionalidad de la app, cuenta | No |
| Ubicación precisa | Sí (dueño al pedir; técnico durante el trabajo, también en segundo plano) | Sí | Funcionalidad de la app | No |
| Fotos o videos (vehículo, perfil, DNI/selfie en Didit) | Sí | Sí | Funcionalidad de la app, verificación | No |
| Otro contenido de usuario (mensajes de chat, reseñas, transcripciones de videollamada con consentimiento) | Sí | Sí | Funcionalidad de la app | No |
| Información de pago (Stripe: marca, últimos 4, vencimiento; ganancias/pagos) | Sí (procesa Stripe) | Sí | Funcionalidad de la app | No |
| Historial de compras / servicios | Sí | Sí | Funcionalidad de la app | No |
| ID de usuario, token del dispositivo (push) | Sí | Sí | Funcionalidad, notificaciones | No |
| Información sensible / identificación gubernamental (DNI del técnico) | Sí (si Didit/backend lo conservan) | Sí | Verificación de identidad | No |
| Otros datos: VIN, patente, datos del vehículo, informe OBD | Sí | Sí | Funcionalidad | No |
| Diagnósticos / crash / analytics / publicidad | No | — | — | — |

«¿Se usan datos para rastrearte?» → **No**. Verificar si el backend usa analytics/crash propios antes de marcar «No recopilado».

### 2.3 URLs

- [ ] Política de privacidad: `https://mechanicassistance.com/privacy-policy/` ✅ 200.
- [ ] Términos de uso / EULA: `https://mechanicassistance.com/terms/` (✅ 200; la URL del app está mal, ver §0.3). Se puede usar el EULA estándar de Apple o este.
- [ ] URL de soporte: `https://mechanicassistance.com/contact/` ✅ 200 (alternativa: `/help/`).
- [ ] URL de marketing: `https://mechanicassistance.com/` ✅ 200.
- [ ] Derechos de autor: «© 2026 [razón social]» — confirmar el titular legal.
- [ ] Contacto de revisión: nombre, teléfono y email de alguien que conteste en 24–48 h (Diego o quien designe).

### 2.4 Capturas de pantalla (planear, no generadas)

| Dispositivo | Tamaño | ¿Obligatorio? |
|---|---|---|
| iPhone 6.9" (16/17 Pro Max) | 1320×2868 (o 1290×2796) | ✅ sí |
| iPhone 6.5" (11 Pro Max / XS Max) | 1284×2778 (o 1242×2688) | solo si no se sube 6.9" o para mejor control (ASC reescala) |
| iPad 13" | 2064×2752 (o 2048×2732) | **solo si** `supportsTablet: true` (decisión B) |

Entre 3 y 10 capturas por idioma (hacer en inglés y español, con los dos idiomas dentro de la app). Orden sugerido (mismo guion para ambos roles, que el 1.er dueño vende la propuesta):

1. Dueño: elegir el tipo de asistencia (inmediata / agendada / videollamada).
2. Dueño: pedido con fotos + dirección en el mapa.
3. Dueño: seguimiento del técnico en el mapa y ETA.
4. Chat dueño↔técnico.
5. Videollamada (con subtítulos opcionales).
6. Cotización / aprobación y pago con tarjeta guardada.
7. Técnico: feed de solicitudes y disponibilidad.
8. Técnico: ganancias y payouts.
9. Informe final / recibo.

Sin datos reales de personas: usar cuentas de prueba; sin barra de estado con carrier raro. Sin precios de la membresía (decisión A).

### 2.5 Ícono, versión y build

- [ ] Ícono 1024×1024 ✅ (RGB sin alfa).
- [ ] Subir un build nuevo con los arreglos de §4 (`npm run testflight`; el flujo ya hace `eas submit`, que solo sube a TestFlight, no envía a revisión).
- [ ] Cuando esté procesado: «Exportar cumplimiento»: **«No usa cifrado, o solo exento»** (consistente con `ITSAppUsesNonExemptEncryption: false`).
- [ ] «Novedades» (versión 1.0.x) ver §3.
- [ ] Release: manual (recomendado la primera vez).

### 2.6 Cuenta de demostración y notas para el revisor

El revisor no puede recibir un SMS. Propuesta, de mejor a peor:

1. **(Recomendada) Cuentas de email + contraseña.** El login ya soporta email (toggle «Email» en la pantalla de login). Crear en producción dos cuentas de prueba (o una con **ambos perfiles**, el app permite alternar desde «Elegir perfil») con la verificación de identidad ya aprobada, método de pago de prueba, vehículo con VIN cargado, y un técnico «disponible». En ASC → «App Review Information» marcar «Sign-in required» y cargar usuario/contraseña **ahí** (no en el repo). Sin credenciales en este documento. Que el backend marque estas cuentas como `review` para: saltear Didit, no cobrar de verdad y no disparar SMS reales.
2. **Teléfono con código fijo**: que el backend acepte un número de prueba (p. ej. reservado) con un OTP fijo. Más frágil (hay límites/lockouts), solo si el backend lo permite.
3. **Solo una nota de revisión**: insuficiente, Apple suele devolver 2.1 «no pudimos acceder».

Flujo de dos puntas y videollamada: el revisor está solo. Resolver con: (a) técnico «de guardia» (cuenta de prueba con la app abierta en un teléfono propio durante la revisión, o un bot de pruebas del backend que acepte los pedidos de la cuenta demo, como hacía el mecánico simulado), y (b) **video de demostración** (≈2 min; subir como adjunto en ASC o link no listado) con el recorrido completo, incluida la videollamada con consentimiento.

### 2.7 Pasos de ASC finales (no ejecutar hasta resolver bloqueantes)

1. Completar todo lo de arriba; 2. Seleccionar el build; 3. Responder cuestionarios (cifrado, publicidad/IDFA: **No**, contenido de terceros); 4. Guardar → «Add for Review» → «Submit». Diego envía manualmente.

---

## 3. Textos del listado

Límites de ASC: nombre 30 · subtítulo 30 · texto promocional 170 · descripción 4000 · palabras clave 100 (separadas por coma, sin espacios; no repetir el nombre ni la categoría) · novedades 4000 · notas del revisor 4000.

### 3.1 Inglés (en-US)

- **Name** (19): `Mechanic Assistance`
- **Subtitle** (29): `Mechanics on-site or by video`
- **Promotional text** (≤170):
  `Need a mechanic? Request one to come to you, book a scheduled visit or start a video call. Follow your technician live and pay securely in the app.`
- **Keywords** (≤100):
  `car repair,mechanic,roadside,breakdown,vehicle,auto,diagnosis,technician,garage,mobile mechanic,OBD`
- **Description**:

```
Mechanic Assistance connects vehicle owners with verified mechanics. Ask for help where you are, schedule a visit, or talk to a technician by video call.

FOR VEHICLE OWNERS
• Immediate assistance: describe the problem, add photos or a video, share your location and get offers from available technicians.
• Scheduled assistance: set a date and time window, compare quotes and choose the technician you prefer.
• Video call: show your vehicle to a technician and get a diagnosis in minutes. Live captions and a written transcript are created only if both of you agree during the call.
• Follow your technician live on the map and chat with them in the app.
• Save your vehicles (VIN, plate, tires) and your cards, and keep the full history of every service with its report and receipt.
• Pay for each service with a card, securely through Stripe.

FOR TECHNICIANS
• Create a verified profile with your certifications, documents and service area.
• Turn availability on, receive requests near you and send your offer.
• Share your arrival with the customer, record the checklist and photos of the job, and close it with a final report.
• Get paid for your jobs through Stripe, with a clear view of your earnings and payouts.

SECURE BY DESIGN
• Technicians verify their identity before taking jobs.
• Pay inside the app: you only pay the price you accepted.
• Available in English and Spanish.

Membership: during our launch stage the plan is included at no cost. We will tell you before any change in pricing.

Mechanic Assistance is not an emergency service. If there is danger, an injury, fire or a hazardous roadway situation, call your local emergency number first.

Support: https://mechanicassistance.com/contact/
Terms: https://mechanicassistance.com/terms/
Privacy: https://mechanicassistance.com/privacy-policy/
```

- **What's new** (v1.0.x primera versión):
  `First release on the App Store: request immediate or scheduled assistance, start a video call with a technician, chat, follow your technician live and pay securely in the app.`
- **Review notes**: ver §3.3 (en inglés, para Apple).

### 3.2 Español (es-MX / es-419; no hay `es-AR`: usar «Spanish (Mexico)» o el idioma «Spanish» según opciones de ASC)

- **Nombre** (19): `Mechanic Assistance`
- **Subtítulo** (30): `Mecánicos en sitio o por video`
- **Texto promocional** (≤170):
  `¿Necesitás un mecánico? Pedí que vaya a donde estás, agendá una visita o hacé una videollamada. Seguí a tu técnico en vivo y pagá de forma segura desde la app.`
- **Palabras clave** (≤100):
  `auxilio mecánico,mecánico,auto,vehículo,taller,grúa,diagnóstico,técnico,OBD,mecánico a domicilio,varadura`
- **Descripción**:

```
Mechanic Assistance conecta a dueños de vehículos con mecánicos verificados. Pedí ayuda donde estés, agendá una visita o hablá con un técnico por videollamada.

PARA DUEÑOS DE VEHÍCULOS
• Asistencia inmediata: contá qué pasa, sumá fotos o un video, compartí tu ubicación y recibí ofertas de los técnicos disponibles.
• Asistencia agendada: elegí fecha y franja horaria, compará cotizaciones y escogé al técnico que prefieras.
• Videollamada: mostrale tu vehículo a un técnico y obtené un diagnóstico en minutos. Los subtítulos en vivo y la transcripción escrita solo se generan si los dos están de acuerdo durante la llamada.
• Seguí a tu técnico en vivo en el mapa y chateá con él desde la app.
• Guardá tus vehículos (VIN, patente, neumáticos) y tus tarjetas, y conservá el historial de cada servicio con su informe y comprobante.
• Pagá cada servicio con tarjeta, de forma segura a través de Stripe.

PARA TÉCNICOS
• Creá un perfil verificado con tus certificaciones, documentos y zona de trabajo.
• Activá tu disponibilidad, recibí solicitudes cerca tuyo y enviá tu oferta.
• Avisale al cliente tu llegada, completá la lista de control y las fotos del trabajo y cerralo con un informe final.
• Cobrá tus trabajos con Stripe y mirá tus ganancias y retiros con claridad.

SEGURIDAD
• Los técnicos verifican su identidad antes de tomar trabajos.
• Pagás dentro de la app: solo el precio que aceptaste.
• Disponible en español e inglés.

Membresía: durante nuestra etapa de lanzamiento el plan está incluido sin costo. Te avisamos antes de cualquier cambio de precios.

Mechanic Assistance no es un servicio de emergencias. Si hay peligro, heridos, fuego o una situación riesgosa en la ruta, llamá primero a tu número local de emergencias.

Soporte: https://mechanicassistance.com/contact/
Términos: https://mechanicassistance.com/terms/
Privacidad: https://mechanicassistance.com/privacy-policy/
```

- **Novedades**:
  `Primera versión en la App Store: pedí asistencia inmediata o agendada, hacé una videollamada con un técnico, chateá, seguí a tu técnico en vivo y pagá de forma segura desde la app.`

> Notas sobre el contenido: los textos **no** prometen «auxilio vial 24/7», grúa, tiempos de llegada garantizados ni precios fijos de membresía. «Grúa» aparece solo como palabra clave en español: **quitarla** si la app no gestiona remolque. Los cargos del servicio son el precio que el técnico ofrece y el dueño acepta; la membresía figura como incluida sin costo durante el lanzamiento (coherente con `startup_waived`, decisión A). Si Diego decide cobrar membresía en el lanzamiento, reescribir ese párrafo.

### 3.3 Notas para el revisor (App Review Information → Notes)

```
Mechanic Assistance connects vehicle owners with mechanics who come to the vehicle (immediate or scheduled requests) or help by video call. It is not a social network. Each chat exists only between an owner and the technician of a specific job.

SIGN-IN
The app normally signs in by phone number with an SMS code, which a reviewer cannot receive. Please use the email and password provided in the "Sign-in required" fields (Log in → "Email" tab). The account has both profiles: the vehicle OWNER and the TECHNICIAN. Switch from Profile → "Switch profile". Sign in with Apple and Google are also offered.

HOW TO TRY IT
1) As OWNER: Home → "Request assistance" → choose Immediate, Scheduled or Video call → describe the issue (photos optional) → send. A technician receives it, sends an offer, and you accept it. You can chat, follow the technician on the map and pay with the test card saved in Wallet.
2) As TECHNICIAN: Dashboard → turn on availability → open the request → send an offer. After the owner accepts, follow the job steps (arrival, checklist, final report).
3) VIDEO CALL (owner and technician each need a device): after the offer is accepted both people go to the video lobby, accept the call conditions and join. Live captions and a transcript are created only if both accept during the call. Video is not recorded. A short screen recording of the whole flow is attached to this submission because a second participant is needed.

PERMISSIONS
Camera and microphone: video calls, identity verification of technicians, vehicle photos/video, QR/VIN scanning. Location: finding the right technician and, for technicians only, sharing their position with the customer during an active job (background location is used only while a job is in progress, with the system indicator on). Notifications: request, message and call updates.

PAYMENTS
Services are physical services performed at the vehicle or a live 1-to-1 consultation with a technician, paid through Stripe (test mode for review accounts). The membership plan is currently included at no cost; nothing is charged for it in this version. No digital goods are sold in the app.

ACCOUNT DELETION: Profile → Settings → Delete account.
REPORTING/BLOCKING: available in each chat and in reviews. Reports are handled within 24 hours.
This app is not an emergency service.
```

(Los últimos dos renglones solo si se implementan: ver §4.)

---

## 4. Cambios propuestos (no aplicados)

| # | Archivo | Cambio | Tamaño |
|---|---|---|---|
| 1 | `lib/config/legal.ts` | `terms` → `https://mechanicassistance.com/terms/` (la actual da 404). | trivial |
| 2 | `app/(tabs)/privacy.tsx`, `lib/i18n/locales/en.json` + `es.json` (`privacy.*`) | Reemplazar el lorem ipsum por links a política/términos (`LEGAL_URLS`) con `expo-web-browser`, o quitar el ítem del menú (`app/(tabs)/index.tsx` líneas 446 y 480). Agregar también «Política de privacidad / Términos» en Configuración. | chico |
| 3 | `app/(tabs)/settings/delete-account.tsx`, `lib/dao/UserDAO.ts` + backend | Llamar al endpoint real de borrado, mostrar error/estado de carga, limpiar sesión, `AsyncStorage`, token push y revocar Apple. Requiere el endpoint del backend. | mediano (bloqueante) |
| 4 | `app.json` | Unificar `NSCameraUsageDescription` (expo-camera vs webrtc) con un solo texto que cubra videollamada, verificación de ID, QR, VIN y fotos del vehículo; agregar mención del video en el texto del micrófono. | trivial |
| 5 | `app.json` | Agregar el plugin `expo-image-picker` con `photosPermission`, `cameraPermission`, `microphonePermission` propios. | trivial |
| 6 | `app.json` | Quitar `NSAppTransportSecurity.NSAllowsArbitraryLoads` tras comprobar que no se usa HTTP. | trivial (probar) |
| 7 | `app.json` | `ios.supportsTablet: false` si no se va a soportar iPad (decisión B). | trivial |
| 8 | `lib/membership/plan.ts`, `app/(tabs)/membership.tsx` | En iOS, ocultar precio, botón «Pagar», cupones y renovación mientras el plan esté gratis; ver decisión A. No dejar los cupones hardcodeados en producción. | chico |
| 9 | Chat y reseñas | Acciones «Reportar» y «Bloquear» + EULA en el registro (necesita backend). | mediano |
| 10 | `app.json` (opcional) | Localizar los permisos al español (`InfoPlist.strings` por idioma). | mediano, opcional |

---

## 5. Riesgos de rechazo, de más a menos probable

1. **Eliminación de cuenta sin implementar (5.1.1(v))**: es un botón que no hace nada; casi seguro lo detecta el revisor. ❌
2. **Contenido de relleno / enlaces rotos (2.1, 2.3.1)**: pantalla de privacidad con lorem ipsum y Terms con 404. ❌
3. **No poder entrar (2.1)**: sin cuenta de demo. ❌ (se resuelve con §2.6.)
4. **Membresía y precios dentro de la app (3.1.1)** si el pago simulado queda visible/operativo. ⚠️
5. **UGC sin reportar/bloquear/EULA (1.2)**. ❌
6. **Ubicación en segundo plano (2.5.4 / 5.1.1)** sin justificación clara en las notas. ⚠️
7. **Datos de privacidad inconsistentes (5.1.1, 5.1.2)**: etiquetas de App Privacy que no coinciden con lo que hace la app (Didit, Daily, Google Places, Stripe). ⚠️
8. **Videollamada no verificable (2.1)**: el revisor no puede completar el flujo sin segunda persona; mitigar con video + técnico de guardia. ⚠️
9. **Seguridad física / emergencias (1.4.1)**: aclarar que no es un servicio de emergencias (ya incluido en la descripción). ⚠️
10. **iPad** (si `supportsTablet: true` y la UI no está adaptada): rechazo por diseño (4.0) o capturas faltantes. ⚠️
11. **ATS abierto (`NSAllowsArbitraryLoads`)**: Apple puede pedir justificación. ⚠️
12. **Cifrado/exportación y privacy manifest**: bajo riesgo si el build 142 no tuvo advertencias. ✅

---

## 6. Qué se verificó y qué no

- Revisado sobre `development` @ `8f08c09`: `app.json`, `app.config.js`, `eas.json`, `plugins/`, `package.json`, `lib/membership/plan.ts`, `lib/config/legal.ts`, `lib/video/consent.ts`, `lib/firebase/auth.ts`, `app/login.tsx`, pantalla de borrar cuenta, `privacy.tsx`, locales en/es.
- Las URL de `mechanicassistance.com` se consultaron el 25-nov-2026 (`/`, `/privacy-policy/`, `/terms/`, `/contact/` = 200; `/terms-conditions/`, `/support/` = 404).
- **No verificado**: contenido de las páginas legales (si mencionan los terceros), comportamiento real del backend (borrado, reportes, cuentas de demo, qué datos conserva), PrivacyInfo generado por el prebuild (no hay `ios/` ni `node_modules` en el árbol de trabajo), tamaños exactos de captura vigentes en ASC hoy y opciones de idioma/región (confirmar en ASC), ni se probó la app en iPad.
- El `CLAUDE.md` del repo está desactualizado respecto del código (habla de backend propio y otros bundle IDs); usé el código actual como fuente de verdad.

> Las notas del revisor (§3.3) son un borrador: los nombres exactos de menús («Switch profile», «Request assistance») y las promesas de reportar/bloquear/borrar cuenta hay que ajustarlos a lo que quede implementado antes de pegarlas en ASC.

---

## 7. Cambios aplicados en la rama `claude/asc-prep-ba08ee` (26-nov-2026)

Aplicados a pedido de Diego, sin push. Hay que llevarlos a `development` (cherry-pick de los commits de esta rama).

| Cambio | Archivos | Estado |
|---|---|---|
| Solo iPhone (`supportsTablet: false`) | `app.json` | ✅ hecho |
| Un solo texto de cámara (expo-camera y webrtc) y micrófono que cubre el video del vehículo | `app.json` | ✅ hecho |
| Botón «Reportar» en el chat (ícono de bandera arriba a la derecha): abre un email a `contact@mechanicassistance.com` con la referencia de la conversación | `app/(tabs)/chat/[id].tsx`, `lib/support/report.ts` | ✅ hecho (mínimo, sin backend) |
| «Reportá un problema o contenido inapropiado» en el Centro de ayuda | `app/(tabs)/help.tsx` | ✅ hecho |
| Casilla obligatoria al registrarse: Términos, Política de privacidad y no publicar contenido ofensivo | `app/setup/index.tsx`, `components/setup/TermsAcceptance.tsx` | ✅ hecho (solo registro por teléfono) |
| Textos en inglés y español | `lib/i18n/locales/{en,es}.json` (`report.*`, `setup.terms.*`) | ✅ hecho |
| Bloquear usuario | — | ❌ falta (necesita backend) |
| Reportar una reseña concreta | — | ❌ falta (el Centro de ayuda cubre el caso general) |
| Membresía gratis en esta versión (interruptor `MEMBERSHIP_FREE_AT_LAUNCH`): sin precio, sin botón «Pay», sin códigos de promo, sin aviso de costo al agregar un vehículo, sin la línea de membresía en los pagos del técnico | `lib/membership/launch.ts`, `lib/membership/plan.ts`, `app/(tabs)/vehicles.tsx`, `components/earnings/MembershipEarnings.tsx` | ✅ hecho; pruebas en `lib/membership/__tests__/` |

Comprobado: `tsc` sin errores nuevos en los archivos tocados y ESLint sin errores nuevos (los de `chat/[id].tsx` líneas 76 y 103 ya existían). No probado en simulador ni en un teléfono.

### Membresía: cómo estaba y cómo volver (para retomarla)

**Cómo estaba (todo sigue en el código, solo apagado por el interruptor):**
- Técnico, plan «All-access»: US$120 al año.
- Dueño, plan «Assistance Pass»: por vehículo con VIN, por año: el 1.º US$15, el 2.º y 3.º US$12, del 4.º en adelante US$9.
- Códigos de promo escritos a mano en el cliente: `MIAMI` (10 %) y `MEKA` (25 %) para técnicos; `INSURANCE` (100 %) para dueños.
- Pago con tarjeta Stripe o con el saldo de ganancias (solo técnico), con renovación automática. El pago estaba **simulado**: se guardaba en el teléfono (`AsyncStorage`), no se cobraba (ver «AN» en `docs/backlog-backend.md`).

**Por qué se apagó:** un pago dentro de la app que desbloquea funciones tiene que pasar por In-App Purchase (guía 3.1.1 de Apple); no se quiso arriesgar el rechazo de la primera revisión.

**Para volver:** poner `MEMBERSHIP_FREE_AT_LAUNCH = false` en `lib/membership/launch.ts`. Antes: decidir cómo se cobra (In-App Purchase u otra vía permitida) y cambiar el pago simulado por el real; y actualizar la ficha (la descripción y las notas del revisor dicen «incluida sin costo») y la declaración de «Purchases» en privacidad. Ojo: Apple restringe que la app dirija a pagar por fuera, salvo excepciones por país.

**Actualización (26-nov-2026, según el repo de análisis `servicios/billing/08-membresia-api.md` y `plataforma/membresia-puesta-en-marcha.md`):** los precios y los cupones ya no son del cliente: los sirve Billing (`GET /api/membership/me?role=` con `amount`, `listAmount`, `dueAmount`, `chargingEnabled`, `coupon`, `fleet`) y se editan desde el Hub (Membership → Prices y Coupons). En producción el **cobro está apagado** (`membership_charging_enabled`: `POST /membership/pay` responde `503`) y los cupones `MIAMI`, `MEKA` e `INSURANCE` están cargados **inactivos**. Cuando la app pase a usar esos endpoints, `lib/membership/plan.ts` deja de tener precios ni cupones propios.

Regla para esa integración (Apple 3.1.1): mostrar el pago **solo si** `!MEMBERSHIP_FREE_AT_LAUNCH && plan.chargingEnabled`. Si dependiera solo del interruptor del servidor, se podría encender el cobro después de la aprobación sin nueva revisión, y eso es justo lo que Apple no acepta.
