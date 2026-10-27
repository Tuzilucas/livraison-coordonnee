// Projets temporaires isolés pour tester le moteur sans toucher à un vrai dépôt.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GATE = join(PLUGIN, "scripts", "gate.mjs");

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test</title>
<style>body{margin:0;font:16px/1.5 sans-serif;color:#111;background:#fff}main{padding:16px;max-width:100%}button{min-height:44px;min-width:44px;padding:0 16px}</style></head>
<body><main><h1>Projet de test</h1><p>Un paragraphe lisible.</p><button type="button">Valider</button></main>__SCRIPT__</body></html>`;

/**
 * Crée un projet minimal : CLAUDE.md, règles couvertes, package.json avec les scripts demandés, public/index.html.
 * options : { check, build, test, testRegles, index, script, regles, pkg, git }
 */
export function creerProjet(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "livraison-test-"));
  const o = { check: 'node -e "process.exit(0)"', index: true, ...options };
  writeFileSync(join(dir, "CLAUDE.md"), "# Projet de test\n\n## Règles\n\n- Règle une.\n");
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(
    join(dir, ".claude", "regles-livraison.json"),
    typeof o.regles === "string"
      ? o.regles
      : JSON.stringify(
          o.regles ?? {
            sections_claude_md: ["Règles"],
            regles: [{ ligne: 5, couverte: true }],
          },
          null,
          2,
        ),
  );
  if (o.pkg !== null) {
    const scripts = {};
    if (o.check) scripts.check = o.check;
    if (o.build) scripts.build = o.build;
    if (o.test) scripts.test = o.test;
    if (o.testRegles) scripts["test:regles"] = o.testRegles;
    if (o.testAcceptance) scripts["test:acceptance"] = o.testAcceptance;
    writeFileSync(
      join(dir, "package.json"),
      typeof o.pkg === "string"
        ? o.pkg
        : JSON.stringify({ name: "projet-test", private: true, scripts }, null, 2),
    );
  }
  if (o.index) {
    mkdirSync(join(dir, "public"), { recursive: true });
    writeFileSync(join(dir, "public", "index.html"), PAGE.replace("__SCRIPT__", o.script ?? ""));
  }
  if (o.git) {
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"], { cwd: dir });
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"], {
      cwd: dir,
    });
  }
  return dir;
}

export function lancerPorte(dir, args = [], env = {}) {
  const r = spawnSync(process.execPath, [GATE, dir, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 120000,
  });
  const fichier = join(dir, "rapport-livraison", "rapport.json");
  const rapport = existsSync(fichier) ? JSON.parse(readFileSync(fichier, "utf8")) : null;
  const resume = existsSync(join(dir, "rapport-livraison", "RESUME.txt"))
    ? readFileSync(join(dir, "rapport-livraison", "RESUME.txt"), "utf8")
    : "";
  return {
    code: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    rapport,
    resume,
  };
}

export const controle = (rapport, debut) => rapport?.controles.find((c) => c.nom.startsWith(debut));

export function nettoyer(dir) {
  rmSync(dir, { recursive: true, force: true });
}
