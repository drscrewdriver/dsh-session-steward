# Änderungsprotokoll

- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

## 0.5.0

### Anpassung — DSH-0.2.0-Linie (Branch compat/0.2.0, reine Metadaten-Anpassung, null Codeänderungen)

- **Host-Generationswechsel**: die 5 peer (dsh-client-locale / dsh-client-ui-settings / dsh-client-ui-settings-general /
  dsh-client-ui-slots / dsh-session) und die beiden `engines.dsh` (package.json + dsh.plugin.json) gemeinsam umgestellt auf
  `>=0.2.0-rc.1 <0.2.1-0` (rc-Fenster verriegelt, ab 0.2.1 erneute Anpassung); npm dist-tag `dsh-0.2.0`.
- **Null-Code-Nachweis** (die drei harten Kopplungspunkte einzeln gegen das echte Paket bzw. die Host-Quellen von 0.2.0-rc.1 verifiziert):
  1. Die beiden First-Party-Listen von `dsh-session-format-v3-to-v4@0.2.0-rc.1` (`RENAMED_PRODUCERS` 5 Einträge +
     `RELEASED_SAME_NAME_PRODUCERS` 25 Einträge) stimmen mit der wörtlichen Abschrift in diesem Repository **postenweise überein**;
  2. Export-Fläche von `dsh-session@0.2.0-rc.1`: `decodeSeqRanges` weiterhin da; `decodeStorageRecord` ist sowohl in
     0.1.7-rc.2 als auch in 0.2.0-rc.1 **nicht exportiert** (der Soft-Load-Guard behandelt sie als optionale Fläche und fällt auf die lokale äquivalente Implementierung zurück, auf beiden Linien identisches Verhalten);
  3. Der Archivverzeichnis-Vertrag ist unverändert: das doppelte Namensschema `session.jsonl.zstd`/`session.v3.jsonl.zstd` läuft auf beiden Linien durch dieselbe Funktion,
     und beide id-Listen — `storages/session_projcache` und `workspace.json` (`global.archivedSessionIds` +
     `tables.workspaces.*.sessionIds`) — sind weiterhin vorhanden.
- **devDependencies**: `dsh-client-ui-slots` / `dsh-session` ohne Caret, exakt auf `0.2.0-rc.1` gepinnt
  (absichtlich nicht rc.2 nachgejagt, Ausrichtung an der Host-Baseline 4878cdabd8; der Gewinn liegt darin, dass vitest/Soft-Loading zur Laufzeit die echten 0.2.0-Pakete auflösen).
- **Abhängigkeitsbaum-Auffrischung**: node_modules und package-lock.json gelöscht und regeneriert committet; veraltetes
  pnpm-lock.yaml (auf die 0.1.0-rc.8-Linie gepinnt) und pnpm-workspace.yaml entfernt, Vereinheitlichung auf die alleinige npm-Linie.
- **Version und Release-Disziplin**: 0.4.8 → **0.5.0**; dsh.plugin.json version 0.4.1 → 0.5.0 (Heilung der Baseline-Drift);
  `publishConfig.tag` → `dsh-0.2.0`; `release:015` umbenannt in `release:020` (`--tag dsh-0.2.0`);
  der zweisprachige Beschreibungstext „0.1.5-Dediziertlinie“ versionsbegleitend aktualisiert.
- Verifikation: install / build / typecheck / test alle grün (167 Tests), `npm ls` ohne peer-Konflikte, in node_modules
  sind dsh-session / dsh-client-ui-slots jeweils 0.2.0-rc.1 installiert.

## 0.4.8

### Korrektur — ST1: Transkription wich beim Namen der First-Party-Produzenten vom Host ab

- `migrateSessionSourceKind` fragt zeilenweise `isFirstPartyLegacyProducer` ab (beide Tabellen wörtlich aus dem Host
  `dsh-session-format-v3-to-v4@0.1.7-rc.2` lib/index.js:51-84 übernommen, gemessen 5+25=**30** First-Party-Namen);
  bei einem Treffer wird die Zeile übersprungen und ehrlich über `skippedFirstParty` gemeldet — First-Party-Namen laufen über die Umbenennungstabelle des Hosts / den namensgleichen nackten kind
  (einschließlich des rollenempfindlichen Zweigs); ein bedingungsloses Präfix würde ein kind schreiben, das der Host nie erzeugt, und die Zuschreibung still beschädigen.
  Enthält die Datei nur First-Party-Altezeilen, wird nicht auf die Platte geschrieben. Neu: 30 Namensvergleiche-Tests und LeseAssertions über den offiziellen Host-Decoder (161 Tests grün).

