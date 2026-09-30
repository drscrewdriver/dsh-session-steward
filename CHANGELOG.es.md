# Registro de cambios

- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

## 0.5.0

### Adaptación — línea DSH 0.2.0 (rama compat/0.2.0, adaptación de puros metadatos, cero modificaciones de código)

- **Cambio de generación del host**: los 5 peer (dsh-client-locale / dsh-client-ui-settings / dsh-client-ui-settings-general /
  dsh-client-ui-slots / dsh-session) y los dos `engines.dsh` (package.json + dsh.plugin.json) se cambian a la vez a
  `>=0.2.0-rc.1 <0.2.1-0` (ventana rc bloqueada, nueva adaptación a partir de 0.2.1); dist-tag npm `dsh-0.2.0`.
- **Prueba del cero código** (los tres puntos de acoplamiento duro verificados uno a uno contra el paquete real y los fuentes del host 0.2.0-rc.1):
  1. las dos listas first-party de `dsh-session-format-v3-to-v4@0.2.0-rc.1` (`RENAMED_PRODUCERS` 5 entradas +
     `RELEASED_SAME_NAME_PRODUCERS` 25 entradas) coinciden **entrada por entrada** con la transcripción literal de este repositorio;
  2. superficie de exportación de `dsh-session@0.2.0-rc.1`: `decodeSeqRanges` sigue ahí; `decodeStorageRecord`
     **no se exporta** ni en 0.1.7-rc.2 ni en 0.2.0-rc.1 (la guardia de carga suave la trata como superficie opcional y cae en la implementación local equivalente, comportamiento idéntico en las dos líneas);
  3. el contrato del directorio de archivos no cambió: el esquema de nombres doble `session.jsonl.zstd`/`session.v3.jsonl.zstd` pasa por la misma función en ambas líneas,
     y las dos listas de id — `storages/session_projcache` y `workspace.json` (`global.archivedSessionIds` +
     `tables.workspaces.*.sessionIds`) — siguen ambas en su sitio.
- **devDependencies**: `dsh-client-ui-slots` / `dsh-session` sin caret, fijadas con exactitud en `0.2.0-rc.1`
  (a propósito no se persigue rc.2, alineación con la línea base del host 4878cdabd8; la ganancia es que vitest/la carga suave en tiempo de ejecución resuelven los paquetes reales 0.2.0).
- **Refresco del árbol de dependencias**: node_modules y package-lock.json eliminados y regenerados en un commit aparte; eliminados el
  pnpm-lock.yaml obsoleto (fijado a la línea 0.1.0-rc.8) y el pnpm-workspace.yaml, unificación en la única línea npm.
- **Versión y disciplina de publicación**: 0.4.8 → **0.5.0**; dsh.plugin.json version 0.4.1 → 0.5.0 (curada la deriva de la línea base);
  `publishConfig.tag` → `dsh-0.2.0`; `release:015` renombrado `release:020` (`--tag dsh-0.2.0`);
  el texto bilingüe «línea dedicada 0.1.5» de la descripción actualizado junto con la versión.
- Verificación: install / build / typecheck / test todos en verde (167 pruebas), `npm ls` sin conflictos de peer, en node_modules
  quedan instalados dsh-session / dsh-client-ui-slots en 0.2.0-rc.1 ambos.

## 0.4.8

### Corrección — ST1: la transcripción divergía del host en los nombres de los productores first-party

- `migrateSessionSourceKind` consulta línea a línea `isFirstPartyLegacyProducer` (las dos tablas transcritas literalmente del
  host `dsh-session-format-v3-to-v4@0.1.7-rc.2`, lib/index.js:51-84, constatados 5+25=**30** nombres first-party);
  al haber coincidencia, la línea se salta y se informa honestamente vía `skippedFirstParty` — los nombres first-party siguen la tabla de renombrado del host / el kind desnudo homónimo
  (incluida la rama sensible al rol); un prefijo incondicional escribiría un kind que el host nunca produce, corrompiendo en silencio la atribución.
  Si solo quedan líneas antiguas first-party no se escribe en disco. Añadidas 30 pruebas de cotejo de nombres y aserciones de relectura con el decodificador oficial del host (161 pruebas en verde).

### Endurecimiento — R2: el lado de la purga reconoce las copias de seguridad firmadas de la transcripción

