# BIOSFERA — El cuaderno del naturalista

**Simulación de vida con economía termodinámica según el modelo triádico (materia, energía y voluntad).**

Implementación completa y jugable del **Proyecto 9 «BIOSFERA»** del documento *«Aplicaciones del modelo triádico de la existencia a la programación, la inteligencia artificial y los videojuegos»* (cap. 6, §6.2), sobre la tesis *«Materia, Energía y Voluntad: hacia una teoría unificada de la realidad»* de F. A. Ragazzon Gallo (2026).

Todo el juego se ejecuta **en tu navegador, en local, sin servidor, sin conexión y sin dependencias externas**: HTML + CSS + JavaScript puro, gráficos y sonido 100% procedurales.

---

## Cómo ejecutarlo

1. Descomprime (si procede) la carpeta `biosfera/`.
2. Haz doble clic en **`index.html`** (o ábrelo con Chrome, Edge o Firefox).
3. Pulsa **«Recibir la reserva»**. Listo.

> Si tu navegador bloquea el guardado automático (`localStorage` en modo `file://`), el juego seguirá funcionando y podrás exportar la partida a un archivo `.json` desde el menú (Esc → Exportar) e importarla cuando quieras.

No hay instalación, no hay compilación, no hay llamadas a la red.

---

## Controles

| Acción | Control |
| --- | --- |
| Mover la cámara | Arrastrar con el ratón · `W A S D` / flechas |
| Zoom | Rueda del ratón |
| Pausa / reanudar | `Espacio` |
| Velocidad | `1` · `3` · `8` |
| Herramientas | `Z` observar · `X` sembrar · `C` regar · `V` micelio · `B` comedero · `N` bautizar · `P` fotografiar |
| Cuaderno de campo | `R` |
| Códice | `K` |
| Seguir a la criatura seleccionada | `F` |
| Carta de honestidad | `H` |
| Menú / cerrar paneles | `Esc` |
| Saltar en el mapa | Clic en el minimapa |

---

## El papel del jugador: naturalista, no dios

No puedes dar órdenes a las criaturas. **Observas, documentas y cultivas**:

- **Observar** (lupa): selecciona una criatura y abre su **ficha de campo** viva: grados triádicos M/E/V, región del cubo booleano, estado de sus tres capas, presupuesto de energía, expectativa (placebo/nocebo), índice de agencia 0–12 con sus cuatro indicadores, síndromes, linaje y biografía.
- **Cultivar** con recursos limitados y honestos: **sembrar** pasto, **regar**, inocular **micelio** (recicla residuo en fertilidad) y colocar **comederos** que las criaturas descubren por curiosidad.
- **Documentar**: renombra (bautiza) criaturas, escribe notas de campo, toma **fotografías** y completa el cuaderno de hitos. La progresión es documental: no hay puntuación.

---

## El modelo triádico aplicado (con etiquetas de honestidad)

Cada mecánica traza su origen. `[D]` = derivación directa de la tesis · `[P]` = propuesta propia · `[F]` = fuente externa.

| Sistema del juego | Origen |
| --- | --- |
| Cubo booleano de 8 celdas, 7 regiones, grados difusos M/E/V | `[D]` tesis, cap. 5 |
| Tres capas de la voluntad: automática, de valoración, reflexiva | `[D]` tesis, cap. 7 (tabla 7.1) |
| Economía termodinámica unificada y orden de degradación (30% / 10%) | `[D]` doc. de aplicaciones, §3.8 |
| Veto deliberativo (incluido el veto terminal «el último trago») | `[D]` doc., §5.2 (AGNES) |
| Índice de agencia 0–12 con los 4 indicadores | `[D]` tesis, cap. 3 + apéndice A |
| Síndromes del vacío: agotamiento, alienación, depresión funcional | `[D]` tesis, §12.7 |
| Placebo/nocebo: `eficiencia = capacidad × (0,75 + 0,5 × expectativa)` | `[D]` doc., §6.6 |
| Muerte con legado: cuerpo → biomasa y residuo; genoma + doctrina en las crías | `[D]` GDD, pilar 4 |
| Rol naturalista sin mando | `[D]` GDD, pilar 2 |
| Ecología: luz estacional de período 200, residuo y micelio (importar orden / exportar desorden) | `[D]` GDD, pilares 1 y 3 |
| Predicciones P-B1…P-B4 vigiladas en vivo en el cuaderno | `[D]` GDD |
| Umbrales y constantes concretas de calibración | `[P]` |
| Brújula triádica de la reserva | `[D→P]` adaptación del cap. 13 de la tesis |

**Límite declarado** `[D]`: nada de este juego valida las regiones 3 y 6 del modelo ni ninguna afirmación metafísica. Las criaturas son región 7 *funcional (artificial)*: agencia completa, experiencia nula. Las simulaciones demuestran fertilidad de diseño, jamás verdad ontológica. La **carta de honestidad** está integrada en la interfaz (tecla `H`), como exige el GDD.

---

## Novedades de la versión 1.2

