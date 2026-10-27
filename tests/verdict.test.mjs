// Verdict d'arrêt : codes de sortie, rapports absents ou malformés, compteur d'essais (scénarios 10 et G).
import assert from "node:assert/strict";
import { test } from "node:test";
import { decider, lireEssaisMax, lireRapport, lireTentatives } from "../scripts/verdict.mjs";

const bon = lireRapport(JSON.stringify({ reussi: true, controles: [{ nom: "x", ok: true }] }));

test("LIVRAISON_ESSAIS : valeurs négatives, nulles, non numériques ou excessives sont ramenées à la raison", () => {
  assert.equal(lireEssaisMax(undefined), 5);
  assert.equal(lireEssaisMax("abc"), 5);
  assert.equal(lireEssaisMax("-3"), 5);
  assert.equal(lireEssaisMax("0"), 5);
  assert.equal(lireEssaisMax("3"), 3);
  assert.equal(lireEssaisMax("999"), 50);
});

test("marqueur illisible : les tentatives repartent de zéro, jamais de NaN", () => {
  assert.equal(lireTentatives("NaN"), 0);
  assert.equal(lireTentatives(""), 0);
  assert.equal(lireTentatives("2\n"), 2);
  assert.equal(lireTentatives("-4"), 0);
});

test("porte réussie (code 0 et rapport « reussi ») : livraison terminée, marqueur retiré", () => {
  const v = decider({
    codeGate: 0,
    rapport: bon,
    tentativesPrecedentes: 0,
    essaisMax: undefined,
  });
  assert.equal(v.decision, "terminee");
  assert.equal(v.retirerMarqueur, true);
});

test("rapport absent ou malformé : jamais un succès, même avec un code 0", () => {
  for (const texte of [
    null,
    "",
    "{",
    JSON.stringify({ reussi: true }),
    JSON.stringify({ reussi: true, controles: [] }),
    JSON.stringify({ reussi: true, controles: [{ nom: "x", ok: false }] }),
    JSON.stringify({ reussi: true, controles: [{ nom: "x", ok: true, statut: "non_execute" }] }),
    JSON.stringify({ reussi: true, controles: [{ nom: "", ok: true }] }),
    JSON.stringify([1]),
  ]) {
    const r = lireRapport(texte);
    assert.equal(r.reussi, false);
    assert.ok(r.invalide, `rapport ${JSON.stringify(texte)} devrait être marqué invalide`);
    const v = decider({ codeGate: 0, rapport: r, tentativesPrecedentes: 0 });
    assert.equal(v.decision, "bloquer");
  }
});

test("rapport « reussi » mais code de sortie non nul ou porte interrompue : blocage", () => {
  assert.equal(decider({ codeGate: 1, rapport: bon, tentativesPrecedentes: 0 }).decision, "bloquer");
  const v = decider({ codeGate: null, rapport: bon, tentativesPrecedentes: 0 });
  assert.equal(v.decision, "bloquer");
  assert.match(v.raisonCode, /interrompue|délai/);
});

test("épuisement des essais : abandon explicite, jamais « terminée »", () => {
  const echec = lireRapport(JSON.stringify({ reussi: false, controles: [{ nom: "x", ok: false }] }));
  const v4 = decider({
    codeGate: 1,
    rapport: echec,
    tentativesPrecedentes: 3,
    essaisMax: "5",
  });
  assert.equal(v4.decision, "bloquer");
  assert.equal(v4.tentatives, 4);
  const v5 = decider({
    codeGate: 1,
    rapport: echec,
    tentativesPrecedentes: 4,
    essaisMax: "5",
  });
  assert.equal(v5.decision, "abandon");
  assert.equal(v5.retirerMarqueur, true);
  assert.notEqual(v5.decision, "terminee");
});

test("un LIVRAISON_ESSAIS négatif ne permet pas d'abandonner dès le premier échec", () => {
  const echec = lireRapport(JSON.stringify({ reussi: false, controles: [] }));
  const v = decider({
    codeGate: 1,
    rapport: echec,
    tentativesPrecedentes: 0,
    essaisMax: "-1",
  });
  assert.equal(v.decision, "bloquer");
  assert.equal(v.essaisMax, 5);
});
