// Porte de qualité sur projets temporaires isolés (scénarios 1 à 7 et 11 à 15).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as fsSync from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { controle, creerProjet, lancerPorte, nettoyer } from "./aide.mjs";

const crees = [];
const projet = (o) => {
  const d = creerProjet(o);
  crees.push(d);
  return d;
};
after(() => crees.forEach(nettoyer));

test("1. projet valide : porte verte, rapport et résumé cohérents", () => {
  const r = lancerPorte(projet());
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.rapport.reussi, true);
  assert.match(r.resume, /peut être acceptée/);
  assert.ok(controle(r.rapport, "affichage et adaptation").ok, "affichage attendu réussi");
  assert.equal(r.rapport.fiabilite, 10);
});

test("1b. une modification de CLAUDE.md invalide la configuration de règles préexistante", () => {
  const dir = projet();
  writeFileSync(join(dir, "CLAUDE.md"), "# Projet de test\n\n## Règles\n\n- Règle une.\n- Nouvelle règle bloquante.\n");
  const r = lancerPorte(dir);
  assert.equal(r.code, 1);
  const c = controle(r.rapport, "lecture-regles");
  assert.equal(c.ok, false);
  assert.match(c.detail, /configuration périmée/);
});

test("2. script check en échec : refus, contrôle nommé", () => {
  const r = lancerPorte(projet({ check: 'node -e "process.exit(3)"' }));
  assert.equal(r.code, 1);
  assert.equal(controle(r.rapport, "verification-projet").ok, false);
  assert.match(r.resume, /n'est pas acceptée/);
});

test("3. build en échec : refus", () => {
  const r = lancerPorte(projet({ build: 'node -e "process.exit(1)"' }));
  assert.equal(r.code, 1);
  assert.equal(controle(r.rapport, "construction").ok, false);
});

test("3b. le contrôle visuel porte sur la sortie du build, pas sur public/ obsolète", () => {
  const dir = projet({ build: "node build.mjs" });
  writeFileSync(
    join(dir, "build.mjs"),
    `import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("out", { recursive: true });
writeFileSync("out/index.html", '<!doctype html><html><body><script>throw new Error("erreur-sortie-build")</script></body></html>');`,
  );
  const r = lancerPorte(dir);
  assert.equal(r.code, 1);
  const a = controle(r.rapport, "affichage");
  assert.equal(a.ok, false);
  assert.match(a.detail, /erreur-sortie-build/);
});

test("3c. les routes profondes sont testées même si la configuration contient seulement /", () => {
  const dir = projet({
    regles: {
      sections_claude_md: ["Règles"],
      regles: [{ ligne: 5, couverte: true }],
      routes: ["/"],
    },
  });
  mkdirSync(join(dir, "public", "guides", "niveau", "trois"), { recursive: true });
  writeFileSync(
    join(dir, "public", "guides", "niveau", "trois", "index.html"),
    '<!doctype html><html><body><script>throw new Error("route-profonde-cassee")</script></body></html>',
  );
  const r = lancerPorte(dir);
  assert.equal(r.code, 1);
  const a = controle(r.rapport, "affichage");
  assert.equal(a.ok, false);
  assert.match(a.detail, /route-profonde-cassee/);
});

test("4. erreur JavaScript dans la page : refus du contrôle d'affichage", () => {
  const r = lancerPorte(projet({ script: "<script>throw new Error('cassé')</script>" }));
  assert.equal(r.code, 1);
  const a = controle(r.rapport, "affichage et adaptation");
  assert.equal(a.ok, false);
  assert.match(a.detail, /erreur JS/);
});

test("5. fichier de règles JSON invalide : échec explicite, rapport produit", () => {
  const r = lancerPorte(projet({ regles: "{ pas du json" }));
  assert.equal(r.code, 1);
  assert.ok(r.rapport, "rapport.json doit exister même sur configuration invalide");
  const c = controle(r.rapport, "lecture-regles");
  assert.equal(c.ok, false);
  assert.match(c.detail, /illisible/);
});

test("6a. package.json malformé : diagnostic, code non nul", () => {
  const r = lancerPorte(projet({ pkg: "{ scripts: oops" }));
  assert.equal(r.code, 1);
  assert.equal(controle(r.rapport, "package.json").ok, false);
});

test("6b. et 11. package.json absent, aucun mécanisme de vérification : jamais de porte verte", () => {
  const r = lancerPorte(projet({ pkg: null }));
  assert.equal(r.code, 1);
  const m = controle(r.rapport, "mécanismes de vérification");
  assert.equal(m.ok, false);
  assert.match(m.detail, /ne peut rien prouver/);
});

test("7. deux instances : la seconde refuse sans toucher au rapport ; un verrou périmé est ignoré", () => {
  const dir = projet();
  writeFileSync(join(dir, ".livraison-porte.lock"), String(process.pid)); // processus vivant : ce test
  const r = lancerPorte(dir);
  assert.equal(r.code, 2);
  assert.equal(r.rapport, null);
  assert.match(r.stderr, /tourne déjà/);
  writeFileSync(join(dir, ".livraison-porte.lock"), "999999999"); // processus inexistant
  const r2 = lancerPorte(dir);
  assert.equal(r2.code, 0, r2.stderr);
  assert.equal(existsSync(join(dir, ".livraison-porte.lock")), false, "verrou retiré à la sortie");
});

test("13. projet sans interface web : affichage sans objet, pas en échec", () => {
  const r = lancerPorte(
    projet({
      index: false,
      regles: {
        sections_claude_md: ["Règles"],
        regles: [],
        interface_web: false,
      },
    }),
  );
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const a = controle(r.rapport, "affichage");
  assert.equal(a.statut, "sans_objet");
  assert.match(r.resume, /➖ .*sans objet/);
});

test("13b. projet web sans index.html : échec, pas « sans objet »", () => {
  const r = lancerPorte(projet({ index: false }));
  assert.equal(r.code, 1);
  assert.equal(controle(r.rapport, "affichage").ok, false);
});

test("14. règle bloquante non couverte : refus", () => {
  const r = lancerPorte(
    projet({
      regles: {
        sections_claude_md: ["Règles"],
        regles: [{ ligne: 5, couverte: false }],
      },
    }),
  );
  assert.equal(r.code, 1);
  assert.equal(controle(r.rapport, "couverture").ok, false);
});

test("15. contournement : test d'acceptation présent mais qu'aucun script n'exécute : refus « non exécuté »", () => {
  const dir = projet({ check: undefined, build: 'node -e "0"', git: true });
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "tests", "demande.test.mjs"), "// demande:bouton\n");
  const r = lancerPorte(dir);
  assert.equal(r.code, 1);
  const c = controle(r.rapport, "test d'acceptation");
  assert.equal(c.ok, false);
  assert.equal(c.statut, "non_execute");
  assert.match(r.resume, /non exécuté/);
});

