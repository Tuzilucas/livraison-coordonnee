// Multilingue : résumés et messages en fr, en, es, de, it ; choix de la langue ; verdict sans progrès.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { LANGUES, langueDe, normaliser, t, traduireDetail } from "../scripts/langue.mjs";
import { libelle, resumeEnFrancais } from "../scripts/resume.mjs";
import { decider, empreinteDe, lireMarqueur, lireRapport } from "../scripts/verdict.mjs";
import { controle, creerProjet, lancerPorte, nettoyer } from "./aide.mjs";

const crees = [];
const projet = (o) => {
  const d = creerProjet(o);
  crees.push(d);
  return d;
};
after(() => crees.forEach(nettoyer));

test("toutes les clés de phrases existent dans les cinq langues", () => {
  const cles = [
    "lecture-regles",
    "verification-projet",
    "affichage",
    "interdit",
    "conclusion_ok",
    "conclusion_ko",
    "hook_bloquer",
    "hook_abandon",
    "hook_sans_progres",
    "sans_objet",
    "non_execute",
  ];
  for (const l of LANGUES)
    for (const c of cles) {
      const s = t(l, c, { n: 1, max: 5, resume: "R" });
      assert.ok(s && s !== c, `${c} manquante en ${l}`);
      assert.ok(!/\{[a-z]+\}/.test(s), `paramètre non remplacé dans ${c} (${l})`);
    }
});

test("le résumé change de langue, la conclusion aussi", () => {
  const c = [{ nom: "construction", ok: false, detail: "code 1 (voir construction.log)" }];
  assert.match(resumeEnFrancais(c, "fr"), /n'est pas acceptée/);
  assert.match(resumeEnFrancais(c, "en"), /is not accepted/);
  assert.match(
    resumeEnFrancais(c, "en"),
    /the command failed \(details: rapport-livraison\/construction\.log\)/,
  );
  assert.match(resumeEnFrancais(c, "es"), /no está aceptada/);
  assert.match(resumeEnFrancais(c, "de"), /nicht angenommen/);
  assert.match(resumeEnFrancais(c, "it"), /non è accettata/);
  assert.equal(libelle("affichage et adaptation (1 pages × 6 largeurs)", "en"), t("en", "affichage"));
});

test("un détail inconnu reste tel quel, un détail connu est traduit, le français n'est pas touché", () => {
  assert.equal(traduireDetail("fr", "défilement horizontal"), "défilement horizontal");
  assert.equal(traduireDetail("en", "défilement horizontal"), "horizontal scrolling");
  assert.equal(traduireDetail("en", "texte inconnu"), "texte inconnu");
});

test("choix de la langue : variable d'environnement, puis fichier de règles, puis français ; codes inconnus ignorés", () => {
  assert.equal(normaliser("EN"), "en");
  assert.equal(normaliser("xx"), null);
  assert.equal(normaliser("en-US"), "en");
  const dir = projet({ regles: { sections_claude_md: ["Règles"], regles: [], langue: "es" } });
  assert.equal(langueDe(dir, {}), "es");
  assert.equal(langueDe(dir, { LIVRAISON_LANGUE: "de" }), "de");
  assert.equal(langueDe(dir, { LIVRAISON_LANGUE: "zz" }), "es");
  assert.equal(langueDe(projet(), {}), "fr");
});

test("la porte écrit RESUME.txt dans la langue demandée (LIVRAISON_LANGUE et --langue)", () => {
  const dir = projet({ check: 'node -e "process.exit(2)"' });
  const en = lancerPorte(dir, [], { LIVRAISON_LANGUE: "en" });
  assert.equal(en.code, 1);
  assert.match(en.resume, /Conclusion: the delivery is not accepted/);
  assert.match(en.resume, /The code passes its automated checks/);
  const it = lancerPorte(dir, ["--langue=it"]);
  assert.match(it.resume, /Conclusione: la consegna non è accettata/);
  // Le rapport technique reste en français : les noms de contrôles ne changent pas.
  assert.ok(controle(it.rapport, "verification-projet"));
});

test("marqueur : ancien format numérique et nouveau format JSON, illisible toléré", () => {
  assert.deepEqual(lireMarqueur("3"), { tentatives: 3, sans_progres: 0, empreinte: "" });
  assert.deepEqual(lireMarqueur('{"tentatives":2,"sans_progres":1,"empreinte":"x"}'), {
    tentatives: 2,
    sans_progres: 1,
    empreinte: "x",
  });
  assert.deepEqual(lireMarqueur("{oops"), { tentatives: 0, sans_progres: 0, empreinte: "" });
  assert.deepEqual(lireMarqueur("-5"), { tentatives: 0, sans_progres: 0, empreinte: "" });
});

test("sans progrès : mêmes échecs trois fois de suite pendant une continuation → abandon anticipé", () => {
  const echec = lireRapport(
    JSON.stringify({ reussi: false, controles: [{ nom: "x", ok: false, detail: "d" }] }),
  );
  const e = empreinteDe(echec);
  let marqueur = { tentatives: 0, sans_progres: 0, empreinte: "" };
  const v1 = decider({ codeGate: 1, rapport: echec, marqueur, essaisMax: "10", stopHookActive: false });
  assert.equal(v1.decision, "bloquer");
  assert.equal(v1.sansProgres, 0, "premier passage : rien à comparer");
  marqueur = { tentatives: v1.tentatives, sans_progres: v1.sansProgres, empreinte: v1.empreinte };
  const v2 = decider({ codeGate: 1, rapport: echec, marqueur, essaisMax: "10", stopHookActive: true });
  assert.equal(v2.decision, "bloquer");
  assert.equal(v2.sansProgres, 1);
  marqueur = { tentatives: v2.tentatives, sans_progres: v2.sansProgres, empreinte: v2.empreinte };
  const v3 = decider({ codeGate: 1, rapport: echec, marqueur, essaisMax: "10", stopHookActive: true });
  assert.equal(v3.decision, "bloquer");
  assert.equal(v3.sansProgres, 2);
  marqueur = { tentatives: v3.tentatives, sans_progres: v3.sansProgres, empreinte: v3.empreinte };
  const v4 = decider({ codeGate: 1, rapport: echec, marqueur, essaisMax: "10", stopHookActive: true });
  assert.equal(v4.decision, "abandon");
  assert.equal(v4.sansProgresAtteint, true);
  assert.equal(v4.empreinte, e);
});

test("sans progrès : un échec différent, ou une continuation non signalée, remet le compteur à zéro", () => {
  const a = lireRapport(JSON.stringify({ reussi: false, controles: [{ nom: "x", ok: false, detail: "1" }] }));
  const b = lireRapport(JSON.stringify({ reussi: false, controles: [{ nom: "x", ok: false, detail: "2" }] }));
  const marqueur = { tentatives: 2, sans_progres: 2, empreinte: empreinteDe(a) };
  assert.equal(
    decider({ codeGate: 1, rapport: b, marqueur, essaisMax: "10", stopHookActive: true }).sansProgres,
    0,
  );
  assert.equal(
    decider({ codeGate: 1, rapport: a, marqueur, essaisMax: "10", stopHookActive: false }).sansProgres,
    0,
  );
  assert.equal(
    decider({ codeGate: 1, rapport: a, marqueur, essaisMax: "10", stopHookActive: true }).decision,
    "abandon",
  );
});

test("regles.mjs --langue=en enregistre la langue dans le fichier de règles", async () => {
  const dir = projet();
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    [join(import.meta.dirname, "..", "scripts", "regles.mjs"), dir, "--langue=en"],
    {
      cwd: dir,
      encoding: "utf8",
    },
  );
  assert.equal(r.status, 0, r.stderr);
  const regles = JSON.parse(
    (await import("node:fs")).readFileSync(join(dir, ".claude", "regles-livraison.json"), "utf8"),
  );
  assert.equal(regles.langue, "en");
  assert.equal(langueDe(dir, {}), "en");
  writeFileSync(join(dir, "CLAUDE.md"), "# P\n\n## Règles\n\n- Règle une.\n");
});

