#!/usr/bin/env node
// Hook « Stop » : tant qu'une livraison est en cours (marqueur .livraison-en-cours à la racine), Claude ne peut pas
// s'arrêter sur « fini » sans que la porte finale passe. Si elle échoue, le hook renvoie Claude au travail.
// Après ESSAIS_MAX échecs (5 par défaut), le marqueur est retiré et l'arrêt est autorisé, avec une mention
// persistante « NON terminée » dans .livraison-etat.json, le journal et un message système.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decider, lireRapport, lireTentatives } from "./verdict.mjs";

// Journal du verdict : une ligne horodatée par décision, à la racine du projet (ignoré par Git).
const journal = (projet, texte) => {
  const ligne = `${new Date().toISOString()} ${texte}\n`;
  try {
    appendFileSync(join(projet, ".livraison-journal.log"), ligne);
  } catch {}
  console.error(ligne.trim());
};

let entree = {};
try {
  entree = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {}
const projet = entree.cwd ?? process.cwd();
// Marqueur à la racine du projet (pas dans .claude/, protégé par l'environnement).
const marqueur = join(projet, ".livraison-en-cours");
if (!existsSync(marqueur)) process.exit(0);
journal(projet, `verdict : début, marqueur présent (${marqueur})`);

const gate = join(import.meta.dirname, "gate.mjs");
const r = spawnSync(process.execPath, [gate, projet], {
  cwd: projet,
  encoding: "utf8",
  timeout: 900000,
  maxBuffer: 256 * 1024 * 1024,
});
if (r.error) journal(projet, `verdict : la porte n'a pas pu être exécutée (${r.error.message})`);

const fichierRapport = join(projet, "rapport-livraison", "rapport.json");
const rapport = lireRapport(existsSync(fichierRapport) ? readFileSync(fichierRapport, "utf8") : null);
const tentativesPrecedentes = lireTentatives(existsSync(marqueur) ? readFileSync(marqueur, "utf8") : "0");
const verdict = decider({
  codeGate: r.status,
  rapport,
  tentativesPrecedentes,
  essaisMax: process.env.LIVRAISON_ESSAIS,
});

if (verdict.decision === "terminee") {
  unlinkSync(marqueur);
  journal(projet, "verdict : porte finale réussie, marqueur retiré, arrêt autorisé");
  console.error("Livraison terminée : la porte finale passe.");
  process.exit(0);
}

const echecs = rapport.controles.filter((c) => !c.ok).map((c) => `${c.nom} : ${c.detail}`);
if (rapport.invalide) echecs.unshift(`rapport de la porte : ${rapport.invalide}`);
// Résumé en français écrit par la porte ; à défaut, la liste technique.
const fichierResume = join(projet, "rapport-livraison", "RESUME.txt");
const resumeFr =
  !rapport.invalide && existsSync(fichierResume) ? readFileSync(fichierResume, "utf8") : echecs.join("\n");
journal(
  projet,
  `verdict : porte finale échouée (${verdict.raisonCode}), tentative ${verdict.tentatives}/${verdict.essaisMax}`,
);

if (verdict.decision === "abandon") {
  unlinkSync(marqueur);
  // État persistant : la livraison n'est PAS terminée. Une reprise (commande relancée) le lit en premier.
  writeFileSync(
    join(projet, ".livraison-etat.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        terminee: false,
        abandon: true,
        essais: verdict.tentatives,
        controles_echoues: rapport.controles.filter((c) => !c.ok).map((c) => c.nom),
        rapport_invalide: rapport.invalide ?? null,
      },
      null,
      2,
    ) + "\n",
  );
  journal(
    projet,
    `verdict : ${verdict.essaisMax} tentatives épuisées, marqueur retiré, livraison NON terminée`,
  );
  const message = `LIVRAISON NON TERMINÉE après ${verdict.essaisMax} essais. La porte de qualité échoue encore :\n${resumeFr}`;
  console.error(message);
  console.log(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

writeFileSync(marqueur, String(verdict.tentatives));
journal(
  projet,
  `verdict : blocage renvoyé à Claude ; échecs : ${echecs.join(" ; ") || "aucun détail dans le rapport"}`,
);
console.log(
  JSON.stringify({
    decision: "block",
    reason: `La livraison n'est pas encore acceptée (essai ${verdict.tentatives} sur ${verdict.essaisMax}). Voici ce qui reste à faire :\n\n${resumeFr}\n\nCorrige ces points, relance la vérification, et n'annonce la livraison qu'une fois tout en vert.`,
  }),
);