- Las dos vías — estadística del archivo y purga — reconocen las copias de seguridad `*.pre-sourcemigrate-<ts>` (la constante del sufijo
  `SOURCE_MIGRATE_BACKUP_SUFFIX` se había exportado ya en 0.4.7, esta vez se cablea):
  - **Estadística**: `locateSessionUsage` / `session-history-list` añaden por línea `backupBytes` /
    `backupCount` — la copia de seguridad es un subconjunto de `bytes`, se lista aparte para que no se lea por error como volumen de registro;
  - **Purga**: el resultado de `session-history-purge` añade `backupsRemoved` (borrar el directorio entero se lleva de todos modos
    las copias de seguridad; contar su gestión hace que «copias tratadas junto con todo» se informe honestamente, ya no es una caja negra).
- Añadidas 6 regresiones (juicio del sufijo, lista aparte en la estadística, cero honesto, informe de la purga, tratamiento conjunto, arrastre en el listado), 167 pruebas en total.

## 0.4.7

### Nuevo — puerta del chequeo sobre el formato de la firma del plugin (source-kind) y transcripción de las firmas antiguas

- **Contexto**: desde el host 0.1.7-rc.1 (formato de sesión v4) se rechaza la firma desnuda `source: { kind: 'plugin', plugin }`
  (SessionFormatError, el turno entero falla); los plugins no adaptados fuera de genui (session-guard, prime-memory, etc.)
  ya corrigieron sus rutas de escritura según la lista, pero las líneas de firma antiguas que escribieron siguen en los registros existentes — el juicio de relectura de los plugins no adaptados no coincidirá.
- **Detección (solo lectura)**: el chequeo gana una sexta puerta `source-kind`, que se divide en líneas según la generación de formato de la cabecera del registro:
  - **tabla de dependencia de versiones** (ver el comentario de cabecera de `src/host/health/source-kind.ts`): las líneas antiguas de las líneas tempranas v1/v2 (no verificadas) y
    v3 (época 0.1.6, por verificar) son legales, no se tocan (de ello responde la migración v3→v4 del host); **v4 (≥0.1.7-rc.1) rechaza
    las firmas antiguas**, cada constatación da un warn.
  - las líneas de versión anteriores a v4 se registran como ok sin subir el nivel — no se tratan, por encima de sus competencias, datos que caen dentro del contrato de migración del host (protección contra el exceso).
- **Transcripción (activación explícita)**: nueva API `session-health-source-migrate` y botón «Transcribir firmas antiguas» del panel de chequeo
  (aparece solo cuando la puerta source-kind está en warn). Reescribe `{ kind: 'plugin', plugin: N }` como
  `{ kind: 'plugin:N' }` (se elimina el campo plugin), todos los demás bytes quedan tal cual.
- **Tres esclusas en la línea roja**: solo se toca el campo de la firma source; antes del cambio se copia de seguridad el archivo entero (`*.pre-sourcemigrate-<ts>`, posible vuelta atrás);
  se rechaza la ejecución si la integridad no llega (tramo final desgarrado/fallo de decodificación/hueco de seq) o si header.version < 4. Es
  la única excepción explícita a la línea roja «prohibido reescribir los registros de sesión», disparada por el usuario sesión a sesión.
- genui está fuera de nuestro control: este plugin no transcribe por él ni lo hará (tras la transcripción de sus líneas históricas, que su propio juicio de relectura coincida o no es asunto suyo).

## 0.1.0-alpha.6

### Corrección — distancia icono/texto apretada; en columna estrecha ya no aplasta al vecino

- **Distancia 8px → 4px**: el hueco entre `🧭` y «Session Steward» se apretó según mediciones reales (comentario del usuario: «reducir un poco el intervalo icono-texto»).
  Al mismo tiempo, su propio padding pasa de `0 12px 0 10px` a `0 10px 0 8px`, igualado con el padding izquierdo/derecho de la cápsula «Búsqueda» vecina.
- **Se encoge él solo y ya no aplasta a los vecinos**: `.dss_entryWrap` pasa de `flex:none` a `flex:0 1 auto; min-width:0`,
  margen exterior delantero de `8px → 6px`. Antes nunca cedía; el déficit caía entero en la cápsula de búsqueda, cuya etiqueta quedaba aplastada hasta un solo carácter;
  ahora, cuando falta espacio, él asume primero (etiqueta terminada en puntos suspensivos).
