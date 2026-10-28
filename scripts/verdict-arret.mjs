#!/usr/bin/env node
// Hook « Stop » : tant qu'une livraison est en cours (marqueur .livraison-en-cours à la racine), Claude ne peut pas
// s'arrêter sur « fini » sans que la porte finale passe. Si elle échoue, le hook renvoie Claude au travail.
// Après ESSAIS_MAX échecs (5 par défaut), ou trois essais de suite avec exactement les mêmes échecs pendant une
// continuation (stop_hook_active), le marqueur est retiré et l'arrêt est autorisé, avec une mention persistante
// « NON terminée » dans .livraison-etat.json, le journal et un message système.
// Claude Code plafonne lui-même à huit continuations consécutives sans appel d'outil (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { langueDe, t } from "./langue.mjs";
import { decider, lireMarqueur, lireRapport } from "./verdict.mjs";

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
const stopHookActive = entree.stop_hook_active === true;
// Marqueur à la racine du projet (pas dans .claude/, protégé par l'environnement).
const marqueurFichier = join(projet, ".livraison-en-cours");
if (!existsSync(marqueurFichier)) process.exit(0);
const langue = langueDe(projet);
journal(
  projet,
  `verdict : début, marqueur présent (${marqueurFichier})${stopHookActive ? ", continuation déjà en cours (stop_hook_active)" : ""}`,
);

const gate = join(import.meta.dirname, "gate.mjs");
// Instant du lancement : seul un rapport écrit après compte. Un rapport d'une exécution antérieure, même tout vert,
// ne prouve rien sur les fichiers actuels et est refusé comme un rapport absent.
const lancement = Date.now();
const r = spawnSync(process.execPath, [gate, projet], {
  cwd: projet,
  encoding: "utf8",
  timeout: 900000,
  maxBuffer: 256 * 1024 * 1024,
});
if (r.error) journal(projet, `verdict : la porte n'a pas pu être exécutée (${r.error.message})`);

const fichierRapport = join(projet, "rapport-livraison", "rapport.json");
const rapport = lireRapport(existsSync(fichierRapport) ? readFileSync(fichierRapport, "utf8") : null, {
  depuis: lancement,
});
const marqueur = lireMarqueur(existsSync(marqueurFichier) ? readFileSync(marqueurFichier, "utf8") : "");
const verdict = decider({
  codeGate: r.status,
  rapport,
  marqueur,
  essaisMax: process.env.LIVRAISON_ESSAIS,
  stopHookActive,
});

if (verdict.decision === "terminee") {
  unlinkSync(marqueurFichier);
  journal(projet, "verdict : porte finale réussie, marqueur retiré, arrêt autorisé");
  console.error(t(langue, "hook_terminee"));
  process.exit(0);
}

const echecs = rapport.controles.filter((c) => !c.ok).map((c) => `${c.nom} : ${c.detail}`);
if (rapport.invalide) echecs.unshift(`rapport de la porte : ${rapport.invalide}`);
// Résumé écrit par la porte (dans la langue du projet) ; à défaut, la liste technique.
const fichierResume = join(projet, "rapport-livraison", "RESUME.txt");
const resume =
  !rapport.invalide && existsSync(fichierResume) ? readFileSync(fichierResume, "utf8") : echecs.join("\n");
journal(
  projet,
  `verdict : porte finale échouée (${verdict.raisonCode}), tentative ${verdict.tentatives}/${verdict.essaisMax}` +
    (verdict.sansProgres ? `, sans progrès ×${verdict.sansProgres}` : ""),
);

if (verdict.decision === "abandon") {
  unlinkSync(marqueurFichier);
  // État persistant : la livraison n'est PAS terminée. Une reprise (commande relancée) le lit en premier.
  writeFileSync(
    join(projet, ".livraison-etat.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        terminee: false,
        abandon: true,
        sans_progres: Boolean(verdict.sansProgresAtteint),
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
    verdict.sansProgresAtteint
      ? `verdict : mêmes échecs ${verdict.sansProgres} fois de suite, marqueur retiré, livraison NON terminée`
      : `verdict : ${verdict.essaisMax} tentatives épuisées, marqueur retiré, livraison NON terminée`,
  );
  const message = verdict.sansProgresAtteint
    ? t(langue, "hook_sans_progres", { n: verdict.sansProgres, resume })
    : t(langue, "hook_abandon", { n: verdict.essaisMax, resume });
  console.error(message);
  console.log(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

writeFileSync(
  marqueurFichier,
  JSON.stringify({
    tentatives: verdict.tentatives,
    sans_progres: verdict.sansProgres,
    empreinte: verdict.empreinte,
  }),
);
journal(
  projet,
  `verdict : blocage renvoyé à Claude ; échecs : ${echecs.join(" ; ") || "aucun détail dans le rapport"}`,
);
console.log(
  JSON.stringify({
    decision: "block",
    reason: t(langue, "hook_bloquer", { n: verdict.tentatives, max: verdict.essaisMax, resume }),
  }),
);