### Härtung — R2: Purge-Seite erkennt signierte Transkriptions-Sicherungen

- Archivstatistik und Purge erkennen beide die Sicherungen `*.pre-sourcemigrate-<ts>` (die Suffix-Konstante
  `SOURCE_MIGRATE_BACKUP_SUFFIX` wurde bereits in 0.4.7 exportiert, diesmal verdrahtet):
  - **Statistik**: `locateSessionUsage` / `session-history-list` führen je Zeile neu `backupBytes` /
    `backupCount` — die Sicherung ist eine Teilmenge von `bytes`; sie wird separat aufgeführt, damit sie nicht fälschlich als Log-Volumen gelesen wird;
  - **Purge**: das Ergebnis von `session-history-purge` führt neu `backupsRemoved` (das Löschen des ganzen Verzeichnisses nimmt ohnehin
    die Sicherungen mit; die Anzahl hier macht „Sicherungen mitbehandelt“ ehrlich berichtbar, keine Blackbox mehr).
- 6 neue Regressionen (Suffix-Beurteilung, Statistik-Einzelauflistung, ehrliche 0, Purge-Bericht, Mitbehandlung, Übernahme in die Liste), 167 Tests insgesamt.

## 0.4.7

### Neu — Health-Gate für die plugin-signierte Formatierung (source-kind) und Transkription alter Signaturen

- **Hintergrund**: ab Host 0.1.7-rc.1 (Sitzungsformat v4) wird die nackte Signatur `source: { kind: 'plugin', plugin }` abgelehnt
  (SessionFormatError, der ganze Durchlauf scheitert); die nicht angepassten Plugins außerhalb von genui (session-guard, prime-memory usw.)
  haben ihre Schreibpfade laut Liste korrigiert, aber die alten Signaturzeilen, die sie geschrieben haben, stehen weiterhin in den Bestands-Logs — die Lesebeurteilung nicht angepasster Plugins passt dann nicht.
- **Erkennung (nur lesend)**: das Check-up erhält ein 6. Gate `source-kind`, das sich nach der Formatgeneration des Log-Headers in Linien trennt:
  - **Versionsabhängigkeitstabelle** (siehe Kopfkommentar von `src/host/health/source-kind.ts`): Altezeilen der frühen Linien v1/v2 (ungeprüft) und
    v3 (Ära 0.1.6, zu prüfen) sind legal, keine Berührung (die v3→v4-Migration des Hosts ist dafür zuständig); **v4 (≥0.1.7-rc.1) lehnt
    alte Signaturen ab**, jede Beobachtung ergibt ein warn.
  - Versionlinien vor v4 werden als ok verbucht, ohne die Stufe anzuheben — Daten innerhalb des Migrationsvertrags des Hosts werden nicht übergriffig behandelt (Schutz vor Übermaß).
- **Transkription (explizit ausgelöst)**: neue API `session-health-source-migrate` und Button „Alte Signaturen transkribieren“ im Check-up-Panel
  (erscheint nur, wenn das Gate source-kind auf warn steht). Schreibt `{ kind: 'plugin', plugin: N }` in
  `{ kind: 'plugin:N' }` um (Feld plugin entfernt), alle übrigen Bytes bleiben unverändert.
- **Drei Schranken auf der roten Linie**: es wird nur das source-Signaturfeld angerührt; vor der Änderung wird die ganze Datei gesichert (`*.pre-sourcemigrate-<ts>`, Rückabwicklung möglich);
  bei unzureichender Integrität (zerrissener Endframe/Dekodierfehler/seq-Lücke) oder header.version < 4 wird die Ausführung verweigert. Dies ist
  die einzige explizite Ausnahme von der roten Linie „Sitzungslogs dürfen nicht umgeschrieben werden“, vom Nutzer sitzungsweise ausgelöst.
- genui liegt außerhalb unserer Reichweite: dieses Plugin transkribiert nicht für ihn und wird es nicht tun (nach der Transkription seiner historischen Zeilen ist die Lesebeurteilung allein seine Sache).

## 0.1.0-alpha.6

### Korrektur — Abstand von Icon und Text strafft; in schmaler Spalte wird der Nachbar nicht mehr verdrängt

