# User guide — `livraison-coordonnee` plugin (version 1.6.1)

_Translation of [`NOTICE.md`](NOTICE.md); the French version is authoritative._

A plugin for Claude Code. One command delivers a request while respecting your project's rules, and only declares it finished after a successful quality gate. This guide is written for someone discovering the plugin: nothing here assumes knowledge of the original project.

## 1. What it is for

When you ask an agent for a change, you often have to correct, rephrase, relaunch. The plugin aims at a single exchange: it reads the project rules, first writes a test proving the request is met, makes the change, runs the project's checks and fixes until green. A stop hook re-runs the gate before any conclusion: "done" is never announced on a failure.

It is not a speed tool: a delivery often takes 15 to 40 minutes. It is a reliability tool.

## 2. Prerequisites

| Required                                       | Why                                              |
| ---------------------------------------------- | ------------------------------------------------ |
| Claude Code (terminal or desktop app)          | The plugin is a Claude Code extension.           |
| Node.js 20 or newer                            | The plugin scripts are written in Node.          |
| A `CLAUDE.md` at the project root              | It is the source of the checked rules.           |

| Recommended                                                  | Effect if missing                                 |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `npm run check` (format, lint, types, tests) and `npm run build` | Those checks are simply skipped.               |
| Playwright and Chrome or Edge                                | No rendering checks, no screenshots.             |
| A test folder (`tests/` or `scripts/`)                       | No rule can be covered by a test.                |

## 3. Installation

### Local folder (the safe way)

1. Get this repository: `git clone https://github.com/Tuzilucas/livraison-coordonnee ~/tools/livraison-coordonnee` (or "Code → Download ZIP" on GitHub, then unzip).
2. Start Claude Code from the folder of the project to change:

```bash
cd /path/to/my-project
claude --plugin-dir ~/tools/livraison-coordonnee
```

Nothing is installed globally: deleting the folder uninstalls the plugin.

### Claude Code marketplace

Inside Claude Code: `/plugin marketplace add Tuzilucas/livraison-coordonnee`, then `/plugin install livraison-coordonnee@tuzilucas`. Update: `/plugin update livraison-coordonnee`.

## 4. First use

In the conversation:

```
/livraison-coordonnee:livrer Add an "Export to CSV" button on the orders page
```

Without a description, the command does nothing and asks what to produce. The request can be written in French, English, Spanish, German or Italian: the plugin detects its language and answers in it (summary, messages, final report). `/livraison-coordonnee:deliver` forces English.

On the first run in a project, the plugin classifies every rule of `CLAUDE.md` and asks, in the conversation, the questions it cannot settle alone: should this rule be checked by a test, reviewed by a human, or ignored? Answers are saved in the project's `.claude/decisions-livraison.json` and never asked again.

## 5. What happens during a delivery

1. A `.livraison-en-cours` marker is placed at the project root.
2. The `CLAUDE.md` rules are read and classified (`.claude/regles-livraison.json`).
3. Minor decisions are written to `CHOIX.txt` instead of being asked.
4. An acceptance test tagged `demande:<name>` is written; it must fail before the change and pass after.
5. The change is made.
6. The quality gate runs (`scripts/gate.mjs`) and failures are fixed, five attempts at most.
7. At the end of the turn, the stop hook re-runs the full gate. If it fails, Claude is sent back to work; if it passes, the marker is removed.
8. A plain-language summary is returned: what is fine, what blocks, the conclusion.

After an interruption (window closed, context limit), run the same command again: the plugin resumes where it stopped thanks to `.livraison-etat.json`.

## 6. The quality gate

| Check                             | What is verified                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules read                        | `CLAUDE.md` exists, its rules are classified, and the rules file carries the fingerprint of the current `CLAUDE.md` (otherwise: run `regles.mjs` again). |
| Project checks                    | `npm run check` (or equivalent) passes.                                                                                                                          |
| Rule coverage                     | Every important rule has a test tagged `regle:<id>`.                                                                                                             |
| Data                              | Data validation passes, if the project has one.                                                                                                                  |
| Build                             | `npm run build` passes, if the project has one.                                                                                                                  |
| Rule and request tests            | `npm run test:regles` passes; the `demande:` test is new or modified during the delivery AND actually run (its output shows the label or the file), by `test:acceptance`, else `test:regles`, else `test`. |
| End-to-end navigation             | Playwright tests pass, if any.                                                                                                                                   |
| Forbidden patterns                | No forbidden pattern (secret, internal data) in built files.                                                                                                     |
| Rendering                         | At 320, 360, 390, 768, 1024 and 1440 px (and dark theme when declared): no horizontal scroll, no off-screen or overlapping text, touch targets of at least 24 px, no JavaScript error. |

Every check has a status: **passed**, **failed**, **not applicable** (the project lacks that step, e.g. no `build` script: counts neither way) or **not run** (the step was expected but could not run: that is a failure). A project with no verification mechanism at all (no `check`, `test`, `test:regles`, `build` nor Playwright) never gets a green gate: nothing would be proven. A project without pages (library, command-line tool) declares it with `"interface_web": false` in `.claude/regles-livraison.json`.

