# Notice d'utilisation — plugin `livraison-coordonnee` (version 1.6.0)

_[English version](NOTICE.en.md)_

Plugin pour Claude Code. Une commande livre une demande en respectant les règles de votre projet, et ne la
déclare terminée qu'après une porte de qualité réussie. Cette notice s'adresse à quelqu'un qui découvre
le plugin : rien n'y suppose de connaître le projet d'origine.

## 1. À quoi ça sert

Quand on demande une modification à un agent, il faut souvent corriger, reformuler, relancer. Le plugin
vise un seul échange : il lit les règles du projet, écrit d'abord un test qui prouve que la demande est
remplie, réalise la modification, lance les vérifications du projet et corrige jusqu'au vert. Un hook
d'arrêt relance la porte avant toute conclusion : « terminé » n'est jamais annoncé sur un échec.

Ce n'est pas un outil de vitesse : une livraison prend souvent 15 à 40 minutes. C'est un outil de
fiabilité.

## 2. Prérequis

| Indispensable                                   | Pourquoi                                             |
| ----------------------------------------------- | ---------------------------------------------------- |
| Claude Code (terminal ou application de bureau) | Le plugin est une extension de Claude Code.          |
| Node.js 20 ou plus récent                       | Les scripts du plugin sont écrits en Node.           |
| Un `CLAUDE.md` à la racine du projet            | C'est la source des règles contrôlées.               |

| Recommandé                                                     | Effet s'il manque                              |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `npm run check` (format, lint, types, tests) et `npm run build` | Ces contrôles sont simplement ignorés.         |
| Playwright et Chrome ou Edge                                   | Pas de contrôle d'affichage ni de captures.    |
| Un dossier de tests (`tests/` ou `scripts/`)                   | Aucune règle ne peut être couverte par un test. |

## 3. Installation

### Dossier local (méthode sûre)

1. Récupérer ce dépôt : `git clone https://github.com/Tuzilucas/livraison-coordonnee ~/outils/livraison-coordonnee`
   (ou « Code → Download ZIP » sur GitHub, puis décompresser).
2. Lancer Claude Code depuis le dossier du projet à modifier :

```bash
cd /chemin/vers/mon-projet
claude --plugin-dir ~/outils/livraison-coordonnee
```

Rien n'est installé globalement : supprimer le dossier désinstalle le plugin.

### Place de marché Claude Code

Dans Claude Code : `/plugin marketplace add Tuzilucas/livraison-coordonnee`, puis
`/plugin install livraison-coordonnee@tuzilucas`. Mise à jour : `/plugin update livraison-coordonnee`.

## 4. Première utilisation

Dans la conversation :

```
/livraison-coordonnee:livrer Ajouter un bouton « Exporter en CSV » sur la page des commandes
```

Sans description, la commande ne lance rien et demande ce qu'il faut produire.

Au premier lancement sur un projet, le plugin classe chaque règle de `CLAUDE.md` et pose dans la
conversation les questions qu'il ne peut pas trancher seul : telle règle doit-elle être contrôlée par un
test, relue par un humain, ou ignorée ? Les réponses sont enregistrées dans
`.claude/decisions-livraison.json` du projet et ne sont plus redemandées.

## 5. Ce qui se passe pendant une livraison

1. Un marqueur `.livraison-en-cours` est posé à la racine du projet.
2. Les règles de `CLAUDE.md` sont lues et classées (`.claude/regles-livraison.json`).
3. Les choix mineurs sont notés dans `CHOIX.txt` plutôt que demandés.
4. Un test d'acceptation portant l'étiquette `demande:<nom>` est écrit ; il doit échouer avant la
   modification et réussir après.
5. La modification est réalisée.
6. La porte de qualité est lancée (`scripts/gate.mjs`) et les échecs corrigés, cinq essais au maximum.
7. À la fin du tour, le hook d'arrêt relance la porte complète. Si elle échoue, Claude est renvoyé au
   travail ; si elle réussit, le marqueur est retiré.
