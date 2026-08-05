---
name: add-translation
description: >
  Cómo traducir pantallas y agregar claves de i18n en la app móvil (i18next +
  react-i18next). Usá esta skill SIEMPRE que traduzcas una vista, agregues o
  edites textos con `t()`, toques `lib/i18n/`, los archivos de locales
  `en.json` / `es.json`, o cuando el pedido mencione traducción, traducir,
  idioma, internacionalización, i18n, español/inglés, o "hacer que la vista
  soporte varios idiomas".
---

# Agregar / editar traducciones (i18n)

La app usa **i18next + react-i18next**, inicializado como side-effect import
(`import "@/lib/i18n"` en `app/_layout.tsx`). No hay Provider: `useTranslation()`
lee la instancia global.

## Antes de traducir una pantalla

1. **Revisá claves compartidas existentes** antes de crear nuevas. Varias
   pantallas del wizard repiten el mismo título/badge — buscá primero claves como
   `requestAssistance.header.*` o `requestAssistance.badge.*` para no duplicar.
2. **No asumas que la pantalla ya usa `t()`.** No todas están traducidas. Abrí el
   archivo y verificá si ya importa `useTranslation` antes de empezar.

## Cómo agregar una clave

- Locales: `lib/i18n/locales/en.json` (inglés) y `lib/i18n/locales/es.json` (español).
- **Siempre agregá la clave en AMBOS archivos**, con la misma ruta anidada.
- **Namespacing por pantalla/feature**: `profile`, `dashboard`, `requestAssistance`,
  `appointments`, etc. Poné la clave bajo el namespace que corresponde a la vista.
- En el componente:
  ```tsx
  import { useTranslation } from 'react-i18next';
  const { t } = useTranslation();
  // ...
  <Text>{t('dashboard.user.title')}</Text>
  ```
- Para interpolación usá `{{var}}`: `"mechanicsNotified": "{{count}} mechanics notified"`
  → `t('...mechanicsNotified', { count: 6 })`.

## Editar valores en JSON de forma segura

Para no reformatear todo el archivo (y generar un diff enorme), editá con un
script puntual que preserve el formato:

```bash
python3 -c "
import json, io
for f, path, val in [('lib/i18n/locales/en.json', ['a','b','key'], 'Value'),
                     ('lib/i18n/locales/es.json', ['a','b','key'], 'Valor')]:
    d = json.load(open(f))
    node = d
    for k in path[:-1]: node = node[k]
    node[path[-1]] = val
    with io.open(f,'w',encoding='utf-8') as out:
        json.dump(d, out, ensure_ascii=False, indent=2); out.write('\n')
"
```

Verificá siempre el diff con `git diff --stat` — debería tocar solo la(s) línea(s)
esperada(s).

## Persistencia del idioma

El idioma seleccionado se guarda en AsyncStorage (`app_language`) y se restaura al
iniciar. Se cambia con `setAppLanguage('en' | 'es')` desde `lib/i18n`.

## Dónde mirar

`lib/i18n/`, `lib/i18n/locales/en.json`, `lib/i18n/locales/es.json`,
`app/_layout.tsx` (init).
