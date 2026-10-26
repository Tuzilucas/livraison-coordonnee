// Logique pure du verdict d'arrêt, séparée du hook pour être testée sans Claude Code ni porte réelle.

export const ESSAIS_DEFAUT = 5;
export const ESSAIS_PLAFOND = 50;

/** Nombre d'essais autorisés : entier entre 1 et 50 ; toute valeur absente, négative, nulle ou non numérique vaut 5. */
export function lireEssaisMax(valeur) {
  const n = Number.parseInt(String(valeur ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return ESSAIS_DEFAUT;
  return Math.min(n, ESSAIS_PLAFOND);
}

/** Tentatives déjà faites, lues dans le marqueur : un contenu absent ou illisible vaut 0. */
export function lireTentatives(texte) {
  const n = Number.parseInt(String(texte ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Lit un rapport de porte ; un rapport absent ou malformé est un échec explicite, jamais un succès. */
export function lireRapport(texte) {
  if (texte === null || texte === undefined)
    return { reussi: false, controles: [], invalide: "rapport absent" };
  try {
    const r = JSON.parse(String(texte).replace(/^﻿/, ""));
    if (!r || typeof r !== "object" || !Array.isArray(r.controles))
      return {
        reussi: false,
        controles: [],
        invalide: "rapport sans liste de contrôles",
      };
    return { ...r, reussi: r.reussi === true };
  } catch (e) {
    return {
      reussi: false,
      controles: [],
      invalide: "rapport illisible : " + e.message,
    };
  }
}

/**
 * Décision du hook après une exécution de la porte.
 *  - codeGate : code de sortie du processus de la porte (null = interrompu ou délai dépassé).
 *  - rapport : résultat de lireRapport().
 * Le succès exige à la fois un code 0 ET un rapport lisible qui dit « reussi » : l'un sans l'autre est un échec.
 */
export function decider({ codeGate, rapport, tentativesPrecedentes, essaisMax }) {
  const max = lireEssaisMax(essaisMax);
  const reussi = codeGate === 0 && rapport.reussi === true && !rapport.invalide;
  if (reussi)
    return {
      decision: "terminee",
      tentatives: tentativesPrecedentes,
      retirerMarqueur: true,
    };
  const tentatives = lireTentatives(tentativesPrecedentes) + 1;
  const raisonCode =
    codeGate === null
      ? "porte interrompue ou délai dépassé"
      : codeGate === 0
        ? `code 0 mais ${rapport.invalide ?? "rapport non concluant"}`
        : `code ${codeGate}`;
  if (tentatives >= max)
    return {
      decision: "abandon",
      tentatives,
      essaisMax: max,
      retirerMarqueur: true,
      raisonCode,
    };
  return {
    decision: "bloquer",
    tentatives,
    essaisMax: max,
    retirerMarqueur: false,
    raisonCode,
  };
}
