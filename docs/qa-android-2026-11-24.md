# QA en Android — 24-nov-2026

Rama `android-qa` (sobre `development`). **Cobertura parcial**: se recorrió el rol técnico (dashboard, requests, citas, perfil, horarios y zona, documentos, cierre de sesión), el registro y el login. Quedan sin recorrer el rol dueño, el flujo en sitio, videollamada, pagos/Stripe y el resto (ver «Pendientes de recorrido»).

## Entorno
- Mac (Apple Silicon), emulador **Pixel_8_QA** (perfil Pixel 6, Android 16 / API 36, arm64, 4 GB de RAM, 8 GB de datos). El AVD `Pixel_4` existente no sirve: se queda sin espacio al instalar el APK de debug.
- JDK: el JBR de Android Studio (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`); no hay Java del sistema.
- Build: `npx expo run:android --no-bundler` (primer build ≈ 8 min). Cuando cambia `app.config.js` hay que correr antes `npx expo prebuild --platform android --no-install`, porque `expo run:android` no vuelve a generar el manifiesto.
- Paquete de Android de `development`: `com.mechanicassistance.app`; esquema del dev client `exp+mechanic-assistance`.
- Metro en el puerto 8089 (el 8081 lo usa otra sesión) con `adb reverse tcp:8089 tcp:8089`. Watchman tiene el repo padre como raíz y Metro no resuelve módulos del worktree: se usó `useWatchman: false` **solo en local** (no se commiteó).
- Backend de producción (`t9smggmz3a.us-east-1.awsapprunner.com`). Cuenta usada: `+1 305 429 9538`, con los roles técnico y dueño. Ubicación simulada con `adb emu geo fix`.
- Las cuentas de prueba de `CLAUDE.md` (`(718) 871-2281`, `+11111111111`) no reciben SMS: el login pide el código solo a números con cuenta y a esos no les llegó.

## Hallazgos corregidos
| # | Dónde | Qué pasaba | Causa | Arreglo |
|---|---|---|---|---|
| 1 | Cualquier mapa (Hours & area, pedir asistencia, citas) | **La app se cerraba** con `IllegalStateException: API key not found` | `development` quitó la clave de Google Maps de Android de `app.json` y `app.config.js` solo inyectaba la de iOS | `app.config.js` pone `GOOGLE_MAPS_ANDROID_API_KEY` (o la de iOS) en el manifiesto; un build de Android en EAS **falla** si no hay clave, en vez de generar un APK que se cierra |
| 2 | Registro (todos los pasos con campos) | El teclado tapaba el botón fijo «Continue» | Con edge-to-edge la ventana no se redimensiona con el teclado y las pantallas usaban `behavior` `undefined`/`height` en Android | `KeyboardAvoidingView` con `behavior="padding"` en las 18 pantallas de pantalla completa (login, registro, chat, cambio de teléfono/email, check-in, etc.) |
| 3 | Pantallas tras el login | Barra de estado con íconos blancos sobre fondo claro (hora ilegible) | El login queda montado debajo y su `StatusBar light` seguía arriba | `GradientLayout` solo monta su `StatusBar` mientras la pantalla tiene foco |
| 4 | Requests (técnico) | Spinner eterno | `getCurrentPositionAsync` en Android puede no responder nunca sin fix de GPS | `getCurrentCoords`: última posición conocida y, si no hay, 5 s de espera antes de seguir sin centro geográfico |
| 5 | Dashboard (técnico), tira de tips | Con link, el tip aparecía sin padding ni `gap` y el texto cortado | Un `Pressable` con `style` como función perdía el layout de `className`/`style` en Android | El layout pasó a una `View` interna (**no se pudo reconfirmar visualmente** después del cambio) |

## Diferencias que quedan entre Android e iOS
- **Hueco bajo el pie fijo después de cerrar el teclado.** Con `behavior="padding"`, tras ocultar el teclado el pie queda ~70 dp por encima del borde inferior, con una sombra gris debajo. Es el relleno que el `KeyboardAvoidingView` de RN no suelta en Android edge-to-edge. Se probaron dos reemplazos (medir el solape a mano; apagar y prender el componente al cerrar) y ninguno quedó bien, así que **no se commitearon**. Opciones: `react-native-keyboard-controller`, o ajustar `softwareKeyboardLayoutMode` y quitar el KAV en Android.
- **Sombra gris detrás del botón blanco «Create account»** de la bienvenida (la elevación de Android pinta una sombra rectangular sobre el degradé). Pendiente.
- **Teclado numérico oscuro** en la pantalla de código del login y claro en el resto: parece depender de `keyboardAppearance`; pendiente de revisar.
- **Mapas sin baldosas** con la clave actual: probablemente restringida al paquete anterior (`com.darkseed.mechanic`) o sin el SHA-1 de la firma de este build. En Google Cloud la clave tiene que admitir `com.mechanicassistance.app` y el SHA-1 del APK que se suba.
- **Sign in with Apple** no aparece en Android (esperado).
- El botón atrás de Android va registro → login → bienvenida y en la bienvenida no cierra la app (OK).

## Pantallas recorridas
| Pantalla | Rol | Estado |
|---|---|---|
| Bienvenida, login (teléfono) | — | OK (con 2 pendientes cosméticos arriba) |
| Registro: teléfono, código, elección de rol (cuenta existente) | — | Corregido (#2) |
| Cierre de sesión (alerta de confirmación y vuelta a bienvenida) | técnico | OK |
| Dashboard (needs your attention, tira de tips, Today, recientes) | técnico | OK, tira corregida (#5) |
| Requests | técnico | Corregido (#4); pestaña «Your quotes» no abierta |
| Appointments (upcoming/past, contadores) | técnico | OK |
| Perfil, menú, profesional | técnico | OK |
| Hours & area (horarios, mapa, radio) | técnico | Corregido (#1) |
| Legal documents | técnico | OK (selector de archivos sin probar) |
| Permisos de ubicación y notificaciones | técnico | OK |

## Pendientes de recorrido (no verificados)
Rol dueño completo (dashboard, pedir asistencia en sus 4 modalidades, mapa, fotos/videos, ofertas, pagos/Stripe, wallet, citas, chat, calificaciones, vehículos, direcciones, membership); técnico: detalle de request y presupuestos, flujo en sitio (QR/PIN, fotos, OBD, cierre), videollamada (Daily), ganancias/payouts, ASE y certificaciones, notificaciones/push; transversales: modo oscuro, escala de fuente, idioma, dos tamaños de pantalla, PDFs (reporte y estado de cuenta), selector de imágenes/video, Didit, canal de notificaciones, deep links. Sombras/elevación: solo se vieron en las pantallas recorridas.

## Pendientes de backend
Ver `docs/backlog-backend.md`, punto **AS**: `GET /api/assistance-types?scope=app` responde 401 antes del login.

## Para probar a mano en un teléfono real antes de subir el APK
1. **Mapas**: que la clave de Google admita `com.mechanicassistance.app` + el SHA-1 de la firma, y que `GOOGLE_MAPS_ANDROID_API_KEY` esté en EAS; abrir Hours & area y el mapa de un pedido: deben verse las baldosas.
2. **Push reales** (aviso con la app cerrada, canal «Avisos de asistencia», tocar la notificación y que abra la pantalla correcta).
3. **SMS real** y autocompletado del código.
4. **Cámara real**: foto de perfil (cámara o galería), fotos del pedido, QR/PIN del check-in, escáner OBD.
5. **Stripe** con tarjeta real/live y descarga/compartir de PDFs.
6. **Videollamada** entre dos dispositivos (Daily).
7. **Didit** (verificación de identidad).
8. Con el teléfono: teclado en todos los formularios (hueco bajo el pie fijo) y barra de navegación por gestos vs. 3 botones.
