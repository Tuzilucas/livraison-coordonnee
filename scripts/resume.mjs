// Résumé en français simple des contrôles, pour quelqu'un qui ne code pas.
// Le détail technique reste dans rapport-livraison/ ; ce fichier ne sert qu'à lire le résultat.

const LIBELLES = {
  "lecture-regles": "Les règles du projet (CLAUDE.md) sont bien lues",
  "verification-projet": "Le code passe ses vérifications automatiques (format, qualité, tests)",
  "mécanismes de vérification":
    "Le projet dispose de moyens de vérification (tests, construction ou navigateur)",
  "package.json": "Le fichier package.json est lisible",
  "porte de qualité": "La porte de qualité s'est exécutée sans erreur interne",
  "test d'acceptation de la demande": "Un test prouve que la demande est remplie",
  "couverture des règles de CLAUDE.md": "Chaque règle importante est vérifiée par un test",
  donnees: "Les données du site sont valides",
  construction: "Le site se construit sans erreur",
  "tests-des-regles": "Les tests des règles passent",
  "tests-bout-en-bout": "Les tests de navigation passent",
  affichage: "Les pages s'affichent bien sur téléphone et ordinateur",
};

// Traduit le nom technique d'un contrôle en phrase simple.
export function libelle(nom) {
  if (LIBELLES[nom]) return LIBELLES[nom];
  if (nom.startsWith("interdit")) return "Aucune donnée interne ni secret n'apparaît sur le site";
  if (nom.startsWith("affichage")) return "Les pages s'affichent bien sur téléphone et ordinateur";
  return nom;
}

// Traduit le détail d'un échec (messages techniques courants).
export function detailEnFrancais(detail = "") {
  return detail
    .replace(
      /code (\d+) \(voir ([\w-]+)\.log\)/g,
      "la commande a échoué (détails : rapport-livraison/$2.log)",
    )
    .replace(/voir ([\w-]+)\.log/g, "détails : rapport-livraison/$1.log")
    .replace(/non couvertes/g, "n'ont pas encore de test")
    .replace(/ligne (\d+)/g, "règle ligne $1");
}

// Statut d'un contrôle : « reussi », « echoue », « sans_objet » (le projet n'a pas cette étape) ou
// « non_execute » (l'étape était attendue mais n'a pas pu tourner : c'est un échec).
export function statutDe(c) {
  if (c.statut) return c.statut;
  if (c.ok) return (c.detail ?? "").includes("non applicable") ? "sans_objet" : "reussi";
  return "echoue";
}

// Lignes du résumé : ce qui va, ce qui est sans objet, ce qui bloque, et la conclusion.
export function resumeEnFrancais(controles) {
  const bons = controles.filter((c) => statutDe(c) === "reussi");
  const sansObjet = controles.filter((c) => statutDe(c) === "sans_objet");
  const bloquants = controles.filter((c) => !c.ok);
  const lignes = [];
  const vus = new Set();
  const unique = (ligne) => (vus.has(ligne) ? false : vus.add(ligne));
  for (const c of bons) if (unique(`✅ ${libelle(c.nom)}`)) lignes.push(`✅ ${libelle(c.nom)}`);
  for (const c of sansObjet) lignes.push(`➖ ${libelle(c.nom)} (sans objet pour ce projet)`);
  for (const c of bloquants)
    lignes.push(
      `❌ ${libelle(c.nom)}${statutDe(c) === "non_execute" ? " — non exécuté" : ""}${c.detail ? " — " + detailEnFrancais(c.detail) : ""}`,
    );
  lignes.push("");
  lignes.push(
    bloquants.length === 0
      ? "Conclusion : la livraison peut être acceptée."
      : `Conclusion : la livraison n'est pas acceptée. ${bloquants.length} point(s) à corriger avant de continuer.`,
  );
  return lignes.join("\n");
}
