# Guía de instalación (CLI oficial de DSH)

Esta guía usa únicamente el comando oficial de DSH `dsh plugin`. Ese comando instala la dependencia en un perfil y sincroniza `dsh.profile.bundles`. No lo sustituya por un `npm install` simple, un `pnpm add` directo en el perfil, ni por ediciones manuales del manifiesto del perfil.

- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Guide d'installation en français](./INSTALL.fr.md)
- [Installationsanleitung auf Deutsch](./INSTALL.de.md)
- [Guida all'installazione in italiano](./INSTALL.it.md)
- [Руководство по установке на русском](./INSTALL.ru.md)
- [Guía de instalación en español](./INSTALL.es.md)
- [中文 README](./README.md)
- [English README](./README.en.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Français README](./README.fr.md)
- [Deutsch README](./README.de.md)
- [Italiano README](./README.it.md)
- [Русский README](./README.ru.md)
- [Español README](./README.es.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

Los marcadores de posición de esta guía son:

- `<profile>`: el perfil DSH que hay que modificar, normalmente `web`;
- `dsh-session-steward`: el paquete npm y el ID del plugin en tiempo de ejecución.

> **Rango de DSH admitido: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> Es el rango declarado en `engines.dsh` tanto de `package.json` como de `dsh.plugin.json`, y coincide con el suelo `^0.1.0-rc.6` que este plugin ya declara para su propia dependencia `@deepseek-ai/dsh-client-ui-slots`. Compruebe la versión en ejecución con `dsh --version` antes de instalar.

## 0. Requisitos previos y descubrimiento del perfil

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Use el perfil que nombra su proceso DSH en ejecución. `web` es lo habitual, pero el argumento `--profile` activo es lo que manda.

## 1. Instalación oficial

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(la bandera `-w` es obligatoria cuando el perfil es la raíz de un workspace de pnpm, como ocurre con `web`.)

Instale una versión concreta de forma explícita:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.6 -w
```

La CLI oficial actualiza automáticamente la dependencia del perfil, el lockfile y `dsh.profile.bundles`. No añada una fila YAML a mano.

### Período de enfriamiento de la cadena de suministro

El runtime de DSH usa pnpm 11, cuya política `minimumReleaseAge` puede bloquear una versión recién publicada con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Añada la versión a `minimumReleaseAgeExclude` en `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.6
```

## 2. Reiniciar el host

**Se requiere un reinicio de DSH tras instalar o actualizar.** Refrescar la página del navegador no basta: la mitad anfitriona registra las rutas `/session-steward/api` y el espacio de nombres de ajustes al arrancar, y el host debe recargar la fuente de archivos para que un prune se refleje.

## 3. Actualización

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

Después, reinicie DSH.

## 4. Registro por ruta local / `link:` (alternativa)

Para desarrollo o instalaciones sin conexión, registre el plugin desde un checkout local:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

O use la CLI oficial con una ruta local (sin necesidad de red):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

La compilación desde un checkout de fuentes usa estos scripts:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` no se commitea, así que un checkout de fuentes debe compilarse antes de poder registrarse por ruta. La publicación lo compila automáticamente mediante el hook `prepublishOnly`.

## 5. Verificar la instalación

Compruebe la dependencia y la versión instalada:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Compruebe la composición oficial:

```bash
dsh --profile <profile> --dump-default-config
```

Debe contener:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Verificar el plugin

Tras el reinicio, la entrada de la barra lateral `dsh-session-steward` está disponible y la sección de ajustes usa el espacio de nombres `session-steward`. Confirme:

1. Ambas pestañas se renderizan — **Residencia** y **Chequeo** — mientras ambos feature gates estén activados.
2. Apagar `historyFiles` elimina la pestaña Residencia y hace que cada llamada `session-history-*` devuelva un error explícito de desactivación.
3. Apagar `healthCheck` elimina la pestaña Chequeo y hace que cada llamada `session-health-*` devuelva un error explícito de desactivación.
4. Un método no reconocido en `/session-steward/api` devuelve un error explícito en lugar de tener éxito en silencio.

Los dominios apagados devuelven `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — el plugin no deja caparazones vacíos.

## 7. Resolución de problemas

| Síntoma | Acción |
| --- | --- |
| No se encuentra `dsh` | Instale o habilite la CLI oficial de DSH. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Añada la versión a `minimumReleaseAgeExclude` en el `pnpm-workspace.yaml` del perfil. |
| Faltan pestañas o rutas tras la instalación | Reinicie el proceso anfitrión — refrescar la página no vuelve a registrar las rutas. |
| No se ven los cambios en el conjunto de archivos | Reinicie el host; la fuente de archivos se lee al arrancar. |
| `session-history-*` devuelve un error de desactivación | El feature gate `historyFiles` está apagado. Reactívelo en los ajustes del plugin. |
| `session-health-*` devuelve un error de desactivación | El feature gate `healthCheck` está apagado. Reactívelo en los ajustes del plugin. |
| Bundle de cliente obsoleto tras una actualización | Refresco forzado del navegador (Ctrl+Shift+R). |

## 8. Desinstalar

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

Después, reinicie DSH.

## La desinstalación no deshace las reparaciones

El plugin nunca reescribe los registros de sesión ni los datos históricos, y nunca descarta campos en silencio. La única acción de apariencia irreversible que emprende — poner en cuarentena un registro dañado de la caché de proyección — copia antes una copia de seguridad, y el directorio de cuarentena queda en el disco para que pueda restaurar desde él. Desinstalar el plugin deja, por tanto, en su sitio cualquier cuarentena que haya solicitado; restáurela manualmente si quiere recuperar el estado.

## Licencia

MIT