test("16. le script npm test est réellement exécuté et son échec bloque", () => {
  const r = lancerPorte(projet({ test: 'node -e "process.exit(4)"' }));
  assert.equal(r.code, 1);
  const c = controle(r.rapport, "tests-projet");
  assert.equal(c.ok, false);
  assert.match(c.detail, /code 4/);
});

test("15b. test d'acceptation exécuté par le script dédié : accepté", () => {
  const dir = projet({
    testAcceptance: "node --test tests/demande.test.mjs",
    git: true,
  });
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(
    join(dir, "tests", "demande.test.mjs"),
    'import { test } from "node:test"; import assert from "node:assert/strict"; test("demande:bouton", () => assert.equal(1, 1));\n',
  );
  const r = lancerPorte(dir);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(controle(r.rapport, "test d'acceptation").ok, true);
  assert.equal(controle(r.rapport, "execution-test-acceptation").ok, true);
});

test("15c. un script test:acceptance qui réussit sans exécuter le test ne suffit pas", () => {
  const dir = projet({ testAcceptance: 'node -e "process.exit(0)"', git: true });
  writeFileSync(join(dir, ".livraison-en-cours"), "0");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "tests", "demande.test.mjs"), "// demande:bouton\n");
  const r = lancerPorte(dir);
  assert.equal(r.code, 1);
  const c = controle(r.rapport, "test d'acceptation");
  assert.equal(c.ok, false);
  assert.equal(c.statut, "non_execute");
  assert.match(c.detail, /n'a pas fourni de preuve d'exécution/);
});

test("B. un contrôle « sans objet » ne compte pas dans la fiabilité et n'est pas affiché comme réussi", () => {
  const r = lancerPorte(projet()); // ni build ni Playwright : deux contrôles sans objet
  const sansObjet = r.rapport.controles.filter((c) => c.statut === "sans_objet");
  assert.ok(sansObjet.length >= 2);
  assert.equal(r.rapport.fiabilite, 10);
  for (const c of sansObjet) assert.ok(!r.resume.includes(`✅ ${c.nom}`));
});

test("C. motif interdit invalide : échec diagnostiqué, pas de plantage", () => {
  const r = lancerPorte(
    projet({
      regles: {
        sections_claude_md: ["Règles"],
        regles: [],
        interdits: [{ motif: "([", description: "x" }],
      },
    }),
  );
  assert.equal(r.code, 1);
  const c = controle(r.rapport, "interdit : x");
  assert.equal(c.ok, false);
  assert.match(c.detail, /motif invalide/);
});

test("12. mode rapide : le build est refait quand une dépendance (lockfile) change", () => {
  const dir = projet({
    build: "node build.mjs",
  });
  writeFileSync(
    join(dir, "build.mjs"),
    `import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
const n = existsSync("compteur.txt") ? Number(readFileSync("compteur.txt", "utf8")) : 0;
writeFileSync("compteur.txt", String(n + 1));
mkdirSync("out", { recursive: true });
writeFileSync("out/index.html", readFileSync("public/index.html", "utf8"));`,
  );
  const lire = () => Number(readFileSync(join(dir, "compteur.txt"), "utf8"));
  assert.equal(lancerPorte(dir).code, 0);
  assert.equal(lire(), 1);
  assert.equal(lancerPorte(dir, ["--rapide"]).code, 0);
  assert.equal(lire(), 1, "build réutilisé : rien n'a changé");
  const futur = new Date(Date.now() + 5000);
  writeFileSync(join(dir, "package-lock.json"), "{}");
  const { utimesSync } = fsSync;
  utimesSync(join(dir, "package-lock.json"), futur, futur);
  assert.equal(lancerPorte(dir, ["--rapide"]).code, 0);
  assert.equal(lire(), 2, "lockfile modifié : reconstruction obligatoire");
  assert.equal(lancerPorte(dir).code, 0);
  assert.equal(lire(), 3, "mode final : reconstruction systématique");
});
