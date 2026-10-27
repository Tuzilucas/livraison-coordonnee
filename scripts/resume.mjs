// Résumé en langage courant des contrôles, pour quelqu'un qui ne code pas.
// Le détail technique reste dans rapport-livraison/ ; ce fichier ne sert qu'à lire le résultat.
// Langue : fr par défaut ; en, es, de, it via scripts/langue.mjs.
import { t, traduireDetail } from "./langue.mjs";

const CLES = [
  "lecture-regles",
  "verification-projet",
  "mécanismes de vérification",
  "package.json",
  "porte de qualité",
  "test d'acceptation de la demande",
  "couverture des règles de CLAUDE.md",
  "donnees",
  "construction",
  "tests-projet",
  "execution-test-acceptation",
  "tests-des-regles",
  "tests-bout-en-bout",
  "affichage",
];

// Traduit le nom technique d'un contrôle en phrase simple.
export function libelle(nom, langue = "fr") {
  if (CLES.includes(nom)) return t(langue, nom);
  if (nom.startsWith("interdit")) return t(langue, "interdit");
  if (nom.startsWith("affichage")) return t(langue, "affichage");
  return nom;
}

// Traduit le détail d'un échec (messages techniques courants).
export function detailEnFrancais(detail = "", langue = "fr") {
  const fr = detail
    .replace(
      /code (\d+) \(voir ([\w-]+)\.log\)/g,
      "la commande a échoué (détails : rapport-livraison/$2.log)",
    )
    .replace(/voir ([\w-]+)\.log/g, "détails : rapport-livraison/$1.log")
    .replace(/non couvertes/g, "n'ont pas encore de test")
    .replace(/ligne (\d+)/g, "règle ligne $1");
  return traduireDetail(langue, fr);
}

// Statut d'un contrôle : « reussi », « echoue », « sans_objet » (le projet n'a pas cette étape) ou
// « non_execute » (l'étape était attendue mais n'a pas pu tourner : c'est un échec).
export function statutDe(c) {
  if (c.statut) return c.statut;
  if (c.ok) return (c.detail ?? "").includes("non applicable") ? "sans_objet" : "reussi";
  return "echoue";
}

// Lignes du résumé : ce qui va, ce qui est sans objet, ce qui bloque, et la conclusion.
export function resumeEnFrancais(controles, langue = "fr") {
  const bons = controles.filter((c) => statutDe(c) === "reussi");
  const sansObjet = controles.filter((c) => statutDe(c) === "sans_objet");
  const bloquants = controles.filter((c) => !c.ok);
  const lignes = [];
  const vus = new Set();
  const unique = (ligne) => (vus.has(ligne) ? false : vus.add(ligne));
  for (const c of bons)
    if (unique(`✅ ${libelle(c.nom, langue)}`)) lignes.push(`✅ ${libelle(c.nom, langue)}`);
  for (const c of sansObjet) lignes.push(`➖ ${libelle(c.nom, langue)} (${t(langue, "sans_objet")})`);
  for (const c of bloquants)
    lignes.push(
      `❌ ${libelle(c.nom, langue)}${statutDe(c) === "non_execute" ? " — " + t(langue, "non_execute") : ""}${
        c.detail ? " — " + detailEnFrancais(c.detail, langue) : ""
      }`,
    );
  lignes.push("");
  lignes.push(
    bloquants.length === 0 ? t(langue, "conclusion_ok") : t(langue, "conclusion_ko", { n: bloquants.length }),
  );
  return lignes.join("\n");
}

/** Même résumé, nom neutre. */
export const resume = resumeEnFrancais;
