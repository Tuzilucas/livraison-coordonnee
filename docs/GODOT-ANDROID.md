# Profil Godot 4 — jeu Android

Ce profil permet à Livraison Coordonnée de contrôler un projet Godot 4 sans remplacer la porte de qualité générique. Il s'appuie sur des scripts npm qui servent uniquement de lanceurs vers l'exécutable Godot ; Node.js reste donc le point d'entrée connu de la porte.

## Mise en place dans le projet de jeu

1. Installer Godot 4.x, les modèles d'export correspondants et la chaîne d'export Android (SDK/JDK) sur le poste ou l'agent qui réalise la livraison.
2. Copier `templates/godot-android/package.json` et le dossier `templates/godot-android/scripts/` dans le projet. Si un `package.json` existe déjà, fusionner les scripts au lieu de l'écraser.
3. Copier les tests de démarrage du modèle dans `tests/`, puis les compléter avec des tests correspondant aux mécaniques réellement présentes dans le jeu. Ne jamais créer des tests qui prétendent couvrir une mécanique inexistante.
4. Définir un préréglage d'export Godot nommé exactement `Android` dans `export_presets.cfg`. Ne pas committer les clés privées, mots de passe ni fichiers de signature.
5. Ajouter à la racine du jeu un `CLAUDE.md` qui décrit les règles de gameplay, les invariants de sauvegarde, les performances mobiles, l'accessibilité et les critères d'acceptation. Lancer ensuite `node scripts/regles.mjs .` depuis le dépôt du plugin, comme pour tout autre projet.
6. Lancer la commande Livraison Coordonnée depuis la racine du jeu : `/livraison-coordonnee:livrer <demande>`.

## Contrôles réalisés

- **Vérification du projet** : import/validation headless par Godot, sans lancer l'éditeur graphique.
- **Tests** : exécution du runner GDScript du projet ; un code de sortie non nul bloque la livraison.
- **Construction** : export d'un APK Android de débogage ; l'absence de preset, de modèles ou de SDK est un échec, pas un succès implicite.
- **Test d'acceptation** : le projet doit fournir un test ciblé, créé ou modifié pour la demande en cours et étiqueté `demande:<nom>`. Les scripts du modèle vérifient cette étiquette dans la sortie.
- **Contrôle humain séparé** : une exportation APK réussie ne prouve pas que le jeu est amusant, que les contrôles tactiles sont bons, ni qu'il fonctionne sur chaque appareil. Prévoir une vérification sur appareil ou émulateur Android pour les changements qui touchent au rendu, aux commandes, au cycle de vie, aux performances ou à la sauvegarde.

## Limites importantes

- Les tests headless ne remplacent pas un test sur téléphone.
- L'export de débogage ne valide pas la signature d'une version de production ni la conformité Play Store.
- Le profil ne simule pas automatiquement des sessions longues, la fermeture forcée d'Android, la perte d'espace disque ou la migration d'anciennes sauvegardes. Ajouter des tests explicites pour ces risques.
- Le nom de preset `Android` doit correspondre exactement à celui de `export_presets.cfg`. Si le projet utilise un autre nom, modifier le script et documenter le choix.
- La porte doit être exécutée dans un environnement où Godot, les export templates et le SDK Android sont installés. Un environnement incomplet doit rester rouge.

Le modèle est un point de départ : il ne doit pas être considéré comme une preuve de qualité tant que les tests du jeu n'ont pas été écrits et exécutés réellement.
