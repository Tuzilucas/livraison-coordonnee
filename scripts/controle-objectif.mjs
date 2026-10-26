// Contrôles mesurables d'un livrable HTML : syntaxe JavaScript, puis débordement d'affichage.
// Usage : node controle-objectif.mjs <chemin/index.html>
// Sortie : JSON ; code 1 si un contrôle échoue.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "");
const html = readFileSync(file, "utf8");
const result = { fichier: file, syntaxe_js: null, affichage: null, erreurs: [] };

const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
try {
  for (const s of scripts) new Function(s);
  result.syntaxe_js = "ok";
} catch (e) {
  result.syntaxe_js = "échec";
  result.erreurs.push("syntaxe : " + e.message);
}

// Affichage : nécessite Playwright et Chromium ; sinon le contrôle est signalé comme non fait.
let chromium = null;
for (const base of [process.cwd(), "/home/user/FRANCE_2027-code-source"]) {
  try {
    const req = createRequire(resolve(base, "package.json"));
    ({ chromium } = req("@playwright/test"));
    break;
  } catch {}
}
if (!chromium) {
  result.affichage = "non fait (Playwright introuvable)";
} else {
  try {
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    });
    const debordements = {};
    for (const width of [320, 390, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto("file://" + file);
      debordements[width] = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const hors = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width && r.right > vw + 1;
          })
          .map((el) => el.id || el.tagName.toLowerCase());
        return {
          elements_hors_ecran: hors.slice(0, 5),
          defilement_horizontal: document.documentElement.scrollWidth > vw,
        };
      });
      await page.close();
    }
    await browser.close();
    const ok = Object.values(debordements).every(
      (d) => !d.defilement_horizontal && d.elements_hors_ecran.length === 0,
    );
    result.affichage = ok ? "ok" : "échec";
    result.details_affichage = debordements;
    if (!ok) result.erreurs.push("affichage : débordement à une largeur de 320, 390 ou 768 px");
  } catch (e) {
    result.affichage = "non fait (" + e.message.split("\n")[0] + ")";
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.syntaxe_js === "échec" || result.affichage === "échec" ? 1 : 0);