- **Tamaño del carril de vuelta a 28×28**: la content box del carril mide solo 36px (carril de 56px − 2×10px de padding); dos entradas en la misma línea
  no caben en dos cajas de control de 36px (medido: 36+28=64px, desbordamiento de 14px). Se toman 28+28=56px,
  más estrecho que los 32+28=60px de antes del cambio.
- **La frontera de cooperación no cambió**: como siempre, solo se toca el CSS propio, no se referencia ningún valor del índice de búsqueda
  ni se supone si está instalado; con ambos instalados, la anchura natural de la línea es 217px; en solitario, cada uno ocupa toda la línea.

## 0.1.0-alpha.5

### Cambio — la entrada de la barra lateral lleva texto y se adapta en la misma línea que el «índice de búsqueda»

- **La entrada tiene nombre**: la entrada del pie era antes un solo botón redondo de icono 28×28 (🧭), sin texto, imposible de saber qué abre.
  En columna ancha pasa a ser un control de línea de 42px: **🧭 Session Steward**, misma altura, mismo redondeo (12px) y mismo tamaño de letra que la cápsula «Búsqueda» vecina.
- **Cooperación geométrica en la misma línea**: tras declarar la entrada de búsqueda `flex:1;min-width:0`, ya no ocupa la línea entera; las dos entradas conviven
  como hermanos dentro de `sidebar.footer.action`; nuestra entrada añade `margin-left:8px` en columna ancha para dejar el espacio
  (a cotejo con el `.triggerRow{gap:8px}` oficial de `ui-settings-general`). Este plugin no sabe si el otro existe y no referencia ninguno de sus valores —
  la cooperación ocurre solo en los CSS respectivos.
- **Degradación del carril recogido**: con `wide=false` el botón pasa por `.dss_footerEntryRail` (redondo 36×36, sin texto), conforme a la especificación del carril de Figma
  (carril 56px / padding 10px / caja de control 36×36) y a los controles de carril oficiales; el texto aparece en las mismas condiciones que en columna ancha.
- **Corregida la atribución del texto**: el repliegue codificado a fuego `'会话管家'` en el componente se eliminó; el texto de la entrada y el título del panel salen de la misma fuente (clave de diccionario `panel.title`),
  el diccionario sigue siendo el único origen.

### Cambio — un verbo dividido en dos: «quitar el estado de archivado» y «purgar los archivos de archivado»

**El problema no era la palabra, sino la semántica.** Antes el panel tenía una sola operación, pero el botón se llamaba «Eliminar selección» —
no era una eliminación (no quitó ni un byte) y no hacía una sola cosa (modificaba el arreglo y proclamaba «eliminar»).
Así, la misma acción se llamaba de tres maneras (eliminar / purgar / quitar), y ni los usuarios ni los implementadores se entendían.

Ahora está dividido en dos operaciones con **ruta independiente, botón independiente, confirmación independiente**:

| | Quitar el estado de archivado | Purgar los archivos de archivado |
|---|---|---|
| Ruta | `session-history-prune` | **`session-history-purge`** (nueva) |
| Qué se modifica | solo `global.archivedSessionIds` | borrado de las entidades en disco **+** cambio de las dos listas de id |
| Archivos en disco | intactos | **desaparecen** |
| Destino de la sesión | vuelve al espacio de trabajo original de la barra lateral | desaparece del mundo |
| Reversible | ✅ surte efecto al reiniciar | ❌ **irreversible** |

«Purgar los archivos de archivado» toca de un golpe 4 lugares:

1. `~/.dsh/sessions/<espacio de trabajo>/<id de sesión>/` — **el directorio entero**. En la práctica, en los 3 directorios coexistían
   `session.jsonl.zstd` y el formato antiguo `session.v3.jsonl.zstd`; borrar solo la copia del formato actual dejaría basura.
2. `~/.dsh/storages/session_projcache/sessions/<id de sesión>.json` — la caché de proyección, entrada por entrada.
   > Atención: existe además un `storages/session_projcache.json` (la disposición entera, 99,4 MB, última escritura detenida en el
   > 09-11): es un **fósil** dejado por la migración de disposición; el host hace tiempo que no lo escribe, y este plugin tampoco lo toca.
   > La caché de proyección viva es `session_projcache/sessions/` (medido: 143,4 MB / 275 entradas, se sigue escribiendo hoy).
