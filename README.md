# livraison-coordonnee

**Une commande, une livraison vérifiée.** Plugin Claude Code : il lit les règles de votre `CLAUDE.md`, écrit d'abord le test de la demande, réalise la modification, puis passe une porte de qualité (format, lint, types, données, construction, tests, navigation, affichage sur six largeurs). Un hook d'arrêt relance la porte avant toute conclusion : « terminé » n'est jamais annoncé sur un échec.

_One command, one verified delivery: a Claude Code plugin that turns your `CLAUDE.md` rules into checks, writes the acceptance test first, and refuses to say "done" until the quality gate is green. Documentation in French._

![Résumé de la porte de qualité : neuf vérifications vertes, « la livraison peut être acceptée »](docs/porte-verte.png)

```bash
git clone https://github.com/Tuzilucas/livraison-coordonnee ~/outils/livraison-coordonnee
cd /chemin/vers/mon-projet && claude --plugin-dir ~/outils/livraison-coordonnee
```

Puis, dans Claude Code : `/livraison-coordonnee:livrer <votre demande>`. Notice pas à pas : [`NOTICE.md`](NOTICE.md). Licence MIT. Version 1.5.0.

Validé en conditions réelles sur deux projets : une application web en un seul fichier (37 règles sur 37 contrôlées par un test) et un site Next.js de 900 pages (porte 9/9, fusion et publication).

## Utilisation

    /livraison-coordonnee:livrer <description du livrable>

Sans description, la commande ne lance aucun travail et demande ce qu'il faut produire.

Dépôt de référence : `Tuzilucas/livraison-coordonnee`. Notice complète pour un nouvel utilisateur : `NOTICE.md`.

Installation :

    # 1. Dossier local (sûr, sans réseau)
    git clone https://github.com/Tuzilucas/livraison-coordonnee ~/outils/livraison-coordonnee
    claude --plugin-dir ~/outils/livraison-coordonnee

    # 2. Place de marché Claude Code (dans Claude Code)
    /plugin marketplace add Tuzilucas/livraison-coordonnee
    /plugin install livraison-coordonnee@tuzilucas

## Fonctionnement

Notice complète pour un nouvel utilisateur : `NOTICE.md` (prérequis, installation, première utilisation, porte de qualité, fichiers créés, réglages, questions fréquentes).

1. **Cadrer** : lecture de `CLAUDE.md`, règles classées dans `.claude/regles-livraison.json`, choix mineurs notés dans `CHOIX.txt`.
2. **Prouver** : un test d'acceptation étiqueté `demande:<nom>` est écrit avant la modification.
3. **Produire** la modification.
4. **Porte de qualité** (`scripts/gate.mjs`), entièrement mécanique : vérifications du projet, couverture des règles par des tests, données, construction, tests des règles, navigation de bout en bout, interdits, affichage à 320, 360, 390, 768, 1024 et 1440 px (thème sombre s'il est déclaré). Rapport, résumé en français et captures dans `rapport-livraison/`.
5. **Corriger** tout échec et relancer, cinq essais au maximum.
6. **Verdict** : le hook d'arrêt (`scripts/verdict-arret.mjs`) relance la porte avant toute conclusion ; en cas d'échec, Claude est renvoyé au travail. Journal dans `.livraison-journal.log`, reprise après coupure via `.livraison-etat.json`.

## Fichier de règles d'un projet

`.claude/regles-livraison.json` :
- `sections_claude_md` : sections de `CLAUDE.md` que le fichier de règles couvre (obligatoire) ;
- `routes` : pages à contrôler ;
- `largeurs` : largeurs d'écran (par défaut 320 à 1440 px) ;
- `interdits` : motifs qui ne doivent apparaître dans aucun fichier construit.

## Avantages

- **Détecte de vrais défauts** : sur le site « Pièces à l'appui », la porte a relevé des superpositions de texte (bouton d'aide sur le pied de page, étiquettes de graphiques), des cibles tactiles trop petites, et des débordements, que la relecture seule n'avait pas vus.
- **Refuse sans négocier** : un contrôle en échec bloque le livrable, quelle que soit la note donnée par ailleurs.
- **Traçable** : chaque passage laisse un rapport, des journaux et des captures.
- **Reproductible** : les mêmes contrôles tournent à chaque passage.

## Inconvénients

