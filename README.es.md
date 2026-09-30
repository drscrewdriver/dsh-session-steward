# dsh-session-steward (Session Steward)

- [中文 README](./README.md)
- [English README](./README.en.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Français README](./README.fr.md)
- [Deutsch README](./README.de.md)
- [Italiano README](./README.it.md)
- [Русский README](./README.ru.md)
- [Español README](./README.es.md)

Plugin web de DSH para **archivos de historial de sesiones + controles de salud de sesiones**.

> **Esta versión (0.5.0) toma la línea DSH 0.2.0 como línea principal** (peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, dist-tag npm `dsh-0.2.0`, rama `compat/0.2.0`).
> La línea DSH 0.1.7 sigue siendo atendida por 0.4.8 (dist-tag `dsh-0.1.7`, rama `compat/0.1.7`) y ya no evoluciona junto con esta línea.
> Las superficies del host que consume este plugin (formato de sesión V4 y las listas de productores first-party de `dsh-session-format-v3-to-v4`, las exportaciones de decodificación de `dsh-session`, el contrato del directorio de archivos `session.jsonl.zstd`/`session.v3.jsonl.zstd` en doble ejemplar + `storages/session_projcache` + las dos listas de id de `workspace.json`) fueron verificadas punto por punto: en 0.2.0-rc.1 están **sin cambios, cero modificaciones de código**; esta versión es una adaptación de puros metadatos (cambio de generación de peer/engines, devDependencies fijadas con exactitud en `0.2.0-rc.1`, disciplina de publicación actualizada junto con la versión).

- **Residencia (archivos de historial)**: explorar el conjunto oficial de archivos, con dos operaciones **independientes** —
  **quitar el estado de archivado** (solo modifica el arreglo, reversible) y **purgar los archivos de archivado** (borra de verdad las entidades en disco, irreversible).

> **Las dos operaciones no son intercambiables y no pueden fusionarse**:
>
> | | Quitar el estado de archivado | Purgar los archivos de archivado |
> |---|---|---|
> | Ruta | `session-history-prune` | `session-history-purge` |
> | Qué se modifica | solo `global.archivedSessionIds` | borra las entidades en disco + modifica el arreglo de archivado + modifica la tabla de miembros de los espacios de trabajo |
> | Destino de la sesión | vuelve al espacio de trabajo original de la barra lateral | desaparece del mundo |
> | Reversible | ✅ | ❌ |
>
> **La purga conlleva necesariamente quitar el estado de archivado** — de lo contrario quedarían id zombis «invisibles en la barra lateral que, en cuanto se les quita el archivado, se convierten en una sesión vacía».
> El tamaño se muestra **por línea** (comprobado en la práctica: una sola entrada puede ir de 0 a 23 MB), y el botón muestra el subtotal de la selección.
>
> **Dos restricciones estrictas** (cúmplalas, o la operación habrá sido en vano):
> 1. **La lista y la escritura tienen la misma fuente** — ambas reconocen el archivo de almacenamiento `~/.dsh/storages/workspace.json`. El `workspaceRegistry` en memoria del host es una instantánea tomada al arrancar: escribir en el archivo no lo actualiza; solo sirve como superficie de diagnóstico para «ya salió del archivo, sigue vigente en este proceso» (`pendingRestart`).
> 2. **Reinicie DSH inmediatamente después de la operación** — la capa de almacenamiento reescribe todo el documento y da prioridad a la memoria: antes de que el host termine, **cualquier** cambio de archivado o de espacio de trabajo reescribe el estado antiguo por completo, anulando la operación recién hecha.
- **Chequeo (control de salud / médico de sesiones)**: chequeo de cuatro puertas → receta (lista de comandos) → alta (intervención reversible + comparación antes/después).

> Frontera de nombres: **este paquete no ofrece búsqueda ni indexación**. La búsqueda/la indexación independiente pertenecen a otro territorio (`dsh-search-index`); ninguna de las dos partes usa los términos de subdominio de la otra, ni interpreta los campos de la otra.

## Vista previa de la interfaz

Una entrada **«Session Steward»** aparece al final de la barra lateral, junto a Búsqueda y Ajustes:

![Entrada de la barra lateral](assets/left-sidebar.png)

**Residencia (archivos de historial)** — panorama del conjunto oficial de archivos; cada línea muestra su tamaño y el estado de la entidad en disco; marque líneas para quitar el archivado o purgar:

![Residencia (estado todo recogido)](assets/archive.png)

**Chequeo** — el punto de entrada del chequeo de cuatro puertas, que termina en una receta reversible:

![Chequeo](assets/doctor.png)

## Instalación

```bash
dsh plugin --profile web add dsh-session-steward
# o un directorio de desarrollo local
dsh plugin --profile web add "link:E:/test/rewrite-agently/mine-dsh-plugins/dsh-session-steward"
```

Después de instalar, **hay que reiniciar el proceso anfitrión** (refrescar la página no basta).

## Contrato de rutas

Prefijo `/session-steward/api`, nombres de método siempre `session-*` (**nunca** mezclarlos con los `index-*` del índice de búsqueda);
un método no reconocido devuelve un error explícito, nunca un silencio.

| Método | Subdominio | Función |
|---|---|---|
| `session-history-list` | history | listar el conjunto de archivos (prioridad del archivo de almacenamiento; con fuente, degradación, tamaño por línea y anotación `pendingRestart`) |
| `session-history-prune` | history | **quitar el estado de archivado**: retirar id del arreglo de archivado en lote (copia de seguridad automática, se requiere reinicio) |
| `session-history-purge` | history | **purgar los archivos de archivado**: borrar de verdad el directorio de transcripciones + la caché de proyección + las dos listas de id (**irreversible**) |
| `session-health-status` | health | estado de los interruptores y tabla de métodos (para el sondeo del panel) |
| `session-health-scan` | health | chequeo por lotes (por defecto devuelve solo las sesiones no ok) |
| `session-health-session` | health | informe de cuatro puertas de una sola sesión + receta |
| `session-health-repair` | health | intervención reversible (cuarentena del registro de la caché de proyección) + antes/después |

Espacio de nombres de ajustes: `session-steward`; id de la entrada de la barra lateral: `dsh-session-steward`.

## Los dos interruptores (feature gates)

| Interruptor | Campo | Efecto al desactivar |
|---|---|---|
| Archivos de historial de sesiones | `historyFiles` (true por defecto) | `session-history-*` no se registra, la pestaña «Residencia» no se renderiza |
| Control de salud | `healthCheck` (true por defecto) | `session-health-*` no se registra, la pestaña «Chequeo» no se renderiza |

Al desactivarse, el método correspondiente devuelve `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — **sin caparazones vacíos**.

## El chequeo de cuatro puertas

| gate | Criterio | level |
|---|---|---|
| `log-integrity` | escaneo multitudinario (multi-frame) de zstd → despliegue de la procedencia → desempaquetado de las líneas empaquetadas; seq continuos, sin tramo final desgarrado | `fail` si hay problemas de lectura; `warn` si solo hay un tramo final desgarrado |
| `projection-cache` | retraso del `minSeq` de `~/.dsh/storages/session_projcache/sessions/<id>.json` respecto al último seq del registro + campos no liquidados (openStep / activeStep.active / pendingTurnStart / turnBoundary=start) | `fail` si hay retraso y no liquidado; `warn` si solo uno de los dos |
| `lossless-json` | juicio línea a línea del JSON sin pérdidas mediante el `sessionProjections.checkpoint(session)` en caliente (undefined / números no finitos / -0 / huecos dispersos / prototipo no ordinario / funciones·Symbol·BigInt / ciclos) | `fail` al encontrar alguno, con la clave de proyección → paquete responsable |
| `cold-read` | motivo del último `turn/end`, existencia de un open step sin cerrar, y si tras el último mensaje user hay salida del assistant | `fail` si hay open step; `warn` si interrupted/ausencia de turn/end |

**La receta** solo propone tres cosas reversibles: ① poner en cuarentena el registro dañado de la caché de proyección (primero la copia de seguridad) ② si quedan step sin liquidar, recordar que hay que esperar a que el host los liquide ③ producir una lista de comandos ejecutables.
**Prohibido**: reescribir los registros de sesión, modificar datos históricos, descartar campos en silencio.

## El único contrato con `dsh-search-index`

Formato del archivo de archivado (`global.archivedSessionIds` de `~/.dsh/storages/workspace.json`):
**este plugin escribe, el índice de búsqueda solo lee**. Descripción del formato en
`dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`.

## Desarrollo

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/client.js
```

## Licencia

MIT
