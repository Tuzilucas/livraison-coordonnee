#!/usr/bin/env node
// Porte de qualité : un livrable n'est accepté que si TOUS les contrôles passent.
// Usage : node gate.mjs <dossier-du-projet>
// Sortie : rapport-livraison/rapport.json et rapport-livraison/*.log ; code 0 seulement si tout passe.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resumeEnFrancais } from "./resume.mjs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

// Modes : --final (défaut) = porte complète, toutes les largeurs ; --rapide = pendant les corrections
// (largeurs réduites, build réutilisé si le code n'a pas changé). La porte finale doit toujours être --final.
const args = process.argv.slice(2);
const rapide = args.includes("--rapide");
const projet = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
// Fichiers temporaires du plugin : ignorés par Git dans le projet (ajoutés une fois, sans toucher au reste).
const entreesIgnorees = [
  ".livraison-en-cours",
  ".livraison-journal.log",
  ".livraison-etat.json",
  "rapport-livraison/",
];
{
  const fichierIgnore = join(projet, ".gitignore");
  const actuel = existsSync(fichierIgnore) ? readFileSync(fichierIgnore, "utf8") : "";
  const manquantes = entreesIgnorees.filter((e) => !actuel.split("\n").includes(e));
  if (manquantes.length)
    writeFileSync(
      fichierIgnore,
      actuel +
        (actuel.endsWith("\n") || !actuel ? "" : "\n") +
        "# Plugin livraison\n" +
        manquantes.join("\n") +
        "\n",
    );
}
const rapportDir = join(projet, "rapport-livraison");
// Repart d'un dossier vide : un rapport de la passe précédente ne doit pas être contrôlé comme code.
rmSync(rapportDir, { recursive: true, force: true });
mkdirSync(rapportDir, { recursive: true });
const controles = [];
const enregistrer = (nom, ok, detail = "") => controles.push({ nom, ok, detail });
// Captures produites par la porte : ce sont les preuves que les experts doivent citer.
const captures = [];

// 1. Fonctionnement : tests, construction et contrôle du projet, tels qu'ils sont définis dans le dépôt.
function commande(nom, cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: projet,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  writeFileSync(join(rapportDir, `${nom}.log`), (r.stdout ?? "") + (r.stderr ?? ""));
  enregistrer(nom, r.status === 0, r.status === 0 ? "" : `code ${r.status} (voir ${nom}.log)`);
}

// 2. Règles du projet : CLAUDE.md doit exister, et le fichier de règles doit couvrir chacune de ses sections.
const claudeMd = join(projet, "CLAUDE.md");
const reglesFile = join(projet, ".claude", "regles-livraison.json");
let regles = null;
if (!existsSync(claudeMd)) enregistrer("lecture-regles", false, "CLAUDE.md absent");
else if (!existsSync(reglesFile))
  enregistrer("lecture-regles", false, ".claude/regles-livraison.json absent");
else {
  regles = JSON.parse(readFileSync(reglesFile, "utf8"));
  const norm = (s) => s.trim().toLowerCase();
  const titres = readFileSync(claudeMd, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => norm(l.slice(3)));
  const couverts = (regles.sections_claude_md ?? []).map(norm);
  const manquants = titres.filter((t) => !couverts.includes(t));
  enregistrer(
    "lecture-regles",
    manquants.length === 0,
    manquants.length ? `sections non traitées : ${manquants.join(", ")}` : "",
  );
}

// Profil du projet : la porte ne fait que ce que le projet sait faire. Une étape absente est notée « non applicable ».
const pkg = existsSync(join(projet, "package.json"))
  ? JSON.parse(readFileSync(join(projet, "package.json"), "utf8"))
  : {};
const scripts = pkg.scripts ?? {};
const aPlaywright = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"].some((f) =>
  existsSync(join(projet, f)),
);
// Racine servie : le build (out/) s'il existe, sinon le dossier statique public/, sinon la racine si elle contient index.html.
function racineServie() {
  for (const d of ["out", "public", "."])
    if (existsSync(join(projet, d, "index.html"))) return join(projet, d);
  return null;
}
// Routes détectées : chaque dossier qui contient un index.html (au plus deux niveaux).
function routesDetectees(racine) {
  if (!racine) return ["/"];
  const routes = [];
  const parcourir = (dir, profondeur, chemin) => {
    if (existsSync(join(dir, "index.html"))) routes.push(chemin);
    if (profondeur >= 2) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory() && !f.startsWith(".") && f !== "node_modules")
        parcourir(p, profondeur + 1, `${chemin}${f}/`);
    }
  };
  parcourir(racine, 0, "/");
  return routes.length ? routes : ["/"];
}
const dist = racineServie();
// Thème sombre : contrôlé seulement si le site déclare un mécanisme de thème (sinon il n'y a rien à vérifier).
const aThemeSombre =
  Boolean(dist) && /prefers-color-scheme|data-theme/.test(readFileSync(join(dist, "index.html"), "utf8"));

