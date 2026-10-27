#!/usr/bin/env node
// Lance le serveur MCP de navigateur (Playwright MCP) avec le navigateur installé sur cet appareil.
// Ordre : Chrome, puis Edge. LIVRAISON_NAVIGATEUR=chrome|msedge force un choix.
// Sans navigateur trouvé, le serveur utilise le navigateur Playwright du projet, s'il est installé.
import { existsSync } from "node:fs";
import { lancerAttache } from "./processus.mjs";

const env = process.env;
const emplacements = {
  chrome: {
    win32: [
      `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"],
  },
  msedge: {
    win32: [
      `${env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    darwin: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    linux: ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"],
  },
};

const ordre = env.LIVRAISON_NAVIGATEUR ? [env.LIVRAISON_NAVIGATEUR] : ["chrome", "msedge"];
const choisi = ordre.find((nom) =>
  (emplacements[nom]?.[process.platform] ?? []).some((p) => p && existsSync(p)),
);
const args = ["-y", "@playwright/mcp@0.0.83", ...(choisi ? ["--browser", choisi] : [])];
if (choisi) console.error(`Navigateur MCP : ${choisi}`);
else console.error("Aucun Chrome ni Edge trouvé : navigateur Playwright du projet utilisé.");

// lancerAttache() : sous Windows, « npx.cmd » lancé sans shell rend EINVAL depuis Node 18.20 (processus.mjs).
lancerAttache("npx", args, { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 0));
