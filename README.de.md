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

DSH-Web-Plugin für **Sitzungsverlaufsdateien + Sitzungs-Healthchecks**.

> **Diese Version (0.5.0) macht die DSH-0.2.0-Linie zur Hauptlinie** (peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, npm dist-tag `dsh-0.2.0`, Branch `compat/0.2.0`).
> Die DSH-0.1.7-Linie wird weiterhin von 0.4.8 bedient (dist-tag `dsh-0.1.7`, Branch `compat/0.1.7`) und entwickelt sich nicht mehr mit dieser Linie weiter.
> Die Host-Flächen, die dieses Plugin konsumiert (Sitzungsformat V4 und die First-Party-Produzentenlisten von `dsh-session-format-v3-to-v4`, die Dekodier-Exports von `dsh-session`, der Archivverzeichnis-Vertrag `session.jsonl.zstd`/`session.v3.jsonl.zstd` in doppelter Ausführung + `storages/session_projcache` + die beiden id-Listen in `workspace.json`), wurden in 0.2.0-rc.1 Punkt für Punkt als **unverändert verifiziert — null Codeänderungen**; diese Version ist eine reine Metadaten-Anpassung (Generationswechsel bei peer/engines, devDependencies exakt auf `0.2.0-rc.1` gepinnt, Release-Disziplin versionsbegleitend aktualisiert).

- **Seniorenheim (Verlaufsdateien)**: den offiziellen Archivbestand durchsehen, mit zwei **unabhängigen** Aktionen —
  **Archivstatus aufheben** (ändert nur das Array, reversibel) und **Archivdateien endgültig löschen (Purge)** (löscht die Datenträger-Entitäten wirklich, irreversibel).

> **Die beiden Aktionen sind nicht austauschbar und lassen sich nicht zusammenlegen**:
>
> | | Archivstatus aufheben | Archivdateien löschen (Purge) |
> |---|---|---|
> | Route | `session-history-prune` | `session-history-purge` |
> | Was geändert wird | nur `global.archivedSessionIds` | löscht Datenträger-Entitäten + ändert das Archiv-Array + ändert die Mitglieder-Tabelle der Arbeitsbereiche |
> | Verbleib der Sitzung | zurück in den ursprünglichen Arbeitsbereich der Seitenleiste | verschwindet aus der Welt |
> | Reversibel | ✅ | ❌ |
>
> **Der Purge zieht zwangsläufig das Aufheben des Archivstatus nach sich** — sonst blieben Zombie-ids zurück, die „in der Seitenleiste unsichtbar sind und sobald man ihren Archivstatus aufhebt zu einer leeren Sitzung werden“.
> Die Größe wird **pro Zeile** angezeigt (praktisch gemessen: ein einzelner Eintrag kann von 0 bis 23 MB reichen), der Button zeigt die Teiltsumme der Auswahl.
>
> **Zwei harte Randbedingungen** (einhalten, sonst war die Aktion umsonst):
> 1. **Liste und Schreibzugriff haben dieselbe Quelle** — beide erkennen die Speicherdatei `~/.dsh/storages/workspace.json` an. Der `workspaceRegistry` im Host-Speicher ist ein Snapshot beim Start: Änderungen an der Datei schreiben nicht in ihn zurück; er dient nur als Diagnosefläche für „bereits aus der Datei hinaus, in diesem Prozess weiterhin wirksam“ (`pendingRestart`).
> 2. **Direkt nach der Aktion DSH neu starten** — die Speicherschicht schreibt vollständig neu, der Speicher ist maßgeblich: Vor dem Beenden des Hosts schreibt **jede** Archiv- oder Arbeitsbereichsänderung den alten Zustand vollständig zurück und macht die soeben durchgeführte Aktion zunichte.
- **Check-up (Gesundheitsprüfung / Sitzungsarzt)**: Vier-Gates-Check-up → Verordnung (Befehlsliste) → Entlassung (reversibler Eingriff + Vorher/Nachher-Vergleich).

> Namensgrenze: **Dieses Paket bietet weder Suche noch Indizierung.** Suche/eigenständige Indizierung gehören in ein anderes Revier (`dsh-search-index`); keine der beiden Seiten verwendet die Unterdomänen-Begriffe der anderen, und keine interpretiert die Felder der anderen.

## Oberflächen-Vorschau

Ein Eintrag **„Session Steward“** erscheint unten in der Seitenleiste, neben Suche und Einstellungen:

![Eintrag in der Seitenleiste](assets/left-sidebar.png)

**Seniorenheim (Verlaufsdateien)** — Überblick über den offiziellen Archivbestand; jede Zeile zeigt ihre Größe und den Zustand der Datenträger-Entität; Zeilen auswählen, um den Archivstatus aufzuheben oder zu löschen (Purge):

