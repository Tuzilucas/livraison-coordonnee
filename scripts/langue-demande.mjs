#!/usr/bin/env node
// Détecte la langue d'une demande (fr, en, es, de, it) et l'enregistre comme langue du projet
// (« langue » dans .claude/regles-livraison.json), pour que la porte et le hook répondent dans la même langue.
// Usage : node langue-demande.mjs <dossier-du-projet> <texte de la demande…>
// Sortie : le code de langue retenu. Un texte trop court ou ambigu garde la langue déjà enregistrée, sinon fr.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LANGUES, normaliser } from "./langue.mjs";

// Mots très fréquents et discriminants, par langue (minuscules, sans accents retirés : on compare tels quels).
const MOTS = {
  fr: "le la les un une des du de et est sont pour avec sur dans que qui pas ne ce cette ces au aux il elle nous vous ils elles ajouter ajoute mettre corriger faire bouton page partage afficher",
  en: "the a an and is are for with on in that which not this these to of it we you they add fix make button page share show display should must when",
  es: "el la los las un una unos unas y es son para con en que no este esta estos al del añadir agregar corregir hacer botón página compartir mostrar",
  de: "der die das ein eine und ist sind für mit auf in dass nicht dieser diese dieses zu den dem hinzufügen korrigieren machen schaltfläche seite teilen anzeigen",
  it: "il lo la i gli le un una uno e è sono per con su in che non questo questa questi al del aggiungere correggere fare pulsante pagina condividere mostrare",
};
const INDEX = Object.fromEntries(Object.entries(MOTS).map(([l, m]) => [l, new Set(m.split(/\s+/))]));

/** Langue la plus probable d'un texte, ou null si trop court ou ambigu. */
export function detecter(texte) {
  const mots = String(texte ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .split(/[\s'’]+/)
    .filter(Boolean);
  if (mots.length < 2) return null;
  const scores = Object.fromEntries(LANGUES.map((l) => [l, 0]));
  for (const m of mots) for (const l of LANGUES) if (INDEX[l].has(m)) scores[l]++;
  const classes = LANGUES.map((l) => [l, scores[l]]).sort((a, b) => b[1] - a[1]);
  const [meilleur, score] = classes[0];
  if (score === 0 || score === classes[1][1]) return null;
  return meilleur;
}

/** Enregistre la langue dans le fichier de règles du projet (créé a minima s'il n'existe pas). */
export function enregistrer(projet, langue) {
  const dossier = join(projet, ".claude");
  const fichier = join(dossier, "regles-livraison.json");
  let contenu = {};
  try {
    if (existsSync(fichier)) contenu = JSON.parse(readFileSync(fichier, "utf8").replace(/^﻿/, "")) ?? {};
  } catch {}
  if (contenu.langue === langue) return;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(fichier, JSON.stringify({ ...contenu, langue }, null, 2) + "\n");
}

// pathToFileURL : sous Windows, argv[1] est « C:\…\langue-demande.mjs » et import.meta.url « file:///C:/… » ;
// la comparaison textuelle d'avant n'était jamais vraie, le script ne faisait rien et n'écrivait rien.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const forcee = normaliser((args.find((a) => a.startsWith("--langue=")) ?? "").slice(9));
  const reste = args.filter((a) => !a.startsWith("--"));
  const projet = resolve(reste[0] ?? ".");
  const texte = reste.slice(1).join(" ");
  const fichier = join(projet, ".claude", "regles-livraison.json");
  let actuelle = null;
  try {
    if (existsSync(fichier)) actuelle = normaliser(JSON.parse(readFileSync(fichier, "utf8")).langue);
  } catch {}
  const langue = forcee ?? normaliser(process.env.LIVRAISON_LANGUE) ?? detecter(texte) ?? actuelle ?? "fr";
  enregistrer(projet, langue);
  console.log(langue);
}
