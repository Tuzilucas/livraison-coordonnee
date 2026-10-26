#!/usr/bin/env node
// Lit CLAUDE.md et écrit .claude/regles-livraison.json : une règle par puce, identifiant stable (section + texte).
// Une règle est « couverte » seulement si deux choses sont vraies :
//   1. un mot-clé la rattache à un type de contrôle ;
//   2. un test du projet porte son étiquette « regle:<identifiant> » (tests/ ou scripts/).
// Une règle de processus (commits, journal d'erreurs) ne bloque pas le verdict : elle est listée en revue humaine.
// Usage : node regles.mjs <dossier-du-projet>
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argsRegles = process.argv.slice(2);
const projet = resolve(argsRegles.find((a) => !a.startsWith("--")) ?? ".");
// Langue des résumés et messages (fr, en, es, de, it), conservée dans le fichier de règles : --langue=xx la change.
const langueArg = (argsRegles.find((a) => a.startsWith("--langue=")) ?? "")
  .slice(9)
  .trim()
  .toLowerCase()
  .slice(0, 2);
const texte = readFileSync(join(projet, "CLAUDE.md"), "utf8");
// Configuration propre au projet, conservée dans .claude/regles-livraison.json :
//   controles : [{ id, motif, bloquant? }] ajoutés avant les contrôles génériques (motif = expression régulière) ;
//   revue_humaine : [motif] règles à classer en revue humaine (motif = expression régulière).
const ancien = existsSync(join(projet, ".claude", "regles-livraison.json"))
  ? JSON.parse(readFileSync(join(projet, ".claude", "regles-livraison.json"), "utf8"))
  : {};
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Types de contrôle reconnus par mot-clé. Le premier motif trouvé gagne.
const CONTROLES = [
  {
    id: "processus",
    motif: /commit|ERROR_LOG|erreur significative|documentation/i,
    bloquant: false,
  },
  {
    id: "descriptif",
    motif: /dépôt (privé|public)|plus de dépendance à GitHub Actions/i,
    bloquant: false,
  },
  { id: "branche", motif: /travailler directement|branche|sur `main`/i },
  { id: "version", motif: /version|cache/i },
  {
    id: "preservation",
    motif: /fonctionnalité existante|supprimer ni réécrire/i,
  },
  { id: "stockage", motif: /clés localStorage|localStorage/i },
  { id: "migration", motif: /migrations?\//i },
  { id: "traduction", motif: /Traductions obligatoires/i },
  { id: "bibliotheque", motif: /Bibliothèques externes/i },
  { id: "nommage", motif: /préfixe `bv`/i },
  { id: "investiture", motif: /investi|validation officielle/i },
  { id: "donnees", motif: /source|schema|zod|intégrit|validée/i },
  {
    id: "publication",
    motif: /public-view|publication_status|seule passerelle/i,
  },
  { id: "documentation", motif: /docs\/|détails|arbitrages/i },
  { id: "neutralite", motif: /neutralit|tri |score|recommandation/i },
  { id: "attribution", motif: /fait|déclaration|analyse/i },
  { id: "justice", motif: /justice|présomption|judiciaire/i },
  { id: "sondages", motif: /sondage|moyenne|probabilité/i },
  { id: "extrait", motif: /extrait|400|paywall/i },
  {
    id: "interdit",
    motif: /secret|NEXT_PUBLIC|interne|review_note|clé|jeton/i,
  },
  { id: "affichage", motif: /affich|mobile|contraste|responsive|écran/i },
  { id: "construction", motif: /statique|export|build|construi/i },
];

// Fichiers où une étiquette « regle:<id> » prouve qu'un test existe.
function fichiersDe(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fichiersDe(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(f)) out.push(p);
  }
  return out;
}
const contenusDeTests = fichiersDe(join(projet, "tests"))
  .concat(fichiersDe(join(projet, "scripts")))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");

const controlesDuProjet = (ancien.controles ?? []).map((c) => ({
  id: c.id,
  motif: new RegExp(c.motif, "i"),
  bloquant: c.bloquant,
}));
const regles = [];
const revueDuProjet = (ancien.revue_humaine ?? []).map((m) => new RegExp(m, "i"));
// Toutes les sections « ## » de CLAUDE.md, même sans puce : la porte les contrôle toutes.
const titresDeSections = texte
  .split("\n")
  .filter((l) => l.startsWith("## "))
  .map((l) => l.slice(3).trim());
