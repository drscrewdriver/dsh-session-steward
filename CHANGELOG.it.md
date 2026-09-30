# Registro delle modifiche

- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

## 0.5.0

### Adattamento — linea DSH 0.2.0 (ramo compat/0.2.0, adattamento di soli metadati, zero modifiche al codice)

- **Passaggio di generazione dell'host**: i 5 peer (dsh-client-locale / dsh-client-ui-settings / dsh-client-ui-settings-general /
  dsh-client-ui-slots / dsh-session) e le due `engines.dsh` (package.json + dsh.plugin.json) passano insieme a
  `>=0.2.0-rc.1 <0.2.1-0` (finestra rc bloccata, nuovo adattamento da 0.2.1); dist-tag npm `dsh-0.2.0`.
- **Prova del codice zero** (i tre punti di accoppiamento rigido verificati uno a uno contro il pacchetto reale e i sorgenti dell'host 0.2.0-rc.1):
  1. le due liste first-party di `dsh-session-format-v3-to-v4@0.2.0-rc.1` (`RENAMED_PRODUCERS` 5 voci +
     `RELEASED_SAME_NAME_PRODUCERS` 25 voci) coincidono **voce per voce** con la trascrizione letterale di questo repository;
  2. superficie di esportazione di `dsh-session@0.2.0-rc.1`: `decodeSeqRanges` c'è ancora; `decodeStorageRecord` è
     **non esportata** sia in 0.1.7-rc.2 sia in 0.2.0-rc.1 (la guardia del soft-loading la tratta come superficie opzionale e ricade sull'implementazione locale equivalente, comportamento identico sulle due linee);
  3. il contratto della directory di archivio è immutato: lo schema di denominazione doppio `session.jsonl.zstd`/`session.v3.jsonl.zstd` passa per la stessa funzione sulle due linee,
     e le due liste di id — `storages/session_projcache` e `workspace.json` (`global.archivedSessionIds` +
     `tables.workspaces.*.sessionIds`) — sono entrambe ancora al loro posto.
- **devDependencies**: `dsh-client-ui-slots` / `dsh-session` senza caret, fissate esattamente su `0.2.0-rc.1`
  (volontariamente non si insegue rc.2, allineamento alla baseline host 4878cdabd8; il guadagno sta nel fatto che vitest/il soft-loading a runtime risolvono i pacchetti reali 0.2.0).
- **Rinfrescata la struttura delle dipendenze**: node_modules e package-lock.json eliminati e rigenerati in un commit; eliminati il
  pnpm-lock.yaml obsoleto (fissato sulla linea 0.1.0-rc.8) e il pnpm-workspace.yaml, unificazione sulla sola linea npm.
- **Versione e disciplina di rilascio**: 0.4.8 → **0.5.0**; dsh.plugin.json version 0.4.1 → 0.5.0 (guarita la deriva della baseline);
  `publishConfig.tag` → `dsh-0.2.0`; `release:015` rinominato `release:020` (`--tag dsh-0.2.0`);
  il testo bilingue «linea dedicata 0.1.5» della descrizione aggiornato con la versione.
- Verifica: install / build / typecheck / test tutti verdi (167 test), `npm ls` senza conflitti tra peer, in node_modules
  dsh-session / dsh-client-ui-slots installati entrambi in 0.2.0-rc.1.

## 0.4.8

### Correzione — ST1: la trascrizione divergeva dall'host sui nomi dei produttori first-party

- `migrateSessionSourceKind` interroga riga per riga `isFirstPartyLegacyProducer` (le due tabelle trascritte letteralmente da
  `dsh-session-format-v3-to-v4@0.1.7-rc.2` dell'host, lib/index.js:51-84, riscontrati 5+25=**30** nomi first-party);
  in caso di corrispondenza la riga viene saltata e riportata onestamente tramite `skippedFirstParty` — i nomi first-party seguono la tabella di rinomina dell'host / il kind nudo omonimo
  (incluso il ramo sensibile al ruolo); un prefisso incondizionato scriverebbe un kind che l'host non produce mai, corrompendo in silenzio l'attribuzione.
  Se restano solo vecchie righe first-party non si scrive su disco. Aggiunti 30 test di confronto dei nomi e asserzioni di rilettura con il decoder ufficiale dell'host (161 test verdi).

### Rafforzamento — R2: il lato purge riconosce i backup firmati della trascrizione

- Le due vie — statistiche degli archivi e purge — riconoscono i backup `*.pre-sourcemigrate-<ts>` (la costante del suffisso
  `SOURCE_MIGRATE_BACKUP_SUFFIX` era già stata esportata in 0.4.7, questa volta viene cablata):
  - **Statistiche**: `locateSessionUsage` / `session-history-list` aggiungono per riga `backupBytes` /
    `backupCount` — il backup è un sottoinsieme di `bytes`, viene elencato a parte per evitare che venga letto per errore come volume di log;
  - **Purge**: il risultato di `session-history-purge` aggiunge `backupsRemoved` (eliminare la directory intera porta via comunque
    i backup; contarne la gestione rende «backup trattati insieme» onestamente riportabile, non più una scatola nera).
- Aggiunte 6 regressioni (giudizio del suffisso, elenco a parte nelle statistiche, zero onesto, rapporto della purge, conservazione collegata, riporto in elenco), 167 test in totale.

## 0.4.7

### Nuovo — gate del check-up sul formato della firma del plugin (source-kind) e trascrizione delle vecchie firme

- **Contesto**: dall'host 0.1.7-rc.1 (formato sessione v4) la firma nuda `source: { kind: 'plugin', plugin }` viene rifiutata
  (SessionFormatError, l'intero turno fallisce); i plugin non adattati fuori da genui (session-guard, prime-memory ecc.)
  hanno corretto i propri percorsi di scrittura secondo la lista, ma le vecchie righe di firma da loro scritte restano nei log esistenti — il giudizio di rilettura dei plugin non adattati andrà in disaccordo.
- **Rilevamento (sola lettura)**: il check-up guadagna un sesto gate `source-kind`, che si divide in linee secondo la generazione di formato dell'header del log:
  - **tabella di dipendenza dalle versioni** (vedi il commento d'intestazione di `src/host/health/source-kind.ts`): le vecchie righe delle linee primitive v1/v2 (non verificate) e
    v3 (epoca 0.1.6, da verificare) sono legali, non si toccano (la migrazione v3→v4 dell'host se ne occupa); **v4 (≥0.1.7-rc.1) rifiuta
    le vecchie firme**, ogni riscontro dà un warn.
  - le linee di versione precedenti a v4 vengono registrate ok senza alzare il livello — non si trattano, sopra il proprio grado, dati che rientrano nel contratto di migrazione dell'host (protezione dall'eccesso).
- **Trascrizione (attivazione esplicita)**: nuova API `session-health-source-migrate` e pulsante «Trascrivi le vecchie firme» del pannello del check-up
  (compare solo quando il gate source-kind è in warn). Riscrive `{ kind: 'plugin', plugin: N }` in
  `{ kind: 'plugin:N' }` (rimozione del campo plugin), tutti gli altri byte restano identici.
- **Tre sbarrate sulla linea rossa**: si tocca solo il campo della firma source; prima della modifica si salva l'intero file (`*.pre-sourcemigrate-<ts>`, possibilità di ritorno);
  si rifiuta l'esecuzione se l'integrità non è sufficiente (frame finale strappato/fallimento di decodifica/lacuna di seq) o se header.version < 4. È
  l'unica eccezione esplicita alla linea rossa «divieto di riscrivere i log di sessione», attivata dall'utente sessione per sessione.
- genui è fuori dal nostro controllo: questo plugin non trascrive per lui e non lo farà (dopo la trascrizione delle sue righe storiche, il giudizio di rilettura è affare suo e suo solo).

## 0.1.0-alpha.6

### Correzione — distanza icona/testo ridotta; in colonna stretta non schiaccia più il vicino

- **Distanza 8px → 4px**: il vuoto tra `🧭` e «Session Steward» è stato ridotto in base alle misurazioni (feedback utente: «ridurre l'intervallo icona-testo»).
  Al tempo stesso il proprio padding passa da `0 12px 0 10px` a `0 10px 0 8px`, in linea con il padding sinistro/destro della capsula «Ricerca» vicina.
- **Si ritrae da sé e non schiaccia più i vicini**: `.dss_entryWrap` passa da `flex:none` a `flex:0 1 auto; min-width:0`,
  margine esterno anteriore da `8px → 6px`. Prima non cedeva mai; il deficit ricadeva tutto sulla capsula di ricerca, il cui etichetta veniva schiacciata fino a un solo carattere;
  ora, quando lo spazio manca, è lui ad assorbire per primo (etichetta terminata con puntini di sospensione).
- **Dimensione del binario tornata a 28×28**: la content box del binario è di soli 36px (binario 56px − 2×10px di padding); due voci sulla stessa riga
  non possono ospitare due caselle di controllo da 36px (misurato: 36+28=64px, sforamento di 14px). Si adotta 28+28=56px,
  più stretto dei 32+28=60px di prima della modifica.
- **Il confine di cooperazione è immutato**: come sempre si tocca solo il proprio CSS, non si referenzia alcun valore dell'indice di ricerca
  e non si presume se sia installato; con entrambi installati la larghezza naturale della riga è 217px; da solo, ciascuno occupa l'intera riga.

## 0.1.0-alpha.5

### Cambiamento — la voce della barra laterale ha un'etichetta e si adatta sulla stessa riga dell'«indice di ricerca»

- **La voce ha un nome**: la voce a piè di pagina era prima un solo pulsante tondo a icona 28×28 (🧭), senza etichetta, impossibile dire cosa apra.
  In colonna larga diventa un controllo di riga da 42px: **🧭 Session Steward**, stessa altezza, stesso raggio (12px) e stessa dimensione di carattere della capsula «Ricerca» vicina.
- **Cooperazione geometrica sulla stessa riga**: dopo che la voce di ricerca ha dichiarato `flex:1;min-width:0`, non occupa più tutta la riga; le due voci convivono
  come elementi fratelli di `sidebar.footer.action`; la nostra voce aggiunge `margin-left:8px` in colonna larga per lasciare lo spazio
  (a confronto con il `.triggerRow{gap:8px}` ufficiale di `ui-settings-general`). Questo plugin non sa se l'altro esiste e non referenzia nessun suo valore —
  la cooperazione avviene solo sui rispettivi CSS.
- **Degradazione del binario richiuso**: con `wide=false` il pulsante passa per `.dss_footerEntryRail` (tondo 36×36, senza etichetta), conforme alla specifica del binario Figma
  (binario 56px / padding 10px / casella di controllo 36×36) e ai controlli di binario ufficiali; l'etichetta compare nelle stesse condizioni della colonna larga.
- **Corretta l'attribuzione dell'etichetta**: il ripiego cablato nel componente `'会话管家'` è stato rimosso; l'etichetta della voce e il titolo del pannello hanno la stessa fonte (chiave di dizionario `panel.title`),
  il dizionario resta l'unica origine.

### Cambiamento — un verbo scisso in due: «rimuovere lo stato di archiviazione» ed «eliminare i file d'archivio»

**Il problema non era la formulazione, ma la semantica.** Prima il pannello aveva una sola operazione, ma il pulsante si chiamava «Elimina selezione» —
non era un'eliminazione (non toglieva un solo byte) e non faceva una cosa sola (modificava l'array e proclamava «eliminare»).
Così la stessa azione portava tre nomi (eliminare / purgere / rimuovere), e né giocatori né implementatori si trovavano.

Ora è scisso in due operazioni con **rotta indipendente, pulsante indipendente, conferma indipendente**:

| | Rimuovere lo stato di archiviazione | Eliminare i file d'archivio |
|---|---|---|
| Rotta | `session-history-prune` | **`session-history-purge`** (nuovo) |
| Cosa viene modificato | solo `global.archivedSessionIds` | eliminazione delle entità su disco **+** modifica delle due liste di id |
| File su disco | intatti | **scompaiono** |
| Destinazione della sessione | torna nello spazio di lavoro originale della barra laterale | scompare dal mondo |
| Reversibile | ✅ fa effetto al riavvio | ❌ **irreversibile** |

«Eliminare i file d'archivio» tocca in una volta 4 punti:

1. `~/.dsh/sessions/<spazio di lavoro>/<id di sessione>/` — **l'intera directory**. In pratica, nelle 3 directory coesistevano
   `session.jsonl.zstd` e il vecchio formato `session.v3.jsonl.zstd`; eliminare solo la copia nel formato attuale lascerebbe rifiuti.
2. `~/.dsh/storages/session_projcache/sessions/<id di sessione>.json` — la cache di proiezione, voce per voce.
   > Attenzione: esiste anche un `storages/session_projcache.json` (l'intero layout, 99,4 MB, ultima scrittura ferma al
   > 09-11): è un **fossile** lasciato dalla migrazione del layout; l'host non lo scrive più da tempo, e nemmeno questo plugin lo tocca.
   > La cache di proiezione viva è `session_projcache/sessions/` (misurato: 143,4 MB / 275 voci, scritta ancora oggi).
3. `workspace.json` → `global.archivedSessionIds`
4. `workspace.json` → `tables.workspaces.*.sessionIds`

**La purge comporta necessariamente la rimozione dello stato di archiviazione**: se i file sono eliminati ma gli id restano nell'array, sono archivi zombie —
la barra laterale non li vede, e appena si rimuove loro l'archiviazione riaffiora una sessione vuota che non si apre.

**L'ordine di esecuzione è «prima modificare i file, poi eliminare le entità»**: la modifica dei file è atomica e può essere interrotta nel blocco
(se il file di archiviazione non è disponibile, **non si elimina un solo byte**); all'ordine contrario — prima eliminare le entità e poi modificare i file — un fallimento a metà strada lascerebbe id zombie.

**Barriere di protezione dell'operazione distruttiva**:

- senza `dshHome` si rifiuta subito l'esecuzione — niente percorsi indovinati;
- prima dell'eliminazione `isSafeChild` asserisce che il bersaglio è un figlio del **livello preciso** atteso sotto la radice prevista
  (un livello sbagliato e si elimina l'intera radice `sessions`);
- ogni voce è indipendente; i fallimenti vengono solo registrati, non lanciati, con il dettaglio `failures` elencato riga per riga nel pannello;
- si continua a usare l'unico punto di ingresso in scrittura `editWorkspaceDocument` (backup + scrittura temporanea nella stessa directory + ridenominazione atomica).

### Cambiamento — la dimensione si calcola per «unità spuntata», niente totale complessivo

L'occupazione di una singola sessione varia enormemente (misurato: una projection-cache di 23,47 MB a fronte di una trascrizione di 0,07 MB;
e ci sono anche casi da 0 byte). Perciò:

- **ogni riga** mostra la propria `trascrizione 6,2 MB · cache 2,3 MB`;
- l'intestazione dell'elenco mostra `72 voci in totale · 98,6 MB`;
- il pulsante mostra il **subtotale della selezione**: `Elimina i file d'archivio (3) · libera 38,2 MB`;
- la finestra di conferma elenca le dimensioni voce per voce + il totale.

### Correzione — il «nessuna reazione» della purge della Casa di riposo: chi leggeva e chi scriveva non usavano gli stessi dati

**Sintomo**: in modalità modifica, spuntare sessioni archiviate → `confirm` → messaggio di purge riuscita, ma l'elenco **non si è ridotto di una voce** e
il pannello non mostra alcun cambiamento visibile — sembra che non sia successo nulla.

**Causa radice**: le due rotte riconoscevano ciascuna il proprio insieme di dati, **senza comunicare tra loro**.

| Rotta | insieme riconosciuto |
|---|---|
| `session-history-prune` | `global.archivedSessionIds` del file di archiviazione `~/.dsh/storages/workspace.json` (backup + sostituzione atomica) |
| `session-history-list` | **prima la memoria host `workspaceRegistry.archivedSessionIds`** (ripiega sul file solo se è illeggibile) |

Il `registry` è un'istantanea caricata dall'host **all'avvio**; modificare direttamente il file non si riscrive in esso. Conseguenza:

- il file dimagriva davvero (misurato: 166 → 159 → 151 → 103 → 72 → 71, ogni conferma lasciava un backup `.bak-*`);
- ma l'elenco restituiva sempre gli stessi — l'utente spuntava nello stesso ordine, eliminando ogni volta «le prime voci dell'elenco»,
  che però non cambiava mai; da qui l'impressione «ho confermato, non è successo nulla».

**Rimedio**: dare a elenco e prune **la stessa fonte**.

- `readArchiveSet` passa a **priorità del file di archiviazione**, il `registry` arretra a ripiego quando il file manca;
  il registry resta letto, ma restituito solo come superficie diagnostica (`registryIds`).
- `session-history-list` aggiunge `pendingRestart`: il numero di id **presenti** nel registry ma **assenti** nel file
  — cioè le voci «già eliminate dal file, ma ancora attive in questo processo». Il pannello mostra di conseguenza un avviso giallo
  e indica il numero totale di righe dell'elenco, perché «una voce in meno» sia verificabile a occhio.
- `pruneHistory` aggiunge una **verifica dopo la scrittura**: dopo la riscrittura si rilegge il file per confermare che gli id bersaglio siano davvero spariti,
  altrimenti si segnala onestamente l'errore; mai più «il pannello dice successo, il file in realtà non è cambiato».

### Rischio noto — l'host riscrive l'intera istantanea della memoria; la purge può essere «resuscitata»

Il livello di archiviazione (`dsh-storage-json`) lavora a **riscrittura completa, memoria prioritaria**: ogni scrittura serializza lo stato in memoria
come intero documento sopra il file, e non c'è un flush separato allo spegnimento. Quindi, dopo la purge e prima del riavvio,
**qualsiasi modifica ad archivi o spazi di lavoro riscrive gli interi vecchi `archivedSessionIds`**, azzerando la purge.

Non è un bug di questo plugin (il lato ufficiale non ha un endpoint unarchive; il file è l'unica superficie scrivibile),
ma l'utente deve saperlo — è scritto nero su bianco nella finestra di conferma e nel messaggio di successo: **dopo la purge, riavviare subito DSH**.

## 0.1.0-alpha.4

La scheda delle impostazioni riacquista la forma a cassetto: prima restava solo una riga nuda, incoerente con gli altri plugin nella sezione di impostazioni «Plugin».

### Correzioni

- **Alla scheda delle impostazioni mancava il guscio a cassetto (importante)**: la sezione di impostazioni «Plugin» di DSH (`dsh-client-ui-settings-plugins`)
  fa una cosa sola — distribuisce `settings.plugin.item` secondo il namespace delle impostazioni:

      renderSlot('settings.plugin.item', {}, { entryKey: ns })

  Non **fornisce alcun guscio**: il titolo della scheda, la descrizione, l'apertura/chiusura appartengono interamente al plugin.
  Questo plugin prima rendeva solo la riga nuda, quindi c'erano due difetti:
  1. nella sezione era incoerente con la forma «cassetto pieghevole» degli altri plugin;
  2. `card.title` (Session Steward) e `card.desc` (file di cronologia · controllo di salute) erano **definiti ma mai renderizzati**,
     testo morto — era esattamente «la voce di cassetto mancante».

  Ora l'intestazione è ripristinata (titolo + descrizione + chevron, tutto il blocco cliccabile per commutare), il corpo chiuso per impostazione predefinita,
  come le altre schede della sezione; `aria-expanded` rispecchia lo stato aperto.
- **Comportamento quando il servizio di impostazioni non è disponibile**: prima l'intera scheda degradava in una riga «servizio di impostazioni non disponibile»,
  perdendo **perfino il titolo**; ora l'intestazione del cassetto viene resa normalmente e solo nel corpo se ne spiega il motivo —
  questo plugin non sparisce più del tutto dalla sezione.

### Cambiamenti

- La commutazione dello stato aperto e la rotazione del chevron rispettano `prefers-reduced-motion`.

## 0.1.0-alpha.3

Cache dei risultati del check-up: riaprire il pannello mostra i contenuti senza ritardo, e dopo un intervento viene aggiornata solo la riga interessata.

### Novità

- **Cache dei risultati del check-up (nel processo)**: dopo una scansione completa (a lotti su tutto il corpus) i risultati restano nel processo host;
  riaprendo il pannello la cache viene resa direttamente, senza nuova scansione completa. La cache **si forma solo dopo aver percorso una volta l'intero corpus** —
  chiudere il pannello a metà scansione non lascia un mezzo risultato fingendosi conclusione completa.
- **`resume` come sonda di pura lettura**: `session-health-scan` accetta `resume: true`, **legge solo la cache, non scandisce nulla**.
  Al montaggio del pannello si sonda così a costo zero: in caso di corrispondenza il contenuto compare, altrimenti non si fa nulla
  (fare lavoro pesante al montaggio era il rimprovero alla versione precedente). Restituisce anche il totale attuale del corpus.
- **Ora di generazione e ingresso di aggiornamento**: in caso di corrispondenza della cache il pannello mostra «risultati dalla cache · N minuti fa» e propone «Aggiorna»
  (nuova scansione completa forzata). I risultati vecchi non si fingono mai appena scansionati.
- **Avviso di cambiamento del corpus**: quando il totale del corpus in cache differisce dall'attuale compare «il corpus è cambiato (a → b), si consiglia di aggiornare».
  Questo riscontro si limita a enumerare le directory, molto economico — non costituisce quindi una nuova politica di invalidazione della cache.

### Cambiamenti

- **Riscrittura in loco della singola riga**: dopo il check-up di una singola sessione e l'intervento reversibile non si dipende più dalla nuova scansione —
  l'intervento ricalcola comunque il rapporto `after`, che viene scritto direttamente nella cache; quando il pannello torna all'elenco la riga è già aggiornata
  (la riga guarita d'ora in poi scompare dall'elenco, in coerenza con «elencare solo i problemi»).
- La cache **non viene scritta su disco**: scade al riavvio di DSH. La persistenza richiederebbe una politica di invalidazione, e il costo del giudizio di invalidità
  (enumerare il corpus, confrontare mtime/size dei log) sfiora la nuova scansione stessa; questo striscio sceglie YAGNI.

### Test

- Aggiunto `tests/cache.spec.ts` (19 casi): regole di formazione (percorso incompleto / completo / corpus vuoto / interrotto a metà / `clear`),
  tutti i rami della riscrittura della singola riga (aggiunta / sostituzione / uscita per guarigione / no-op) e il cablaggio di `handleMethod`
  (`resume` non scandisce, corrispondenza dopo percorso completo a lotti, `onlyProblems=false` non inquina la cache,
  identità dell'oggetto riscritto dopo l'intervento, runtime senza cache resta utilizzabile).

## 0.1.0-alpha.2

Correzione del giudizio e della presentazione dell'intervento (prescrizione): non si prescrive più per i gate «non giudicabili», e dopo l'intervento si dà una conclusione esplicita.

### Correzioni

- **Prescrizione sbagliata per `skipped` (importante)**: `prescribe()` giudicava con `level !== 'ok'` se la cache di proiezione andasse messa in quarantena;
  «questo gate non può giudicare» veniva quindi trattato come «cache di proiezione non allineata», prescrivendo contro la propria evidenza
  e suggerendo di mettere in quarantena un record **inesistente**. Estratto il predicato condiviso `isActionable()` (solo `warn` / `fail` sono trattabili) per raccogliere tutto in un punto:
  il metro di `gates.ts` e il criterio di `repair.ts` da allora sono la stessa cosa.
- **Falso «quattro gate tutti verdi»**: senza elementi trattabili la risposta fissa era «quattro gate tutti verdi». Quando un gate è `skipped` (non giudicabile, non verde) questa dicitura non regge;
  ora: «nessun elemento trattabile (N gate non giudicabili, non anormali): <elenco degli id dei gate>».
- **Anomalia mostrata anche dopo l'intervento, impossibile capire se ha funzionato**: il pannello rendeva solo i due livelli «prima / dopo l'intervento»;
  quando entrambi sono anormali non si distingue «intervento fallito» da «intervento estraneo alla lesione».
  L'host si aggiudica `assessRepair({ before, after, repair })`, che giudica su una di cinque livelli con spiegazione leggibile:
  `nothing-to-do` (quattro gate tutti verdi) / `repaired` (ripristinato) / `repaired-with-residual` (cache messa in quarantena,
  ma restano anomalie estranee a questa cache, per es. un open step nel log di sessione) / `not-applicable` (l'anomalia attuale non ha elementi trattabili reversibili) /
  `failed` (l'intervento stesso è fallito). Il pannello rende il banner della conclusione con il colore del livello.

### Note

- **La capacità d'intervento non è cambiata**: sempre «mettere in quarantena solo i record della cache di proiezione, copiare poi spostare, non toccare i log di sessione»;
  stavolta si correggono solo il **giudizio** e la **presentazione**. Lo scenario tipico è «solo il gate `cold-read` è anormale (la sessione contiene un open step non saldato)» —
  tali anomalie non erano già cose che questo plugin doveva riparare; ora vengono giudicate esplicitamente `not-applicable` con motivazione,
  invece di apparire in silenzio come «ancora anormale dopo l'intervento».

### Test

- Aggiunto `tests/repair.spec.ts` (12 casi): copre i quattro livelli di `isActionable`, il fatto che `prescribe` non prescrive più a vuoto,
  e i rami del giudizio a cinque livelli di `assessRepair`.

## 0.1.0-alpha.1

Correzione del giudizio e del riscontro del pannello del check-up: eliminato il falso positivo massiccio «Attenzione», aggiunti avanzamento della scansione e motivi in riga.

### Correzioni

- **Falso positivo massiccio di «Attenzione» (importante)**: i tre gate `lossless-json` / `projection-cache` / `cold-read` restituivano `warn`
  **quando non potevano giudicare** (sessione fredda senza proiezione calda, record di cache non ancora generato, nessun turn/end nel log),
  così che **tutte le sessioni non caricate erano perennemente «Attenzione»**, affogando il vero segnale.
  Aggiunto il livello neutro `skipped` (testo del pannello «non verificato») a portare «non osservabile», **fuori dall'aggregazione del giudizio complessivo**.
  Metro fissato: `warn` = fenomeno anormale osservato (con evidenza); `skipped` = non osservabile/non giudicabile (senza evidenza).
  Misurato: 30 sessioni passano da «30×Attenzione» a «26 normali / 3 Attenzione / 1 anormale».
- **Le righe dell'elenco non mostravano il motivo dell'attivazione**: l'elenco dei risultati del check-up rendeva solo il livello aggregato, righe indistinguibili tra loro.
  Ora ogni riga elenca il riepilogo dei «gate · livello» non-ok (per es. `continuità · attenzione`), senza dover aprire ogni dettaglio.

### Novità

- **Avanzamento della scansione del check-up**: `session-health-scan` accetta `offset` per chiamate a lotti e restituisce `total`;
  il pannello incatena i piccoli lotti e cumula da sé l'**avanzamento reale** (`n/total · Xs trascorse`).
  Finché il primo lotto non fornisce il denominatore corre un'animazione indeterminata. L'host resta senza stato; il ciclo di scansione sincrono non deve diventare asincrono.
- **Riscontro di occupazione dell'intervento**: il pulsante dell'intervento reversibile prende uno spinner e resta disabilitato, per evitare un'interfaccia ferma dopo il clic.

### Cambiamenti

- **Rinomina della scheda**: `病案室` → `养老院` (inglese `Records Room` → `Retirement Home`),
  in sintonia con la metafora «check-up / prescrizione / dimissione».

## 0.1.0-alpha.0

Prima versione alpha: Session Steward (file di cronologia + controllo di salute).

### Novità

- **File di cronologia delle sessioni (Sala delle cartelle)**: preso da `dsh-session-search-toggle` il codice di lettura e purge dell'insieme ufficiale degli archivi,
  comportamento equivalente a prima della migrazione (backup + scrittura temporanea nella stessa directory + sostituzione atomica; la purge è permessa solo in modalità modifica esplicita).
  Differenza: la fonte dell'elenco diventa la **verità dell'insieme ufficiale degli archivi** (prima il registry, ripiego sul file di archiviazione), perché l'indice indipendente è andato via con il pacchetto dell'indice di ricerca;
  titolo e altre metainformazioni al meglio dello sforzo (istantanea del titolo `sessionQuery` → titolo della cache di proiezione → vuoto).
- **Controllo di salute (check-up → prescrizione → dimissione)**: quattro gate testabili indipendentemente
  (`log-integrity` / `projection-cache` / `lossless-json` / `cold-read`),
  output unificato `{ id, level, evidence, attribution, detail }`; aggregati in `SessionHealthReport`.
- **Indice di attribuzione**: scansione statica dei `node_modules/<pkg>/lib/*.js` del profilo, per costruire «chiave di proiezione → nome del pacchetto»
  e riportare i gate falliti al plugin preciso e al percorso del campo; se non trovato, marcato onestamente `unknown`.
- **Prescrizione reversibile**: quarantena dei record danneggiati della cache di proiezione (prima la copia di backup, poi lo spostamento in `.quarantine-<ts>`) + elenco di comandi.
  **Vietato** riscrivere i log di sessione, modificare i dati storici, scartare silenziosamente campi.
- **Due feature gate**: `historyFiles` / `healthCheck`; spento, la sottodominio corrispondente non viene registrata affatto (errore disabled esplicito),
  e il client non rende la scheda corrispondente.
- **Rotte**: `/session-steward/api/*`, nomi dei metodi sempre `session-*`, totalmente isolati dagli `index-*` di `/switch-search/api` dell'indice di ricerca.

### Limiti noti

- Il gate `lossless-json` dipende dall'esposizione di `sessionProjections` (stato caldo) da parte dell'host per dare un giudizio determinato;
  se non lo ottiene, degrada onestamente a `warn`, senza speculare.
- La scansione di salute elenca per impostazione predefinita solo le ultime 30 sessioni non sane (`limit` con tetto a 200), senza percorrenza completa della base come predefinito.
- Il pannello client è un'implementazione minima (elenco + dettagli + pulsante in tre passi), senza scorrimento virtuale né operazioni in massa.
