# Paquete para la revisión legal antes de enviar la app a Apple

**Fecha:** 27-nov-2026 · **App:** Mechanic Assistance (iOS, versión 1.0.1, build 146) · **Para:** Legal / abogado de privacidad
**Qué es esto:** los textos y comportamientos de la app que Apple revisa o que tocan datos personales, juntos, con las preguntas que necesitan respuesta **antes** de apretar «Enviar a revisión». No es una opinión legal: lo armó el equipo técnico para que Legal lo valide o lo corrija.

Resumen de lo que se pide: **A** (borrado de cuenta) y **B** (consentimiento biométrico) bloquean el envío. **C**, **D** y **E** conviene revisarlos ahora, pero no frenan.

---

## A. Borrado de cuenta (Apple 5.1.1(v)) — BLOQUEA

**Qué hace la app** (Perfil → Configuración → Eliminar cuenta): si la cuenta entró con Apple o Google pide iniciar sesión de nuevo; llama al servidor; si sale bien, revoca el token de Apple, borra el usuario de Firebase y cierra sesión. Si hay algo abierto, **no borra** y explica qué resolver (pedido o trabajo abierto, disputa, pago retenido, deuda, saldo en la billetera, ganancias sin liquidar, descuento pendiente, único administrador de una empresa).

**Texto que ve la persona** (reemplaza al anterior «se borra todo»):
- ES: «Eliminamos tus datos personales y anonimizamos tu cuenta. Algunos registros se conservan porque la ley lo exige o porque la otra persona los necesita: el historial de pagos y ganancias, los pedidos y citas anteriores (tu nombre aparece como «Usuario eliminado») y los registros de auditoría. No se puede deshacer.»
- EN: «We delete your personal data and anonymize your account. Some records stay because the law requires them or the other person needs them: payment and earnings history, past requests and appointments (your name will show as “Deleted user”) and audit records. This cannot be undone.»

**Qué se conserva** (según `plataforma/borrado-de-cuenta.md` del repo de análisis, §4):

| Dato | Se conserva | Motivo que da el equipo |
|---|---|---|
| Pagos, ganancias, transferencias, reembolsos, libro contable | Sí, solo con el id de la cuenta anonimizada | Historial financiero y fiscal; el libro es de solo agregar |
| Registro de eventos de la cuenta (con IP y agente de usuario) | Sí | Pista de auditoría de solo agregar. Las IP y agentes no se pueden limpiar sin cambiar el trigger de la base |
| Aceptaciones de políticas legales | Sí | Prueba de que aceptó cada versión; solo agregar |
| Pedidos y citas con la otra parte | Sí; siguen guardadas la dirección y las notas del servicio | La otra parte los sigue necesitando |
| Reseñas que escribió | Sí | Pendiente decidir si se anonimizan |
| Mensajes de chat | Se vacían los de la persona (sin texto ni foto); la otra parte conserva el hilo | — |
| Archivos (fotos, documentos) y lecturas de pólizas | Se borran | — |
| Respaldos de la base | Hasta 1 día | Retención del respaldo automático |

**Preguntas para Legal**
1. ¿La base legal y los plazos de cada fila de la tabla son correctos (CCPA/CPRA y la normativa fiscal que corresponda)? ¿Hay plazos máximos que deban figurar en la política?
2. ¿Pueden conservarse **IP y agente de usuario** del registro de auditoría de una cuenta borrada? Hoy no se pueden limpiar.
3. ¿Se pueden conservar los **nombres de las reseñas** o hay que anonimizarlas?
4. ¿El texto de la pantalla promete algo que no es cierto o no dice algo que debería decir? ¿Falta aclarar que Apple y Google conservan lo suyo?
5. Cuando algo abierto bloquea el borrado, ¿alcanza con explicarlo, o la ley obliga a ofrecer otra vía (por ejemplo, un pedido por email)?

---

## B. Consentimiento para datos biométricos (Didit: licencia de conducir y selfie) — BLOQUEA

**Qué se procesa:** al verificar su identidad, el técnico fotografía su **licencia de conducir** y se saca una **selfie**; Didit las compara (incluye comparación biométrica del rostro con el documento) y le devuelve a Mechanic Assistance el resultado y los datos leídos del documento (nombre, fecha de nacimiento, número de licencia).

**Configuración real de Didit** (aplicación «Mechanic Assistance», producción):
- Las plantillas de rostro se borran junto con la sesión de verificación.
- Los registros de la verificación (incluidas las imágenes) se conservan **hasta 1 año** y se borran solos (plan gratuito).
- Para residentes de Illinois, Colorado y Texas, Didit borra los datos biométricos en el plazo de esas leyes (3 años, 24 meses y 12 meses desde la última verificación); nuestro plazo de 1 año queda por debajo.
- **«Improve fraud models»** (Didit puede usar los datos para mejorar sus modelos) está **activado por defecto**. Decisión pendiente: desactivarlo (recomendado) o declararlo.

**Texto actual de la pantalla de consentimiento** (antes de la selfie; hay una casilla obligatoria):
- ES: «Antes de empezar — Didit, nuestro proveedor de identidad, revisa tu documento y tu selfie. Solo guardamos el resultado.» Casilla: «Entiendo y quiero continuar».
- EN: «Before you start — Didit, our identity provider, checks your ID and selfie. We only keep the result.» Casilla: «I understand and want to continue».

**Problema que encontró el equipo técnico:** el texto dice «solo guardamos el resultado», pero **Didit conserva las imágenes hasta 1 año** y la política publicada así lo dice. El consentimiento es más escueto que la política y puede ser inexacto. Tampoco menciona que hay comparación biométrica, la finalidad, ni el plazo.

