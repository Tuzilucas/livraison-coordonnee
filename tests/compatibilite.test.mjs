// Compatibilité Windows et projets à plusieurs : fins de ligne \r\n, lancement de npm, configuration stable.
// Chaque cas reproduit un défaut mesuré le 27/10/2026 sur un poste Windows 11 (Node 24) avec un projet Maven.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { lancer, ligneDeCommande } from "../scripts/processus.mjs";
import { PLUGIN, controle, creerProjet, lancerPorte, nettoyer } from "./aide.mjs";

const crees = [];
const projet = (o) => {
  const d = creerProjet(o);
  crees.push(d);
  return d;
};
after(() => crees.forEach(nettoyer));

const REGLES = join(PLUGIN, "scripts", "regles.mjs");
const lancerRegles = (dir, ...args) =>
  lancer(process.execPath, [REGLES, dir, ...args], { cwd: dir, encoding: "utf8" });
const lireRegles = (dir) => JSON.parse(readFileSync(join(dir, ".claude", "regles-livraison.json"), "utf8"));

test("W1. un CLAUDE.md aux fins de ligne Windows (\\r\\n) donne les mêmes règles qu'en \\n", () => {
  const dir = projet();
  writeFileSync(join(dir, "CLAUDE.md"), "# Projet\r\n\r\n## Règles\r\n\r\n- Règle une.\r\n- Règle deux.\r\n");
  const r = lancerRegles(dir);
  assert.equal(r.status, 0, r.stderr);
  const regles = lireRegles(dir);
  assert.equal(regles.regles.length, 2, "deux puces, deux règles (zéro avant le correctif)");
  assert.deepEqual(regles.sections_claude_md, ["Règles"]);
  assert.equal(regles.regles[0].texte, "Règle une.", "pas de \\r en fin de texte");
  // La porte lit les mêmes titres et accepte l'empreinte calculée sur le texte brut.
  const porte = lancerPorte(dir);
  assert.equal(controle(porte.rapport, "lecture-regles").ok, true, controle(porte.rapport, "lecture-regles").detail);
});

test("W2. un .gitignore en \\r\\n qui contient déjà les entrées n'est pas réécrit à chaque passage", () => {
  const dir = projet();
  const contenu =
    "node_modules/\r\n# Plugin livraison\r\n.livraison-en-cours\r\n.livraison-journal.log\r\n.livraison-etat.json\r\n.livraison-porte.lock\r\nrapport-livraison/\r\n";
  writeFileSync(join(dir, ".gitignore"), contenu);
  lancerPorte(dir);
  assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), contenu, "aucune ligne rajoutée");
});

test("W3. lancer() exécute npm sur cet appareil (sous Windows, npm est un .cmd)", () => {
  const r = lancer("npm", ["--version"], { encoding: "utf8" });
  assert.equal(r.error, undefined, r.error?.message);
  assert.equal(r.status, 0);
  assert.match(String(r.stdout).trim(), /^\d+\.\d+\.\d+/);
});

test("W4. ligneDeCommande() cite les arguments qui en ont besoin", () => {
  assert.equal(ligneDeCommande("npm", ["run", "build"]), "npm run build");
  assert.equal(ligneDeCommande("node", ["mon script.mjs", 'a"b']), 'node "mon script.mjs" "a""b"');
});

test("W5. regles.mjs conserve interface_web et theme_sombre d'une génération à l'autre", () => {
  const dir = projet({ regles: { sections_claude_md: ["Règles"], regles: [], interface_web: false, theme_sombre: true } });
  assert.equal(lancerRegles(dir).status, 0);
  const regles = lireRegles(dir);
  assert.equal(regles.interface_web, false, "effacé à chaque régénération avant le correctif");
  assert.equal(regles.theme_sombre, true);
  // Sans mention : projet avec interface web, explicitement.
  const dir2 = projet();
  assert.equal(lancerRegles(dir2).status, 0);
  assert.equal(lireRegles(dir2).interface_web, true);
});

test("W6. .claude/livraison.json (configuration stable, versionnable) prime sur le fichier généré", () => {
  const dir = projet();
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(
    join(dir, ".claude", "livraison.json"),
    JSON.stringify({
      interface_web: false,
      largeurs: [1157, 1366],
      langue: "fr",
      controles: [{ id: "traduction-mes", motif: "portugais" }],
      revue_humaine: ["^Principe"],
    }),
  );
  writeFileSync(join(dir, "CLAUDE.md"), "# Projet\n\n## Règles\n\n- Principe général.\n- Libellé en portugais.\n");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "tests", "regles.test.mjs"), "// regle:regles-libelle-en-portugais\n");
  const r = lancerRegles(dir);
  assert.equal(r.status, 0, r.stderr);
  const regles = lireRegles(dir);
  assert.equal(regles.interface_web, false);
  assert.deepEqual(regles.largeurs, [1157, 1366]);
  const principe = regles.regles.find((x) => x.texte.startsWith("Principe"));
  const portugais = regles.regles.find((x) => x.texte.includes("portugais"));
  assert.equal(principe.bloquante, false, "classée en revue humaine par le motif du projet");
  assert.equal(portugais.controle, "traduction-mes");
  assert.equal(portugais.couverte, true, "test étiqueté trouvé dans tests/");
  assert.deepEqual(regles.non_couvertes, []);
  // La porte, sans pages ni Playwright, accepte le projet : l'affichage est sans objet.
  const porte = lancerPorte(dir);
  assert.equal(controle(porte.rapport, "affichage").statut, "sans_objet");
  assert.equal(porte.code, 0, porte.resume);
  assert.ok(existsSync(join(dir, "rapport-livraison", "RESUME.txt")));
});
