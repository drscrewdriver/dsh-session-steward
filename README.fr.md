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

Plugin web DSH : **fichiers d'historique des sessions + bilan de santé des sessions**.

> **Cette version (0.5.0) prend la ligne DSH 0.2.0 comme ligne principale** (peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, dist-tag npm `dsh-0.2.0`, branche `compat/0.2.0`).
> La ligne DSH 0.1.7 reste servie par 0.4.8 (dist-tag `dsh-0.1.7`, branche `compat/0.1.7`) et n'évolue plus avec la présente ligne.
> Les surfaces de l'hôte consommées par ce plugin (format de session V4 et listes de producteurs first-party de `dsh-session-format-v3-to-v4`, exports de décodage de `dsh-session`, contrat du répertoire d'archive `session.jsonl.zstd`/`session.v3.jsonl.zstd` en double exemplaire + `storages/session_projcache` + les deux listes d'id de `workspace.json`) ont été vérifiées point par point comme **inchangées dans 0.2.0-rc.1, zéro modification de code** ; cette version est une adaptation purement métadonnées (rotation des peer/engines, devDependencies épinglées exactement sur `0.2.0-rc.1`, discipline de publication mise à jour avec la version).

- **Maison de retraite (fichiers d'historique)** : parcourir l'ensemble officiel des archives, avec deux opérations **indépendantes** —
  **retirer le statut d'archivage** (ne modifie que le tableau, réversible) et **purger les fichiers d'archive** (supprime réellement les entités sur disque, irréversible).

> **Les deux opérations ne sont pas interchangeables et ne peuvent pas être fusionnées** :
>
> | | Retirer le statut d'archivage | Purger les fichiers d'archive |
> |---|---|---|
> | Route | `session-history-prune` | `session-history-purge` |
> | Ce qui est modifié | uniquement `global.archivedSessionIds` | suppression des entités sur disque + modification du tableau d'archive + modification de la table des membres des espaces de travail |
> | Devenir de la session | retour dans l'espace de travail d'origine de la barre latérale | disparaît du monde |
> | Réversible | ✅ | ❌ |
>
> **La purge entraîne nécessairement le retrait du statut d'archivage** — sinon subsisteraient des id zombies « invisibles dans la barre latérale et qui, dès qu'on retire leur statut d'archivage, se transforment en session vide ».
> La taille est affichée **par ligne** (constaté en pratique : une entrée peut aller de 0 à 23 Mo), et le bouton affiche le sous-total de la sélection.
>
> **Deux contraintes strictes** (à respecter, sinon l'opération est vaine) :
> 1. **Liste et écriture ont la même source** — toutes deux se réfèrent au fichier de stockage `~/.dsh/storages/workspace.json`. Le `workspaceRegistry` en mémoire de l'hôte est un instantané pris au démarrage : écrire dans le fichier ne le met pas à jour ; il ne sert que de surface de diagnostic « déjà sorti du fichier, toujours actif en mémoire » (`pendingRestart`).
> 2. **Redémarrer DSH immédiatement après l'opération** — la couche de stockage réécrit tout le document et donne la priorité à la mémoire : avant l'arrêt de l'hôte, **toute** modification d'archive ou d'espace de travail réécrit l'ancien état en entier, annulant l'opération qui vient d'être faite.
- **Bilan de santé (contrôle de santé / médecin des sessions)** : bilan à quatre portes → ordonnance (liste de commandes) → sortie (traitement réversible + comparaison avant/après).

> Frontière de nommage : **ce plugin ne fournit ni recherche ni indexation**. La recherche et l'indexation autonome relèvent d'un autre territoire (`dsh-search-index`) ; aucune des deux parties n'emploie les termes de sous-domaine de l'autre et aucune n'interprète les champs de l'autre.

## Aperçu de l'interface

Une entrée **« Session Steward »** apparaît en bas de la barre latérale, aux côtés de Recherche et Paramètres :

![Entrée de la barre latérale](assets/left-sidebar.png)

**Maison de retraite (fichiers d'historique)** — vue d'ensemble de l'ensemble officiel des archives ; chaque ligne indique sa taille et l'état de l'entité sur disque ; cochez des lignes pour retirer le statut d'archivage ou purger :

![Maison de retraite (état tout regroupé)](assets/archive.png)

**Bilan de santé** — le point d'entrée du bilan à quatre portes, qui débouche sur une ordonnance réversible :

![Bilan de santé](assets/doctor.png)

## Installation

```bash
dsh plugin --profile web add dsh-session-steward
# ou un répertoire de développement local
dsh plugin --profile web add "link:E:/test/rewrite-agently/mine-dsh-plugins/dsh-session-steward"
```

Après l'installation, **il faut redémarrer le processus hôte** (rafraîchir la page ne suffit pas).

## Contrat des routes

Préfixe `/session-steward/api`, noms de méthodes toujours en `session-*` (**jamais** à mélanger avec les `index-*` de l'index de recherche) ;
une méthode non reconnue renvoie une erreur explicite, jamais un silence.

| Méthode | Sous-domaine | Rôle |
|---|---|---|
| `session-history-list` | history | lister l'ensemble des archives (fichier de stockage prioritaire ; avec source, dégradation, taille par ligne et annotation `pendingRestart`) |
| `session-history-prune` | history | **retirer le statut d'archivage** : retirer des id du tableau d'archives en lot (sauvegarde automatique, redémarrage requis) |
| `session-history-purge` | history | **purger les fichiers d'archive** : supprimer réellement le répertoire de transcription + le cache de projection + les deux listes d'id (**irréversible**) |
| `session-health-status` | health | état des interrupteurs et table des méthodes (pour le polling du panneau) |
| `session-health-scan` | health | bilan en lot (par défaut, ne renvoie que les sessions non ok) |
| `session-health-session` | health | rapport aux quatre portes d'une seule session + ordonnance |
| `session-health-repair` | health | traitement réversible (mise en quarantaine de l'enregistrement du cache de projection) + avant/après |

Espace de noms des paramètres : `session-steward` ; id de l'entrée de la barre latérale : `dsh-session-steward`.

## Les deux interrupteurs (feature gates)

| Interrupteur | Champ | Effet à la désactivation |
|---|---|---|
| Fichiers d'historique des sessions | `historyFiles` (true par défaut) | `session-history-*` n'est pas enregistré, l'onglet « Maison de retraite » n'est pas rendu |
| Contrôle de santé | `healthCheck` (true par défaut) | `session-health-*` n'est pas enregistré, l'onglet « Bilan de santé » n'est pas rendu |

Une fois désactivé, la méthode correspondante renvoie `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — **aucune coquille vide**.

## Le bilan à quatre portes

| gate | Critère | level |
|---|---|---|
| `log-integrity` | balayage multi-trames zstd → déploiement de la provenance → déballage des lignes empaquetées ; seq continues, aucune trame finale déchirée | `fail` en cas de problème de lecture ; `warn` si uniquement une trame finale déchirée |
| `projection-cache` | retard du `minSeq` de `~/.dsh/storages/session_projcache/sessions/<id>.json` par rapport au dernier seq du journal + champs non soldés (openStep / activeStep.active / pendingTurnStart / turnBoundary=start) | `fail` si retard et non soldé ; `warn` si l'un des deux seulement |
| `lossless-json` | jugement ligne à ligne du JSON sans perte par le `sessionProjections.checkpoint(session)` à chaud (undefined / nombres non finis / -0 / trous creux / prototype non ordinaire / fonctions·Symbol·BigInt / cycles) | `fail` en cas de correspondance, avec la clé de projection → paquet attribué |
| `cold-read` | raison du dernier `turn/end`, existence d'un open step non clôturé, présence éventuelle d'une sortie assistant après le dernier message user | `fail` si open step ; `warn` si interrupted/absence de turn/end |

**L'ordonnance** ne propose que trois choses réversibles : ① mettre en quarantaine l'enregistrement endommagé du cache de projection (sauvegarde d'abord) ② s'il reste des steps non soldés, rappeler qu'il faut attendre la soldation par l'hôte ③ produire une liste de commandes exécutables.
**Interdit** : réécrire les journaux de session, modifier les données historiques, abandonner silencieusement des champs.

## L'unique contrat avec `dsh-search-index`

Format du fichier d'archive (`global.archivedSessionIds` de `~/.dsh/storages/workspace.json`) :
**ce plugin écrit, l'index de recherche ne fait que lire**. Description du format dans
`dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`.

## Développement

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/client.js
```

## Licence

MIT