if (scripts.check) commande("verification-projet", "npm", ["run", "check"]);
else enregistrer("verification-projet", true, "pas de script check : non applicable");
// Couverture : chaque règle de CLAUDE.md doit être reliée à un contrôle exécuté ici. Une règle non couverte bloque.
const reglesGenerees = join(projet, ".claude", "regles-livraison.json");
if (existsSync(reglesGenerees)) {
  const generees = JSON.parse(readFileSync(reglesGenerees, "utf8"));
  const sansControle = (generees.regles ?? []).filter((r) => r.bloquante !== false && !r.couverte);
  enregistrer(
    "couverture des règles de CLAUDE.md",
    sansControle.length === 0,
    sansControle.length ? sansControle.map((r) => `ligne ${r.ligne}`).join(", ") + " non couvertes" : "",
  );
  // Contrôle « donnees » : la validation des données du projet, si elle existe.
  const donneesCouvertes = (generees.regles ?? []).some((r) => r.controle === "donnees");
  if (donneesCouvertes && readFileSync(join(projet, "package.json"), "utf8").includes('"data:validate"'))
    commande("donnees", "npm", ["run", "data:validate"]);
} else
  enregistrer(
    "couverture des règles de CLAUDE.md",
    false,
    ".claude/regles-livraison.json absent : lancer scripts/regles.mjs",
  );
