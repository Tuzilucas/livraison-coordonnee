#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const mode = process.argv[2];
const godot = process.env.GODOT_BIN || (process.platform === "win32" ? "godot.exe" : "godot");
const run = (args) => {
  const result = spawnSync(godot, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10 * 60 * 1000,
    windowsHide: true,
  });
  const output = (result.stdout || "") + (result.stderr || "");
  process.stdout.write(output);
  if (result.error) {
    console.error(`Impossible de lancer Godot (${godot}) : ${result.error.message}`);
    process.exit(2);
  }
  if (result.signal) {
    console.error(`Godot s'est arrêté sur le signal ${result.signal}`);
    process.exit(2);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return output;
};

if (!existsSync(resolve(root, "project.godot"))) {
  console.error("project.godot absent : ce lanceur doit être exécuté à la racine du projet Godot.");
  process.exit(2);
}

if (mode === "--check") {
  run(["--headless", "--editor", "--path", root, "--quit"]);
} else if (mode === "--test") {
  const testFile = resolve(root, "tests/run_tests.gd");
  if (!existsSync(testFile)) {
    console.error("tests/run_tests.gd absent : aucun runner de tests Godot n'est configuré.");
    process.exit(2);
  }
  run(["--headless", "--path", root, "--script", "res://tests/run_tests.gd"]);
} else if (mode === "--acceptance") {
  const testFile = resolve(root, "tests/acceptance.gd");
  if (!existsSync(testFile)) {
    console.error("tests/acceptance.gd absent : le test d'acceptation propre à la demande est obligatoire.");
    process.exit(2);
  }
  const output = run(["--headless", "--path", root, "--script", "res://tests/acceptance.gd"]);
  if (!/demande:[a-zA-Z0-9._-]+/.test(output)) {
    console.error("La sortie du test d'acceptation ne contient aucune étiquette demande:<nom>.");
    process.exit(1);
  }
} else if (mode === "--export") {
  const presetFile = resolve(root, "export_presets.cfg");
  if (!existsSync(presetFile)) {
    console.error("export_presets.cfg absent : impossible de prouver l'export Android.");
    process.exit(2);
  }
  const presetText = readFileSync(presetFile, "utf8");
  if (!/\[preset\.\d+\]/.test(presetText) || !/platform\s*=\s*"Android"/.test(presetText)) {
    console.error('Aucun preset d\'export Android détecté dans export_presets.cfg.');
    process.exit(2);
  }
  const output = resolve(root, "build/android/game.apk");
  mkdirSync(dirname(output), { recursive: true });
  run(["--headless", "--path", root, "--export-debug", "Android", output]);
  if (!existsSync(output) || statSync(output).size === 0) {
    console.error("Godot a terminé sans produire un APK non vide : export refusé.");
    process.exit(1);
  }
  console.log(`APK de débogage produit : ${output} (${statSync(output).size} octets)`);
} else {
  console.error("Usage : node scripts/godot-check.mjs --check|--test|--acceptance|--export");
  process.exit(2);
}
