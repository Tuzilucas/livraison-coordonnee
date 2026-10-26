// Serveur statique de la porte : sert uniquement les fichiers du dossier construit, sur l'interface locale,
// sur un port libre choisi par le système. Tout chemin qui sort du dossier (« .. », encodages, liens
// symboliques) est refusé après résolution réelle du chemin, pas seulement après normalisation de la chaîne.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

/** Chemin réel du fichier à servir pour une URL, ou null s'il est hors du dossier ou absent. */
export function resoudre(dist, url) {
  let brut;
  try {
    brut = decodeURIComponent((url ?? "/").split("?")[0].split("#")[0]);
  } catch {
    return null; // URL malformée (« %zz »)
  }
  if (brut.includes("\0")) return null;
  const racine = realpathSync(dist);
  // Tout séparateur alternatif est traité comme un séparateur : « ..\ » ne doit pas contourner le contrôle.
  const relatif = brut.replace(/\\/g, "/").replace(/^\/+/, "");
  let chemin = resolve(racine, relatif);
  if (chemin !== racine && !chemin.startsWith(racine + sep)) return null;
  if (!existsSync(chemin)) return null;
  if (statSync(chemin).isDirectory()) chemin = resolve(chemin, "index.html");
  if (!existsSync(chemin) || !statSync(chemin).isFile()) return null;
  // Résolution réelle : un lien symbolique vers l'extérieur du dossier est refusé.
  const reel = realpathSync(chemin);
  if (reel !== racine && !reel.startsWith(racine + sep)) return null;
  return reel;
}

/** Démarre le serveur ; résout { serveur, port, url }. L'appelant doit appeler serveur.close(). */
export function demarrer(dist) {
  const serveur = createServer((req, res) => {
    try {
      const fichier = resoudre(dist, req.url);
      // Une icône d'onglet absente n'est pas un défaut de la page : réponse vide plutôt qu'une erreur console.
      if (!fichier && (req.url ?? "").split("?")[0] === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
      }
      if (!fichier) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("introuvable");
      }
      res.writeHead(200, {
        "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream",
      });
      res.end(readFileSync(fichier));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("erreur du serveur : " + e.message);
    }
  });
  return new Promise((ok, ko) => {
    serveur.once("error", ko);
    serveur.listen(0, "127.0.0.1", () => {
      const { port } = serveur.address();
      ok({ serveur, port, url: `http://127.0.0.1:${port}` });
    });
  });
}