- **Abstand 8px → 4px**: der Zwischenraum zwischen `🧭` und „Session Steward“ wurde nach Messung strafft (Nutzerfeedback: „Abstand zwischen Icon und Text etwas kleiner“).
  Zugleich geht das eigene Padding von `0 12px 0 10px` auf `0 10px 0 8px`, deckungsgleich mit dem linken/rechten Padding der Nachbar-Kapsel „Suche“.
- **Er schrumpft selbst, statt Nachbarn plattzudrücken**: `.dss_entryWrap` geht von `flex:none` auf `flex:0 1 auto; min-width:0`,
  der äußere Vorderabstand von `8px → 6px`. Zuvor räumte er nie; das Defizit fiel ganz auf die Such-Kapsel, deren Label auf ein einziges Zeichen gedrückt wurde;
  jetzt trägt er bei Platzmangel selbst zuerst (Label endet mit Auslassungspunkten).
- **Rail-Größe zurück auf 28×28**: die Content-Box des Rails ist nur 36px breit (56px-Rail − 2×10px Padding); zwei Einträge in einer Zeile können
  keine zwei 36px-Kontrollboxen fassen (gemessen: 36+28=64px, Überlauf 14px). Man nimmt 28+28=56px — schmaler als die 32+28=60px vor der Änderung.
- **Die Grenze der Kooperation ist unverändert**: wie bisher wird nur das eigene CSS berührt, kein Wert des Suchindex referenziert und nicht angenommen, ob er installiert ist;
  sind beide installiert, beträgt die natürliche Zeilenbreite 217px, einzeln nimmt jeder die ganze Zeile.

## 0.1.0-alpha.5

### Änderung — der Seitenleisten-Eintrag trägt einen Text und passt sich neben dem „Suchindex“ in derselben Zeile an

- **Der Eintrag hat einen Namen**: der Fuß-Eintrag war zuvor ein einzelner Icon-Rundknopf 28×28 (🧭), ohne Text, unklar, was er öffnet.
  In breiter Spalte wird er ein 42px-Zeilenkontrollelement: **🧭 Session Steward**, gleich hoch, gleich gerundet (12px) und gleich groß wie die Nachbar-Kapsel „Suche“.
- **Geometrische Kooperation in derselben Zeile**: nachdem der Suche-Eintrag `flex:1;min-width:0` deklariert hat, belegt er nicht mehr die ganze Zeile; beide Einträge leben
  als Geschwister unter `sidebar.footer.action` in einer Zeile; unser Eintrag bekommt in breiter Spalte `margin-left:8px`, um Abstand zu lassen
  (im Vergleich zum offiziellen `.triggerRow{gap:8px}` von `ui-settings-general`). Dieses Plugin weiß nicht, ob der andere existiert, und referenziert keinen seiner Werte —
  die Kooperation geschieht nur auf den jeweiligen CSS.
- **Degradation des eingeklappten Rails**: bei `wide=false` geht der Knopf über `.dss_footerEntryRail` (36×36-Rundung, ohne Text), gemäß der Figma-Rail-Spezifikation
  (56px-Rail / 10px-Padding / 36×36-Kontrollbox) und den offiziellen Rail-Steuerelementen; der Text erscheint unter denselben Bedingungen wie in breiter Spalte.
- **Korrektur der Text-Zuordnung**: der fest codierte Fallback `'会话管家'` in der Komponente wurde entfernt; Eintragstext und Panel-Titel stammen aus derselben Quelle (Wörterbuch-Schlüssel `panel.title`),
  das Wörterbuch bleibt die einzige Quelle.

### Änderung — ein Verb wird zu zwei: „Archivstatus aufheben“ und „Archivdateien endgültig löschen“

**Das Problem war nicht die Wortwahl, sondern die Semantik.** Zuvor hatte das Panel nur eine einzige Operation, der Knopf hieß aber „Auswahl löschen“ —
das war weder eine Löschung (kein einziges Byte wurde gelöscht) noch eine einzige Sache (das Array wurde geändert und „Löschen“ behauptet).
So hieß dieselbe Aktion drei Namen (löschen / purgen / entfernen), und weder Spieler noch Implementierer konnten sie zuordnen.

Jetzt aufgeteilt in zwei Operationen mit **eigener Route, eigenem Knopf, eigenem Bestätigungsdialog**:

| | Archivstatus aufheben | Archivdateien endgültig löschen |
|---|---|---|
| Route | `session-history-prune` | **`session-history-purge`** (neu) |
| Was geändert wird | nur `global.archivedSessionIds` | Löschen der Datenträger-Entitäten **+** Ändern der beiden id-Listen |
| Dateien auf der Platte | unverändert | **verschwunden** |
| Verbleib der Sitzung | zurück in den ursprünglichen Arbeitsbereich der Seitenleiste | verschwindet aus der Welt |
| Reversibel | ✅ wirkt nach dem Neustart | ❌ **irreversibel** |

„Archivdateien endgültig löschen“ fasst mit einem Griff 4 Stellen an:

1. `~/.dsh/sessions/<Arbeitsbereich>/<Sitzungs-id>/` — **das ganze Verzeichnis**. Gemessen existierten in den 3 Verzeichnissen zugleich
   `session.jsonl.zstd` und das alte Format `session.v3.jsonl.zstd`; nur die aktuelle Formatkopie zu löschen, würde Müll hinterlassen.
2. `~/.dsh/storages/session_projcache/sessions/<Sitzungs-id>.json` — der Projektions-Cache, Eintrag für Eintrag.
   > Achtung: Es gibt noch ein weiteres `storages/session_projcache.json` (das ganze Layout, 99,4 MB, letzte Schreibung steckengeblieben am
   > 09-11): das ist ein **Fossil** aus der Layout-Migration; der Host schreibt es längst nicht mehr, und dieses Plugin fasst es ebenfalls nicht an.
   > Der lebendige Projektions-Cache ist `session_projcache/sessions/` (gemessen: 143,4 MB / 275 Einträge, heute noch geschrieben).
3. `workspace.json` → `global.archivedSessionIds`
4. `workspace.json` → `tables.workspaces.*.sessionIds`

**Der Purge muss zwangsläufig das Aufheben des Archivstatus nach sich ziehen**: sind die Dateien gelöscht, die id aber noch im Array, sind es Zombie-Archive —
die Seitenleiste sieht sie nicht, und sobald man ihren Archivstatus aufhebt, taucht wieder eine leere, nicht öffnbare Sitzung auf.

**Die Ausführungsreihenfolge lautet „erst Dateien ändern, dann Entitäten löschen“**: das Ändern der Dateien ist atomar und kann als Ganzes abgebrochen werden
(ist die Speicherdatei unbrauchbar, wird **kein einziges Byte gelöscht**); umgekehrt — erst die Entitäten löschen, dann die Dateien ändern — würde ein Scheitern unterwegs Zombie-ids hinterlassen.

**Schutzgeländer der destruktiven Operation**:

- ohne `dshHome` wird die Ausführung direkt verweigert — keine geratenen Pfade;
- vor dem Löschen behauptet `isSafeChild`, dass das Ziel ein Kind der **erwarteten bestimmten Ebene** unter der erwarteten Wurzel ist
  (eine falsch geschriebene Ebene, und die ganze `sessions`-Wurzel wird gelöscht);
- jeder Eintrag unabhängig; Fehler werden nur protokolliert, nicht geworfen, mit `failures`-Detail, das Panel listet sie einzeln;
- weiterhin der einzige Schreibeingang `editWorkspaceDocument` (Sicherung + temporäres Schreiben im selben Verzeichnis + atomares Umbenennen).

### Änderung — Größe wird pro „angekreuzter Einheit“ gerechnet, keine Gesamtsumme

Der Platzbedarf einer einzelnen Sitzung schwankt extrem (gemessen: ein Projektions-Cache von 23,47 MB bei nur 0,07 MB Transkript;
und auch 0-Byte-Fälle). Deshalb:

- **jede Zeile** zeigt ihr eigenes `Transkript 6,2 MB · Cache 2,3 MB`;
- der Listenkopf zeigt `insgesamt 72 Einträge · 98,6 MB`;
- der Knopf zeigt die **Teilsumme der Auswahl**: `Archivdateien löschen (3) · gibt 38,2 MB frei`;
- der Bestätigungsdialog listet die Größen einzeln auf + Summe.

### Korrektur — das „keine Reaktion“ des Purges im Seniorenheim: Leser und Schreiber nutzten nicht dieselben Daten

**Symptom**: im Bearbeitungsmodus archivierte Sitzungen ankreuzen → `confirm` → Meldung, der Purge sei erfolgreich, aber die Liste **hat nicht um einen einzigen Eintrag abgenommen**,
und das Panel zeigt keinerlei sichtbare Veränderung — es sieht völlig wirkungslos aus.

**Grundursache**: die beiden Routen erkannten jeweils ihre eigenen Daten an, **ohne Verbindung zueinander**.

