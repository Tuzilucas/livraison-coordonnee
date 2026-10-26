#!/usr/bin/env node
// Vérifie que la porte de qualité peut tourner, avant de lancer une livraison. Usage : node verifier-environnement.mjs <projet>
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const projet = resolve(process.argv[2] ?? ".");
const verifs = [];
const ok = (nom, detail = "") => verifs.push({ nom, ok: true, detail });
const ko = (nom, aide) => verifs.push({ nom, ok: false, detail: aide });

const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok("Node.js", process.versions.node) : ko("Node.js", "installer Node.js 20 ou plus récent");
spawnSync("npm", ["--version"]).status === 0 ? ok("npm") : ko("npm", "npm est nécessaire");
existsSync(join(projet, "package.json"))
  ? ok("package.json du projet")
  : ko("package.json", "le projet doit avoir un package.json");
existsSync(join(projet, "CLAUDE.md"))
  ? ok("CLAUDE.md")
  : ko("CLAUDE.md", "ajouter un CLAUDE.md décrivant les règles du projet");
existsSync(join(projet, ".claude", "regles-livraison.json"))
  ? ok("fichier de règles")
  : ko("fichier de règles", "créer .claude/regles-livraison.json");

try {
  const req = createRequire(join(projet, "package.json"));
  req("@playwright/test");
  ok("Playwright");
} catch {
  ko("Playwright", "installer les dépendances du projet (npm install) : Playwright doit être présent");
}
const chromium = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
existsSync(chromium)
  ? ok("Chromium", chromium)
  : ko("Chromium", `définir CHROMIUM_PATH ou installer Chromium (attendu : ${chromium})`);

for (const v of verifs)
  console.log(`${v.ok ? "OK   " : "MANQUE"} ${v.nom}${v.detail ? " : " + v.detail : ""}`);
const pret = verifs.every((v) => v.ok);
console.log(
  pret
    ? "\nEnvironnement prêt pour la porte de qualité."
    : "\nCorriger les points MANQUE avant de lancer une livraison.",
);
process.exit(pret ? 0 : 1);
