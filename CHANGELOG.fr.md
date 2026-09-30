# Journal des modifications

- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

## 0.5.0

### Adaptation — ligne DSH 0.2.0 (branche compat/0.2.0, adaptation de purs métadonnées, zéro modification de code)

- **Rotation de l'hôte** : les 5 peer (dsh-client-locale / dsh-client-ui-settings / dsh-client-ui-settings-general /
  dsh-client-ui-slots / dsh-session) et les deux `engines.dsh` (package.json + dsh.plugin.json) passent ensemble à
  `>=0.2.0-rc.1 <0.2.1-0` (fenêtre rc verrouillée, ré-adaptation à partir de 0.2.1) ; dist-tag npm `dsh-0.2.0`.
- **Preuve zéro code** (les trois points de couplage dur vérifiés un à un contre le paquet réel et les sources de l'hôte 0.2.0-rc.1) :
  1. les deux listes first-party de `dsh-session-format-v3-to-v4@0.2.0-rc.1` (`RENAMED_PRODUCERS` 5 entrées +
     `RELEASED_SAME_NAME_PRODUCERS` 25 entrées) concordent **entrée par entrée** avec la copie mot à mot de ce dépôt ;
  2. surface d'exports de `dsh-session@0.2.0-rc.1` : `decodeSeqRanges` toujours présente ; `decodeStorageRecord`
     **non exportée** aussi bien en 0.1.7-rc.2 qu'en 0.2.0-rc.1 (le garde de soft-loading la traite comme surface optionnelle et retombe sur l'implémentation locale équivalente, comportement identique sur les deux lignes) ;
  3. le contrat du répertoire d'archive est inchangé : le schéma de nommage double `session.jsonl.zstd`/`session.v3.jsonl.zstd` passe par la même fonction sur les deux lignes, et les deux listes d'id —
     `storages/session_projcache` et `workspace.json` (`global.archivedSessionIds` +
     `tables.workspaces.*.sessionIds`) — sont toujours en place.
- **devDependencies** : `dsh-client-ui-slots` / `dsh-session` sans caret, épinglées exactement sur `0.2.0-rc.1`
  (volontairement pas de poursuite de rc.2, alignement sur la baseline hôte 4878cdabd8 ; l'intérêt est que vitest et le soft-loading à l'exécution résolvent les paquets réels 0.2.0).
- **Rafraîchissement de l'arbre de dépendances** : suppression de node_modules et de package-lock.json puis régénération committée ; suppression du
  pnpm-lock.yaml obsolète (épinglé sur la ligne 0.1.0-rc.8) et du pnpm-workspace.yaml, unification sur la seule ligne npm.
- **Version et discipline de publication** : 0.4.8 → **0.5.0** ; dsh.plugin.json version 0.4.1 → 0.5.0 (guérison de la dérive de baseline) ;
  `publishConfig.tag` → `dsh-0.2.0` ; `release:015` renommé `release:020` (`--tag dsh-0.2.0`) ;
  le texte bilingue « ligne dédiée 0.1.5 » de la description mis à jour avec la version.
- Vérification : install / build / typecheck / test tous au vert (167 tests), `npm ls` sans conflit de peer,
  dsh-session / dsh-client-ui-slots réellement installés dans node_modules en 0.2.0-rc.1 tous les deux.

## 0.4.8

### Correction — ST1 : la transcription divergeait de l'hôte sur les noms des producteurs first-party