- **Plus lent** : sur le test du site, 1 440 s avec plugin contre 789 s sans. Environ deux fois plus long, et plus de jetons consommés.
- **Ne juge pas le goût** : le design, le ton et la pertinence des textes restent des avis subjectifs des experts.
- **Ne vérifie pas la compréhension des règles** : la porte contrôle la couverture des sections de `CLAUDE.md`, pas que chaque règle est bien appliquée partout.
- **Dépend de l'environnement** : les contrôles d'affichage demandent Playwright et Chromium. Les experts n'exécutent rien : ils s'appuient sur les preuves écrites par la porte.
- **Faux positifs possibles** : plusieurs ont été corrigés pendant la mise au point (contenu replié, texte pour lecteurs d'écran, animations). D'autres peuvent apparaître sur des sites différents.
- **Le test porte sur un seul projet.** Rien ne prouve encore qu'il fasse mieux qu'un bon travail direct sur d'autres livrables.

## Quand l'utiliser

**Oui**, quand la fiabilité compte plus que la vitesse :
- un site ou une application publique, qui doit fonctionner sur tous les écrans ;
- une livraison qui doit respecter des règles écrites (sources, neutralité, données) ;
- un livrable qu'on ne pourra pas corriger rapidement après publication.

**Non**, pour :
- un prototype ou une idée à tester vite ;
- une modification mineure d'un texte ou d'une couleur ;
- un projet sans tests ni construction : la porte ne peut rien vérifier.

**Ordre d'usage recommandé** : écrire d'abord, lancer la porte, corriger, puis n'appeler les experts que sur un livrable qui passe la porte.

## Résultats du test (site « Pièces à l'appui »)

| | Avec plugin | Sans plugin |
|---|---|---|
| Durée | 1 440 s | 789 s |
| Fichiers modifiés | 7 | 2 |
| Porte de qualité | 10/10 après 3 passages de correction | non mesurée |
| Tests de bout en bout | 29 réussis | 28 réussis |

## Limites connues

- Les notes des experts restent subjectives. Ce qui est vérifié mécaniquement : la présence des preuves, les lignes citées, le seuil de 9,5 (`scripts/verifier-notes.mjs`).
- Le retour utilisateur est simulé : il ne remplace pas des personnes qui testent.
- Pour un module métier (base de données, MES), il faut des tests de base de données, comme ceux du module d'exemple.
- Le plugin n'est pas encore publié dans un annuaire : il manque une licence et une icône.

## Équipe (version 0.4.0)

- **Porte de qualité** (mécanique) : fonctionnement, règles du projet, affichage à six largeurs, contraste des textes.
- **Sept experts**, lancés après une porte réussie : `expert-code`, `expert-ergonomie`, `expert-visuel`, `expert-design`, `expert-securite`, `expert-vulgarisation`, `expert-retour-utilisateur`.
- **Arbitre** `arbitre-equilibre` : tranche les désaccords entre experts selon un ordre fixe (règles du projet, sécurité, mesure de la porte, puis le moins de pages touchées). Il ne note pas et ne peut pas abaisser un seuil.
- **Pas de shell pour les experts** (depuis 0.6.0) : leurs outils sont Read, Grep et Glob. Une note sans preuve vaut zéro (`scripts/verifier-notes.mjs`).

Ce qui a été corrigé depuis la version 0.3.0 : permissions explicites pour les commandes de contrôle des experts ; contrôle du contraste ajouté à la porte ; rapport de couverture (nombre de zones de texte mesurées) ; arbitrage des désaccords défini.

## Vitesse et modes de la porte (version 0.5.0)

- **Mode rapide** (`--rapide`) : pendant les corrections. Largeurs réduites (320, 390, 1024 px) et build réutilisé si le code n'a pas changé. Mesuré : **90 s**.
- **Mode final** (défaut) : toutes les largeurs (320 à 1440 px), build complet. Mesuré : **220 s**. C'est la seule porte qui compte pour accepter le livrable.
- **Vérification de l'environnement** (`verifier-environnement.mjs`) : dit ce qui manque (Node, Playwright, Chromium, fichiers du projet) avant de lancer une livraison.

Aucune garantie n'est perdue : le mode rapide sert seulement à corriger plus vite ; la porte finale reconstruit tout.

## Versions

- 1.5.0 : audit technique. Serveur de contrôle confiné au dossier construit (chemins résolus réellement, liens symboliques et encodages refusés), interface locale et port libre choisi par le système. Statuts explicites des contrôles : « reussi », « echoue », « sans_objet » (ne compte pas dans la fiabilité) et « non_execute » (compte comme un échec) ; un projet sans aucun mécanisme de vérification n'obtient jamais de porte verte ; pendant une livraison, le test d'acceptation doit être exécuté par un script (`test:regles`, `check` ou `test`), pas seulement présent ; `interface_web: false` déclare un projet sans pages. Lecture sûre des JSON (règles, `package.json`), motifs interdits invalides diagnostiqués, plantage interne de la porte converti en rapport d'échec. Verrou contre deux portes simultanées. Navigateur toujours fermé, même sur exception. Mode rapide : le build est refait si une dépendance, un lockfile, une configuration ou un `.env` a changé. Hook d'arrêt : `LIVRAISON_ESSAIS` borné (1 à 50), marqueur illisible toléré, rapport absent ou malformé traité comme un échec, abandon après épuisement consigné dans `.livraison-etat.json` (`terminee: false`) et signalé par un message système. Faux positifs corrigés : icône d'onglet absente, dossier de tests non suivi par Git. Suite de tests du moteur sur projets temporaires (`npm test`, 28 tests).
- 1.4.1 : contrôle d'affichage : un résumé imbriqué dans un bloc replié n'est plus compté comme visible (faux positifs de chevauchement sur des `details` imbriqués). Validé en conditions réelles sur BattleVote (37/37 règles testées, version 1.14.0 en production) et sur Pièces à l'appui (porte 9/9, fusion et publication).
- 1.4.0 : une seule commande pour une demande : test d'acceptation écrit d'abord (exigé par la porte pendant une livraison), choix mineurs notés dans CHOIX.txt, cinq essais au lieu de trois.
- 1.3.1 : page de questions adaptative : une colonne sur téléphone, deux sur ordinateur, zones de toucher de 44 px minimum (mesuré à 320 et 1440 px).
- 1.3.0 : questions de revue en français (`questions/revue-humaine.json`), regroupées, sans doublon. `scripts/questions.mjs` crée une page à choix (relecture humaine, contrôle automatique, sans objet, autre). Les réponses (`.claude/decisions-livraison.json`) retirent les règles du blocage, sauf si un test les couvre.
- 1.2.0 : résultats en français simple (`rapport-livraison/RESUME.txt`) : ce qui est bon, ce qui bloque, et la conclusion. Messages du hook traduits.
- 1.1.0 : classement des règles configurable par projet (`controles` et `revue_humaine` dans `.claude/regles-livraison.json`) ; porte adaptative (check, build, Playwright, dossier servi, routes, thème sombre seulement si déclaré) ; règles numérotées lues ; tests de règles pour BattleVote.
- 1.0.0 : première version finalisée. Toutes les règles bloquantes de CLAUDE.md sont couvertes (17 couvertes, 5 revues humaines). Porte finale du site : 10/10. Ligne 26 couverte par un contrôle automatique (investiture ≠ validation officielle). Retrait temporaire de deux fiches non vérifiées (La Convention, Fabien Roussel).
- 0.8.4 : journal du verdict (`.livraison-journal.log` à la racine, ignoré par Git) : une ligne horodatée par décision du hook (début, échec, blocage, fin).
- 0.8.3 : marqueur de livraison déplacé de `.claude/livraison-en-cours` vers `.livraison-en-cours` à la racine, parce que `.claude/` est protégé par l'environnement et bloquait le démarrage.
- 0.8.2 : tests partiels pour les règles de sourçage (chaque affirmation publiée a un justificatif ; chaque document est sur le domaine de sa source). Ils révèlent de vrais écarts dans les données, qui bloquent le verdict tant qu'ils ne sont pas corrigés.
- 0.8.1 : contrôles ajoutés pour les règles techniques (export statique, commandes, secrets, route d'écriture, mode strict) et classement des règles descriptives en revue humaine. Quatre règles de fond restent bloquantes sans test (sourçage, invention de données, publication directe, investiture).
- 0.8.0 : les règles de CLAUDE.md sont converties en contrôles (`scripts/regles.mjs`). Une règle n'est couverte que si un test du projet porte son étiquette `regle:<identifiant>` ; une règle sans test bloque. Les règles de processus (commits, journal d'erreurs) sont listées en revue humaine. Le verdict « fini » est un hook d'arrêt (`hooks/hooks.json`, `scripts/verdict-arret.mjs`), pas une consigne. Navigateur MCP lancé avec Chrome ou Edge selon l'appareil (`.mcp.json`, `scripts/lancer-navigateur.mjs`). Les sept experts ne sont plus dans le procédé (fichiers conservés dans `agents/`).
- 0.7.0 : la note n'est plus libre : elle est calculée à partir des contrôles réussis (`- [x]`) sur l'ensemble des contrôles (`- [ ]` ou `- [x]`), et un contrôle « BLOQUANT » non passé refuse le livrable. Le seuil de 9,5 est inchangé. Porte finale relancée après correction d'un test mobile (rôle de menu).
- 0.6.0 : les experts n'ont plus d'outil shell ; leur réponse doit citer le rapport et une capture, et finir par `NOTE : x/10` ; `scripts/verifier-notes.mjs` retire toute note sans preuve, sous le seuil ou sans rapport réussi et récent ; la porte capture le haut de page et le thème sombre.
- 0.5.0 : mode rapide et mode final de la porte, vérification de l'environnement, build réutilisé en mode rapide seulement.
- 0.4.0 : sept experts, arbitre, contrôle du contraste, rapport de couverture, permissions des experts corrigées.
- 0.3.0 : porte de qualité mécanique (fonctionnement, règles, affichage à toutes les largeurs), refus de toute note sans porte réussie.
- 0.2.0 : grille et chemins corrigés, outils autorisés, contrôle objectif, deux passages au maximum.
- 0.1.0 : premier prototype, trois experts, grille de notation.

## Journal et marqueur (0.8.4)
- Une livraison en cours est marquée par `.livraison-en-cours` à la racine du projet ; la commande le crée, le hook le retire à la fin.
- Chaque décision du hook est écrite dans `.livraison-journal.log` (heure, tentative, échecs). Ces deux fichiers sont ignorés par Git.