| Route | anerkannter Datensatz |
|---|---|
| `session-history-prune` | `global.archivedSessionIds` der Speicherdatei `~/.dsh/storages/workspace.json` (Sicherung + atomarer Ersatz) |
| `session-history-list` | **zuerst der Host-Speicher `workspaceRegistry.archivedSessionIds`** (nur wenn die Datei unlesbar ist, Rückfall) |

Der `registry` ist ein Snapshot, den der Host **beim Start** lädt; direktes Bearbeiten der Datei schreibt nicht in ihn zurück. Folge:

- die Datei mag tatsächlich ab (gemessen: 166 → 159 → 151 → 103 → 72 → 71, jede Bestätigung hinterließ eine `.bak-*`-Sicherung);
- die Liste lieferte aber immer dieselben — der Nutzer kreuzte in derselben Reihenfolge an und löschte jedes Mal „die ersten Einträge der Liste“,
  die Liste selbst änderte sich nie; daher der Eindruck „bestätigt, nichts ist passiert“.

**Reparatur**: Liste und prune **eine Quelle geben**.

- `readArchiveSet` stellt auf **Speicherdatei zuerst** um, der `registry` rückt in die Rückfallrolle bei fehlender Datei;
  der registry wird weiterhin gelesen, aber nur als Diagnosefläche zurückgegeben (`registryIds`).
- `session-history-list` erhält `pendingRestart`: die Anzahl der id, die **im registry vorhanden**, **in der Datei aber fehlend** sind
  — also die hängenden Posten „bereits aus der Datei gepurgt, in diesem Prozess aber noch wirksam“. Das Panel zeigt daraufhin einen gelben Hinweis
  und nennt die Gesamtzahl der Listeneinträge, damit „ein Eintrag weniger“ mit bloßem Auge prüfbar ist.
- `pruneHistory` erhält eine **Prüfung nach dem Schreiben**: nach dem Zurückschreiben wird die Datei erneut gelesen, um zu bestätigen, dass die Ziel-id wirklich verschwunden sind,
  sonst wird ehrlich ein Fehler gemeldet; nie wieder „das Panel sagt Erfolg, die Datei hat sich in Wirklichkeit nicht geändert“.

### Bekanntes Risiko — der Host schreibt den ganzen Speicher-Snapshot zurück; der Purge kann „auferweckt“ werden

Die Speicherschicht (`dsh-storage-json`) arbeitet mit **vollständiger Neuschreibung, Speicher als maßgeblich**: jede Schreibung serialisiert den Zustand im Speicher
als ganzes Dokument über die Datei, und es gibt keinen separaten Flush beim Herunterfahren. Deshalb schreibt nach dem Purge und vor dem Neustart
**jede beliebige Archiv- oder Arbeitsbereichsänderung die alten `archivedSessionIds` vollständig zurück**, und der Purge ist nulliert.

Das ist kein Bug dieses Plugins (die offizielle Seite hat keinen unarchive-Endpunkt; die Datei ist die einzige beschreibbare Fläche),
aber der Nutzer muss es wissen — im Bestätigungsdialog und in der Erfolgsmeldung steht es bereits: **nach dem Purge sofort DSH neu starten**.

## 0.1.0-alpha.4

Die Einstellungskarte bekommt ihre Schubladen-Form zurück: zuvor blieb nur eine nackte Zeile, inkonsistent mit den anderen Plugins im Einstellungsbereich „Plugins“.

### Korrekturen

- **Der Einstellungskarte fehlte die Schubladen-Hülle (wichtig)**: der Einstellungsbereich „Plugins“ von DSH (`dsh-client-ui-settings-plugins`)
  tut nur eine Sache — er verteilt `settings.plugin.item` nach dem Einstellungs-Namespace:

      renderSlot('settings.plugin.item', {}, { entryKey: ns })

  Er **stellt keinerlei Hülle bereit**: Titel der Karte, Beschreibung, Ausklappen/Einklappen gehören ganz dem Plugin.
  Dieses Plugin renderte zuvor nur die nackte Zeile, daher stimmten zwei Dinge nicht:
  1. im Bereich war es inkonsistent mit der „ausklappbaren Schublade“ der anderen Plugins;
  2. `card.title` (Session Steward) und `card.desc` (Verlaufsdateien · Healthcheck) waren **definiert, aber nie gerendert**,
     toter Text — genau der „fehlende Schubladen-Eintrag“.

  Jetzt ist der Kopf wiederhergestellt (Titel + Beschreibung + Chevron, der ganze Block klickbar zum Umschalten), der Körper standardmäßig eingeklappt,
  wie bei den anderen Karten des Bereichs; `aria-expanded` spiegelt den ausgeklappten Zustand wider.