- `migrateSessionSourceKind` interroge ligne à ligne `isFirstPartyLegacyProducer` (les deux tables copiées mot à mot depuis
  l'hôte `dsh-session-format-v3-to-v4@0.1.7-rc.2` lib/index.js:51-84, 5+25=**30** noms first-party constatés) ;
  en cas de correspondance, la ligne est sautée et signalée honnêtement via `skippedFirstParty` — les noms first-party passent par la table de renommage de l'hôte / le kind nu du même nom
  (avec la branche sensible au rôle) ; un préfixe inconditionnel écrirait un kind que l'hôte ne produit jamais, corrompant silencieusement l'attribution.
  Pas d'écriture disque quand il ne reste que des anciennes lignes first-party. Ajout de 30 tests de correspondance de noms et d'assertions de relecture par le décodeur officiel de l'hôte (161 tests au vert).

### Durcissement — R2 : reconnaissance côté purge des sauvegardes de transcription signées

- Les deux chemins — statistiques d'archive et purge — reconnaissent les sauvegardes `*.pre-sourcemigrate-<ts>` (la constante de suffixe
  `SOURCE_MIGRATE_BACKUP_SUFFIX` avait été exportée en 0.4.7, cette fois elle est câblée) :
  - **Statistiques** : `locateSessionUsage` / `session-history-list` ajoutent par ligne `backupBytes` /
    `backupCount` — la sauvegarde est un sous-ensemble de `bytes`, on la liste à part pour éviter qu'elle soit lue à tort comme volume de journal ;
  - **Purge** : le résultat de `session-history-purge` ajoute `backupsRemoved` (supprimer un répertoire entier emporte de toute façon
    les sauvegardes ; compter leur traitement rend « sauvegardes traitées ensemble » honnêtement rapportable, ce n'est plus une boîte noire).
- 6 régressions ajoutées (jugement du suffixe, liste à part dans les statistiques, zéro honnête, rapport de purge, conservation liée, report dans la liste), 167 tests au total.

## 0.4.7

### Nouveau — gate de bilan de santé du format signé par le plugin (source-kind) et transcription des anciennes signatures

- **Contexte** : depuis l'hôte 0.1.7-rc.1 (format de session v4), la signature nue `source: { kind: 'plugin', plugin }` est rejetée
  (SessionFormatError, tout le tour échoue) ; les plugins non adaptés hors genui (session-guard, prime-memory, etc.)
  ont corrigé leurs chemins d'écriture selon la liste, mais les anciennes lignes de signature qu'ils avaient écrites demeurent dans les journaux existants — le jugement de relecture des plugins non adaptés sera en désaccord.
- **Détection (lecture seule)** : le bilan gagne une 6e porte `source-kind`, qui se sépare en lignes selon la génération de format de l'en-tête du journal :
  - **table de dépendance de version** (voir le commentaire d'en-tête de `src/host/health/source-kind.ts`) : anciennes lignes v1/v2 (non vérifiées) et
    v3 (époque 0.1.6, à vérifier) légales, on n'y touche pas (la migration v3→v4 de l'hôte en a la charge) ; **v4 (≥0.1.7-rc.1) rejette
    les anciennes signatures**, tout constat donne un warn.
  - les lignes de version antérieures à v4 sont enregistrées ok sans remonter le niveau — on ne traite pas par-dessus le marché des données relevant du contrat de migration de l'hôte (contre le sur-traitement).
- **Transcription (déclenchement explicite)** : nouvelle API `session-health-source-migrate` et bouton « Transcrire les anciennes signatures » du panneau de bilan
  (il n'apparaît que lorsque la porte source-kind est en warn). Réécrit `{ kind: 'plugin', plugin: N }` en
  `{ kind: 'plugin:N' }` (suppression du champ plugin), tous les autres octets restant en l'état.
- **Trois barrières sur la ligne rouge** : on ne touche qu'au champ de signature source ; sauvegarde du fichier entier avant modification (`*.pre-sourcemigrate-<ts>`, retour en arrière possible) ;
  refus d'exécuter si l'intégrité n'est pas au niveau (trame finale déchirée/échec de décodage/trou de seq) ou si header.version < 4. C'est
  l'unique exception explicite à la ligne rouge « interdiction de réécrire les journaux de session », déclenchée par l'utilisateur session par session.
- genui est hors de notre portée : ce plugin ne transcrit pas pour lui et ne le fera pas (une fois ses lignes historiques transcrites, son propre jugement de relecture décidera, à ses dépens).

## 0.1.0-alpha.6

### Correction — espacement icône/texte resserré ; plus de voisin écrasé en colonne étroite

- **Espacement 8px → 4px** : le vide entre `🧭` et « Session Steward » a été resserré selon les mesures (retour utilisateur : « réduire l'écart entre icône et texte »).
  Dans le même temps, le padding propre passe de `0 12px 0 10px` à `0 10px 0 8px`, aligné sur le padding gauche/droite de la capsule « Recherche » voisine.
- **Il se rétracte lui-même et n'écrase plus les voisins** : `.dss_entryWrap` passe de `flex:none` à `flex:0 1 auto; min-width:0`,
  marge avant extérieure de `8px → 6px`. Auparavant il ne cédait jamais ; le déficit retombait tout entier sur la capsule de recherche,
  dont le libellé était écrasé jusqu'à un seul caractère ; désormais, quand l'espace manque, c'est lui qui encaisse d'abord (libellé terminé par des points de suspension).
- **Taille du rail revenue à 28×28** : la content box du rail ne fait que 36px (rail de 56px − 2×10px de padding) ; deux entrées sur une même ligne
  ne peuvent pas loger deux boîtes de contrôle de 36px (mesuré : 36+28=64px, débordement de 14px). On prend 28+28=56px,
  plus étroit que les 32+28=60px d'avant la modification.
- **La frontière de coopération n'a pas changé** : comme toujours, on ne touche qu'à son propre CSS, on ne référence aucune valeur de l'index de recherche
  et on ne suppose pas s'il est installé ; quand les deux sont installés, la largeur naturelle de la ligne est de 217px ; isolément, chacun occupe toute la ligne.

## 0.1.0-alpha.5

### Changement — l'entrée de la barre latérale porte un libellé et s'adapte sur la même ligne que l'« index de recherche »

- **L'entrée a un nom** : l'entrée du pied était auparavant un simple bouton rond icône 28×28 (🧭), sans libellé, impossible de dire ce qu'il ouvre.
  En colonne large, il devient un contrôle de ligne de 42px : **🧭 Session Steward**, même hauteur, même arrondi (12px) et même taille de police que la capsule « Recherche » voisine.
- **Coopération géométrique sur la même ligne** : après que l'entrée de recherche a déclaré `flex:1;min-width:0`, elle n'occupe plus toute la ligne ; les deux entrées cohabitent
  comme éléments frères de `sidebar.footer.action` ; notre entrée ajoute `margin-left:8px` en colonne large pour laisser l'espacement
  (en regard du `.triggerRow{gap:8px}` officiel de `ui-settings-general`). Ce plugin ignore si l'autre existe et ne référence aucune de ses valeurs —
  la coopération ne se produit que sur les CSS respectifs.
- **Dégradation du rail replié** : à `wide=false`, le bouton passe par `.dss_footerEntryRail` (rond 36×36, sans libellé), conforme à la spécification du rail Figma
  (rail 56px / padding 10px / boîte de contrôle 36×36) et aux contrôles de rail officiels ; le libellé apparaît dans les mêmes conditions qu'en colonne large.
- **Correction de l'attribution du libellé** : le repli codé en dur `'会话管家'` dans le composant a été supprimé ; le libellé de l'entrée et le titre du panneau ont la même source (clé de dictionnaire `panel.title`),
  le dictionnaire reste l'unique origine.

### Changement — un verbe scindé en deux : « retirer le statut d'archivage » et « purger les fichiers d'archive »

**Le problème n'était pas le libellé, mais la sémantique.** Auparavant, le panneau n'avait qu'une seule opération, mais le bouton s'appelait « Supprimer la sélection » —
ce n'était ni une suppression (pas un octet supprimé), ni une seule chose (on modifiait le tableau et on proclamait « supprimer »).
Ainsi, la même action portait trois noms (supprimer / purger / retirer), et ni les utilisateurs ni les implémenteurs ne s'y retrouvaient.

Désormais scindé en deux opérations à **route indépendante, bouton indépendant, confirmation indépendante** :

| | Retirer le statut d'archivage | Purger les fichiers d'archive |
|---|---|---|
| Route | `session-history-prune` | **`session-history-purge`** (nouveau) |
| Ce qui est modifié | uniquement `global.archivedSessionIds` | suppression des entités sur disque **+** modification des deux listes d'id |
| Fichiers sur disque | inchangés | **disparaissent** |
| Devenir de la session | retour dans l'espace de travail d'origine de la barre latérale | disparaît du monde |
| Réversible | ✅ prend effet au redémarrage | ❌ **irréversible** |

« Purger les fichiers d'archive » touche d'un coup 4 endroits :

1. `~/.dsh/sessions/<espace de travail>/<id de session>/` — **le répertoire entier**. En pratique, les 3 répertoires contenaient simultanément
   `session.jsonl.zstd` et l'ancien format `session.v3.jsonl.zstd` ; ne supprimer que la copie au format courant laisserait des déchets.
2. `~/.dsh/storages/session_projcache/sessions/<id de session>.json` — cache de projection, entrée par entrée.
   > Attention : il existe aussi un `storages/session_projcache.json` (mise en page entière, 99,4 Mo, dernière écriture restée au
   > 09-11) : c'est un **fossile** laissé par la migration de mise en page ; l'hôte ne l'écrit plus depuis longtemps et ce plugin n'y touche pas non plus.
   > Le cache de projection vivant est `session_projcache/sessions/` (mesuré : 143,4 Mo / 275 entrées, encore écrit aujourd'hui).
3. `workspace.json` → `global.archivedSessionIds`
4. `workspace.json` → `tables.workspaces.*.sessionIds`

**La purge doit emporter le retrait du statut d'archivage** : si les fichiers sont supprimés mais que les id restent dans le tableau, ce sont des archives zombies —
la barre latérale ne les voit pas, et dès qu'on leur retire le statut d'archivage ressurgit une session vide impossible à ouvrir.

**L'ordre d'exécution est « d'abord modifier les fichiers, ensuite supprimer les entités »** : la modification des fichiers est atomique et peut être interrompue en bloc
(si le fichier de stockage est indisponible, **pas un octet n'est supprimé**) ; dans l'ordre inverse — supprimer d'abord les entités puis modifier les fichiers — un échec en cours de route laisserait des id zombies.

**Garde-fous de l'opération destructive** :

- sans `dshHome`, refus d'exécuter — pas de chemins devinés ;
- avant suppression, `isSafeChild` affirme que la cible est bien un enfant du **niveau précis** attendu sous la racine prévue
  (une couche de travers et c'est toute la racine `sessions` qui est supprimée) ;
- chaque entrée est indépendante ; les échecs sont consignés sans être levés, avec un détail `failures` listé ligne à ligne dans le panneau ;
- réutilisation de l'unique point d'entrée d'écriture `editWorkspaceDocument` (sauvegarde + écriture temporaire dans le même répertoire + renommage atomique).

### Changement — la taille se calcule par « unité cochée », pas de total global

L'occupation d'une session varie énormément (mesuré : une projection-cache de 23,47 Mo pour une transcription de 0,07 Mo ;
et il y a aussi des fichiers de 0 octet). Donc :

- **chaque ligne** affiche sa propre `transcription 6,2 Mo · cache 2,3 Mo` ;
- l'en-tête de liste affiche `72 entrées au total · 98,6 Mo` ;
- le bouton affiche le **sous-total de la sélection** : `Purger les fichiers d'archive (3) · libère 38,2 Mo` ;
- la boîte de confirmation liste les tailles entrée par entrée + le total.

### Correction — le « aucune réaction » de la purge de la Maison de retraite : le lecteur et l'écrivain n'utilisaient pas les mêmes données

**Symptôme** : en mode édition, cocher des sessions archivées → `confirm` → message de purge réussie, mais la liste **n'a pas diminué d'une ligne** et
le panneau ne montre aucun changement visible — on dirait que rien n'a pris effet.

**Cause racine** : les deux routes reconnaissaient chacune son propre jeu de données, **sans communication entre elles**.

| Route | Jeu reconnu |
|---|---|
| `session-history-prune` | `global.archivedSessionIds` du fichier de stockage `~/.dsh/storages/workspace.json` (sauvegarde + remplacement atomique) |
| `session-history-list` | **priorité à la mémoire hôte `workspaceRegistry.archivedSessionIds`** (repli sur le fichier seulement s'il est illisible) |

Le `registry` est un instantané chargé par l'hôte **au démarrage** ; éditer directement le fichier ne s'y réécrit pas. Résultat :

- le fichier maigrissait réellement (mesuré : 166 → 159 → 151 → 103 → 72 → 71, chaque confirmation laissant une sauvegarde `.bak-*`) ;
- mais la liste renvoyait toujours les mêmes — l'utilisateur cochait dans le même ordre, supprimant chaque fois « les premières lignes de la liste »,
  laquelle ne changeait pas du tout ; d'où l'impression « j'ai confirmé, rien ne s'est passé ».

**Correctif** : rendre la liste et prune **de même source**.

- `readArchiveSet` passe en **priorité au fichier de stockage**, le `registry` reculant au rôle de repli en cas de fichier absent ;
  le registry est toujours lu, mais uniquement retourné comme surface de diagnostic (`registryIds`).
- `session-history-list` ajoute `pendingRestart` : le nombre d'id **présents** dans le registry mais **absents** du fichier
  — c'est-à-dire les éléments « déjà purgés sur disque, mais encore actifs dans ce processus ». Le panneau affiche en conséquence un avertissement jaune
  et indique le nombre total de lignes de la liste, pour que « une ligne de moins » se vérifie à l'œil.
- `pruneHistory` ajoute une **vérification après écriture** : après réécriture, relire le fichier pour confirmer que les id cibles ont bien disparu,
  sinon signaler honnêtement l'erreur ; plus jamais « le panneau dit succès, le fichier n'a en réalité pas changé ».

### Risque connu — l'hôte réécrit l'instantané mémoire entier ; la purge peut être « ressuscitée »

La couche de stockage (`dsh-storage-json`) est en **réécriture complète, mémoire prioritaire** : chaque écriture sérialise le document entier depuis l'état mémoire
pour écraser le fichier, sans flush séparé à l'extinction. Donc, après la purge et avant le redémarrage,
**n'importe quel changement d'archive ou d'espace de travail réécrit l'intégralité de l'ancien `archivedSessionIds`**, annulant la purge.

Ce n'est pas un bug de ce plugin (l'officiel n'a pas de point de terminaison unarchive ; le fichier est la seule surface inscriptible),
mais il faut le savoir — c'est écrit noir sur blanc dans la boîte de confirmation et le message de succès : **après la purge, redémarrez immédiatement DSH**.

## 0.1.0-alpha.4

La carte de réglages retrouve sa forme en tiroir : auparavant il ne restait qu'une ligne nue, incohérente avec les autres plugins dans la section de réglages « Plugins ».

### Corrections

- **La carte de réglages n'avait pas d'enveloppe de tiroir (important)** : la section de réglages « Plugins » de DSH (`dsh-client-ui-settings-plugins`)
  ne fait qu'une seule chose — distribuer `settings.plugin.item` selon le namespace de réglages :

      renderSlot('settings.plugin.item', {}, { entryKey: ns })

  Elle **ne fournit aucune enveloppe** : le titre de la carte, sa description, le dépliage/le repli appartiennent entièrement au plugin.
  Ce plugin ne rendait auparavant que la ligne nue, d'où deux défauts :
  1. incohérence, au sein de la section, avec la forme « tiroir dépliable » des autres plugins ;
  2. `card.title` (Session Steward) et `card.desc` (fichiers d'historique · contrôle de santé) **définis mais jamais rendus**,
     des textes morts — c'était précisément « l'entrée de tiroir qui manquait ».

  L'en-tête est maintenant rétabli (titre + description + chevron, tout le bloc cliquable pour basculer), le corps replié par défaut,
  à l'image des autres cartes de la section ; `aria-expanded` reflète l'état déplié.
- **Comportement quand le service de réglages est indisponible** : auparavant, toute la carte se dégradait en une ligne « service de réglages indisponible »,
  et **perdait même le titre** ; désormais l'en-tête du tiroir se rend normalement et seul le corps explique la raison —
  ce plugin ne disparaît plus totalement de la section.

### Changements

- La bascule d'état déplié et la rotation du chevron respectent `prefers-reduced-motion`.

## 0.1.0-alpha.3

Cache des résultats de bilan : rouvrir le panneau affiche le contenu sans délai, et après un traitement seule la ligne concernée est mise à jour.

### Nouveautés

- **Cache des résultats de bilan (dans le processus)** : après un scan complet (par lots couvrant tout le corpus), les résultats restent dans le processus hôte ;
  à la réouverture du panneau, le cache est rendu directement, sans re-scan complet. Le cache **ne se forme qu'après un passage complet du corpus** —
  fermer le panneau à mi-scan ne laisse pas un demi-résultat se faire passer pour une conclusion complète.
- **`resume` en sonde de pure lecture** : `session-health-scan` accepte `resume: true`, **lit seulement le cache, ne scanne rien**.
  Au montage du panneau, on sonde ainsi à coût nul : en cas de correspondance le contenu s'affiche, sinon on ne fait rien
  (charger du travail lourd au montage était le grief contre la version précédente). Renvoie aussi le total actuel du corpus.
- **Heure de génération et entrée de rafraîchissement** : en cas de correspondance du cache, le panneau affiche « résultats issus du cache · il y a N minutes » et propose « Rafraîchir »
  (re-scan complet forcé). Les anciens résultats ne se font jamais passer pour un scan tout frais.
- **Avertissement de changement du corpus** : quand le total du corpus en cache diffère de l'actuel, afficher « le corpus a changé (a → b), un rafraîchissement est conseillé ».
  Ce rapprochement se contente d'énumérer les répertoires, très bon marché — il ne constitue donc pas une nouvelle politique d'invalidation du cache.

### Changements

- **Réécriture sur place d'une entrée** : après le bilan d'une seule session et le traitement réversible, plus de dépendance au re-scan — le traitement recalcule de toute façon
  le rapport `after`, on l'écrit directement dans le cache ; quand le panneau revient à la liste, la ligne est déjà à jour (la ligne guérie disparaît désormais de la liste,
  conforme au principe « ne lister que les problèmes »).
- Le cache **ne s'écrit pas sur disque** : il expire au redémarrage de DSH. Une persistance exigerait une politique d'invalidation, et le coût du jugement d'invalidité
  (énumérer le corpus, comparer mtime/size des journaux) avoisine le re-scan lui-même ; ce tranchet choisit YAGNI.

### Tests

- Ajout de `tests/cache.spec.ts` (19 cas) : règles de formation (passage incomplet / complet / corpus vide / interruption en cours / `clear`),
  toutes les branches de réécriture d'une entrée (ajout / remplacement / sortie pour guérison / no-op), et câblage de `handleMethod`
  (`resume` ne scanne pas, correspondance après passage complet par lots, `onlyProblems=false` ne pollue pas le cache,
  identité de l'objet réécrit après traitement, runtime sans cache toujours utilisable).

## 0.1.0-alpha.2

Correction du jugement et de la présentation du traitement (ordonnance) : ne plus prescrire pour les portes « indéterminables », et conclure explicitement après traitement.

### Corrections

- **Ordonnance erronée pour `skipped` (important)** : `prescribe()` jugeait avec `level !== 'ok'` si le cache de projection devait être mis en quarantaine ;
  « cette porte ne peut pas se déterminer » était donc traité comme « cache de projection non aligné », ce qui prescrivait contre sa propre preuve
  et suggérait de mettre en quarantaine un enregistrement **inexistant**. Extraction du prédicat partagé `isActionable()` (seuls `warn` / `fail` sont traitables) pour tout unifier :
  le barème de `gates.ts` et le critère de `repair.ts` sont désormais une seule et même chose.
- **Faux « quatre portes au vert »** : sans élément à traiter, la réponse fixe était « quatre portes au vert ». Quand une porte est `skipped` (indéterminable, et non verte), ce libellé ne tient pas ;
  désormais : « aucun élément traitable (N portes indéterminables, non anormales) : <liste des id de portes> ».
- **Anomalie toujours affichée après traitement, impossible de savoir si le traitement a pris** : le panneau ne rendait que les deux niveaux « avant / après traitement » ;
  quand les deux sont anormaux, impossible de distinguer « échec du traitement » de « traitement sans rapport avec la lésion ».
  L'hôte ajoute `assessRepair({ before, after, repair })`, qui juge en cinq niveaux avec une explication lisible :
  `nothing-to-do` (quatre portes au vert) / `repaired` (rétabli) / `repaired-with-residual` (cache mis en quarantaine,
  mais subsistent des anomalies sans rapport avec ce cache, par ex. un open step du journal de session) / `not-applicable` (l'anomalie actuelle n'a pas d'élément traitable réversible) /
  `failed` (échec du traitement lui-même). Le panneau rend la bannière de conclusion avec la couleur du niveau.

### Notes

- **La capacité de traitement n'a pas changé** : toujours « ne mettre en quarantaine que les enregistrements du cache de projection, copier puis déplacer, ne pas toucher aux journaux de session » ;
  cette fois, on ne corrige que le **jugement** et la **présentation**. Le scénario typique est « seule la porte `cold-read` est anormale (la session contient un open step non soldé) » —
  de telles anomalies ne devaient déjà pas être réparées par ce plugin ; elles sont maintenant explicitement jugées `not-applicable` avec le motif,
  au lieu d'un silencieux « toujours anormal après traitement ».

### Tests

- Ajout de `tests/repair.spec.ts` (12 cas) : couvre les quatre niveaux d'`isActionable`, le fait que `prescribe` ne prescrit plus à vide,
  et les branches du jugement à cinq niveaux d'`assessRepair`.

## 0.1.0-alpha.1

Correction du jugement et du retour du panneau de bilan : suppression du faux positif massif « Attention », ajout de la progression de scan et des raisons en ligne.

### Corrections

- **Faux positif massif de « Attention » (important)** : les trois portes `lossless-json` / `projection-cache` / `cold-read` renvoyaient `warn`
  **quand elles ne pouvaient pas se déterminer** (session froide sans projection chaude, enregistrement de cache pas encore généré, pas de turn/end dans le journal),
  de sorte que **toutes les sessions non chargées étaient perpétuellement « Attention »**, noyant le vrai signal.
  Ajout d'un niveau neutre `skipped` (libellé du panneau « non vérifié ») portant « impossible d'observer », **non pris en compte dans l'agrégation du jugement global**.
  Critère figé : `warn` = phénomène anormal observé (avec preuve) ; `skipped` = inobservable/indéterminable (sans preuve).
  Mesuré : 30 sessions passent de « 30×Attention » à « 26 normales / 3 Attention / 1 anormale ».
- **Les lignes de liste n'affichaient pas la raison du déclenchement** : la liste des résultats de bilan ne rendait que le niveau agrégé, lignes indiscernables les unes des autres.
  Désormais, chaque ligne liste le résumé des « porte · niveau » non-ok (par ex. `continuité · attention`), sans devoir ouvrir chaque détail.

### Nouveautés

- **Progression du scan de bilan** : `session-health-scan` accepte un `offset` pour un appel par lots et renvoie `total` ;
  le panneau enchaîne les petits lots et cumule lui-même la **progression réelle** (`n/total · Xs écoulées`).
  Tant que le premier lot n'a pas fourni le dénominateur, une animation indéterminée est affichée. L'hôte reste sans état ; la boucle de scan synchrone n'a pas à passer en asynchrone.
- **Retour d'occupation du traitement** : le bouton de traitement réversible obtient un spinner et reste désactivé, pour éviter une interface figée après le clic.

### Changements

- **Renommage de l'onglet** : `病案室` → `养老院` (anglais : `Records Room` → `Retirement Home`),
  pour s'accorder avec la métaphore « bilan / ordonnance / sortie ».

## 0.1.0-alpha.0

Première version alpha : Session Steward (fichiers d'historique + contrôle de santé).

### Nouveautés

- **Fichiers d'historique des sessions (Salle des dossiers)** : reprise depuis `dsh-session-search-toggle` de la lecture et de la purge de l'ensemble officiel des archives,
  comportement équivalent à avant la migration (sauvegarde + écriture temporaire dans le même répertoire + remplacement atomique ; la purge n'est permise qu'en mode édition explicite).
  Différence : la source de la liste devient la **vérité de l'ensemble officiel des archives** (priorité au registry, repli sur le fichier de stockage), puisque l'index indépendant est parti avec le paquet de l'index de recherche ;
  le titre et les autres métadonnées sont au mieux effort (instantané de titre `sessionQuery` → titre du cache de projection → vide).
- **Contrôle de santé (bilan → ordonnance → sortie)** : quatre gates testables indépendamment
  (`log-integrity` / `projection-cache` / `lossless-json` / `cold-read`),
  sortie unifiée `{ id, level, evidence, attribution, detail }` ; agrégés en `SessionHealthReport`.
- **Index d'attribution** : scan statique des `node_modules/<pkg>/lib/*.js` du profil, pour établir « clé de projection → nom de paquet »
  et ramener les gates en échec au plugin précis et au chemin de champ ; introuvable, marqué honnêtement `unknown`.
- **Ordonnance réversible** : mise en quarantaine des enregistrements endommagés du cache de projection (copie de sauvegarde d'abord, puis déplacement vers `.quarantine-<ts>`) + liste de commandes.
  **Interdit** de réécrire les journaux de session, de modifier les données historiques, d'abandonner silencieusement des champs.
- **Deux feature gates** : `historyFiles` / `healthCheck` ; éteint, le sous-domaine correspondant n'est pas enregistré du tout (erreur disabled explicite),
  et le client ne rend pas l'onglet correspondant.
- **Routes** : `/session-steward/api/*`, noms de méthodes toujours en `session-*`, totalement isolés des `index-*` de `/switch-search/api` de l'index de recherche.

### Limitations connues

- Le gate `lossless-json` dépend de l'exposition par l'hôte de `sessionProjections` (état chaud) pour donner un jugement déterminé ;
  faute de quoi il dégrade honnêtement en `warn`, sans spéculer.
- Le scan de santé ne liste par défaut que les 30 dernières sessions non saines (`limit` plafonné à 200), sans parcours complet de la base par défaut.
- Le panneau client est une implémentation minimale (liste + détails + bouton en trois étapes), sans scroll virtuel ni opérations en masse.