3. `workspace.json` → `global.archivedSessionIds`
4. `workspace.json` → `tables.workspaces.*.sessionIds`

**La purga conlleva necesariamente quitar el estado de archivado**: si los archivos se borran y los id siguen en el arreglo, son archivos zombis —
la barra lateral no los ve, y en cuanto se les quita el archivado reaparece una sesión vacía que no se puede abrir.

**El orden de ejecución es «primero modificar los archivos, luego borrar las entidades»**: la modificación de los archivos es atómica y puede abortarse en bloque
(si el archivo de almacenamiento no está disponible, **no se borra ni un byte**); al revés —borrar primero las entidades y modificar después los archivos— un fallo a mitad de camino dejaría id zombis.

**Barandillas de la operación destructiva**:

- sin `dshHome` se rechaza ejecutar directamente — nada de rutas adivinadas;
- antes de borrar, `isSafeChild` afirma que el objetivo es un hijo del **nivel concreto** esperado bajo la raíz prevista
  (un nivel mal escrito y se borra toda la raíz `sessions`);
- cada entrada es independiente; los fallos solo se registran, no se lanzan, con el detalle `failures` listado línea a línea en el panel;
- se sigue usando el único punto de entrada de escritura `editWorkspaceDocument` (copia de seguridad + escritura temporal en el mismo directorio + renombrado atómico).

### Cambio — el tamaño se calcula por «unidad marcada», sin total global

La ocupación de una sola sesión varía muchísimo (medido: una projection-cache de 23,47 MB frente a una transcripción de 0,07 MB;
y también hay casos de 0 bytes). Por eso:

- **cada línea** muestra su propio `transcripción 6,2 MB · caché 2,3 MB`;
- la cabecera del listado muestra `72 entradas en total · 98,6 MB`;
- el botón muestra el **subtotal de la selección**: `Purgar los archivos de archivado (3) · libera 38,2 MB`;
- la ventana de confirmación lista los tamaños entrada por entrada + el total.

### Corrección — el «sin reacción» de la purga de la Residencia: el que leía y el que escribía no usaban los mismos datos

**Síntoma**: en modo edición, marcar sesiones archivadas → `confirm` → aviso de purga con éxito, pero el listado **no se redujo ni una entrada** y
el panel no muestra ningún cambio visible — parece que no surtió ningún efecto.

**Causa raíz**: las dos rutas reconocían cada una su propio conjunto de datos, **sin comunicación entre sí**.

| Ruta | conjunto reconocido |
|---|---|
| `session-history-prune` | `global.archivedSessionIds` del archivo de almacenamiento `~/.dsh/storages/workspace.json` (copia de seguridad + sustitución atómica) |
| `session-history-list` | **primero la memoria del host `workspaceRegistry.archivedSessionIds`** (solo si el archivo no se puede leer, repliegue) |

El `registry` es una instantánea que el host carga **al arrancar**; editar directamente el archivo no se reescribe en él. Consecuencia:

- el archivo enflaquecía de verdad (medido: 166 → 159 → 151 → 103 → 72 → 71, cada confirmación dejaba una copia `.bak-*`);
- pero el listado devolvía siempre los mismos — el usuario marcaba en el mismo orden y cada vez borraba «las primeras entradas del listado»,
  que nunca cambiaba; de ahí la impresión de «confirmé y no pasó nada».

**Remedio**: dar a listado y prune **la misma fuente**.

- `readArchiveSet` pasa a **prioridad del archivo de almacenamiento**, el `registry` retrocede a papel de repliegue cuando el archivo falta;
  el registry sigue leyéndose, pero se devuelve solo como superficie diagnóstica (`registryIds`).
- `session-history-list` añade `pendingRestart`: el número de id que **están** en el registry pero **faltan** en el archivo
  — es decir, las entradas «ya purgadas del archivo, pero aún vigentes en este proceso». El panel muestra en consecuencia un aviso amarillo
  e indica el número total de entradas del listado, para que «una entrada menos» sea verificable a simple vista.
- `pruneHistory` añade una **verificación tras la escritura**: tras reescribir se vuelve a leer el archivo para confirmar que los id objetivo desaparecieron de verdad,
  si no, se informa honestamente del error; nunca más «el panel dice éxito, el archivo en realidad no cambió».