- **Verhalten bei unavailbarem Einstellungsdienst**: zuvor degradeierte die ganze Karte zu einer Zeile „Einstellungsdienst nicht verfügbar“
  und verlor dabei **auch den Titel**; jetzt wird der Schubladen-Kopf ganz normal gerendert, und nur im Körper steht der Grund —
  dieses Plugin verschwindet nicht mehr vollständig aus dem Bereich.

### Änderungen

- Das Umschalten des ausgeklappten Zustands und die Drehung des Chevrons folgen `prefers-reduced-motion`.

## 0.1.0-alpha.3

Cache der Check-up-Ergebnisse: erneutes Öffnen des Panels zeigt Inhalte ohne Verzögerung, und nach einer Behandlung wird nur die betroffene Zeile aktualisiert.

### Neuerungen

- **Cache der Check-up-Ergebnisse (im Prozess)**: nach einem vollständigen Scan (in Batches durch das ganze Korpus) bleiben die Ergebnisse im Host-Prozess;
  beim erneuten Öffnen des Panels wird der Cache direkt gerendert, ohne vollständigen Neu-Scan. Der Cache **entsteht erst, nachdem das Korpus einmal vollständig durchlaufen wurde** —
  ein Schließen des Panels auf halbem Weg hinterlässt keinen halben Befund, der sich als vollständiges Ergebnis ausgibt.
- **`resume` als reine Lesesonde**: `session-health-scan` versteht `resume: true`, **liest nur den Cache, scannt nichts**.
  Beim Montieren des Panels wird damit einmal kostenlos sondiert: bei Treffer erscheint der Inhalt, sonst geschieht nichts
  (beim Montieren gleich Schwerarbeit zu leisten war der Kritikpunkt an der Vorgängerversion). Liefert zugleich die aktuelle Gesamtzahl des Korpus.
- **Erstellungszeit und Aktualisierungseingang**: bei Cache-Treffer zeigt das Panel „Ergebnisse aus dem Cache · vor N Minuten“ und bietet „Aktualisieren“
  (erzwungener vollständiger Neu-Scan). Alte Ergebnisse geben sich niemals für frisch Gescanntes aus.
- **Hinweis bei Korpus-Änderung**: weicht die gecachte Korpus-Gesamtzahl von der aktuellen ab, erscheint „Das Korpus hat sich geändert (a → b), Aktualisierung empfohlen“.
  Dieser Abgleich macht nur eine Verzeichnis-Aufzählung, sehr billig — er stellt daher keine neue Cache-Invalidierungsstrategie dar.

### Änderungen

- **Einzelne Zeile direkt zurückschreiben**: nach dem Check-up einer einzelnen Sitzung und der reversiblen Behandlung hängt nichts mehr von einem Neu-Scan ab —
  die Behandlung berechnet den `after`-Bericht ohnehin neu, er wird direkt in den Cache geschrieben; kehrt das Panel zur Liste zurück, ist die Zeile bereits auf dem neuesten Stand
  (die geheilte Zeile verschwindet fortan aus der Liste, im Einklang mit „nur Probleme auflisten“).
- Der Cache **wird nicht auf die Platte geschrieben**: er verfällt mit dem Neustart von DSH. Persistenz bräuchte eine Invalidierungsstrategie, und die Kosten der Ungültigkeitsprüfung
  (Korpus aufzählen, mtime/size der Logs vergleichen) liegen nahe am Neu-Scan selbst; dieser Streifen nimmt YAGNI.

### Tests

- Neu `tests/cache.spec.ts` (19 Fälle): Bildungsregeln (unvollständig durchlaufen / vollständig / leeres Korpus / mittendrin abgebrochen / `clear`),
  alle Zweige des Zurückschreibens einer einzelnen Zeile (hinzufügen / ersetzen / geheilt ausgetragen / no-op) sowie die Verdrahtung von `handleMethod`
  (`resume` scannt nicht, Treffer nach vollständigem Batch-Durchlauf, `onlyProblems=false` verunreinigt den Cache nicht,
  Objektidentität des nach der Behandlung Zurückgeschriebenen, Runtime ohne Cache bleibt benutzbar).

## 0.1.0-alpha.2

