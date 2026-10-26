#!/usr/bin/env node
// Hook « Stop » : tant qu'une livraison est en cours (marqueur .livraison-en-cours à la racine), Claude ne peut pas
// s'arrêter sur « fini » sans que la porte finale passe. Si elle échoue, le hook renvoie Claude au travail.
// Après 3 échecs, le marqueur est retiré et l'arrêt est autorisé, avec la mention « NON terminé ».
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Journal du verdict : une ligne horodatée par décision, à la racine du projet (ignoré par Git).
const journal = (projet, texte) => {
  const ligne = `${new Date().toISOString()} ${texte}\n`;
  appendFileSync(join(projet, ".livraison-journal.log"), ligne);
  console.error(ligne.trim());
};

const entree = JSON.parse(readFileSync(0, "utf8") || "{}");
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

if (r.status === 0) {
  unlinkSync(marqueur);
  journal(projet, "verdict : porte finale réussie, marqueur retiré, arrêt autorisé");
  console.error("Livraison terminée : la porte finale passe.");
  process.exit(0);
}

// Nombre d'essais avant abandon : 5 par défaut, modifiable avec LIVRAISON_ESSAIS.
const ESSAIS_MAX = Number(process.env.LIVRAISON_ESSAIS) || 5;
const tentatives = Number(readFileSync(marqueur, "utf8") || 0) + 1;
journal(projet, `verdict : porte finale échouée (code ${r.status}), tentative ${tentatives}/${ESSAIS_MAX}`);
const rapport = JSON.parse(
  readFileSync(join(projet, "rapport-livraison", "rapport.json"), "utf8").replace(/^﻿/, "") || "{}",
);
const echecs = (rapport.controles ?? []).filter((c) => !c.ok).map((c) => `${c.nom} : ${c.detail}`);
// Résumé en français écrit par la porte ; à défaut, la liste technique.
const resumeFr = existsSync(join(projet, "rapport-livraison", "RESUME.txt"))
  ? readFileSync(join(projet, "rapport-livraison", "RESUME.txt"), "utf8")
  : echecs.join("\n");

if (tentatives >= ESSAIS_MAX) {
  unlinkSync(marqueur);
  journal(projet, `verdict : ${ESSAIS_MAX} tentatives épuisées, marqueur retiré, livraison NON terminée`);
  console.error(`La livraison n'est pas terminée après ${ESSAIS_MAX} essais. Points restants :\n` + resumeFr);
  process.exit(0);
}
writeFileSync(marqueur, String(tentatives));
journal(
  projet,
  `verdict : blocage renvoyé à Claude ; échecs : ${echecs.join(" ; ") || "aucun détail dans le rapport"}`,
);
console.log(
  JSON.stringify({
    decision: "block",
    reason: `La livraison n'est pas encore acceptée (essai ${tentatives} sur ${ESSAIS_MAX}). Voici ce qui reste à faire :\n\n${resumeFr}\n\nCorrige ces points, relance la vérification, et n'annonce la livraison qu'une fois tout en vert.`,
  }),
);