8. Un résumé en français est rendu : ce qui est bon, ce qui bloque, la conclusion.

En cas de coupure (fermeture, limite de contexte), relancer la même commande : le plugin reprend là où il
s'est arrêté grâce à `.livraison-etat.json`.

## 6. La porte de qualité

| Vérification                                   | Ce qui est contrôlé                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Règles lues                                    | `CLAUDE.md` est présent et ses règles sont classées.                                                      |
| Vérifications du projet                        | `npm run check` (ou équivalent) passe.                                                                    |
| Couverture des règles                          | Chaque règle importante a un test étiqueté `regle:<identifiant>`.                                        |
| Données                                        | La validation des données passe, si le projet en a une.                                                   |
| Construction                                   | `npm run build` passe, si le projet en a une.                                                             |
| Tests des règles et de la demande              | `npm run test:regles` passe et le test `demande:` est nouveau ou modifié pendant la livraison.            |
| Navigation de bout en bout                     | Les tests Playwright passent, s'il y en a.                                                                |
| Interdits                                      | Aucun motif interdit (secret, donnée interne) dans les fichiers construits.                              |
| Affichage                                      | À 320, 360, 390, 768, 1024 et 1440 px (et en thème sombre s'il est déclaré) : pas de défilement horizontal, pas de texte hors écran ni superposé, cibles tactiles d'au moins 24 px, aucune erreur JavaScript. |

Chaque contrôle a un statut : **réussi**, **échoué**, **sans objet** (le projet n'a pas cette étape, par exemple
pas de script `build` : le contrôle ne compte ni pour ni contre) ou **non exécuté** (l'étape était attendue
mais n'a pas pu tourner : c'est un échec). Un projet qui n'a aucun mécanisme de vérification (ni `check`,
ni `test`, ni `test:regles`, ni `build`, ni Playwright) n'obtient jamais de porte verte : il n'y aurait rien
de prouvé. Un projet sans pages (bibliothèque, outil en ligne de commande) le déclare avec
`"interface_web": false` dans `.claude/regles-livraison.json`.

Le rapport est écrit dans `rapport-livraison/` du projet : `rapport.json` (détail), `RESUME.txt`
(résumé en français), journaux de chaque étape et captures d'écran.

## 7. Fichiers créés dans le projet

| Fichier                              | Rôle                                        | À commiter ? |
| ------------------------------------ | ------------------------------------------- | ------------ |
| `.claude/regles-livraison.json`      | Règles classées, générées depuis `CLAUDE.md` | Oui          |
| `.claude/decisions-livraison.json`   | Vos réponses de relecture humaine            | Oui          |
| `CHOIX.txt`                          | Choix mineurs de la livraison en cours       | Non          |
| `.livraison-en-cours`                | Marqueur de livraison                        | Non          |
| `.livraison-etat.json`               | Point de reprise                             | Non          |
| `.livraison-journal.log`             | Journal horodaté des décisions du hook       | Non          |
| `.livraison-porte.lock`              | Verrou : une seule porte à la fois           | Non          |
| `rapport-livraison/`                 | Rapport, résumé, captures                    | Non          |

Les fichiers « Non » sont ajoutés automatiquement au `.gitignore` du projet.

## 8. Réglages

| Variable d'environnement | Valeur par défaut           | Rôle                                            |
| ------------------------ | --------------------------- | ----------------------------------------------- |
| `LIVRAISON_ESSAIS`       | `5`                         | Nombre d'essais de correction avant abandon (1 à 50). |
| `LIVRAISON_NAVIGATEUR`   | Chrome, puis Edge           | Forcer `chrome` ou `msedge` pour les captures.  |
| `LIVRAISON_LANGUE`       | `fr`                        | Langue des résumés et messages : `fr`, `en`, `es`, `de`, `it`. Sinon `"langue"` du fichier de règles (`regles.mjs --langue=xx`). |