Korrektur von Beurteilung und Darstellung der Behandlung (Verordnung): keine Verordnung mehr für „nicht beurteilbare“ Gates, und nach der Behandlung gibt es eine klare Konclusion.

### Korrekturen

- **Falsche Verordnung bei `skipped` (wichtig)**: `prescribe()` beurteilte mit `level !== 'ok'`, ob der Projektions-Cache in Quarantäne müsse;
  „dieses Gate kann nicht beurteilen“ galt dadurch als „Projektions-Cache nicht ausgerichtet“, woraufhin es gegen die eigene Evidenz eine sich widersprechende Verordnung ausstellte
  und vorschlug, einen **nicht existierenden** Datensatz in Quarantäne zu versetzen. Das gemeinsame Prädikat `isActionable()` wurde extrahiert (nur `warn` / `fail` sind behandelbar), um alles an einer Stelle zu sammeln:
  der Stufenmaßstab in `gates.ts` und das Behandlungskriterium in `repair.ts` sind seither dieselbe Sache.
- **Falsches „alle vier Gates grün“**: ohne Behandlungsposten kam fest die Antwort „alle vier Gates grün“. Steht ein Gate auf `skipped` (nicht beurteilbar, nicht grün), stimmt dieser Text nicht;
  jetzt: „keine behandelbaren Posten (N Gates nicht beurteilbar, nicht abnormal): <Liste der Gate-ids>“.
- **Nach der Behandlung zeigt sich weiter eine Abnormität, unklar ob die Behandlung half**: das Panel renderte nur die beiden Stufen „vor / nach der Behandlung“;
  sind beide abnormal, lassen sich „Behandlung gescheitert“ und „Behandlung ohne Bezug zum Herd“ nicht unterscheiden.
  Der Host erhält `assessRepair({ before, after, repair })`, das auf eine von fünf Stufen urteilt mit menschenlesbarer Erklärung:
  `nothing-to-do` (alle vier Gates grün) / `repaired` (wiederhergestellt) / `repaired-with-residual` (Cache in Quarantäne,
  aber es bleiben Abnormitäten ohne Bezug zu diesem Cache, z. B. ein open step im Sitzungslog) / `not-applicable` (die aktuelle Abnormität hat keinen reversiblen Behandlungsposten) /
  `failed` (die Behandlung selbst scheiterte). Das Panel rendert das Konclusions-Banner in der Farbe der Stufe.

### Erläuterungen

- **Die Behandlungsfähigkeit hat sich nicht geändert**: weiterhin „nur Projektions-Cache-Datensätze in Quarantäne, erst kopieren dann verschieben, Sitzungslogs unangetastet“;
  diesmal wurden nur **Beurteilung** und **Darstellung** korrigiert. Typisches Szenario ist „nur das Gate `cold-read` ist abnormal (die Sitzung enthält einen nicht abgeschlossenen open step)“ —
  solche Abnormitäten gehörten nie zu den Dingen, die dieses Plugin reparieren sollte; sie werden jetzt ausdrücklich als `not-applicable` mit Begründung geurteilt,
  statt still als „nach der Behandlung weiterhin abnormal“ dazustehen.

### Tests

- Neu `tests/repair.spec.ts` (12 Fälle): deckt die vier Stufen von `isActionable` ab, dass `prescribe` keine leeren Verordnungen mehr ausstellt,
  sowie die Zweige der fünfstufigen Beurteilung von `assessRepair`.

## 0.1.0-alpha.1

Korrektur von Beurteilung und Feedback des Check-up-Panels: der Massen-Fehlalarm „Achtung“ ist beseitigt, Scan-Fortschritt und Zeilen-Begründungen ergänzt.

### Korrekturen

- **Massen-Fehlalarm „Achtung“ (wichtig)**: die drei Gates `lossless-json` / `projection-cache` / `cold-read` gaben `warn` zurück,
  **wenn sie nicht beurteilen konnten** (kalte Sitzung ohne heiße Projektion, Cache-Datensatz noch nicht erzeugt, kein turn/end im Log),
  sodass **alle nicht geladenen Sitzungen ewig „Achtung“ zeigten** und das echte Signal ertranken.
  Neu ist die neutrale Stufe `skipped` (Paneltext „nicht geprüft“) für „nicht beobachtbar“, **ohne Anteil an der Aggregation des Gesamturteils**.
  Festgezogener Maßstab: `warn` = abnormales Phänomen beobachtet (mit Evidenz); `skipped` = nicht beobachtbar/nicht beurteilbar (ohne Evidenz).
  Gemessen: 30 Sitzungen gehen von „30×Achtung“ auf „26 normal / 3 Achtung / 1 abnormal“.
