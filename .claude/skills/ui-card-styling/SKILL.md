---
name: ui-card-styling
description: >
  Convenciones visuales de la app móvil (NativeWind): títulos de pantalla, badges,
  cards, sombras, botones con degradé, inputs y bloques de info. Usá esta skill
  SIEMPRE que crees o ajustes la apariencia de una vista: cards, tarjetas,
  botones, badges, pastillas, sombras, degradés/gradientes, encabezados, títulos,
  inputs/campos de formulario, o cuando el pedido mencione estilo, diseño,
  maquetar, "que se vea mejor", espaciado, márgenes o colores.
---

# Convenciones de estilo (NativeWind)

La app usa **NativeWind** (clases Tailwind sobre componentes RN). Componentes base
en `components/ui/`. Estas son las convenciones consistentes en toda la app — usalas
para que las vistas nuevas coincidan con las existentes.

## Títulos y encabezados de pantalla

- **Título principal**: `text-3xl` (30px) + `text-gray-900` (#111827) +
  `font-outfit-medium`. Estándar para todos los títulos primarios salvo que el
  diseño lo sobreescriba.
- **Section badge** (pastilla arriba del título): pill con fondo `#E9F1FF`, un punto
  `#0047AB` y texto `text-blue-600 font-outfit-semibold text-xs tracking-widest`,
  en MAYÚSCULAS.
  ```tsx
  <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">TÍTULO</Text>
  </View>
  ```

## Sombra estándar de cards

```tsx
style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}
```

**Importante (iOS):** si el card hijo tiene `overflow-hidden` + esquinas
redondeadas, la sombra en el wrapper se ve como un rectángulo con esquinas que
sobresalen. Para arreglarlo, el wrapper de la sombra debe tener el **mismo
`borderRadius`** y un **`backgroundColor`** que llene las esquinas. No pongas doble
margen si el card ya trae su propio `mb-*`.

## Botones con degradé

Botón primario azul (el más usado):

```tsx
<LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
  style={{ borderRadius: 10, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
  <Text className="text-white font-outfit-bold text-center">Continue</Text>
</LinearGradient>
```

- **Aceptar (verde)**: `colors={['#10B981', '#047857']}`, misma dirección.
- **Deshabilitado**: bajar `opacity` a ~0.6 y usar colores apagados.
- **Split Back/Acción**: fila con `flex: 0.3` (secundario/Back, outline o gris
  `#F3F4F6`) + `flex: 0.7` (primario con degradé). El botón primario va a la
  izquierda cuando es la acción principal de la vista.
- No metas iconos `>` / chevron dentro de los botones salvo que se pida.

## Inputs

El componente `components/ui/Input.tsx` tiene **altura fija 52** y **fontSize 17**,
texto centrado verticalmente (`textAlignVertical: 'center'`). Los dropdowns/selects
que imiten un input deben usar `height: 52` y texto `text-[17px]` para alinear.

## Bloque de info dentro de un card

Fondo `#F4F8FF`, con divisor interno `#E1EAFB` cuando hay filas separadas
(ej: vehículo/problema arriba, dirección abajo).

## Badges de estado (ej. URGENT)

```tsx
<View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
  <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: '#EF4444' }}>URGENT</Text>
</View>
```

Para badges sobre fondo de color (ej. card azul), un borde suave
`borderColor: 'rgba(255,255,255,0.3)'` ayuda a definirlo.

## Fondo de vistas

Color de fondo del cuerpo de las vistas: `#F4F6FC` (o `#F6F8FC` en pantallas más
viejas — preferí `#F4F6FC` para vistas nuevas).

## Listas con header/footer scrolleable

Cuando el badge/título/subtítulo deben scrollear con el contenido, poné esos
elementos en `ListHeaderComponent` del `FlatList` (no fijos arriba). Para intercalar
secciones, usá el patrón `ListHeaderComponent` → `data` → `ListFooterComponent`.