- **Pareja fundadora de cazadores**: la reserva se siembra con **dos** carnívoros (macho y hembra del mismo linaje, adultos, con territorio propio lejos del rebaño) en lugar de uno solo — con un único fundador jamás había segunda generación. Crían en su primera temporada y sostienen una pequeña familia (tope territorial: 4).
- **Rebaño reproductor**: la siembra forrajera sube a 20 y llega como población mayormente adulta, para que presas y depredadores coexistan: la pareja caza, el rebaño se reproduce, y el auge-quiebre estacional queda intacto.
- **El agua no se pisa — jamás**: corregida la rama de movimiento que dejaba a las criaturas entrar en tiles bloqueados (caminar sobre el agua o la roca). Ahora solo existe el deslizamiento costero, y las crías nacen siempre en tile libre.
- **Las criaturas aprenden del bloqueo** (región 2 del diagrama: «si el camino se bloquea, prueba otra vía»): si una meta no se alcanza porque el agua cierra el paso, la criatura la marca como fallida durante ~75 s y elige otra; la doctrina de esa zona pierde valor y **se hereda a las crías**. Sin mapa global, sin A*: pura experiencia local, imperfecta y caduca, como manda el modelo.
- **La meta de agua es la orilla** (tile caminable con agua adyacente), no el centro del lago: se bebe desde la orilla y la meta más próxima casi siempre está en el propio lado de la criatura. La migración por gradiente de humedad solo huele tierra pisable.
- **Reflejo de hambre cazador**: con el presupuesto crítico, la capa automática de los carnívoros toma el mando (caza o carroña desesperada), igual que hacía el pasto desesperado de los forrajeros — antes el cazador se quedaba inmóvil y moría de pie junto a las presas.
- **Reconocimiento filial**: un cazador no devora a sus propias crías (las ajenas siguen siendo presa legítima), y las crías de cazador huelen la carroña más lejos para sobrevivir a la infancia.
- **Caza dirigida por el hambre**: se eliminó el incentivo constante de cazar — cazar lleno desperdicia la presa y talaba el rebaño. El estancamiento ahora se mide contra la velocidad propia de cada criatura (caminar despacio hacia la meta sí es progreso).

---

## Novedades de la versión 1.1

- **Ficha de campo**: la biografía y el panel ya conservan su posición de lectura al refrescarse (antes el scroll volvía arriba cada medio segundo); renombrar ya no se interrumpe por el refresco.
- **Animaciones de comer y beber**: la cabeza baja hasta la hierba o el agua con cada bocado, mandíbula al masticar, lengüetazo al beber, ojos entornados de gusto, migas que saltan, gotas y ondulaciones en el punto exacto de la boca.
- **Crecimiento de cría a adulto**: las criaturas nacen pequeñas (30 % de su tamaño) y crecen de forma continua y visible hasta su tamaño definitivo al madurar; al hacerse adultas se anota en su biografía y despiden un pequeño destello. La economía interna no cambia: el equilibrio ecológico de la reserva es exactamente el de la versión 1.0.

---

## Estructura del proyecto

```
biosfera/
├── index.html            · Página única: lienzo, HUD, paneles, intro
├── css/
│   └── biosfera.css      · Sistema de diseño completo
├── js/
│   ├── config.js         · Constantes y calibración
│   ├── util.js           · RNG con semilla, ruido fBm, bus de eventos
│   ├── audio.js          · Sonido procedural (WebAudio, sin assets)
│   ├── triadico.js       · Núcleo del modelo: regiones, agencia, honestidad
│   ├── genoma.js         · Genes, herencia con mutación, doctrina (memoria heredable)
│   ├── mundo.js          · Terreno, lagos, ecología, luz estacional, clima
│   ├── criatura.js       · Las tres capas, economía, veto, síndromes, muerte con legado
│   ├── poblacion.js      · Rejilla espacial, caza, cortejo, estadísticas
│   ├── registro.js       · Fichas, hitos, crónica, series, predicciones P-B
│   ├── render.js         · Cámara, cache de tiles, minimapa, fotografía
│   ├── render-criaturas.js · Dibujo procedural y animado de las criaturas
│   ├── render-efectos.js · Partículas, iluminación día/noche, clima
│   ├── ui.js             · HUD, herramientas, toasts, modales, menú, intro
│   ├── ui-paneles.js     · Inspector de fichas y cajón del cuaderno
│   ├── juego.js          · Bucle principal, entrada, guardado/exportación
│   └── main.js           · Arranque y captura de errores
└── README.md
```

---

## Solución de problemas

- **No abre nada**: activa JavaScript en el navegador.
- **No se oye**: el navegador exige un clic antes de iniciar el audio; pulsa cualquier parte de la pantalla de inicio. Revisa el volumen en Ajustes.
- **El guardado no funciona**: algunos navegadores restringen `localStorage` en `file://`. Usa **Exportar/Importar** partida (menú con `Esc`).
- **Rendimiento lento**: juega con la velocidad 3×/8× en lugar de muchas pestañas; el juego está optimizado para ~140 criaturas.
- **Quiero empezar de nuevo**: `Esc` → «Nueva reserva (semilla nueva)». Puedes anotar una semilla en la pantalla de inicio para compartir mundos idénticos.

---

**Créditos**: Implementación del Proyecto 9 (BIOSFERA) del programa de aplicaciones del modelo triádico — tesis base y documento de aplicación de F. A. Ragazzon Gallo (2026). Desarrollo: juego original en HTML/CSS/JS. «Simplifica sin mentir.»