- **Die Listenzeilen zeigten den Auslösegrund nicht**: die Ergebnisliste des Check-ups renderte nur die aggregierte Stufe, die Zeilen waren nicht unterscheidbar.
  Jetzt listet jede Zeile die Zusammenfassung der nicht-ok „Gate · Stufe“ (z. B. `Fortsetzbarkeit · Achtung`), ohne jeden Einzelfall öffnen zu müssen.

### Neuerungen

- **Fortschritt des Check-up-Scans**: `session-health-scan` versteht `offset` für gestapelte Aufrufe und liefert `total`;
  das Panel ruft in kleinen Batches nacheinander auf und kumuliert selbst den **echten Fortschritt** (`n/total · Xs verbraucht`).
  Solange der erste Batch keinen Nenner liefert, läuft eine unbestimmte Animation. Der Host bleibt zustandslos; die synchrone Scanschleife muss nicht asynchron werden.
- **Beschäftigt-Feedback der Behandlung**: der Knopf der reversiblen Behandlung bekommt einen Spinner und bleibt deaktiviert, damit die Oberfläche nach dem Klick nicht stillsteht.

### Änderungen

- **Umbenennung des Tabs**: `病案室` → `养老院` (englisch `Records Room` → `Retirement Home`),
  im Einklang mit der Metapher „Check-up / Verordnung / Entlassung“.

## 0.1.0-alpha.0

Erste Alpha-Version: Session Steward (Verlaufsdateien + Healthcheck).

### Neuerungen

- **Sitzungsverlaufsdateien (Aktenraum)**: aus `dsh-session-search-toggle` übernommen, Lesen und Purge des offiziellen Archivbestands,
  Verhalten äquivalent zur Zeit vor der Migration (Sicherung + temporäres Schreiben im selben Verzeichnis + atomarer Ersatz; Purge nur im expliziten Bearbeitungsmodus erlaubt).
  Unterschied: die Listenquelle ist jetzt die **Wahrheit des offiziellen Archivbestands** (zuerst registry, Rückfall auf die Speicherdatei), weil der unabhängige Index mit dem Suchindex-Paket gegangen ist;
  Titel und übrige Metadaten nach Best-Effort (`sessionQuery`-Titelschnappschuss → Titel des Projektions-Cache → leer).
- **Healthcheck (Check-up → Verordnung → Entlassung)**: vier einzeln testbare Gates
  (`log-integrity` / `projection-cache` / `lossless-json` / `cold-read`),
  vereinheitlichte Ausgabe `{ id, level, evidence, attribution, detail }`; aggregiert zu `SessionHealthReport`.
- **Zuschreibungsindex**: statischer Scan der `node_modules/<pkg>/lib/*.js` des Profils, um „Projektionsschlüssel → Paketname“ aufzubauen
  und fehlgeschlagene Gates dem konkreten Plugin und Feldpfad zuzuordnen; wenn nicht auffindbar, ehrlich als `unknown` markiert.
- **Reversible Verordnung**: Quarantäne beschädigter Projektions-Cache-Datensätze (zuerst Sicherungskopie, dann Verschieben nach `.quarantine-<ts>`) + Befehlsliste.
  **Verboten**: Sitzungslogs umschreiben, historische Daten ändern, Felder stillschweigend verwerfen.
- **Zwei Feature-Gates**: `historyFiles` / `healthCheck`; ausgeschaltet wird die jeweilige Subdomäne gar nicht registriert (expliziter disabled-Fehler),
  und der Client rendert den zugehörigen Tab nicht.
- **Routen**: `/session-steward/api/*`, Methodennamen ausnahmslos `session-*`, vollständig getrennt von den `index-*` von `/switch-search/api` des Suchindex.

### Bekannte Einschränkungen

- Das Gate `lossless-json` braucht die Freigabe von `sessionProjections` (heißer Zustand) durch den Host, um ein bestimmtes Urteil zu fällen;
  fehlt das, degradiert es ehrlich auf `warn`, ohne zu spekulieren.
- Der Health-Scan listet standardmäßig nur die letzten 30 nicht gesunden Sitzungen (`limit` gedeckelt auf 200), kein vollständiger Durchlauf der Datenbank als Default.
- Das Client-Panel ist eine minimale Implementierung (Liste + Details + Drei-Schritte-Knopf), ohne virtuelles Scrollen und Massenoperationen.
