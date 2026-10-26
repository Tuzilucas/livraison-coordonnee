// Résumé en français simple des contrôles, pour quelqu'un qui ne code pas.
// Le détail technique reste dans rapport-livraison/ ; ce fichier ne sert qu'à lire le résultat.

const LIBELLES = {
  "lecture-regles": "Les règles du projet (CLAUDE.md) sont bien lues",
  "verification-projet": "Le code passe ses vérifications automatiques (format, qualité, tests)",
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

// Lignes du résumé : ce qui va, ce qui bloque, et la conclusion.
export function resumeEnFrancais(controles) {
  const bons = controles.filter((c) => c.ok && !(c.detail ?? "").includes("non applicable"));
  const bloquants = controles.filter((c) => !c.ok);
  const lignes = [];
  const vus = new Set();
  const unique = (ligne) => (vus.has(ligne) ? false : vus.add(ligne));
  for (const c of bons) if (unique(`✅ ${libelle(c.nom)}`)) lignes.push(`✅ ${libelle(c.nom)}`);
  for (const c of controles.filter((c) => c.ok && (c.detail ?? "").includes("non applicable")))
    lignes.push(`➖ ${libelle(c.nom)} (sans objet pour ce projet)`);
  for (const c of bloquants)
    lignes.push(`❌ ${libelle(c.nom)}${c.detail ? " — " + detailEnFrancais(c.detail) : ""}`);
  lignes.push("");
  lignes.push(
    bloquants.length === 0
      ? "Conclusion : la livraison peut être acceptée."
      : `Conclusion : la livraison n'est pas acceptée. ${bloquants.length} point(s) à corriger avant de continuer.`,
  );
  return lignes.join("\n");
}