**Propuesta de texto para que Legal apruebe, corrija o descarte (NO está aplicada en la app):**
- ES: «Para confirmar tu identidad, Didit (nuestro proveedor) va a leer tu licencia de conducir y tu selfie, y va a comparar tu rostro con la foto del documento. Esto usa datos biométricos de tu rostro. Los usamos solo para verificar que sos vos antes de que tomes trabajos. Las plantillas del rostro se eliminan al terminar la verificación y Didit conserva el registro (con las imágenes) hasta 1 año y después lo elimina. Nosotros guardamos el resultado y los datos que se leen del documento. Podés pedir que borremos tu cuenta y tus datos en cualquier momento. Más información en nuestra Política de privacidad.» Casilla: «Doy mi consentimiento para que se procesen mis datos biométricos para verificar mi identidad».
- EN: «To confirm your identity, Didit (our provider) will read your driver's license and your selfie, and compare your face with the photo on the document. This uses biometric data from your face. We use it only to check that it is you before you take jobs. Face templates are deleted when the verification ends, and Didit keeps the record (with the images) for up to 1 year and then deletes it. We keep the result and the data read from the document. You can ask us to delete your account and data at any time. More in our Privacy Policy.» Checkbox: «I consent to the processing of my biometric data to verify my identity».

**Preguntas para Legal**
1. Para Illinois (BIPA), Colorado y Texas (CUBI): ¿el aviso y la casilla alcanzan, o se necesita un **consentimiento escrito por separado**, una política de retención publicada de forma específica o texto distinto por estado?
2. ¿Es correcto lo de «hasta 1 año», o hay que fijar un plazo y una política de destrucción propios?
3. ¿Qué hay que registrar de cada consentimiento (fecha, versión del texto, idioma, usuario)? Hoy la app solo guarda localmente que se marcó la casilla durante el trámite; **no** hay constancia en el servidor.
4. ¿Se puede usar Didit para mejorar sus modelos (activado por defecto)? Recomendación del equipo: desactivarlo.
5. ¿Hay que ofrecer una alternativa a la verificación biométrica (por ejemplo, revisión manual)?
6. ¿Aplica algo especial para residentes de otros estados (Washington, California) o de los países de Latinoamérica donde se publica la app?

---

## C. Política de privacidad publicada

URLs: https://mechanicassistance.com/privacy-policy/ (inglés) y https://mechanicassistance.com/es/privacy-policy/ (español), «Last updated: November, 2026». Nombra a Didit, Daily, Stripe, Firebase y Apple, Google Maps y Places; dice que no se vende información y que no se rastrea; contempla el borrado de cuenta por escritura, no desde la app; fija la edad mínima en 18 años.

**Preguntas:** (1) ¿Falta algo que exigen CCPA/CPRA o las leyes de los estados donde se publica (derechos de acceso, corrección, portabilidad, no venta ni compartición, cómo ejercerlos, plazos de respuesta)? (2) Cuando la app permita borrar desde dentro, ¿se actualiza la sección de derechos (ya es cierto, la app lo hace desde la versión 1.0.1)? (3) La política es única para dueños y técnicos. El servidor ya permite políticas por rol: ¿conviene una específica para técnicos (verificación de identidad, ganancias) y otra para dueños?

---

## D. Términos y reglas de contenido (Apple 1.2)

La app tiene mensajes entre dueño y técnico, reseñas y fotos. Se agregó: una casilla obligatoria al registrarse («Acepto los Términos y la Política de privacidad. No voy a publicar contenido ofensivo, abusivo o ilegal, y entiendo que las cuentas que lo hagan pueden ser eliminadas»); un ícono de **reportar** en cada chat y en el Centro de ayuda, que envía un correo a contact@mechanicassistance.com, que se lee a diario.

**Preguntas:** (1) ¿Los Términos publicados (https://mechanicassistance.com/terms/) tienen la cláusula de «cero tolerancia» a contenido ofensivo y el derecho a eliminar cuentas, o hay que agregarla? (2) ¿Es suficiente reportar por correo, o hace falta un mecanismo con plazos y respuesta al denunciante? (3) Apple espera actuar en 24 horas: ¿qué compromiso conviene asumir? (4) Todavía **no hay función de bloquear** a otra persona (necesita el backend): ¿es indispensable para el lanzamiento?

---

## E. Registro de la aceptación de textos legales

Al crear la cuenta, la app registra en el servidor la aceptación de las versiones vigentes de Términos y Privacidad para el rol elegido (el servidor guarda fecha, idioma, hash del texto exacto, IP, dispositivo y versión de la app; solo se agrega, nunca se modifica). La casilla del registro enlaza a los textos de la web; lo que se registra es lo publicado en el Hub: **deben ser idénticos**.

**Pregunta:** ¿alcanza esta constancia como prueba de aceptación, y se debe pedir una nueva aceptación cada vez que cambia una versión (hoy el perfil muestra «Update» pero no bloquea el uso)?

---

## Qué se le puede mostrar a Legal

- Los textos de arriba (ya en `lib/i18n/locales/en.json` y `es.json`: `deleteAccount.*`, `setup.identity.*`, `setup.terms.*`, `report.*`).
- El video de demostración que se le envía a Apple (flujo completo, incluida la videollamada).
- La configuración de retención de Didit y el documento `plataforma/borrado-de-cuenta.md` del repo de análisis.
- La política y los términos publicados en la web.
