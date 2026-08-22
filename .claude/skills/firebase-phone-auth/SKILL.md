---
name: firebase-phone-auth
description: >
  OBSOLETA para login por teléfono — usá `phone-otp-auth`. Sigue valiendo solo
  para Google y Apple sign-in, que todavía pasan por Firebase. Usá esta skill al
  tocar `signInWithGoogle` / `signInWithApple` en `lib/firebase/auth.ts`, los
  config plugins de Firebase o `GoogleService-Info.plist`.
---

# Firebase Auth (solo social)

> **El login por teléfono ya no usa Firebase.** Lo hace `auth-service` con OTP
> propio — ver la skill `phone-otp-auth`. Todo lo que sigue sobre
> `signInWithPhoneNumber`, reCAPTCHA, APNs forwarding y `BILLING_NOT_ENABLED`
> quedó **sin efecto** para el flujo de teléfono; se conserva porque Google y
> Apple sign-in siguen pasando por Firebase, y porque describe la configuración
> nativa (plugins, plist, frameworks) que esos dos todavía necesitan.
>
> Cuando Google y Apple migren a verificación de `id_token` en el backend,
> este archivo se borra junto con `lib/firebase/`.

La app usaba autenticación por teléfono (SMS/OTP) con Firebase. La configuración es
delicada porque el fallback de reCAPTCHA en iOS y el forwarding de APNs tienen
requisitos específicos. Seguí estas reglas para no romper el flujo.

## Reglas de la API (no negociables)

- Usá la **API namespaced**: `auth().signInWithPhoneNumber(phoneNumber)`.
  La API modular `signInWithPhoneNumber(getAuth(), ...)` **no** maneja bien el
  fallback de reCAPTCHA en iOS — por eso no se usa.
- Antes de llamar a `signInWithPhoneNumber`, hacé **sign-out** de cualquier
  usuario Firebase existente. Si no, se produce `auth/internal-error`.

## Billing y números de prueba

- Se requiere el **plan Blaze** de Firebase para SMS real en dispositivos físicos.
- Los **números de prueba** (Firebase Console → Authentication → Sign-in method →
  Phone → "Phone numbers for testing") **bypassean el SMS** y funcionan en cualquier
  plan. Usalos en dev local para evitar rate limiting.
- Cuentas de test del proyecto: mecánico `(718) 871-2281`, usuario `+11111111111`.

## Errores comunes y su causa

| Error | Causa / Solución |
|---|---|
| `auth/too-many-requests` | Dispositivo bloqueado por demasiados intentos fallidos → esperar ~1 hora o usar número de prueba. |
| `auth/internal-error` en <500ms en dispositivo real | Casi siempre billing. Verificá que el plan sea Blaze (ver curl abajo). |

Verificación de billing:

```bash
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=<API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1...","recaptchaToken":"test"}'
```

Si devuelve `BILLING_NOT_ENABLED`, hay que actualizar a Blaze.

## APNs / iOS (para que el push de verificación llegue)

- El forwarding de APNs se configura en `ios/Mechanic/AppDelegate.swift` vía el
  config plugin `withFirebaseAuthAPNS`: `setAPNSToken(.sandbox)` para DEBUG,
  `.prod` para release.
- Entitlements requeridos: `aps-environment: production`,
  `UIBackgroundModes: remote-notification`.
- Config plugins que sobreviven a `expo prebuild --clean` (EAS):
  `plugins/withFirebasePodfile.js`, `plugins/withFirebaseAuthAPNS.js`.
- `firebase/GoogleService-Info.plist` se copia a
  `ios/Mechanic/GoogleService-Info.plist` durante el prebuild. **Debe** incluir
  `REVERSED_CLIENT_ID` para el fallback de reCAPTCHA.

## Dónde mirar

`lib/firebase/auth.ts`, `app/login.tsx`, `context/UserContext.tsx`,
`plugins/withFirebaseAuthAPNS.js`, `firebase/GoogleService-Info.plist`.