![Seniorenheim (alles zusammengeführt)](assets/archive.png)

**Check-up** — der Einstiegspunkt des Vier-Gates-Check-ups, der in einer reversiblen Verordnung endet:

![Check-up](assets/doctor.png)

## Installation

```bash
dsh plugin --profile web add dsh-session-steward
# oder ein lokales Entwicklungsverzeichnis
dsh plugin --profile web add "link:E:/test/rewrite-agently/mine-dsh-plugins/dsh-session-steward"
```

Nach der Installation **muss der Host-Prozess neu gestartet werden** (ein Neuladen der Seite genügt nicht).

## Routen-Vertrag

Präfix `/session-steward/api`, Methodennamen immer `session-*` (**niemals** mit den `index-*` des Suchindex vermischen);
eine unbekannte Methode liefert einen expliziten Fehler, niemals Stillschweigen.

| Methode | Subdomäne | Zweck |
|---|---|---|
| `session-history-list` | history | den Archivbestand auflisten (Speicherdatei hat Vorrang; mit Quelle, Degradierung, Größe pro Zeile und `pendingRestart`-Vermerk) |
| `session-history-prune` | history | **Archivstatus aufheben**: ids massenweise aus dem Archiv-Array entfernen (automatische Sicherung, Neustart erforderlich) |
| `session-history-purge` | history | **Archivdateien endgültig löschen**: Transkript-Verzeichnis + Projektions-Cache + beide id-Listen wirklich löschen (**irreversibel**) |
| `session-health-status` | health | Schalterzustand und Methodentabelle (für das Polling des Panels) |
| `session-health-scan` | health | Check-up im Batch (standardmäßig nur nicht-ok-Sitzungen zurückgeben) |
| `session-health-session` | health | Vier-Gates-Bericht einer einzelnen Sitzung + Verordnung |
| `session-health-repair` | health | reversibler Eingriff (Quarantäne des Projektions-Cache-Datensatzes) + Vorher/Nachher |

Einstellungs-Namespace: `session-steward`; id des Seitenleisten-Eintrags: `dsh-session-steward`.

## Die beiden Schalter (feature gates)

| Schalter | Feld | Wirkung bei Deaktivierung |
|---|---|---|
| Sitzungsverlaufsdateien | `historyFiles` (Standard true) | `session-history-*` wird nicht registriert, der Tab „Seniorenheim“ wird nicht gerendert |
| Gesundheitsprüfung | `healthCheck` (Standard true) | `session-health-*` wird nicht registriert, der Tab „Check-up“ wird nicht gerendert |

Bei Deaktivierung liefert die entsprechende Methode `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — **keine leeren Hüllen**.

## Der Vier-Gates-Check-up

| gate | Kriterium | level |
|---|---|---|
| `log-integrity` | Multi-Frame-Scan mit zstd → Entfaltung der Provenance → Auspacken der gepackten Zeilen; seq fortlaufend, kein zerrissener Endframe | `fail` bei Leseproblemen; `warn` bei nur zerrissenem Endframe |
| `projection-cache` | Abstand des `minSeq` von `~/.dsh/storages/session_projcache/sessions/<id>.json` zur letzten seq des Logs + nicht abgeschlossene Felder (openStep / activeStep.active / pendingTurnStart / turnBoundary=start) | `fail` bei Abstand und nicht abgeschlossen; `warn` wenn eines von beiden |
| `lossless-json` | zeilenweise Prüfung auf verlustfreies JSON durch das hot-state `sessionProjections.checkpoint(session)` (undefined / nicht-endliche Zahlen / -0 / löchrige Sparse-Löcher / nicht-gewöhnlicher Prototyp / Funktionen·Symbol·BigInt / Zyklen) | `fail` bei einem Treffer, mit Projektions-Key → zugeordnetem Paket |
| `cold-read` | Grund des letzten `turn/end`, ob ein offener open step ohne Abschluss existiert, ob nach der letzten user-Nachricht noch Assistant-Ausgabe folgt | `fail` bei open step; `warn` bei interrupted/fehlendem turn/end |

**Die Verordnung** enthält nur drei reversible Dinge: ① den beschädigten Projektions-Cache-Datensatz in Quarantäne versetzen (zuerst sichern) ② bei nicht abgeschlossenen steps daran erinnern, auf die Abschlusserklärung des Hosts zu warten ③ eine ausführbare Befehlsliste ausgeben.
**Verboten**: Sitzungslogs umschreiben, historische Daten ändern, Felder stillschweigend verwerfen.

## Der einzige Vertrag mit `dsh-search-index`

Format der Archivdatei (`global.archivedSessionIds` von `~/.dsh/storages/workspace.json`):
**dieses Plugin schreibt, der Suchindex liest nur**. Formatbeschreibung in
`dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`.

## Entwicklung

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/client.js
```

## Lizenz

MIT
