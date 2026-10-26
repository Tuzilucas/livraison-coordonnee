# Contribuer · Contributing

_English below._

## Avant d'ouvrir une issue

- Dites quel projet (type, outils : `npm run check`, `build`, Playwright ?) et quelle version du plugin.
- Joignez `rapport-livraison/RESUME.txt` et les lignes utiles de `.livraison-journal.log` : ils disent exactement ce que la porte a vu.
- Un faux positif (la porte refuse quelque chose de correct) est une issue prioritaire : donnez la page et la largeur concernées.

## Lancer les tests

```bash
git clone https://github.com/Tuzilucas/livraison-coordonnee
cd livraison-coordonnee
npm test
```

28 tests sur des projets temporaires (créés dans le dossier temporaire du système, supprimés ensuite). Chromium et Playwright sont nécessaires pour les scénarios d'affichage ; sans eux, ces tests échouent, ce qui est attendu.

## Ce qui est accepté

- Une correction de défaut **avec un test qui échoue avant et passe après**.
- Un nouveau contrôle mesurable, désactivable par configuration, avec son test et sa ligne dans `NOTICE.md`.
- Une amélioration de robustesse (chemins, codes de sortie, messages d'erreur).
- Des traductions de la documentation.

## Ce qui n'est pas accepté

- Affaiblir un contrôle, un seuil ou un test pour obtenir une porte verte.
- Un « mode sans porte » ou une option qui permet d'annoncer « terminé » sans vérification : c'est le contraire du but du plugin.
- Une dépendance npm à l'exécution. Le plugin tourne avec Node seul ; Playwright est cherché dans le projet ou à côté du plugin, jamais imposé.
- Un changement de comportement sans mise à jour de `NOTICE.md` et de l'historique des versions.

## Style

- Scripts en JavaScript moderne (`.mjs`), Node 20 ou plus récent, sans transpilation.
- Noms et messages en français (la documentation anglaise est une traduction, le français fait foi).
- Mise en forme : Prettier, 110 colonnes (`.prettierrc.json`).
- Chaque contrôle écrit son statut : `reussi`, `echoue`, `sans_objet` ou `non_execute`. Un contrôle attendu qui ne tourne pas est `non_execute`, jamais `sans_objet`.

## Pull request

Une PR = une intention. Décrivez le défaut ou le besoin, le test ajouté, et ce que vous avez lancé (`npm test`, et idéalement la porte sur un vrai projet). Le mainteneur répond sous quelques jours ; pas de garantie de délai.

---

# Contributing (English)

## Before opening an issue

- Say which kind of project (tooling: `npm run check`, `build`, Playwright?) and which plugin version.
- Attach `rapport-livraison/RESUME.txt` and the relevant lines of `.livraison-journal.log`: they state exactly what the gate saw.
- A false positive (the gate rejects something correct) is a priority issue: give the page and viewport width.

## Running the tests

```bash
git clone https://github.com/Tuzilucas/livraison-coordonnee
cd livraison-coordonnee
npm test
```

28 tests on temporary projects (created in the system temp folder, removed afterwards). Chromium and Playwright are required for the display scenarios; without them those tests fail, which is expected.

## What is accepted

- A bug fix **with a test that fails before and passes after**.
- A new measurable check, switchable by configuration, with its test and its line in `NOTICE.md`.
- Robustness improvements (paths, exit codes, error messages).
- Documentation translations.

## What is not accepted

- Weakening a check, a threshold or a test to get a green gate.
- A "no gate" mode or any option that lets the agent say "done" without verification: that is the opposite of the plugin's purpose.
- A runtime npm dependency. The plugin runs on Node alone; Playwright is looked up in the project or next to the plugin, never imposed.
- A behaviour change without updating `NOTICE.md` and the version history.

## Style

- Modern JavaScript (`.mjs`), Node 20+, no transpilation.
- Identifiers and messages are in French (the English documentation is a translation; French is authoritative).
- Formatting: Prettier, 110 columns (`.prettierrc.json`).
- Every check records a status: `reussi` (passed), `echoue` (failed), `sans_objet` (not applicable) or `non_execute` (expected but not run). An expected check that did not run is `non_execute`, never `sans_objet`.

## Pull requests

One PR, one intent. Describe the defect or need, the test you added, and what you ran (`npm test`, ideally the gate on a real project). The maintainer answers within a few days; no guaranteed turnaround.