let section = "";
texte.split("\n").forEach((ligne, i) => {
  if (ligne.startsWith("## ")) section = ligne.slice(3).trim();
  const puce = ligne.match(/^\s*(?:-|\d+\.)\s+(.*)$/);
  if (!puce || !section) return;
  const id = `${slug(section)}-${slug(puce[1]).slice(0, 40).replace(/-$/, "")}`;
  // Sections d'intention, de produit, de légal, de process ou de documentation : revue humaine, sans blocage.
  const revueHumaine =
    revueDuProjet.some((re) => re.test(puce[1]) || re.test(section)) ||
    /projet en bref|principes|produit|légal|skills|déploiement|objectif/i.test(section) ||
    /expliquer brièvement le plan|Naviguer par nom de fonction|passe par `esc\(\)`|Styles : réutiliser|second document HTML/.test(
      puce[1],
    );
  const testee = contenusDeTests.includes(`regle:${id}`);
  const controle =
    revueHumaine && !testee
      ? { id: "humaine", bloquant: false }
      : [...controlesDuProjet, ...CONTROLES].find((c) => c.motif.test(puce[1]));
  const bloquante = controle ? controle.bloquant !== false : true;
  regles.push({
    id,
    section,
    ligne: i + 1,
    texte: puce[1].trim(),
    controle: controle ? controle.id : null,
    testee,
    couverte: testee || (Boolean(controle) && testee),
    bloquante,
  });
});

// Réponses du projet aux questions de revue humaine (.claude/decisions-livraison.json).
// « humaine » ou « ignorer » retire la règle du blocage, sauf si un test la couvre.
const fichierDecisions = join(projet, ".claude", "decisions-livraison.json");
const decisions = existsSync(fichierDecisions)
  ? (JSON.parse(readFileSync(fichierDecisions, "utf8")).decisions ?? {})
  : {};
const questionsRevue = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "questions", "revue-humaine.json"), "utf8"),
);
for (const q of questionsRevue) {
  const d = decisions[q.id];
  if (!d) continue;
  for (const r of regles) {
    if (r.testee || !q.motifs.some((m) => new RegExp(m, "i").test(r.texte))) continue;
    r.decision = d.choix;
    if (d.choix === "humaine" || d.choix === "ignorer") {
      r.bloquante = false;
    } else if (d.choix === "auto") {
      // Contrôle automatique demandé : la règle bloque jusqu'à ce qu'un test la couvre.
      r.bloquante = true;
      r.controle = "a-tester";
    }
  }
}
const nonCouvertes = regles
  .filter((r) => r.bloquante && !r.couverte)
  .map((r) => `${r.id} (ligne ${r.ligne})`);
const sortie = {
  genere_par: "livraison-coordonnee/scripts/regles.mjs",
  source_sha256: createHash("sha256").update(texte).digest("hex"),
  sections_claude_md: titresDeSections,
  langue: ["fr", "en", "es", "de", "it"].includes(langueArg) ? langueArg : (ancien.langue ?? "fr"),
  controles: ancien.controles ?? [],
  revue_humaine: ancien.revue_humaine ?? [],
  routes: ancien.routes ?? ["/"],
  largeurs: ancien.largeurs ?? [320, 360, 390, 768, 1024, 1440],
  interdits: ancien.interdits ?? [],
  regles,
  non_couvertes: nonCouvertes,
  revues_humaines: regles.filter((r) => !r.bloquante).map((r) => `${r.id} (ligne ${r.ligne})`),
};
mkdirSync(join(projet, ".claude"), { recursive: true });
writeFileSync(join(projet, ".claude", "regles-livraison.json"), JSON.stringify(sortie, null, 2) + "\n");
console.log(
  `${regles.length} règles lues depuis CLAUDE.md : ${regles.filter((r) => r.couverte).length} couvertes, ${nonCouvertes.length} non couvertes bloquantes, ${sortie.revues_humaines.length} en revue humaine.`,
);
for (const r of regles.filter((r) => r.bloquante && !r.couverte))
  console.log(
    `  non couverte : ${r.id} (ligne ${r.ligne}) — ${r.controle ? "pas de test « regle:" + r.id + " »" : "aucun type de contrôle reconnu"}`,
  );
