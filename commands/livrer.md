---
description: Réalise une demande en une seule commande : écrit d'abord le test qui prouve qu'elle est remplie, produit, vérifie et corrige jusqu'au vert. Répond dans la langue de la demande (fr, en, es, de, it). Pose une question seulement si c'est vraiment bloqué.
argument-hint: <demande, dans n'importe quelle langue>
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(node:*), Bash(npm:*), Bash(npx:*), Bash(git:*)
---

Demande : $ARGUMENTS

Procédure, sans interruption :
0. **Reprendre si nécessaire** : si `.livraison-en-cours`, `.livraison-etat.json` ou `rapport-livraison/CHOIX.txt` existent déjà, une livraison a été coupée. Lis-les, ne refais pas ce qui est fait (tests déjà écrits, choix déjà notés), et continue à l'étape où elle s'est arrêtée.
1. **Marquer la livraison** : crée `.livraison-en-cours` à la racine du projet (contenu `0`), s'il n'existe pas déjà.
2. **Langue, puis règles** : lance `node ${CLAUDE_PLUGIN_ROOT}/scripts/langue-demande.mjs . "$ARGUMENTS"` : il détecte la langue de la demande (fr, en, es, de, it), l'enregistre pour le projet et l'affiche. À partir de là, tout ce que tu écris (choix, rendu final, questions) est dans cette langue ; la porte et le hook la lisent aussi. Puis lis `CLAUDE.md` et lance `node ${CLAUDE_PLUGIN_ROOT}/scripts/regles.mjs .`.
3. **Trancher les choix mineurs toi-même** : pour chaque ambiguïté, prends la solution la plus simple et la plus conforme à `CLAUDE.md`. Note chaque choix dans `rapport-livraison/CHOIX.txt` (une ligne : question, choix, raison).
4. **Écrire le test d'acceptation d'abord** : dans `tests/`, un test dont le nom de test contient `demande:<nom-court>`, qui vérifie la demande avec une preuve par l'échec (il doit échouer avant la modification). Cette étiquette doit apparaître dans la sortie du test. Il doit être exécuté par un script de `package.json` : de préférence un script dédié `test:acceptance`, sinon `test:regles` ou `test` existant. Ce script doit lancer réellement le fichier de test : la porte exige que sa sortie montre l'étiquette ou le fichier, un script qui rend 0 sans rien lancer est refusé.
5. **Produire** la modification demandée, en modifications ciblées, sans toucher aux textes ni aux données qui ne sont pas demandés.
6. **Corriger jusqu'au vert** : lance `node ${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs . --rapide`, lis `rapport-livraison/RESUME.txt`, corrige chaque point, relance.
7. **Arrêt** : ne déclare jamais la livraison terminée toi-même. Quand tu t'arrêtes, le hook lance la porte finale et te renvoie au travail si elle échoue (cinq essais au maximum).
8. **Rendu final, en langage simple, dans la langue de la demande** : ce qui a été fait, les choix pris (tirés de `CHOIX.txt`), ce qui reste. Pas de question sauf si un point est bloqué et impossible à trancher.

Règles absolues :
- Tu ne modifies jamais un test d'acceptation, un contrôle, `gate.mjs` ou `CLAUDE.md` pour faire passer la porte.
- Tu ne committes, ne pousses et ne publies que si la demande le dit explicitement.