// Mode rapide seulement : build réutilisé si out/ est plus récent que le code. La porte finale reconstruit toujours.
function codeModifieDepuis(instant) {
  const racines = ["src", "public", "data", "scripts", "package.json", "next.config.ts", "next.config.mjs"]
    .map((f) => join(projet, f))
    .filter((f) => existsSync(f));
  const parcourir = (p) =>
    statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => parcourir(join(p, f))) : [p];
  return racines.flatMap(parcourir).some((f) => statSync(f).mtimeMs > instant);
}
const indexOut = join(projet, "out", "index.html");
if (!scripts.build) {
  enregistrer("construction", true, "pas de script build : site statique servi tel quel");
} else if (rapide && existsSync(indexOut) && !codeModifieDepuis(statSync(indexOut).mtimeMs)) {
  enregistrer("construction", true, "build réutilisé (code inchangé depuis le dernier build)");
} else {
  commande("construction", "npm", ["run", "build"], { NEXT_PUBLIC_BASE_PATH: "" });
}
if (scripts["test:regles"]) commande("tests-des-regles", "npm", ["run", "test:regles"]);
// Demande : pendant une livraison, il faut un test d'acceptation étiqueté « demande:<nom> » qui prouve que la demande est remplie.
if (existsSync(join(projet, ".livraison-en-cours"))) {
  const lireTests = (dir) =>
    existsSync(dir)
      ? readdirSync(dir).flatMap((f) => {
          const p = join(dir, f);
          return statSync(p).isDirectory() ? lireTests(p) : [readFileSync(p, "utf8")];
        })
      : [];
  // Le test doit être nouveau ou modifié pendant cette livraison : un ancien test ne peut pas prouver une nouvelle demande.
  const modifies = (() => {
    try {
      return execFileSync("git", ["status", "--porcelain", "--", "tests"], { cwd: projet, encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
        .map((l) => l.slice(3));
    } catch {
      return null;
    }
  })();
  const fichiersDemande = lireTests(join(projet, "tests")).length
    ? [
        ...new Set(
          (modifies ?? []).filter((f) => {
            const c =
              existsSync(join(projet, f)) && statSync(join(projet, f)).isFile()
                ? readFileSync(join(projet, f), "utf8")
                : "";
            return /demande:[\w-]+/.test(c);
          }),
        ),
      ]
    : [];
  enregistrer(
    "test d'acceptation de la demande",
    fichiersDemande.length > 0,
    modifies === null
      ? "impossible de vérifier (pas de dépôt Git) : ajouter un test « demande:<nom> » modifié pendant la livraison"
      : "aucun test « demande:<nom> » nouveau ou modifié pendant cette livraison ne prouve la demande",
  );
}
if (aPlaywright) commande("tests-bout-en-bout", "npx", ["playwright", "test"]);
else enregistrer("tests-bout-en-bout", true, "pas de Playwright : non applicable");

// 3. Règles interdites, vérifiées sur le site construit.
function fichiers(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if ([".html", ".js", ".txt", ".json", ".xml"].includes(extname(p))) out.push(p);
  }
  return out;
}
if (regles) {
  for (const r of regles.interdits ?? []) {
    const trouves = dist
      ? fichiers(dist).filter((p) => new RegExp(r.motif).test(readFileSync(p, "utf8")))
      : [];
    enregistrer(
      `interdit : ${r.description ?? r.motif}`,
      trouves.length === 0,
      trouves
        .slice(0, 3)
        .map((p) => p.replace(projet, ""))
        .join(", "),
    );
  }
}

// 4. Affichage : chaque page clé, à chaque largeur (petits téléphones, téléphones, tablettes, ordinateurs).
if (!dist) enregistrer("affichage", false, "aucun dossier servi (out/, public/ ou index.html)");
else {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".webp": "image/webp",
  };
  const { readFileSync: lire } = await import("node:fs");
  const serveur = createServer((req, res) => {
    let chemin = join(dist, decodeURIComponent(req.url.split("?")[0]));
    if (existsSync(chemin) && statSync(chemin).isDirectory()) chemin = join(chemin, "index.html");
    if (!existsSync(chemin)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": types[extname(chemin)] ?? "application/octet-stream" });
    res.end(lire(chemin));
  });
  await new Promise((ok) => serveur.listen(4399, ok));
  const port = 4399;
  try {
    const req = createRequire(join(projet, "package.json"));
    const { chromium } = req("@playwright/test");
    const navigateur = await chromium
      .launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" })
      .catch(() => chromium.launch());
    const largeurs = rapide ? [320, 390, 1024] : (regles?.largeurs ?? [320, 360, 390, 768, 1024, 1440]);
    const routes = regles?.routes ?? routesDetectees(dist);
    const problemes = [];
    let textesMesures = 0;
    let textesNonMesurables = 0;
    for (const route of routes) {
      for (const w of largeurs) {
        const page = await navigateur.newPage({
          viewport: { width: w, height: 800 },
          reducedMotion: "reduce",
        });
        const erreurs = [];
        page.on("pageerror", (e) => erreurs.push("erreur JS : " + e.message));
        page.on("console", (m) => {
          if (m.type() === "error" && !m.text().includes("net::ERR_")) erreurs.push("console : " + m.text());
        });
        // Les échecs réseau (polices, statistiques externes) dépendent de l'environnement : ils sont ignorés ici.
        const reponse = await page
          .goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle" })
          .catch(() => null);
        if (!reponse || reponse.status() !== 200) {
          problemes.push(`${route} @${w}px : page absente`);
          await page.close();
          continue;
        }
        await page.waitForTimeout(300); // état final : aucune animation en cours au moment de la mesure
        const mesure = await page.evaluate(
          ({ w }) => {
            document.documentElement.style.scrollBehavior = "auto";
            window.scrollTo(0, 0);
            const vw = document.documentElement.clientWidth;
            const visible = (el) => {
              const r = el.getBoundingClientRect();
              const s = getComputedStyle(el);
              // Dans un bloc replié, seul son propre résumé est visible : un résumé imbriqué dans un bloc replié ne l'est pas.
              for (
                let d = el.closest("details:not([open])");
                d;
                d = d.parentElement?.closest("details:not([open])")
              ) {
                const resume = d.querySelector(":scope > summary");
                if (!resume || !resume.contains(el)) return false;
              }
              if (el.closest(".sr-only") || el.closest("title")) return false;
              return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none";
            };
            const defilement = document.documentElement.scrollWidth > vw + 1;
            const dansZoneDefilante = (el) => {
              for (let n = el.parentElement; n && n !== document.body; n = n.parentElement)
                if (["auto", "scroll"].includes(getComputedStyle(n).overflowX)) return true;
              return false;
            };
            const horsEcran = [...document.querySelectorAll("body *")]
              .filter(
                (el) =>
                  visible(el) &&
                  el.getBoundingClientRect().right > vw + 1 &&
                  !el.closest('[aria-hidden="true"]') &&
                  !dansZoneDefilante(el),
              )
              .map(
                (el) =>
                  (el.id || el.tagName.toLowerCase()) + " " + (el.textContent || "").trim().slice(0, 30),
              )
              .slice(0, 4);
            // Les éléments fixes (barre de navigation, boutons flottants) se superposent au contenu en défilant : c'est
            // leur rôle. Ils sont contrôlés à part, en bas de page (voir plus bas).
            const fixe = (el) => {
              for (let n = el; n && n !== document.body; n = n.parentElement)
                if (["fixed", "sticky"].includes(getComputedStyle(n).position)) return true;
              return false;
            };
            const estTexte = (el) =>
              el.namespaceURI === "http://www.w3.org/1999/xhtml" || el.tagName.toLowerCase() === "text";
            const feuilles = [...document.querySelectorAll("body *")].filter(
              (el) =>
                visible(el) &&
                estTexte(el) &&
                !fixe(el) &&
                el.textContent.trim().length > 0 &&
                ![...el.children].some((c) => c.textContent.trim().length > 0 && visible(c)),
            );
            const superpositions = [];
            for (let i = 0; i < feuilles.length && i < 400 && superpositions.length < 4; i++) {
              // Comparaison ligne à ligne (un texte qui passe à la ligne a une boîte globale trompeuse).
              const lignesA = [...feuilles[i].getClientRects()];
              for (let j = i + 1; j < feuilles.length && superpositions.length < 4; j++) {
                const b = feuilles[j];
                if (feuilles[i].contains(b) || b.contains(feuilles[i])) continue;
                const lignesB = [...b.getClientRects()];
                const chevauche = lignesA.some((a) =>
                  lignesB.some((r) => {
                    const aire =
                      Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) *
                      Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
                    return aire > 16;
                  }),
                );
                if (chevauche)
                  superpositions.push(
                    `« ${feuilles[i].textContent.trim().slice(0, 25)} » / « ${b.textContent.trim().slice(0, 25)} »`,
                  );
              }
            }
            const cibles = [];
            if (w <= 768) {
              for (const el of document.querySelectorAll("button, input, select, textarea, a")) {
                if (!visible(el)) continue;
                if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
                const r = el.getBoundingClientRect();
                if (r.width < 24 || r.height < 24)
                  cibles.push(
                    `${el.tagName.toLowerCase()} « ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)} » ${Math.round(r.width)}x${Math.round(r.height)}`,
                  );
                if (cibles.length >= 4) break;
              }
            }
            // En bas de page : les contrôles fixes ne doivent pas masquer le texte qui défile en dessous.
            window.scrollTo(0, document.body.scrollHeight);
            const fixesBas = [...document.querySelectorAll("body *")].filter(
              (el) =>
                visible(el) &&
                fixe(el) &&
                el.getBoundingClientRect().top > 80 &&
                (el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "DIV") &&
                el.textContent.trim().length > 0 &&
                el.getBoundingClientRect().height < 200,
            );
            const texteBas = feuilles.filter((el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.top < window.innerHeight;
            });
            for (const f of fixesBas) {
              const a = f.getBoundingClientRect();
              for (const t of texteBas) {
                const r = t.getBoundingClientRect();
                const aire =
                  Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) *
                  Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
                if (aire > 16 && superpositions.length < 6)
                  superpositions.push(
                    `en bas de page, « ${f.textContent.trim().slice(0, 20)} » recouvre « ${t.textContent.trim().slice(0, 25)} »`,
                  );
              }
            }
            // Contraste : couleur du texte contre la couleur de fond la plus proche (opaque). Les fonds en image ou en
            // dégradé ne sont pas mesurables : ils sont comptés à part, sans être validés.
            const lum = (c) => {
              const v = c.map((k) => {
                k /= 255;
                return k <= 0.03928 ? k / 12.92 : Math.pow((k + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
            };
            const rgba = (t) => {
              const m = t.match(/rgba?\(([^)]+)\)/);
              if (!m) return null;
              const p = m[1]
                .split(/[ ,\/]+/)
                .filter(Boolean)
                .map(Number);
              return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
            };
            const contrastes = [];
            let nonMesurables = 0;
            for (const el of feuilles) {
              if (!el.childNodes || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
                continue;
              const cs = getComputedStyle(el);
              const txt = rgba(cs.color);
              if (!txt) continue;
              let fond = null;
              let image = false;
              for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
                const ns = getComputedStyle(n);
                if (ns.backgroundImage !== "none") {
                  image = true;
                  break;
                }
                const bg = rgba(ns.backgroundColor);
                if (bg && bg.a >= 0.99) {
                  fond = bg.c;
                  break;
                }
              }
              if (image || !fond) {
                nonMesurables++;
                continue;
              }
              const l1 = lum(txt.c),
                l2 = lum(fond);
              const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
              const taille = parseFloat(cs.fontSize),
                gras = parseInt(cs.fontWeight, 10) >= 700;
              const seuil = taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5;
              if (ratio < seuil)
                contrastes.push(
                  `« ${el.textContent.trim().slice(0, 20)} » ${ratio.toFixed(2)}:1 (min ${seuil}:1)`,
                );
            }
            return {
              defilement,
              horsEcran,
              superpositions,
              cibles,
              contrastes: contrastes.slice(0, 3),
              nonMesurables,
              mesures: feuilles.length,
            };
          },
          { w },
        );
        textesMesures += mesure.mesures;
        textesNonMesurables += mesure.nonMesurables;
        const pieces = [];
        if (mesure.defilement) pieces.push("défilement horizontal");
        if (mesure.horsEcran.length) pieces.push("hors écran : " + mesure.horsEcran.join(" ; "));
        if (mesure.superpositions.length) pieces.push("superposition : " + mesure.superpositions.join(" ; "));
        if (mesure.cibles.length) pieces.push("cibles trop petites (< 24 px) : " + mesure.cibles.join(" ; "));
        if (mesure.contrastes.length) pieces.push("contraste insuffisant : " + mesure.contrastes.join(" ; "));
        if (erreurs.length) pieces.push(erreurs.slice(0, 2).join(" ; "));
        if (pieces.length) problemes.push(`${route} @${w}px : ${pieces.join(" | ")}`);
        // Capture du haut de page (la mesure a fini en bas de page). Puis, aux largeurs téléphone et ordinateur,
        // une capture en thème sombre : un défaut de contraste ou de fond n'apparaît que là.
        const nom = route.replace(/\//g, "_") || "accueil";
        await page.evaluate(() => window.scrollTo(0, 0));
        const fichierHaut = `capture-${nom}-${w}-haut.png`;
        await page.screenshot({ path: join(rapportDir, fichierHaut), fullPage: false });
        captures.push(fichierHaut);
        await page.close();
        if (aThemeSombre && [390, 1440].includes(w)) {
          // Le thème du site est choisi par l'utilisateur (stockage local « theme ») : on le fixe avant la visite,
          // puis on vérifie qu'il est bien appliqué. Sinon la capture ne prouve rien et le contrôle échoue.
          const sombre = await navigateur.newPage({
            viewport: { width: w, height: 800 },
            reducedMotion: "reduce",
            colorScheme: "dark",
          });
          await sombre.addInitScript(() => {
            try {
              localStorage.setItem("theme", "dark");
            } catch (e) {}
          });
          await sombre
            .goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle" })
            .catch(() => null);
          await sombre.waitForTimeout(300);
          if ((await sombre.evaluate(() => document.documentElement.dataset.theme)) !== "dark")
            problemes.push(`${route} @${w}px : thème sombre non appliqué`);
          const fichierSombre = `capture-${nom}-${w}-sombre.png`;
          await sombre.screenshot({ path: join(rapportDir, fichierSombre), fullPage: false });
          captures.push(fichierSombre);
          await sombre.close();
        }
      }
    }
    await navigateur.close();
    enregistrer(
      "affichage et adaptation (" +
        routes.length +
        " pages × " +
        largeurs.length +
        " largeurs" +
        (rapide ? ", mode rapide" : ", mode final") +
        ")",
      problemes.length === 0,
      problemes.slice(0, 6).join(" ;; ") +
        ` [${textesMesures} zones de texte mesurées, ${textesNonMesurables} contrastes non mesurables (fond en image)]`,
    );
  } catch (e) {
    enregistrer(
      "affichage",
      false,
      "contrôle impossible (installer @playwright/test et Chromium dans le projet) : " +
        e.message.split("\n")[0],
    );
  } finally {
    serveur.close();
  }
}

// 5. Verdict : tout doit passer. La fiabilité est la part des contrôles réussis, sur 10.
const reussis = controles.filter((c) => c.ok).length;
const fiabilite = Math.round(((10 * reussis) / controles.length) * 10) / 10;
const reussi = controles.every((c) => c.ok);
const rapport = { date: new Date().toISOString(), reussi, fiabilite, controles, captures };
writeFileSync(join(rapportDir, "rapport.json"), JSON.stringify(rapport, null, 2));
// Point de reprise : si la session est coupée, la prochaine commande sait où on en était.
writeFileSync(
  join(projet, ".livraison-etat.json"),
  JSON.stringify(
    {
      date: rapport.date,
      reussi,
      fiabilite,
      controles_echoues: controles.filter((c) => !c.ok).map((c) => c.nom),
    },
    null,
    2,
  ) + "\n",
);
// Résumé lisible en français, écrit à côté du rapport technique et affiché.
const resume = resumeEnFrancais(controles);
writeFileSync(join(rapportDir, "RESUME.txt"), resume + "\n");
console.log("\n" + resume + "\n");
process.exit(reussi ? 0 : 1);