### Riesgo conocido — el host reescribe la instantánea entera de la memoria; la purga puede «resucitarse»

La capa de almacenamiento (`dsh-storage-json`) funciona con **reescritura completa, memoria como prioridad**: cada escritura serializa el estado en memoria
como documento entero sobre el archivo, y no hay un flush aparte al apagar. Así, tras la purga y antes del reinicio,
**cualquier cambio de archivo o de espacio de trabajo reescribe íntegros los `archivedSessionIds` antiguos**, anulando la purga.

No es un fallo de este plugin (el lado oficial no tiene un endpoint unarchive; el archivo es la única superficie escribible),
pero el usuario tiene que saberlo — ya está escrito en la ventana de confirmación y en el aviso de éxito: **tras la purga, reinicie DSH de inmediato**.

## 0.1.0-alpha.4

La tarjeta de ajustes recupera su forma de cajón: antes quedaba solo una línea desnuda, disconforme con los demás plugins en la sección de ajustes «Plugins».

### Correcciones

- **A la tarjeta de ajustes le faltaba el caparazón de cajón (importante)**: la sección de ajustes «Plugins» de DSH (`dsh-client-ui-settings-plugins`)
  hace una sola cosa — reparte `settings.plugin.item` según el espacio de nombres de ajustes:

      renderSlot('settings.plugin.item', {}, { entryKey: ns })

  **No ofrece ningún caparazón**: el título de la tarjeta, la descripción, el desplegar/plegar pertenecen por entero al plugin.
  Este plugin antes solo renderizaba la línea desnuda, de modo que había dos desajustes:
  1. en la sección no coincidía con la forma «cajón plegable» de los demás plugins;
  2. `card.title` (Session Steward) y `card.desc` (archivos de historial · control de salud) estaban **definidos pero jamás renderizados**,
     texto muerto — era exactamente «el punto de cajón que faltaba».

  Ahora la cabecera está restituida (título + descripción + chevron, todo el bloque clicable para conmutar), el cuerpo plegado por defecto,
  igual que las demás tarjetas de la sección; `aria-expanded` refleja sincrónicamente el estado desplegado.
- **Comportamiento cuando el servicio de ajustes no está disponible**: antes toda la tarjeta degradaba a una línea «servicio de ajustes no disponible»
  y con ello **perdía hasta el título**; ahora la cabecera del cajón se renderiza con normalidad y solo en el cuerpo se explica el motivo —
  este plugin ya no desaparece de la sección por completo.

### Cambios

- La conmutación del estado desplegado y la rotación del chevron respetan `prefers-reduced-motion`.

## 0.1.0-alpha.3

Caché de los resultados del chequeo: reabrir el panel muestra el contenido sin demora, y tras una intervención solo se actualiza esa línea.

### Novedades

- **Caché de los resultados del chequeo (en el proceso)**: tras un escaneo completo (por lotes a lo largo de todo el corpus) los resultados quedan en el proceso del host;
  al reabrir el panel la caché se renderiza directamente, sin escaneo completo nuevo. La caché **solo se forma tras recorrer una vez todo el corpus** —
  cerrar el panel a mitad de escaneo no deja medio resultado haciéndose pasar por conclusión completa.
- **`resume` como sonda de pura lectura**: `session-health-scan` acepta `resume: true`, **solo lee la caché, no escanea nada**.
  Al montar el panel sirve para tantear una vez a coste cero: si hay coincidencia aparece el contenido, si no, no se hace nada
  (cargar trabajo pesado al montar era el reproche a la versión anterior). Devuelve además el total actual del corpus.
- **Hora de generación y entrada de refresco**: con coincidencia de caché el panel muestra «resultados de la caché · hace N minutos» y ofrece «Refrescar»
  (escaneo completo forzado). Los resultados viejos jamás se hacen pasar por recién escaneados.
- **Aviso de cambio del corpus**: cuando el total del corpus en caché no coincide con el actual se muestra «el corpus ha cambiado (a → b), se recomienda refrescar».
  Esta conciliación solo enumera directorios, muy barata — así que no constituye una nueva política de invalidación de la caché.

### Cambios

