// Hook d'arrêt de bout en bout : un rapport vert d'une exécution antérieure ne fait jamais passer une livraison.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { PLUGIN, creerProjet, nettoyer } from "./aide.mjs";

const crees = [];
const projet = (o) => {
  const d = creerProjet(o);
  crees.push(d);
  return d;
};
after(() => crees.forEach(nettoyer));

const hook = (dir, entree = {}) =>
  spawnSync(process.execPath, [join(PLUGIN, "scripts", "verdict-arret.mjs")], {
    input: JSON.stringify({ cwd: dir, hook_event_name: "Stop", ...entree }),
    encoding: "utf8",
    env: { ...process.env, LIVRAISON_LANGUE: "fr" },
    timeout: 180000,
  });

test("un rapport vert d'hier déposé dans un projet qui échoue : le hook bloque et remplace le rapport", () => {
  const dir = projet({ check: 'node -e "process.exit(1)"' });
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  mkdirSync(join(dir, "rapport-livraison"), { recursive: true });
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  writeFileSync(
    join(dir, "rapport-livraison", "rapport.json"),
    JSON.stringify({
      date: hier,
      reussi: true,
      fiabilite: 10,
      controles: [{ nom: "tout", ok: true }],
      captures: [],
    }),
  );
  writeFileSync(
    join(dir, "rapport-livraison", "RESUME.txt"),
    "Conclusion : la livraison peut être acceptée.\n",
  );
  const r = hook(dir);
  assert.equal(r.status, 0, r.stderr);
  const sortie = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(sortie.decision, "block", "le hook doit renvoyer Claude au travail");
  assert.ok(existsSync(join(dir, ".livraison-en-cours")), "le marqueur reste en place");
  const rapport = JSON.parse(readFileSync(join(dir, "rapport-livraison", "rapport.json"), "utf8"));
  assert.equal(rapport.reussi, false, "le rapport lu est celui de cette exécution, pas celui d'hier");
  assert.ok(Date.parse(rapport.date) > Date.parse(hier));
});

test("un rapport vert d'hier et une porte qui ne peut pas s'exécuter : blocage, jamais « terminée »", () => {
  const dir = projet();
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  mkdirSync(join(dir, "rapport-livraison"), { recursive: true });
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  writeFileSync(
    join(dir, "rapport-livraison", "rapport.json"),
    JSON.stringify({
      date: hier,
      reussi: true,
      fiabilite: 10,
      controles: [{ nom: "tout", ok: true }],
      captures: [],
    }),
  );
  // Verrou tenu par ce processus : la porte refuse de démarrer (code 2) et ne réécrit pas le rapport.
  writeFileSync(join(dir, ".livraison-porte.lock"), String(process.pid));
  const r = hook(dir);
  assert.equal(r.status, 0, r.stderr);
  const sortie = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(sortie.decision, "block");
  assert.match(sortie.reason, /antérieur|rapport/);
  assert.ok(existsSync(join(dir, ".livraison-en-cours")));
});

test("porte verte réelle : le hook retire le marqueur (le contrôle de date ne bloque pas une exécution saine)", () => {
  // Une livraison en cours exige un test d'acceptation exécuté : on en fournit un vrai.
  const dir = projet({ testAcceptance: "node --test tests/demande.test.mjs", git: true });
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(
    join(dir, "tests", "demande.test.mjs"),
    'import { test } from "node:test"; import assert from "node:assert/strict"; test("demande:bouton", () => assert.equal(1, 1));\n',
  );
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  const r = hook(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(join(dir, ".livraison-en-cours")), false, "marqueur retiré après une porte verte");
});
