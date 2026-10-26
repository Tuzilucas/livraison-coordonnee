# Grille de notation

## 1. Porte de qualité (obligatoire, binaire)
Captures produites : haut de page et thème sombre (390 et 1440 px), à chaque largeur et chaque page clé.
Lancée par `scripts/gate.mjs`. Un seul contrôle en échec bloque le livrable.
- Lecture des règles : `CLAUDE.md` et `.claude/regles-livraison.json`, toutes les sections couvertes.
- Fonctionnement : contrôle du projet, construction, tests de bout en bout.
- Règles interdites du projet : aucune occurrence.
- Affichage, pour chaque page clé et chaque largeur (320, 360, 390, 768, 1024, 1440 px) :
  - pas de défilement horizontal, rien hors de l'écran ;
  - pas de superposition entre textes ;
  - cibles tactiles d'au moins 24 px sur petit écran ;
  - contraste du texte suffisant (4,5:1, ou 3:1 pour les grands textes) ;
  - aucune erreur JavaScript.

## 2. Notes des experts (seulement après une porte réussie)
Sept experts répondent par des contrôles `- [x]` (réussi) ou `- [ ]` (échec), chacun avec sa preuve. La note est calculée : part des contrôles réussis, sur 10. Aucune note libre.
- Note minimale acceptée : 9,5 pour chaque expert, et 9,5 de moyenne.
- Une note sans preuve vaut 0 : `scripts/verifier-notes.mjs` contrôle que la réponse cite `rapport-livraison/rapport.json`, une capture existante, et les lignes de code citées, puis qu'elle contient au moins trois contrôles `- [x]` / `- [ ]`.
- Les experts n'ont pas de shell : ils ne lancent aucune commande. Ils lisent le rapport, les captures et le code.
- Le rapport doit être plus récent que le dernier changement de code, sinon la porte est relancée avant de noter.
- Un constat bloquant (sécurité) rend le livrable refusé, quelle que soit la note.

## 3. Arbitrage des désaccords
- Les règles du projet priment sur tout avis.
- Un défaut mesuré par la porte prime sur un avis subjectif.
- L'arbitre ne note jamais et ne peut pas abaisser un seuil ni ignorer un échec de la porte.
- Un désaccord que ces règles ne tranchent pas est signalé à l'utilisateur.

## 4. Plafond
Deux passages au maximum. Au-delà, le livrable n'est pas rendu comme terminé : la liste des points restants est donnée à la place.
