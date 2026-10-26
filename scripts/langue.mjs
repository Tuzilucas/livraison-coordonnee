// Langue des résumés et des messages (fr par défaut ; en, es, de, it). Le français reste la langue du code,
// des noms de contrôles et des rapports techniques : seule la lecture humaine est traduite.
// Choix : LIVRAISON_LANGUE (environnement) > « langue » dans .claude/regles-livraison.json > fr.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LANGUES = ["fr", "en", "es", "de", "it"];

export function normaliser(code) {
  const c = String(code ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return LANGUES.includes(c) ? c : null;
}

/** Langue effective d'un projet. */
export function langueDe(projet, env = process.env) {
  const forcee = normaliser(env.LIVRAISON_LANGUE);
  if (forcee) return forcee;
  try {
    const f = join(projet, ".claude", "regles-livraison.json");
    if (existsSync(f)) {
      const c = normaliser(JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")).langue);
      if (c) return c;
    }
  } catch {}
  return "fr";
}

// Phrases complètes, par clé.
const PHRASES = {
  "lecture-regles": {
    fr: "Les règles du projet (CLAUDE.md) sont bien lues",
    en: "The project rules (CLAUDE.md) are read correctly",
    es: "Las reglas del proyecto (CLAUDE.md) se leen correctamente",
    de: "Die Projektregeln (CLAUDE.md) werden korrekt gelesen",
    it: "Le regole del progetto (CLAUDE.md) sono lette correttamente",
  },
  "verification-projet": {
    fr: "Le code passe ses vérifications automatiques (format, qualité, tests)",
    en: "The code passes its automated checks (format, lint, tests)",
    es: "El código supera sus comprobaciones automáticas (formato, calidad, pruebas)",
    de: "Der Code besteht seine automatischen Prüfungen (Format, Qualität, Tests)",
    it: "Il codice supera le verifiche automatiche (formato, qualità, test)",
  },
  "mécanismes de vérification": {
    fr: "Le projet dispose de moyens de vérification (tests, construction ou navigateur)",
    en: "The project has verification means (tests, build or browser)",
    es: "El proyecto dispone de medios de verificación (pruebas, compilación o navegador)",
    de: "Das Projekt verfügt über Prüfmittel (Tests, Build oder Browser)",
    it: "Il progetto dispone di mezzi di verifica (test, build o browser)",
  },
  "package.json": {
    fr: "Le fichier package.json est lisible",
    en: "The package.json file is readable",
    es: "El archivo package.json es legible",
    de: "Die Datei package.json ist lesbar",
    it: "Il file package.json è leggibile",
  },
  "porte de qualité": {
    fr: "La porte de qualité s'est exécutée sans erreur interne",
    en: "The quality gate ran without internal error",
    es: "La puerta de calidad se ejecutó sin error interno",
    de: "Das Qualitätstor lief ohne internen Fehler",
    it: "Il cancello di qualità è stato eseguito senza errori interni",
  },
  "test d'acceptation de la demande": {
    fr: "Un test prouve que la demande est remplie",
    en: "A test proves the request is fulfilled",
    es: "Una prueba demuestra que la petición está cumplida",
    de: "Ein Test belegt, dass die Anforderung erfüllt ist",
    it: "Un test dimostra che la richiesta è soddisfatta",
  },
  "couverture des règles de CLAUDE.md": {
    fr: "Chaque règle importante est vérifiée par un test",
    en: "Every important rule is covered by a test",
    es: "Cada regla importante está cubierta por una prueba",
    de: "Jede wichtige Regel ist durch einen Test abgedeckt",
    it: "Ogni regola importante è coperta da un test",
  },
  donnees: {
    fr: "Les données du site sont valides",
    en: "The site data is valid",
    es: "Los datos del sitio son válidos",
    de: "Die Daten der Website sind gültig",
    it: "I dati del sito sono validi",
  },
  construction: {
    fr: "Le site se construit sans erreur",
    en: "The site builds without error",
    es: "El sitio se compila sin errores",
    de: "Die Website wird fehlerfrei gebaut",
    it: "Il sito viene costruito senza errori",
  },
  "tests-des-regles": {
    fr: "Les tests des règles passent",
    en: "The rule tests pass",
    es: "Las pruebas de las reglas pasan",
    de: "Die Regeltests bestehen",
    it: "I test delle regole passano",
  },
  "tests-bout-en-bout": {
    fr: "Les tests de navigation passent",
    en: "The end-to-end tests pass",
    es: "Las pruebas de navegación pasan",
    de: "Die End-to-End-Tests bestehen",
    it: "I test di navigazione passano",
  },
  affichage: {
    fr: "Les pages s'affichent bien sur téléphone et ordinateur",
    en: "Pages render correctly on phone and desktop",
    es: "Las páginas se muestran bien en teléfono y ordenador",
    de: "Die Seiten werden auf Telefon und Desktop korrekt dargestellt",
    it: "Le pagine si visualizzano bene su telefono e computer",
  },
  interdit: {
    fr: "Aucune donnée interne ni secret n'apparaît sur le site",
    en: "No internal data or secret appears on the site",
    es: "Ningún dato interno ni secreto aparece en el sitio",
    de: "Keine internen Daten oder Geheimnisse erscheinen auf der Website",
    it: "Nessun dato interno o segreto compare sul sito",
  },
  non_execute: {
    fr: "non exécuté",
    en: "not run",
    es: "no ejecutado",
    de: "nicht ausgeführt",
    it: "non eseguito",
  },
  sans_objet: {
    fr: "sans objet pour ce projet",
    en: "not applicable to this project",
    es: "no aplicable a este proyecto",
    de: "für dieses Projekt nicht zutreffend",
    it: "non applicabile a questo progetto",
  },
  conclusion_ok: {
    fr: "Conclusion : la livraison peut être acceptée.",
    en: "Conclusion: the delivery can be accepted.",
    es: "Conclusión: la entrega puede aceptarse.",
    de: "Fazit: Die Lieferung kann angenommen werden.",
    it: "Conclusione: la consegna può essere accettata.",
  },
  conclusion_ko: {
    fr: "Conclusion : la livraison n'est pas acceptée. {n} point(s) à corriger avant de continuer.",
    en: "Conclusion: the delivery is not accepted. {n} item(s) to fix before continuing.",
    es: "Conclusión: la entrega no está aceptada. {n} punto(s) por corregir antes de continuar.",
    de: "Fazit: Die Lieferung ist nicht angenommen. {n} Punkt(e) sind vor dem Weitermachen zu beheben.",
    it: "Conclusione: la consegna non è accettata. {n} punto/i da correggere prima di continuare.",
  },
  hook_terminee: {
    fr: "Livraison terminée : la porte finale passe.",
    en: "Delivery finished: the final gate passes.",
    es: "Entrega terminada: la puerta final pasa.",
    de: "Lieferung abgeschlossen: Das finale Tor besteht.",
    it: "Consegna terminata: il cancello finale passa.",
  },
  hook_bloquer: {
    fr: "La livraison n'est pas encore acceptée (essai {n} sur {max}). Voici ce qui reste à faire :\n\n{resume}\n\nCorrige ces points, relance la vérification, et n'annonce la livraison qu'une fois tout en vert.",
    en: "The delivery is not accepted yet (attempt {n} of {max}). Here is what remains:\n\n{resume}\n\nFix these items, run the check again, and only announce the delivery once everything is green.",
    es: "La entrega aún no está aceptada (intento {n} de {max}). Esto es lo que queda por hacer:\n\n{resume}\n\nCorrige estos puntos, vuelve a lanzar la verificación y anuncia la entrega solo cuando todo esté en verde.",
    de: "Die Lieferung ist noch nicht angenommen (Versuch {n} von {max}). Das bleibt zu tun:\n\n{resume}\n\nBehebe diese Punkte, starte die Prüfung erneut und melde die Lieferung erst, wenn alles grün ist.",
    it: "La consegna non è ancora accettata (tentativo {n} di {max}). Ecco cosa resta da fare:\n\n{resume}\n\nCorreggi questi punti, rilancia la verifica e annuncia la consegna solo quando tutto è verde.",
  },
  hook_abandon: {
    fr: "LIVRAISON NON TERMINÉE après {n} essais. La porte de qualité échoue encore :\n{resume}",
    en: "DELIVERY NOT FINISHED after {n} attempts. The quality gate still fails:\n{resume}",
    es: "ENTREGA NO TERMINADA tras {n} intentos. La puerta de calidad sigue fallando:\n{resume}",
    de: "LIEFERUNG NICHT ABGESCHLOSSEN nach {n} Versuchen. Das Qualitätstor schlägt weiterhin fehl:\n{resume}",
    it: "CONSEGNA NON TERMINATA dopo {n} tentativi. Il cancello di qualità fallisce ancora:\n{resume}",
  },
  hook_sans_progres: {
    fr: "LIVRAISON NON TERMINÉE : les mêmes échecs reviennent depuis {n} essais sans progrès. La porte de qualité échoue encore :\n{resume}",
    en: "DELIVERY NOT FINISHED: the same failures have recurred for {n} attempts without progress. The quality gate still fails:\n{resume}",
    es: "ENTREGA NO TERMINADA: los mismos fallos se repiten desde hace {n} intentos sin progreso. La puerta de calidad sigue fallando:\n{resume}",
    de: "LIEFERUNG NICHT ABGESCHLOSSEN: Dieselben Fehler wiederholen sich seit {n} Versuchen ohne Fortschritt. Das Qualitätstor schlägt weiterhin fehl:\n{resume}",
    it: "CONSEGNA NON TERMINATA: gli stessi errori si ripetono da {n} tentativi senza progressi. Il cancello di qualità fallisce ancora:\n{resume}",
  },
};

/** Phrase traduite, avec remplacement de {param}. Repli sur le français, puis sur la clé. */
export function t(langue, cle, params = {}) {
  const l = normaliser(langue) ?? "fr";
  let s = PHRASES[cle]?.[l] ?? PHRASES[cle]?.fr ?? cle;
  for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// Fragments des détails techniques produits par la porte, du plus long au plus court.
const FRAGMENTS = [
  [
    "aucun script check, test, test:regles ou build, ni Playwright : la porte ne peut rien prouver",
    {
      en: "no check, test, test:regles or build script, and no Playwright: the gate can prove nothing",
      es: "ningún script check, test, test:regles o build, ni Playwright: la puerta no puede probar nada",
      de: "kein check-, test-, test:regles- oder build-Skript und kein Playwright: das Tor kann nichts belegen",
      it: "nessuno script check, test, test:regles o build, né Playwright: il cancello non può provare nulla",
    },
  ],
  [
    "le test « demande:<nom> » existe mais aucun script (test:regles, check ou test) ne l'exécute",
    {
      en: "the « demande:<name> » test exists but no script (test:regles, check or test) runs it",
      es: "la prueba « demande:<nombre> » existe pero ningún script (test:regles, check o test) la ejecuta",
      de: "der Test « demande:<name> » existiert, aber kein Skript (test:regles, check oder test) führt ihn aus",
      it: "il test « demande:<nome> » esiste ma nessuno script (test:regles, check o test) lo esegue",
    },
  ],
  [
    "aucun test « demande:<nom> » nouveau ou modifié pendant cette livraison ne prouve la demande",
    {
      en: "no « demande:<name> » test created or modified during this delivery proves the request",
      es: "ninguna prueba « demande:<nombre> » nueva o modificada durante esta entrega demuestra la petición",
      de: "kein während dieser Lieferung neuer oder geänderter Test « demande:<name> » belegt die Anforderung",
      it: "nessun test « demande:<nome> » nuovo o modificato durante questa consegna prova la richiesta",
    },
  ],
  [
    "impossible de vérifier (pas de dépôt Git) : ajouter un test « demande:<nom> » modifié pendant la livraison",
    {
      en: "cannot verify (no Git repository): add a « demande:<name> » test modified during the delivery",
      es: "imposible verificar (sin repositorio Git): añadir una prueba « demande:<nombre> » modificada durante la entrega",
      de: "nicht prüfbar (kein Git-Repository): einen während der Lieferung geänderten Test « demande:<name> » hinzufügen",
      it: "impossibile verificare (nessun repository Git): aggiungere un test « demande:<nome> » modificato durante la consegna",
    },
  ],
  [
    "contrôle impossible (installer @playwright/test et Chromium dans le projet)",
    {
      en: "check impossible (install @playwright/test and Chromium in the project)",
      es: "comprobación imposible (instalar @playwright/test y Chromium en el proyecto)",
      de: "Prüfung nicht möglich (@playwright/test und Chromium im Projekt installieren)",
      it: "controllo impossibile (installare @playwright/test e Chromium nel progetto)",
    },
  ],
  [
    "pas de script build : non applicable, site statique servi tel quel",
    {
      en: "no build script: not applicable, static site served as is",
      es: "sin script build: no aplicable, sitio estático servido tal cual",
      de: "kein build-Skript: nicht zutreffend, statische Website wird unverändert ausgeliefert",
      it: "nessuno script build: non applicabile, sito statico servito così com'è",
    },
  ],
  [
    "build réutilisé (code inchangé depuis le dernier build)",
    {
      en: "build reused (code unchanged since last build)",
      es: "compilación reutilizada (código sin cambios desde la última)",
      de: "Build wiederverwendet (Code seit dem letzten Build unverändert)",
      it: "build riutilizzata (codice invariato dall'ultima build)",
    },
  ],
  [
    "aucun dossier servi (out/, public/ ou index.html)",
    {
      en: "no served folder (out/, public/ or index.html)",
      es: "ninguna carpeta servida (out/, public/ o index.html)",
      de: "kein ausgelieferter Ordner (out/, public/ oder index.html)",
      it: "nessuna cartella servita (out/, public/ o index.html)",
    },
  ],
  [
    "contrastes non mesurables (fond en image)",
    {
      en: "contrasts not measurable (image background)",
      es: "contrastes no medibles (fondo con imagen)",
      de: "Kontraste nicht messbar (Bildhintergrund)",
      it: "contrasti non misurabili (sfondo con immagine)",
    },
  ],
  [
    ".claude/regles-livraison.json absent : lancer scripts/regles.mjs",
    {
      en: ".claude/regles-livraison.json missing: run scripts/regles.mjs",
      es: ".claude/regles-livraison.json ausente: ejecutar scripts/regles.mjs",
      de: ".claude/regles-livraison.json fehlt: scripts/regles.mjs ausführen",
      it: ".claude/regles-livraison.json assente: eseguire scripts/regles.mjs",
    },
  ],
  [
    "projet sans interface web : non applicable",
    {
      en: "project without a web interface: not applicable",
      es: "proyecto sin interfaz web: no aplicable",
      de: "Projekt ohne Weboberfläche: nicht zutreffend",
      it: "progetto senza interfaccia web: non applicabile",
    },
  ],
  [
    "pas de script data:validate : non applicable",
    {
      en: "no data:validate script: not applicable",
      es: "sin script data:validate: no aplicable",
      de: "kein data:validate-Skript: nicht zutreffend",
      it: "nessuno script data:validate: non applicabile",
    },
  ],
  [
    "pas de script check : non applicable",
    {
      en: "no check script: not applicable",
      es: "sin script check: no aplicable",
      de: "kein check-Skript: nicht zutreffend",
      it: "nessuno script check: non applicabile",
    },
  ],
  [
    "pas de Playwright : non applicable",
    {
      en: "no Playwright: not applicable",
      es: "sin Playwright: no aplicable",
      de: "kein Playwright: nicht zutreffend",
      it: "nessun Playwright: non applicabile",
    },
  ],
  [
    "cibles trop petites (< 24 px)",
    {
      en: "targets too small (< 24 px)",
      es: "objetivos demasiado pequeños (< 24 px)",
      de: "Ziele zu klein (< 24 px)",
      it: "bersagli troppo piccoli (< 24 px)",
    },
  ],
  [
    "thème sombre non appliqué",
    {
      en: "dark theme not applied",
      es: "tema oscuro no aplicado",
      de: "dunkles Design nicht angewendet",
      it: "tema scuro non applicato",
    },
  ],
  [
    "zones de texte mesurées",
    {
      en: "text areas measured",
      es: "zonas de texto medidas",
      de: "Textbereiche gemessen",
      it: "aree di testo misurate",
    },
  ],
  [
    "contraste insuffisant",
    {
      en: "insufficient contrast",
      es: "contraste insuficiente",
      de: "unzureichender Kontrast",
      it: "contrasto insufficiente",
    },
  ],
  [
    "défilement horizontal",
    {
      en: "horizontal scrolling",
      es: "desplazamiento horizontal",
      de: "horizontales Scrollen",
      it: "scorrimento orizzontale",
    },
  ],
  [
    "sections non traitées",
    {
      en: "sections not handled",
      es: "secciones no tratadas",
      de: "nicht behandelte Abschnitte",
      it: "sezioni non trattate",
    },
  ],
  [
    "n'ont pas encore de test",
    {
      en: "have no test yet",
      es: "aún no tienen prueba",
      de: "haben noch keinen Test",
      it: "non hanno ancora un test",
    },
  ],
  [
    "en bas de page,",
    {
      en: "at the bottom of the page,",
      es: "al pie de la página,",
      de: "am Seitenende,",
      it: "in fondo alla pagina,",
    },
  ],
  ["page absente", { en: "page missing", es: "página ausente", de: "Seite fehlt", it: "pagina assente" }],
  [
    "motif invalide",
    { en: "invalid pattern", es: "patrón inválido", de: "ungültiges Muster", it: "pattern non valido" },
  ],
  [
    "erreur interne",
    { en: "internal error", es: "error interno", de: "interner Fehler", it: "errore interno" },
  ],
  ["superposition", { en: "overlap", es: "superposición", de: "Überlappung", it: "sovrapposizione" }],
  [
    "hors écran",
    { en: "off screen", es: "fuera de pantalla", de: "außerhalb des Bildschirms", it: "fuori schermo" },
  ],
  ["erreur JS", { en: "JS error", es: "error JS", de: "JS-Fehler", it: "errore JS" }],
  ["recouvre", { en: "covers", es: "cubre", de: "überdeckt", it: "copre" }],
  ["illisible", { en: "unreadable", es: "ilegible", de: "unlesbar", it: "illeggibile" }],
  ["mode rapide", { en: "fast mode", es: "modo rápido", de: "Schnellmodus", it: "modalità rapida" }],
  ["mode final", { en: "final mode", es: "modo final", de: "Endmodus", it: "modalità finale" }],
  ["largeurs", { en: "widths", es: "anchos", de: "Breiten", it: "larghezze" }],
  ["pages ×", { en: "pages ×", es: "páginas ×", de: "Seiten ×", it: "pagine ×" }],
  ["règle ligne", { en: "rule line", es: "regla línea", de: "Regel Zeile", it: "regola riga" }],
  ["absent", { en: "missing", es: "ausente", de: "fehlt", it: "assente" }],
  ["détails :", { en: "details:", es: "detalles:", de: "Details:", it: "dettagli:" }],
  [
    "la commande a échoué",
    {
      en: "the command failed",
      es: "el comando falló",
      de: "der Befehl ist fehlgeschlagen",
      it: "il comando è fallito",
    },
  ],
];

/** Traduit les fragments connus d'un détail technique ; ce qui n'est pas connu reste tel quel. */
export function traduireDetail(langue, detail = "") {
  const l = normaliser(langue) ?? "fr";
  if (l === "fr") return detail;
  let s = detail;
  for (const [fr, tr] of FRAGMENTS) if (tr[l]) s = s.split(fr).join(tr[l]);
  return s;
}
