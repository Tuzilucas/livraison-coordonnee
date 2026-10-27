#!/usr/bin/env node
// Vérifie que la porte de qualité peut tourner, avant de lancer une livraison. Usage : node verifier-environnement.mjs <projet>
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { lancer, navigateurTrouve } from "./processus.mjs";

const projet = resolve(process.argv[2] ?? ".");
const verifs = [];
const ok = (nom, detail = "") => verifs.push({ nom, ok: true, detail });
const ko = (nom, aide) => verifs.push({ nom, ok: false, detail: aide });

const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok("Node.js", process.versions.node) : ko("Node.js", "installer Node.js 20 ou plus récent");
// lancer() : sous Windows, npm est un .cmd que spawnSync seul ne trouve pas (ENOENT) — faux « manque ».
const npm = lancer("npm", ["--version"], { encoding: "utf8" });
npm.status === 0 ? ok("npm", String(npm.stdout).trim()) : ko("npm", "npm est nécessaire (il doit être dans le PATH)");
existsSync(join(projet, "package.json"))
  ? ok("package.json du projet")
  : ko("package.json", "le projet doit avoir un package.json");
existsSync(join(projet, "CLAUDE.md"))
  ? ok("CLAUDE.md")
  : ko("CLAUDE.md", "ajouter un CLAUDE.md décrivant les règles du projet");
existsSync(join(projet, ".claude", "regles-livraison.json"))
  ? ok("fichier de règles")
  : ko("fichier de règles", "créer .claude/regles-livraison.json (node scripts/regles.mjs <projet>)");

// Projet sans pages (interface_web: false dans .claude/livraison.json ou le fichier de règles) : Playwright et
// Chromium ne servent à rien, les contrôles d'affichage sont sans objet.
let sansInterfaceWeb = false;
for (const f of ["livraison.json", "regles-livraison.json"]) {
  try {
    const req = createRequire(join(projet, "package.json"));
    if (req(join(projet, ".claude", f)).interface_web === false) sansInterfaceWeb = true;
  } catch {}
}
if (sansInterfaceWeb) {
  ok("Playwright", "sans objet : projet sans interface web");
  ok("Chromium", "sans objet : projet sans interface web");
} else {
  try {
    const req = createRequire(join(projet, "package.json"));
    req("@playwright/test");
    ok("Playwright");
  } catch {
    ko("Playwright", "installer les dépendances du projet (npm install) : Playwright doit être présent");
  }
  const navigateur = navigateurTrouve();
  navigateur
    ? ok("Chromium", navigateur)
    : ko(
        "Chromium",
        "définir CHROMIUM_PATH, installer le navigateur de Playwright (npx playwright install chromium), ou Chrome/Edge",
      );
}

for (const v of verifs)
  console.log(`${v.ok ? "OK   " : "MANQUE"} ${v.nom}${v.detail ? " : " + v.detail : ""}`);
const pret = verifs.every((v) => v.ok);
console.log(
  pret
    ? "\nEnvironnement prêt pour la porte de qualité."
    : "\nCorriger les points MANQUE avant de lancer une livraison.",
);
process.exit(pret ? 0 : 1);
