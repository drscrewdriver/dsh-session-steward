# Guide d'installation (CLI DSH officielle)

Ce guide n'utilise que la commande officielle DSH `dsh plugin`. Cette commande installe la dépendance dans un profil et synchronise `dsh.profile.bundles`. Ne la remplacez pas par un simple `npm install`, un `pnpm add` direct dans le profil, ou des modifications manuelles du manifeste du profil.

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

Les espaces réservés de ce guide sont :

- `<profile>` : le profil DSH à modifier, généralement `web` ;
- `dsh-session-steward` : le paquet npm et l'identifiant du plugin à l'exécution.

> **Plage de versions DSH prise en charge : `>=0.1.0-rc.6 <0.2.0-0`.**
>
> C'est la plage déclarée dans `engines.dsh` de `package.json` comme de `dsh.plugin.json`, et elle correspond au plancher `^0.1.0-rc.6` que ce plugin déclare déjà pour sa propre dépendance `@deepseek-ai/dsh-client-ui-slots`. Vérifiez la version en cours d'exécution avec `dsh --version` avant d'installer.

## 0. Prérequis et découverte du profil

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Utilisez le profil nommé par votre processus DSH en cours d'exécution. `web` est courant, mais l'argument `--profile` actif fait autorité.

## 1. Installation officielle

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(l'option `-w` est requise quand le profil est une racine d'espace de travail pnpm, comme c'est le cas de `web`.)

Installez une version précise de façon explicite :

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.6 -w
```

La CLI officielle met à jour automatiquement la dépendance du profil, le fichier de verrouillage et `dsh.profile.bundles`. N'ajoutez pas de ligne YAML à la main.

### Période de refroidissement de la chaîne d'approvisionnement

Le runtime DSH utilise pnpm 11, dont la politique `minimumReleaseAge` peut bloquer une version fraîchement publiée avec `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Ajoutez la version à `minimumReleaseAgeExclude` dans `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` :

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.6
```

## 2. Redémarrer l'hôte

**Un redémarrage de DSH est requis après l'installation ou la mise à niveau.** Rafraîchir la page du navigateur ne suffit pas : la moitié hôte enregistre les routes `/session-steward/api` et l'espace de noms des paramètres au démarrage, et l'hôte doit recharger la source d'archive pour refléter un retrait (prune).

## 3. Mise à niveau

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

Redémarrez DSH ensuite.

## 4. Enregistrement par chemin local / `link:` (alternative)

Pour le développement ou les installations hors ligne, enregistrez le plugin depuis un checkout local :

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Ou utilisez la CLI officielle avec un chemin local (aucun réseau requis) :

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

La construction depuis un checkout source utilise ces scripts :

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` n'est pas commité, donc un checkout source doit être construit avant de pouvoir être enregistré par chemin. La publication le construit automatiquement via le hook `prepublishOnly`.

## 5. Vérifier l'installation

Vérifiez la dépendance et la version installée :

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Vérifiez la composition officielle :

```bash
dsh --profile <profile> --dump-default-config
```

Elle doit contenir :

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Vérifier le plugin

Après le redémarrage, l'entrée de barre latérale `dsh-session-steward` est disponible et la section des paramètres utilise l'espace de noms `session-steward`. Confirmez :

1. Les deux onglets se rendent — **Maison de retraite** et **Bilan de santé** — tant que les deux feature gates sont actifs.
2. Désactiver `historyFiles` fait disparaître l'onglet Maison de retraite et fait renvoyer à chaque appel `session-history-*` une erreur explicite de désactivation.
3. Désactiver `healthCheck` fait disparaître l'onglet Bilan de santé et fait renvoyer à chaque appel `session-health-*` une erreur explicite de désactivation.
4. Une méthode non reconnue sur `/session-steward/api` renvoie une erreur explicite au lieu de réussir en silence.

Les domaines désactivés renvoient `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — le plugin ne laisse pas de coquilles vides derrière lui.

## 7. Dépannage

| Symptôme | Action |
| --- | --- |
| `dsh` est introuvable | Installez ou activez la CLI DSH officielle. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Ajoutez la version à `minimumReleaseAgeExclude` dans le `pnpm-workspace.yaml` du profil. |
| Onglets ou routes absents après l'installation | Redémarrez le processus hôte — un rafraîchissement de page ne réenregistre pas les routes. |
| Les modifications de l'ensemble d'archives ne sont pas visibles | Redémarrez l'hôte ; la source d'archive est lue au démarrage. |
| `session-history-*` renvoie une erreur de désactivation | Le feature gate `historyFiles` est désactivé. Réactivez-le dans les paramètres du plugin. |
| `session-health-*` renvoie une erreur de désactivation | Le feature gate `healthCheck` est désactivé. Réactivez-le dans les paramètres du plugin. |
| Bundle client périmé après une mise à niveau | Rafraîchissement forcé du navigateur (Ctrl+Shift+R). |

## 8. Désinstallation

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

Redémarrez DSH ensuite.

## La désinstallation n'annule pas les réparations

Le plugin ne réécrit jamais les journaux de session, ni les données historiques, et n'abandonne jamais silencieusement des champs. La seule action d'apparence irréversible qu'il entreprend — la mise en quarantaine d'un enregistrement endommagé du cache de projection — copie d'abord une sauvegarde, et le répertoire de quarantaine reste sur disque pour que vous puissiez restaurer depuis celui-ci. La désinstallation laisse donc en place toute quarantaine que vous avez demandée ; restaurez-la manuellement si vous voulez retrouver l'état antérieur.

## Licence

MIT
