# Installationsanleitung (offizielle DSH-CLI)

Diese Anleitung verwendet ausschließlich den offiziellen DSH-Befehl `dsh plugin`. Dieser Befehl installiert die Abhängigkeit in ein Profil und synchronisiert `dsh.profile.bundles`. Ersetzen Sie ihn nicht durch ein bloßes `npm install`, ein direktes `pnpm add` im Profil oder manuelle Bearbeitungen des Profil-Manifests.

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

Die Platzhalter in dieser Anleitung sind:

- `<profile>`: das zu ändernde DSH-Profil, üblicherweise `web`;
- `dsh-session-steward`: das npm-Paket und die Laufzeit-Plugin-ID.

> **Unterstützter DSH-Bereich: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> Dies ist der in `engines.dsh` sowohl von `package.json` als auch von `dsh.plugin.json` deklarierte Bereich, und er entspricht der Untergrenze `^0.1.0-rc.6`, die dieses Plugin bereits für seine eigene Abhängigkeit `@deepseek-ai/dsh-client-ui-slots` deklariert. Prüfen Sie die laufende Version vor der Installation mit `dsh --version`.

## 0. Voraussetzungen und Auffinden des Profils

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Verwenden Sie das Profil, das Ihr laufender DSH-Prozess nennt. `web` ist üblich, aber das aktive `--profile`-Argument ist maßgeblich.

## 1. Offizielle Installation

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(der Schalter `-w` ist erforderlich, wenn das Profil die Wurzel eines pnpm-Workspace ist, wie es bei `web` der Fall ist.)

Eine bestimmte Version explizit installieren:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.6 -w
```

Die offizielle CLI aktualisiert automatisch die Profil-Abhängigkeit, die Lockfile und `dsh.profile.bundles`. Fügen Sie keine manuelle YAML-Zeile hinzu.

### Abkühlphase der Lieferkette

Die DSH-Laufzeit verwendet pnpm 11, dessen `minimumReleaseAge`-Richtlinie eine frisch veröffentlichte Version mit `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` blockieren kann. Fügen Sie die Version zu `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` hinzu:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.6
```

## 2. Host neu starten

**Nach der Installation oder dem Upgrade ist ein DSH-Neustart erforderlich.** Das Neuladen der Browserseite genügt nicht: Die Host-Hälfte registriert die Routen `/session-steward/api` und den Einstellungs-Namespace beim Start, und der Host muss die Archivquelle neu laden, damit ein Prune sichtbar wird.

## 3. Upgrade

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

Danach DSH neu starten.

## 4. Registrierung über lokalen Pfad / `link:` (Alternative)

Für Entwicklung oder Offline-Installationen registrieren Sie das Plugin aus einem lokalen Checkout:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Oder verwenden Sie die offizielle CLI mit einem lokalen Pfad (kein Netz nötig):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

Der Bau aus einem Source-Checkout verwendet diese Skripte:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` wird nicht committed, daher muss ein Source-Checkout gebaut werden, bevor er per Pfad registriert werden kann. Die Veröffentlichung baut ihn automatisch über den `prepublishOnly`-Hook.

## 5. Installation überprüfen

Prüfen Sie die Abhängigkeit und die installierte Version:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Prüfen Sie die offizielle Komposition:

```bash
dsh --profile <profile> --dump-default-config
```

Sie muss enthalten:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Das Plugin überprüfen

Nach dem Neustart ist der Seitenleisten-Eintrag `dsh-session-steward` verfügbar, und der Einstellungsbereich verwendet den Namespace `session-steward`. Bestätigen Sie:

1. Beide Tabs werden gerendert — **Seniorenheim** und **Check-up** — solange beide Feature-Gates an sind.
2. Das Abschalten von `historyFiles` entfernt den Tab Seniorenheim und lässt jeden `session-history-*`-Aufruf einen expliziten Deaktivierungsfehler zurückgeben.
3. Das Abschalten von `healthCheck` entfernt den Tab Check-up und lässt jeden `session-health-*`-Aufruf einen expliziten Deaktivierungsfehler zurückgeben.
4. Eine unbekannte Methode auf `/session-steward/api` gibt einen expliziten Fehler zurück, statt stillschweigend Erfolg zu melden.

Geschlossene Domänen geben `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` zurück — das Plugin hinterlässt keine leeren Hüllen.

## 7. Fehlerbehebung

| Symptom | Maßnahme |
| --- | --- |
| `dsh` wird nicht gefunden | Installieren oder aktivieren Sie die offizielle DSH-CLI. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Fügen Sie die Version zu `minimumReleaseAgeExclude` in der `pnpm-workspace.yaml` des Profils hinzu. |
| Tabs oder Routen fehlen nach der Installation | Starten Sie den Host-Prozess neu — ein Seiten-Neuladen registriert die Routen nicht neu. |
| Änderungen am Archivbestand sind nicht sichtbar | Starten Sie den Host neu; die Archivquelle wird beim Start gelesen. |
| `session-history-*` gibt einen Deaktivierungsfehler zurück | Das Feature-Gate `historyFiles` ist aus. Aktivieren Sie es in den Plugin-Einstellungen wieder. |
| `session-health-*` gibt einen Deaktivierungsfehler zurück | Das Feature-Gate `healthCheck` ist aus. Aktivieren Sie es in den Plugin-Einstellungen wieder. |
| Veralteter Client-Bundle nach einem Upgrade | Browser hart neu laden (Ctrl+Shift+R). |

## 8. Entfernen

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

Danach DSH neu starten.

## Entfernen macht Reparaturen nicht rückgängig

Das Plugin schreibt nie Sitzungslogs oder historische Daten um und verwirft nie stillschweigend Felder. Die einzige scheinbar irreversible Aktion, die es ausführt — die Quarantäne eines beschädigten Projektions-Cache-Datensatzes — kopiert vorher eine Sicherung, und das Quarantäne-Verzeichnis bleibt auf der Platte, damit Sie daraus wiederherstellen können. Das Entfernen des Plugins lässt daher jede Quarantäne, die Sie veranlasst haben, an Ort und Stelle; stellen Sie sie manuell wieder her, wenn Sie den Zustand zurück wollen.

## Lizenz

MIT
