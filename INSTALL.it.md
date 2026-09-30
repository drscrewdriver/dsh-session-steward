# Guida all'installazione (CLI DSH ufficiale)

Questa guida usa solo il comando ufficiale DSH `dsh plugin`. Quel comando installa la dipendenza in un profilo e sincronizza `dsh.profile.bundles`. Non sostituirlo con un semplice `npm install`, un `pnpm add` diretto nel profilo o modifiche manuali del manifest del profilo.

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

I segnaposto di questa guida sono:

- `<profile>`: il profilo DSH da modificare, di solito `web`;
- `dsh-session-steward`: il pacchetto npm e l'ID del plugin a runtime.

> **Intervallo di DSH supportato: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> È l'intervallo dichiarato in `engines.dsh` sia di `package.json` sia di `dsh.plugin.json`, e corrisponde al minimo `^0.1.0-rc.6` che questo plugin dichiara già per la propria dipendenza `@deepseek-ai/dsh-client-ui-slots`. Verificare la versione in esecuzione con `dsh --version` prima di installare.

## 0. Prerequisiti e individuazione del profilo

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Usare il profilo indicato dal proprio processo DSH in esecuzione. `web` è comune, ma l'argomento `--profile` attivo fa autorità.

## 1. Installazione ufficiale

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(l'opzione `-w` è richiesta quando il profilo è la radice di un workspace pnpm, come accade per `web`.)

Installare una versione specifica in modo esplicito:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.6 -w
```

La CLI ufficiale aggiorna automaticamente la dipendenza del profilo, il lockfile e `dsh.profile.bundles`. Non aggiungere una riga YAML a mano.

### Periodo di raffreddamento della supply chain

Il runtime DSH usa pnpm 11, la cui politica `minimumReleaseAge` può bloccare una versione appena pubblicata con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Aggiungere la versione a `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.6
```

## 2. Riavviare l'host

**Dopo l'installazione o l'aggiornamento è richiesto un riavvio di DSH.** Ricaricare la pagina del browser non basta: la parte host registra le rotte `/session-steward/api` e il namespace delle impostazioni all'avvio, e l'host deve ricaricare la fonte degli archivi perché un prune diventi visibile.

## 3. Aggiornamento

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

Dopodiché riavviare DSH.

## 4. Registrazione tramite percorso locale / `link:` (alternativa)

Per sviluppo o installazioni offline, registrare il plugin da un checkout locale:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Oppure usare la CLI ufficiale con un percorso locale (nessuna rete necessaria):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

La compilazione da un checkout dei sorgenti usa questi script:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` non è committato, quindi un checkout dei sorgenti deve essere compilato prima di poter essere registrato tramite percorso. La pubblicazione lo compila automaticamente tramite l'hook `prepublishOnly`.

## 5. Verificare l'installazione

Controllare la dipendenza e la versione installata:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Controllare la composizione ufficiale:

```bash
dsh --profile <profile> --dump-default-config
```

Deve contenere:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Verificare il plugin

Dopo il riavvio, la voce della barra laterale `dsh-session-steward` è disponibile e la sezione delle impostazioni usa il namespace `session-steward`. Confermare:

1. Entrambe le schede vengono renderizzate — **Casa di riposo** e **Check-up** — finché entrambi i feature gate sono attivi.
2. Spegnere `historyFiles` rimuove la scheda Casa di riposo e fa sì che ogni chiamata `session-history-*` restituisca un errore esplicito di disattivazione.
3. Spegnere `healthCheck` rimuove la scheda Check-up e fa sì che ogni chiamata `session-health-*` restituisca un errore esplicito di disattivazione.
4. Un metodo non riconosciuto su `/session-steward/api` restituisce un errore esplicito invece di riuscire in silenzio.

I domini disattivati restituiscono `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — il plugin non lascia gusci vuoti.

## 7. Risoluzione dei problemi

| Sintomo | Azione |
| --- | --- |
| `dsh` non trovato | Installare o abilitare la CLI DSH ufficiale. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Aggiungere la versione a `minimumReleaseAgeExclude` nel `pnpm-workspace.yaml` del profilo. |
| Schede o rotte assenti dopo l'installazione | Riavviare il processo host — un ricaricamento della pagina non registra di nuovo le rotte. |
| Le modifiche all'insieme degli archivi non sono visibili | Riavviare l'host; la fonte degli archivi viene letta all'avvio. |
| `session-history-*` restituisce un errore di disattivazione | Il feature gate `historyFiles` è spento. Riattivarlo nelle impostazioni del plugin. |
| `session-health-*` restituisce un errore di disattivazione | Il feature gate `healthCheck` è spento. Riattivarlo nelle impostazioni del plugin. |
| Bundle client obsoleto dopo un aggiornamento | Ricaricamento forzato del browser (Ctrl+Shift+R). |

## 8. Rimozione

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

Dopodiché riavviare DSH.

## La rimozione non annulla le riparazioni

Il plugin non riscrive mai i log di sessione né i dati storici, e non scarta mai silenziosamente campi. L'unica azione dall'apparenza irreversibile che compie — la messa in quarantena di un record danneggiato della cache di proiezione — copia prima un backup, e la directory di quarantena resta su disco per consentire un ripristino. La rimozione del plugin lascia quindi al suo posto ogni quarantena richiesta; ripristinarla manualmente se si vuole recuperare lo stato.

## Licenza

MIT