The report is written to the project's `rapport-livraison/`: `rapport.json` (details), `RESUME.txt` (plain-language summary, in the project's language), one log per step and screenshots.

## 7. Files created in the project

| File                               | Role                                        | Commit it? |
| ---------------------------------- | ------------------------------------------- | ---------- |
| `.claude/regles-livraison.json`    | Classified rules generated from `CLAUDE.md` | Yes        |
| `.claude/decisions-livraison.json` | Your human-review answers                   | Yes        |
| `CHOIX.txt`                        | Minor decisions of the current delivery     | No         |
| `.livraison-en-cours`              | Delivery marker                             | No         |
| `.livraison-etat.json`             | Resume point                                | No         |
| `.livraison-journal.log`           | Timestamped log of the hook's decisions     | No         |
| `.livraison-porte.lock`            | Lock: one gate at a time                    | No         |
| `rapport-livraison/`               | Report, summary, screenshots                | No         |

The "No" files are added automatically to the project's `.gitignore`.

## 8. Settings

| Environment variable   | Default           | Role                                                |
| ---------------------- | ----------------- | --------------------------------------------------- |
| `LIVRAISON_ESSAIS`     | `5`               | Number of fix attempts before giving up (1 to 50).  |
| `LIVRAISON_NAVIGATEUR` | Chrome, then Edge | Force `chrome` or `msedge` for screenshots.         |
| `LIVRAISON_LANGUE`     | `fr`              | Language of summaries and messages: `fr`, `en`, `es`, `de`, `it`. Otherwise `"langue"` in the rules file (`regles.mjs --langue=xx`). |

Options of `.claude/regles-livraison.json`: `routes` (explicit list of pages to check; empty = automatic detection at any depth, capped at 40 pages, the report says so), `largeurs` (widths), `interdits` (forbidden patterns), `controles` and `revue_humaine` (keywords that classify a rule), `theme_sombre`, `interface_web`.

## 9. Frequently asked questions

**The gate says a rule is not covered.** Write a test carrying the `regle:<id>` tag (the id is displayed), or answer "human review" to the question asked.

**The project is not a website.** Rendering and navigation checks are skipped; the rest works (rules, tests, acceptance test, stop hook). Declare `"interface_web": false`.

**The plugin rewrote code I did not ask for.** That is the fix for a gate failure. The summary names the check that caused it. If the check is too strict, adjust it in `.claude/regles-livraison.json` rather than bypassing the gate.

**An acceptance test looks weak.** Review it and strengthen it: a weak test gives a false green. This is the main known limit.

**The gate is going in circles.** If, during a continuation (Claude Code reports `stop_hook_active`), the same failures recur three times in a row, the hook gives up before the fifth attempt, flagged "no progress". Claude Code itself caps at eight consecutive continuations without a tool call (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).

**Can an old green report let a delivery through?** No. The hook always re-runs the gate, which deletes the previous report before writing its own; and it refuses any report dated before its own launch (a report from an earlier revision counts as a missing report). Both cases are tested end to end.

**The attempts are exhausted, what happens?** The marker is removed so Claude can stop, but the delivery is recorded as **not finished**: `.livraison-etat.json` contains `"terminee": false`, the log notes it, and a system message shows it. Running the command again resumes from that state.

**Is the check server exposed?** No: it listens only on `127.0.0.1`, on a free port chosen by the system, and serves only the files of the build folder (any path leaving it is refused).

**How do I stop a delivery in progress?** Delete `.livraison-en-cours` at the project root; the stop hook will no longer re-run the gate.

## 10. Known limits

- Tests written by the plugin must be reviewed at first.
- Rendering checks detect measurable defects (overflow, overlap, small targets), not taste or copy relevance.
- Automatic page detection is capped at 40 pages (breadth first); beyond that, list the important pages in `routes`. Once `routes` is set, only those pages are checked.
- Contrast is only measured on solid backgrounds; text over images or gradients is counted "not measurable", never validated.
- The check browser was exercised in a development environment; Chrome and Edge on workstations remain to be tried widely.
- Two projects served for validation (a single-file web app and a 900-page Next.js site). A new project needs a first pass to write its rule tests.

## 11. Testing the plugin itself

`npm test` in the plugin folder runs the test suite on temporary projects (created in the system temp folder, removed afterwards): valid project, failing test or build, JavaScript error, invalid configuration, missing or malformed `package.json`, two concurrent gates, directory traversal, missing or corrupted reports, exhausted attempts, project without tests, stale build in fast mode, project without a web interface, uncovered rule, acceptance test not run. Chromium and Playwright are required for the rendering scenarios.

## 12. Going further

- `README.en.md`: strengths, weaknesses, measured results, version history.
- `commands/livrer.md`: the exact procedure the command follows (in French).
- `scripts/gate.mjs`: the quality gate; `scripts/regles.mjs`: rule conversion.