- **Reescritura de la línea en el sitio**: tras el chequeo de una sola sesión y la intervención reversible ya no se depende de un nuevo escaneo —
  la intervención recalcula de todos modos el informe `after`, que se escribe directamente en la caché; cuando el panel vuelve al listado la línea ya está al día
  (la línea curada desaparece de ahora en adelante del listado, en coherencia con «listar solo los problemas»).
- La caché **no se escribe en disco**: caduca al reiniciar DSH. La persistencia exigiría una política de invalidación, y el coste de juzgar la caducidad
  (enumerar el corpus, comparar mtime/size de los registros) roza el nuevo escaneo en sí; este corte elige YAGNI.

### Pruebas

- Añadido `tests/cache.spec.ts` (19 casos): reglas de formación (recorrido incompleto / completo / corpus vacío / interrumpido a medias / `clear`),
  todas las ramas de la reescritura de una sola línea (añadir / sustituir / salir curado / no-op) y el cableado de `handleMethod`
  (`resume` no escanea, coincidencia tras recorrido completo por lotes, `onlyProblems=false` no contamina la caché,
  identidad del objeto reescrito tras la intervención, el runtime sin caché sigue siendo utilizable).

## 0.1.0-alpha.2

Corrección del juicio y de la presentación de la intervención (receta): ya no se receta para las puertas «sin criterio propio», y tras la intervención se da una conclusión explícita.

### Correcciones

- **Receta equivocada para `skipped` (importante)**: `prescribe()` juzgaba con `level !== 'ok'` si la caché de proyección debía ponerse en cuarentena;
  «esta puerta no puede juzgar» contaba entonces como «caché de proyección sin alinear», de modo que contra su propia evidencia recetaba una contradicción
  y sugería poner en cuarentena un registro **inexistente**. Se extrajo el predicado compartido `isActionable()` (solo `warn` / `fail` son tratables) para reunir todo en un punto:
  la vara de medir de `gates.ts` y el criterio de `repair.ts` son desde entonces la misma cosa.
- **Falso «cuatro puertas todas verdes»**: sin puntos tratables la respuesta fija era «cuatro puertas todas verdes». Cuando una puerta está `skipped` (sin criterio, no verde) esa fórmula no se sostiene;
  ahora: «no hay puntos tratables (N puertas sin criterio, no anómalas): <lista de id de puertas>».
- **La anomalía sigue en pantalla tras la intervención, sin poder saber si surtió efecto**: el panel solo renderizaba los dos niveles «antes / después de la intervención»;
  cuando ambos son anómalos, «la intervención falló» y «la intervención no tiene que ver con el foco» son indistinguibles.
  El host estrena `assessRepair({ before, after, repair })`, que dictamina entre cinco niveles con explicación legible:
  `nothing-to-do` (cuatro puertas todas verdes) / `repaired` (restaurado) / `repaired-with-residual` (caché en cuarentena,
  pero quedan anomalías ajenas a esa caché, por ejemplo un open step en el registro de sesión) / `not-applicable` (la anomalía actual no tiene punto reversible que tratar) /
  `failed` (la intervención en sí falló). El panel renderiza la bandera de conclusión con el color del nivel.

### Notas

- **La capacidad de intervención no cambió**: siempre «en cuarentena solo los registros de la caché de proyección, copiar y luego mover, no tocar los registros de sesión»;
  esta vez se corrigen solo el **juicio** y la **presentación**. El escenario típico es «solo la puerta `cold-read` es anómala (la sesión contiene un open step sin liquidar)» —
  tales anomalías ya de antemano no eran cosa que este plugin debía reparar; ahora se dictaminan explícitamente `not-applicable` con su motivo,
  en lugar de aparecer en silencio como «sigue anómalo tras la intervención».

### Pruebas

- Añadido `tests/repair.spec.ts` (12 casos): cubre los cuatro niveles de `isActionable`, que `prescribe` ya no receta en vacío,
  y las ramas del dictamen de cinco niveles de `assessRepair`.

## 0.1.0-alpha.1

Corrección del juicio y de la retroalimentación del panel de chequeo: eliminado el falso positivo masivo de «Atención», añadidos progreso del escaneo y motivos en línea.

### Correcciones

