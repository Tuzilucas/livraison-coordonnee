// Serveur statique : confinement strict au dossier servi (scénario 8 : traversée de répertoires).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { demarrer, resoudre } from "../scripts/serveur.mjs";

let racine, dist, serveur, base;
// Sous Windows, créer un lien symbolique demande un droit (mode développeur ou administrateur) : sans lui, le
// cas « lien sortant » est sauté et signalé, les autres cas de confinement restent testés.
let lienCree = false;
before(async () => {
  racine = mkdtempSync(join(tmpdir(), "livraison-serveur-"));
  dist = join(racine, "out");
  mkdirSync(join(dist, "page"), { recursive: true });
  writeFileSync(join(dist, "index.html"), "<h1>accueil</h1>");
  writeFileSync(join(dist, "page", "index.html"), "<h1>page</h1>");
  writeFileSync(join(dist, "style.css"), "body{}");
  writeFileSync(join(racine, "secret.txt"), "SECRET-HORS-DOSSIER");
  try {
    symlinkSync(join(racine, "secret.txt"), join(dist, "lien-sortant.txt"));
    lienCree = true;
  } catch (e) {
    if (e.code !== "EPERM") throw e;
    console.error(
      "lien symbolique impossible sur ce poste (EPERM) : le cas « lien sortant » n'est pas testé ici",
    );
  }
  ({ serveur, base } = await demarrer(dist).then((s) => ({
    serveur: s.serveur,
    base: s.url,
  })));
});
after(() => {
  serveur.close();
  rmSync(racine, { recursive: true, force: true });
});

const get = async (chemin) => {
  const r = await fetch(base + chemin);
  return { status: r.status, texte: await r.text() };
};

test("écoute sur l'interface locale, sur un port libre choisi par le système", () => {
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.notEqual(serveur.address().port, 4399);
});

test("sert les fichiers et les index de dossier du périmètre", async () => {
  assert.equal((await get("/")).texte, "<h1>accueil</h1>");
  assert.equal((await get("/page/")).texte, "<h1>page</h1>");
  assert.equal((await get("/page")).texte, "<h1>page</h1>");
  assert.equal((await get("/style.css?v=1")).status, 200);
  assert.equal((await get("/absent.html")).status, 404);
});

test("refuse toute sortie du dossier : « .. », encodages, séparateurs alternatifs, lien symbolique", async () => {
  const tentatives = [
    "/../secret.txt",
    "/%2e%2e/secret.txt",
    "/%2E%2E%2Fsecret.txt",
    "/..%2fsecret.txt",
    "/..%5csecret.txt",
    "/page/../../secret.txt",
    "/page/..%2f..%2fsecret.txt",
    "/%252e%252e/secret.txt",
    ...(lienCree ? ["/lien-sortant.txt"] : []),
    "/%00",
  ];
  for (const t of tentatives) {
    const r = await get(t);
    assert.notEqual(r.status, 200, `accès accepté pour ${t}`);
    assert.ok(!r.texte.includes("SECRET"), `contenu hors dossier servi pour ${t}`);
  }
});

test("une URL malformée reçoit une réponse propre, le serveur reste debout", async () => {
  assert.equal((await get("/%zz")).status, 404);
  assert.equal((await get("/")).status, 200);
});

test("resoudre() refuse hors périmètre même sans passer par HTTP", () => {
  assert.equal(resoudre(dist, "/../secret.txt"), null);
  if (lienCree) assert.equal(resoudre(dist, "/lien-sortant.txt"), null);
  assert.ok(resoudre(dist, "/page/").endsWith(join("page", "index.html")));
});