test("détection de la langue d'une demande : cinq langues, texte court ou ambigu → null", async () => {
  const { detecter } = await import("../scripts/langue-demande.mjs");
  assert.equal(detecter("Ajouter un bouton de partage sur la page d'accueil"), "fr");
  assert.equal(detecter("Add a share button on the home page"), "en");
  assert.equal(detecter("Añadir un botón de compartir en la página de inicio"), "es");
  assert.equal(detecter("Füge auf der Startseite eine Schaltfläche zum Teilen hinzu"), "de");
  assert.equal(detecter("Aggiungere un pulsante di condivisione nella pagina iniziale"), "it");
  assert.equal(detecter("CSV"), null);
  assert.equal(detecter(""), null);
});

test("langue-demande.mjs enregistre la langue détectée dans le projet, conserve le reste du fichier", async () => {
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const dir = projet();
  const script = join(import.meta.dirname, "..", "scripts", "langue-demande.mjs");
  let r = spawnSync(
    process.execPath,
    [script, dir, "Add", "a", "share", "button", "on", "the", "home", "page"],
    { encoding: "utf8" },
  );
  assert.equal(r.stdout.trim(), "en");
  const regles = JSON.parse(fs.readFileSync(join(dir, ".claude", "regles-livraison.json"), "utf8"));
  assert.equal(regles.langue, "en");
  assert.deepEqual(regles.sections_claude_md, ["Règles"], "le reste du fichier est conservé");
  r = spawnSync(process.execPath, [script, dir, "CSV"], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "en", "texte ambigu : la langue enregistrée est gardée");
  r = spawnSync(process.execPath, [script, dir, "--langue=de", "whatever", "text"], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "de");
  assert.equal(langueDe(dir, {}), "de");
});