- **Falso positivo masivo de «Atención» (importante)**: las tres puertas `lossless-json` / `projection-cache` / `cold-read` devolvían `warn`
  **cuando no podían juzgar** (sesión fría sin proyección caliente, registro de caché aún sin generar, sin turn/end en el registro),
  de modo que **todas las sesiones no cargadas eran eternamente «Atención»**, ahogando la señal verdadera.
  Se añade el nivel neutro `skipped` (texto del panel «no verificado») para «no hay forma de observar», **fuera de la agregación del veredicto global**.
  Criterio fijado: `warn` = fenómeno anómalo observado (con evidencia); `skipped` = inobservable/sin criterio (sin evidencia).
  Medido: 30 sesiones pasan de «30×Atención» a «26 normales / 3 Atención / 1 anómala».
- **Las líneas del listado no mostraban el motivo del disparo**: el listado de resultados del chequeo solo renderizaba el nivel agregado, líneas indistinguibles entre sí.
  Ahora cada línea lista el resumen de «puerta · nivel» no-ok (por ejemplo `continuidad · atención`), sin tener que abrir cada detalle.

### Novedades

- **Progreso del escaneo del chequeo**: `session-health-scan` acepta `offset` para llamadas por lotes y devuelve `total`;
  el panel encadena lotes pequeños y acumula por sí mismo el **progreso real** (`n/total · Xs empleadas`).
  Hasta que el primer lote da el denominador corre una animación indeterminada. El host sigue sin estado; el bucle de escaneo sincrónico no necesita volverse asincrónico.
- **Retroalimentación de ocupación de la intervención**: el botón de la intervención reversible recibe un spinner y queda deshabilitado, para que la interfaz no se quede quieta tras el clic.

### Cambios

- **Renombrado de la pestaña**: `病案室` → `养老院` (inglés `Records Room` → `Retirement Home`),
  en sintonía con la metáfora «chequeo / receta / alta».

## 0.1.0-alpha.0

Primera versión alpha: Session Steward (archivos de historial + control de salud).

### Novedades

- **Archivos de historial de sesiones (Sala de historiales)**: tomado de `dsh-session-search-toggle` el código de lectura y purga del conjunto oficial de archivos,
  comportamiento equivalente al de antes de la migración (copia de seguridad + escritura temporal en el mismo directorio + sustitución atómica; la purga solo se permite en modo de edición explícito).
  Diferencia: la fuente del listado pasa a ser la **verdad del conjunto oficial de archivos** (prioridad del registry, repliegue al archivo de almacenamiento), porque el índice independiente se fue con el paquete del índice de búsqueda;
  título y demás metadatos al mejor esfuerzo (instantánea del título `sessionQuery` → título de la caché de proyección → vacío).
- **Control de salud (chequeo → receta → alta)**: cuatro puertas testables por separado
  (`log-integrity` / `projection-cache` / `lossless-json` / `cold-read`),
  salida unificada `{ id, level, evidence, attribution, detail }`; agregadas en `SessionHealthReport`.
- **Índice de atribución**: escaneo estático de los `node_modules/<pkg>/lib/*.js` del perfil, para construir «clave de proyección → nombre del paquete»
  y devolver las puertas fallidas al plugin concreto y a la ruta del campo; si no se encuentra, se marca honestamente `unknown`.
- **Receta reversible**: cuarentena de los registros dañados de la caché de proyección (primero la copia de seguridad, luego el traslado a `.quarantine-<ts>`) + lista de comandos.
  **Prohibido** reescribir los registros de sesión, modificar los datos históricos, descartar campos en silencio.
- **Dos feature gates**: `historyFiles` / `healthCheck`; apagado, el subdominio correspondiente no se registra en absoluto (error disabled explícito),
  y el cliente no renderiza la pestaña correspondiente.
- **Rutas**: `/session-steward/api/*`, nombres de método siempre `session-*`, totalmente aislados de los `index-*` de `/switch-search/api` del índice de búsqueda.

### Limitaciones conocidas

- La puerta `lossless-json` depende de que el host exponga `sessionProjections` (estado caliente) para dar un veredicto determinado;
  si no lo consigue, degrada honestamente a `warn`, sin especular.
- El escaneo de salud lista por defecto solo las últimas 30 sesiones no sanas (techo de `limit` en 200), sin recorrido completo de la base por defecto.
- El panel del cliente es una implementación mínima (listado + detalles + botón de tres pasos), sin desplazamiento virtual ni operaciones en masa.
