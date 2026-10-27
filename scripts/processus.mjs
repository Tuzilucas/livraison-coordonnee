// Lancement de processus et de navigateur portables (Linux, macOS, Windows).
//
// Pourquoi ce module existe (mesuré sur un poste Windows 11, Node 24, le 27/10/2026) :
//   - « npm » et « npx » y sont des scripts .cmd : spawnSync("npm", …) sans shell rend ENOENT, et Node ≥ 18.20
//     refuse de lancer un .cmd sans shell (EINVAL, CVE-2024-27980). La porte ne pouvait donc exécuter AUCUN
//     script du projet, et verifier-environnement annonçait « npm manque » alors qu'il était installé.
//   - L'option { shell: true } de Node concatène les arguments sans les protéger et émet l'avertissement
//     DEP0190 dans la sortie : on passe par cmd.exe explicitement, avec les arguments cités.
//   - Chromium n'est pas en /opt/pw-browsers sous Windows : on cherche le navigateur de Playwright, puis
//     Chrome ou Edge installés sur le poste.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export const WINDOWS = process.platform === "win32";

// Citation d'un argument pour cmd.exe : guillemets autour de tout ce qui contient un espace ou un caractère
// spécial, guillemets internes doublés (convention des programmes Windows courants).
const citer = (a) => (/[\s"&|<>^()%!]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);

/** Commande et arguments tels qu'un shell les lancerait : utile aussi pour les journaux. */
export function ligneDeCommande(cmd, args = []) {
  return [cmd, ...args].map(String).map(citer).join(" ");
}

function viaCmd(cmd, args, options) {
  // /d : sans AutoRun ; /s : les guillemets externes encadrent toute la ligne ; /c : exécute puis quitte.
  return [
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", `"${ligneDeCommande(cmd, args)}"`],
    { ...options, windowsVerbatimArguments: true },
  ];
}

/** spawnSync portable : sous Windows, les commandes .cmd (npm, npx) passent par cmd.exe. */
export function lancer(cmd, args = [], options = {}) {
  if (!WINDOWS) return spawnSync(cmd, args, options);
  const [c, a, o] = viaCmd(cmd, args, options);
  return spawnSync(c, a, o);
}

/** spawn portable (processus attaché, même règle que lancer()). */
export function lancerAttache(cmd, args = [], options = {}) {
  if (!WINDOWS) return spawn(cmd, args, options);
  const [c, a, o] = viaCmd(cmd, args, options);
  return spawn(c, a, o);
}

/** Emplacements habituels d'un Chromium, Chrome ou Edge sur l'appareil, dans l'ordre d'essai. */
export function cheminsNavigateurs() {
  const env = process.env;
  const pf = env.PROGRAMFILES ?? "C:\\Program Files";
  const pf86 = env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const lad = env.LOCALAPPDATA ?? "";
  const par = {
    linux: [
      "/opt/pw-browsers/chromium",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/microsoft-edge",
    ],
    darwin: [
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    win32: [
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${lad}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
  };
  return par[process.platform] ?? [];
}

/** Navigateur à utiliser : CHROMIUM_PATH s'il est défini, sinon le premier installé sur l'appareil, sinon null. */
export function navigateurTrouve() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return cheminsNavigateurs().find((p) => p && existsSync(p)) ?? null;
}

/**
 * Ouvre Chromium avec le lanceur de Playwright, dans cet ordre : CHROMIUM_PATH ; le navigateur que Playwright a
 * installé lui-même (npx playwright install chromium) ; Chrome ou Edge présents sur l'appareil.
 * Échoue avec la liste des essais si aucun ne s'ouvre : « navigateur absent » doit rester un échec lisible.
 */
export async function ouvrirChromium(chromium, options = {}) {
  const essais = [];
  if (process.env.CHROMIUM_PATH) essais.push({ executablePath: process.env.CHROMIUM_PATH });
  essais.push({});
  for (const p of cheminsNavigateurs()) if (p && existsSync(p)) essais.push({ executablePath: p });
  const erreurs = [];
  for (const essai of essais) {
    try {
      return await chromium.launch({ ...options, ...essai });
    } catch (e) {
      erreurs.push(`${essai.executablePath ?? "navigateur de Playwright"} : ${String(e.message).split("\n")[0]}`);
    }
  }
  throw new Error("aucun Chromium, Chrome ou Edge ne s'ouvre (" + erreurs.join(" ; ") + ")");
}
