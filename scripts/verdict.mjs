// Logique pure du verdict d'arrêt, séparée du hook pour être testée sans Claude Code ni porte réelle.

export const ESSAIS_DEFAUT = 5;
export const ESSAIS_PLAFOND = 50;
/** Essais consécutifs avec exactement les mêmes échecs avant de conclure qu'on tourne en rond. */
export const SANS_PROGRES_MAX = 3;

/** Nombre d'essais autorisés : entier entre 1 et 50 ; toute valeur absente, négative, nulle ou non numérique vaut 5. */
export function lireEssaisMax(valeur) {
  const n = Number.parseInt(String(valeur ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return ESSAIS_DEFAUT;
  return Math.min(n, ESSAIS_PLAFOND);
}

/** Tentatives déjà faites, lues dans le marqueur : un contenu absent ou illisible vaut 0. */
export function lireTentatives(texte) {
  return lireMarqueur(texte).tentatives;
}

/**
 * Contenu du marqueur .livraison-en-cours : soit un entier (ancien format), soit un objet JSON
 * { tentatives, sans_progres, empreinte }. Tout contenu illisible vaut un état vierge.
 */
export function lireMarqueur(texte) {
  const vierge = { tentatives: 0, sans_progres: 0, empreinte: "" };
  const brut = String(texte ?? "").trim();
  if (!brut) return vierge;
  if (/^\d+$/.test(brut)) return { ...vierge, tentatives: Number.parseInt(brut, 10) };
  try {
    const o = JSON.parse(brut);
    if (!o || typeof o !== "object") return vierge;
    const n = Number.parseInt(String(o.tentatives ?? ""), 10);
    const p = Number.parseInt(String(o.sans_progres ?? ""), 10);
    return {
      tentatives: Number.isFinite(n) && n >= 0 ? n : 0,
      sans_progres: Number.isFinite(p) && p >= 0 ? p : 0,
      empreinte: typeof o.empreinte === "string" ? o.empreinte : "",
    };
  } catch {
    return vierge;
  }
}

/** Lit un rapport de porte ; un rapport absent ou malformé est un échec explicite, jamais un succès. */
export function lireRapport(texte) {
  if (texte === null || texte === undefined)
    return { reussi: false, controles: [], invalide: "rapport absent" };
  try {
    const r = JSON.parse(String(texte).replace(/^﻿/, ""));
    if (!r || typeof r !== "object" || !Array.isArray(r.controles))
      return { reussi: false, controles: [], invalide: "rapport sans liste de contrôles" };
    return { ...r, reussi: r.reussi === true };
  } catch (e) {
    return { reussi: false, controles: [], invalide: "rapport illisible : " + e.message };
  }
}

/** Empreinte des échecs d'un rapport : mêmes contrôles en échec avec les mêmes détails = même empreinte. */
export function empreinteDe(rapport) {
  if (rapport.invalide) return "invalide:" + rapport.invalide;
  return rapport.controles
    .filter((c) => !c.ok)
    .map((c) => `${c.nom}=${c.detail ?? ""}`)
    .sort()
    .join("\n");
}

/**
 * Décision du hook après une exécution de la porte.
 *  - codeGate : code de sortie du processus de la porte (null = interrompu ou délai dépassé).
 *  - rapport : résultat de lireRapport().
 *  - marqueur : état précédent (lireMarqueur()) ; tentativesPrecedentes (ancien appel) reste accepté.
 *  - stopHookActive : vrai quand Claude Code continue déjà à cause d'un hook d'arrêt (documentation Claude Code).
 * Le succès exige à la fois un code 0 ET un rapport lisible qui dit « reussi » : l'un sans l'autre est un échec.
 * Sans progrès (mêmes échecs SANS_PROGRES_MAX fois de suite pendant une continuation), on abandonne plus tôt :
 * bloquer sur une condition qui ne bouge pas ne résout rien, et Claude Code plafonne de toute façon à huit
 * continuations consécutives sans appel d'outil.
 */
export function decider({
  codeGate,
  rapport,
  marqueur,
  tentativesPrecedentes,
  essaisMax,
  stopHookActive = false,
}) {
  const max = lireEssaisMax(essaisMax);
  const etat = marqueur ?? {
    tentatives: lireTentatives(tentativesPrecedentes),
    sans_progres: 0,
    empreinte: "",
  };
  const reussi = codeGate === 0 && rapport.reussi === true && !rapport.invalide;
  if (reussi) return { decision: "terminee", tentatives: etat.tentatives, retirerMarqueur: true };
  const tentatives = etat.tentatives + 1;
  const empreinte = empreinteDe(rapport);
  const sansProgres = stopHookActive && empreinte && empreinte === etat.empreinte ? etat.sans_progres + 1 : 0;
  const raisonCode =
    codeGate === null
      ? "porte interrompue ou délai dépassé"
      : codeGate === 0
        ? `code 0 mais ${rapport.invalide ?? "rapport non concluant"}`
        : `code ${codeGate}`;
  const commun = { tentatives, essaisMax: max, raisonCode, empreinte, sansProgres };
  if (tentatives >= max) return { decision: "abandon", retirerMarqueur: true, ...commun };
  if (sansProgres >= SANS_PROGRES_MAX)
    return { decision: "abandon", retirerMarqueur: true, sansProgresAtteint: true, ...commun };
  return { decision: "bloquer", retirerMarqueur: false, ...commun };
}
