#!/usr/bin/env node
// Vérifie les notes des experts. Une note sans preuve vaut zéro, une note sous 9,5 ne passe pas.
// Usage : node verifier-notes.mjs <dossier-du-projet>
// Entrée : rapport-livraison/notes/<expert>.md, une réponse complète par expert, copiée telle quelle par l'orchestrateur.
// Chaque expert répond par des contrôles « - [x] » (réussi) ou « - [ ] » (échec), chacun avec sa preuve.
// La note est la part des contrôles réussis sur 10 ; un contrôle « BLOQUANT » non passé refuse le livrable.
// Sortie : tableau des notes retenues ; code 0 seulement si toutes passent.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const EXPERTS = [
  "expert-code",
  "expert-ergonomie",
  "expert-visuel",
  "expert-design",
  "expert-securite",
  "expert-vulgarisation",
  "expert-retour-utilisateur",
];
const SEUIL = 9.5;
const projet = resolve(process.argv[2] ?? ".");
const rapportDir = join(projet, "rapport-livraison");
const bloquants = [];

// Le dernier changement de code, dans les mêmes dossiers que la porte.
function codeModifieDepuis(instant) {
  const racines = ["src", "public", "data", "scripts", "package.json", "next.config.ts", "next.config.mjs"]
    .map((f) => join(projet, f))
    .filter((f) => existsSync(f));
  const parcourir = (p) =>
    statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => parcourir(join(p, f))) : [p];
  return racines.flatMap(parcourir).some((f) => statSync(f).mtimeMs > instant);
}

// 1. La porte doit avoir réussi, et son rapport doit être plus récent que le code.
const rapportFile = join(rapportDir, "rapport.json");
if (!existsSync(rapportFile)) bloquants.push("rapport.json absent : la porte finale n'a pas été lancée");
else {
  const rapport = JSON.parse(readFileSync(rapportFile, "utf8"));
  if (!rapport.reussi) bloquants.push("la porte a échoué : aucune note ne compte");
  if (codeModifieDepuis(statSync(rapportFile).mtimeMs))
    bloquants.push("du code a changé après la porte : la relancer avant de noter");
}

// 2. Chaque expert : une réponse, une note, et des preuves vérifiées.
const lignes = [];
let total = 0;
for (const expert of EXPERTS) {
  const fichier = join(rapportDir, "notes", `${expert}.md`);
  if (!existsSync(fichier)) {
    lignes.push({ expert, note: 0, raison: "réponse absente" });
    continue;
  }
  const texte = readFileSync(fichier, "utf8");
  // La note n'est jamais libre : elle est calculée à partir des contrôles « - [x] » réussis sur « - [ ] » + « - [x] ».
  const controles = [...texte.matchAll(/^\s*-\s*\[( |x|X)\]\s*(.*)$/gm)];
  if (controles.length < 3) {
    lignes.push({
      expert,
      note: 0,
      raison: "moins de 3 contrôles « - [x] » / « - [ ] » (réponse incomplète ou refus de noter)",
    });
    continue;
  }
  const reussis = controles.filter((c) => c[1].toLowerCase() === "x").length;
  const bloquant = controles.find((c) => c[1] === " " && /BLOQUANT/i.test(c[2]));
  const note = Math.round(((10 * reussis) / controles.length) * 10) / 10;
  const problemes = [];
  // Le rapport de porte et au moins une capture doivent être cités, et chaque capture citée doit exister.
  if (!texte.includes("rapport-livraison/rapport.json"))
    problemes.push("ne cite pas rapport-livraison/rapport.json");
  const captures = [...texte.matchAll(/rapport-livraison\/(capture-[\w.-]+\.png)/g)].map((m) => m[1]);
  if (captures.length === 0) problemes.push("ne cite aucune capture");
  for (const c of new Set(captures))
    if (!existsSync(join(rapportDir, c))) problemes.push(`capture citée introuvable : ${c}`);
  // Les lignes de code citées (fichier:ligne) doivent exister, à cette ligne près.
  for (const m of texte.matchAll(/([\w./[\]-]+\.(?:ts|tsx|mjs|js|css|json|html|md)):(\d+)/g)) {
    const f = join(projet, m[1]);
    if (!existsSync(f)) {
      problemes.push(`fichier cité introuvable : ${m[1]}`);
      continue;
    }
    const nb = readFileSync(f, "utf8").split("\n").length;
    if (Number(m[2]) > nb) problemes.push(`ligne citée au-delà de la fin : ${m[1]}:${m[2]}`);
  }
  if (bloquant) problemes.push(`contrôle bloquant non passé : ${bloquant[2].slice(0, 80)}`);
  if (problemes.length)
    lignes.push({ expert, note: 0, raison: problemes.join(" ; ") + ` (la note calculée était ${note})` });
  else
    lignes.push({
      expert,
      note,
      raison: note >= SEUIL ? "" : `${reussis}/${controles.length} contrôles, sous le seuil de ${SEUIL}`,
    });
}

// 3. Verdict : chaque note et la moyenne doivent atteindre le seuil.
for (const l of lignes) total += l.note;
const moyenne = total / EXPERTS.length;
for (const l of lignes)
  console.log(`${l.note.toFixed(1).padStart(4)}/10  ${l.expert}${l.raison ? "  -> " + l.raison : ""}`);
console.log(
  `\nMoyenne : ${moyenne.toFixed(2).replace(".", ",")}/10 (seuil ${SEUIL} pour chacun et pour la moyenne)`,
);
const accepte = bloquants.length === 0 && lignes.every((l) => l.note >= SEUIL) && moyenne >= SEUIL;
for (const b of bloquants) console.log("BLOQUANT : " + b);
console.log(accepte ? "NOTES ACCEPTÉES" : "NOTES REFUSÉES : livrable non rendu comme terminé");
process.exit(accepte ? 0 : 1);
