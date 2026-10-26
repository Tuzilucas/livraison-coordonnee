---
description: Deliver a request in a single command — write the test that proves it first, produce, verify and fix until green. Ask a question only when truly blocked. Summaries in English.
argument-hint: <request, in any language>
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(node:*), Bash(npm:*), Bash(npx:*), Bash(git:*)
---

Request: $ARGUMENTS

Procedure, without interruption:
0. **Resume if needed**: if `.livraison-en-cours`, `.livraison-etat.json` or `rapport-livraison/CHOIX.txt` already exist, a delivery was interrupted. Read them, do not redo what is done (tests already written, decisions already recorded), and continue at the step where it stopped.
1. **Mark the delivery**: create `.livraison-en-cours` at the project root (content `0`) if it does not exist yet.
2. **Read the rules**: read `CLAUDE.md`, then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/regles.mjs . --langue=en` (this also records English as the language of summaries and messages for this project).
3. **Settle minor choices yourself**: for every ambiguity, take the simplest solution that complies with `CLAUDE.md`. Record each choice in `rapport-livraison/CHOIX.txt` (one line: question, choice, reason).
4. **Write the acceptance test first**: in `tests/`, a test tagged `demande:<short-name>` that verifies the request is fulfilled, with proof by failure (it must fail before your change). It must be run by `npm run test:regles` or by an existing script.
5. **Produce** the requested change, with targeted edits, without touching texts or data that were not requested.
6. **Fix until green**: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs . --rapide --langue=en`, read `rapport-livraison/RESUME.txt`, fix every item, run again.
7. **Stop**: never declare the delivery finished yourself. When you stop, the hook runs the final gate and sends you back to work if it fails (five attempts at most).
8. **Final report, in plain English**: what was done, the choices made (from `CHOIX.txt`), what remains. No question unless an item is blocked and impossible to settle.

Absolute rules:
- You never modify an acceptance test, a check, `gate.mjs` or `CLAUDE.md` to make the gate pass.
- You only commit, push or publish if the request explicitly says so.
