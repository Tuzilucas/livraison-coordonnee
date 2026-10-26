#!/usr/bin/env node
// Crée une page de questions en français (rapport-livraison/questions.html) pour les règles
// qui demandent une décision humaine. Chaque règle n'apparaît que dans une question.
// Usage : node questions.mjs <dossier-du-projet>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projet = resolve(process.argv[2] ?? ".");
const regles = JSON.parse(readFileSync(join(projet, ".claude", "regles-livraison.json"), "utf8")).regles;
const questions = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "questions", "revue-humaine.json"), "utf8"),
);

const CHOIX = [
  ["humaine", "Relecture humaine : je vérifie moi-même"],
  ["auto", "Contrôle automatique : le plugin doit le vérifier (à écrire)"],
  ["ignorer", "Sans objet : cette règle ne s'applique pas à ce projet"],
  ["autre", "Autre : je précise ci-dessous"],
];

// Règles à trancher : celles qui ne sont couvertes par aucun test.
const aTrancher = regles.filter((r) => !r.testee);
const dejaPrises = new Map();
const blocs = questions.map((q) => {
  const concernees = aTrancher.filter((r) => q.motifs.some((m) => new RegExp(m, "i").test(r.texte)));
  for (const r of concernees) dejaPrises.set(r.id, (dejaPrises.get(r.id) ?? 0) + 1);
  return { ...q, concernees };
});
const doublons = [...dejaPrises.values()].filter((n) => n > 1).length;
const sansQuestion = aTrancher.filter((r) => !dejaPrises.has(r.id));

const echap = (t) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const regle = (r) => `<li>Ligne ${r.ligne} : ${echap(r.texte.replace(/\*\*/g, "").replace(/`/g, ""))}</li>`;
const bloc = (q) => `
<fieldset class="question" data-id="${q.id}">
  <legend><span class="titre">${echap(q.titre)}</span></legend>
  <p>${echap(q.question)}</p>
  <details><summary>Règles concernées (${q.concernees.length})</summary><ul>${q.concernees.map(regle).join("")}</ul></details>
  ${CHOIX.map(([v, l]) => `<label class="choix"><input type="radio" name="${q.id}" value="${v}"> ${echap(l)}</label>`).join("\n  ")}
  <label class="precision">Précision (facultatif) <textarea data-precision="${q.id}" rows="2"></textarea></label>
</fieldset>`;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Questions de revue · livraison</title>
<style>
  :root { --bg: #f4f5fa; --surface: #ffffff; --ink: #141a2e; --muted: #4f5870; --line: #d9deea; --accent: #1d3fb0; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111425; --surface: #1b2038; --ink: #eef0f8; --muted: #b7bdd3; --line: #33395a; --accent: #8aa2ff; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 20px 16px 48px; box-sizing: border-box; }
  .liste { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 14px 0; }
  @media (min-width: 900px) { .liste { grid-template-columns: 1fr 1fr; } }
  h1 { font-size: 24px; margin: 0 0 6px; }
  .question { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; margin: 0; min-width: 0; }
  .titre { font-weight: 700; color: var(--accent); }
  .choix { display: flex; align-items: center; gap: 10px; padding: 10px 6px; min-height: 44px; cursor: pointer; }
  .choix input { width: 22px; height: 22px; flex: none; margin: 0; }
  .precision { display: block; margin-top: 8px; color: var(--muted); font-size: 14px; }
  textarea { width: 100%; box-sizing: border-box; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); padding: 8px; font: inherit; }
  button { font: inherit; padding: 12px 16px; border-radius: 10px; border: 0; background: var(--accent); color: #fff; cursor: pointer; min-height: 44px; }
  textarea { font-size: 16px; }
  details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  #sortie { width: 100%; min-height: 160px; margin-top: 12px; font: 13px ui-monospace, monospace; }
  .info { color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<main>
  <h1>Questions de revue</h1>
  <p class="info">${aTrancher.length} règles à trancher, regroupées en ${questions.length} questions. Choisis une réponse par question, puis clique sur « Préparer mes réponses ». Copie le texte obtenu et envoie-le-moi : je l'enregistre dans le projet.</p>
  <form id="formulaire" class="liste">
    ${blocs.map(bloc).join("\n")}
  </form>
  <button type="button" id="generer">Préparer mes réponses</button>
  <textarea id="sortie" readonly placeholder="Le texte à copier apparaîtra ici."></textarea>
  <p class="info" id="etat"></p>
</main>
<script>
  const QUESTIONS = ${JSON.stringify(questions.map((q) => q.id))};
  document.getElementById("generer").addEventListener("click", () => {
    const decisions = {};
    const manquantes = [];
    for (const id of QUESTIONS) {
      const choix = document.querySelector('input[name="' + id + '"]:checked');
      if (!choix) { manquantes.push(id); continue; }
      const precision = document.querySelector('textarea[data-precision="' + id + '"]').value.trim();
      decisions[id] = { choix: choix.value, precision };
    }
    document.getElementById("sortie").value = JSON.stringify({ decisions }, null, 2);
    document.getElementById("etat").textContent = manquantes.length
      ? manquantes.length + " question(s) sans réponse : " + manquantes.join(", ")
      : "Toutes les questions ont une réponse. Copie le texte ci-dessus.";
  });
</script>
</body>
</html>
`;

mkdirSync(join(projet, "rapport-livraison"), { recursive: true });
writeFileSync(join(projet, "rapport-livraison", "questions.html"), html);
console.log(
  `${aTrancher.length} règles à trancher, ${questions.length} questions, ${doublons} règle(s) dans plusieurs questions, ${sansQuestion.length} sans question.`,
);
for (const r of sansQuestion) console.log(`  sans question : ligne ${r.ligne}`);