Options de `.claude/regles-livraison.json` : `routes` (pages à contrôler), `largeurs`, `interdits`,
`controles` et `revue_humaine` (mots-clés qui classent une règle), `theme_sombre`.

## 9. Questions fréquentes

**La porte dit qu'une règle n'est pas couverte.** Écrire un test qui porte l'étiquette
`regle:<identifiant>` (l'identifiant est affiché), ou répondre « relecture humaine » à la question posée.

**Le projet n'est pas un site web.** Les contrôles d'affichage et de navigation sont ignorés ; le reste
fonctionne (règles, tests, test d'acceptation, hook d'arrêt).

**Le plugin a réécrit du code que je ne lui avais pas demandé.** C'est la correction d'un échec de la
porte. Le résumé indique quel contrôle l'a motivée. Si le contrôle est trop strict, l'ajuster dans
`.claude/regles-livraison.json` plutôt que de contourner la porte.

**Un test d'acceptation me paraît faible.** Le relire et le renforcer : un test trop faible donne un faux
vert. C'est la principale limite connue.

**La porte tourne en rond.** Si, pendant une continuation (Claude Code signale `stop_hook_active`), les mêmes
échecs reviennent trois fois de suite, le hook abandonne sans attendre le cinquième essai, avec la mention
« sans progrès ». Claude Code plafonne lui-même à huit continuations consécutives sans appel d'outil
(`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).

**Les essais sont épuisés, que se passe-t-il ?** Le marqueur est retiré pour que Claude puisse s'arrêter,
mais la livraison est consignée comme **non terminée** : `.livraison-etat.json` contient `"terminee": false`,
le journal le note, et un message système l'affiche. Relancer la commande reprend à cet état.

**Le serveur de contrôle est-il exposé ?** Non : il n'écoute que sur `127.0.0.1`, sur un port libre choisi
par le système, et ne sert que les fichiers du dossier construit (tout chemin qui en sort est refusé).

**Comment arrêter une livraison en cours ?** Supprimer `.livraison-en-cours` à la racine du projet ; le
hook d'arrêt ne relancera plus la porte.

## 10. Limites connues

- Les tests écrits par le plugin doivent être relus au début.
- Le contrôle d'affichage détecte des défauts mesurables (débordement, superposition, cibles trop
  petites), pas le goût ni la pertinence des textes.
- La détection automatique des pages s'arrête à deux niveaux de dossiers ; au-delà, lister les pages dans
  `routes` de `.claude/regles-livraison.json`. Une page non listée n'est pas contrôlée.
- Le contraste n'est mesuré que sur fond de couleur unie ; les textes sur image ou dégradé sont comptés
  « non mesurables », jamais validés.
- Le navigateur de contrôle a été exercé dans un environnement de développement ; Chrome et Edge sur
  poste restent à essayer largement.
- Deux projets ont servi à la validation (une application web en un seul fichier et un site Next.js de
  900 pages). Un nouveau projet demande une première passe pour écrire ses tests de règles.

## 11. Tester le plugin lui-même

`npm test` dans le dossier du plugin lance 37 tests sur des projets temporaires (créés dans le dossier
temporaire du système, supprimés ensuite) : projet valide, test ou build en échec, erreur JavaScript,
configuration invalide, `package.json` absent ou malformé, deux portes simultanées, traversée de
répertoires, rapports absents ou corrompus, épuisement des essais, projet sans tests, build périmé en mode
rapide, projet sans interface web, règle non couverte, test d'acceptation non exécuté. Chromium et
Playwright sont nécessaires pour les scénarios d'affichage.

## 12. Pour aller plus loin

- `README.md` : avantages, inconvénients, résultats mesurés, historique des versions.
- `commands/livrer.md` : la procédure exacte suivie par la commande.
- `scripts/gate.mjs` : la porte de qualité ; `scripts/regles.mjs` : la conversion des règles.
