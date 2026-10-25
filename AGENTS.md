# Random Round Timer

Static BJJ round timer: vanilla HTML/CSS/JS in `src/`, no build step, no runtime dependencies. `src/index.html` is the app entry; `src/app.js` holds all timer logic and synth audio; `src/style.css` holds styling.

## Commands

- `npm install` — installs only Vitest + jsdom (dev)
- `npm test` — run all tests once (`vitest run`)
- `npm run test:watch` — watch mode
- `npx vitest run tests/timer-logic.test.js` — run one test file
- `npx vitest run -t "should pause"` — run tests matching a name
- `cd src && python3 -m http.server 8000` — serve the app (or open `src/index.html` directly)

There is no lint, typecheck, formatter, codegen, or CI. Verification = `npm test` plus a manual browser check for UI/audio changes.

## Architecture / gotchas

- `src/app.js` is a **classic browser script**, not an ES module: no exports/imports, and it queries every DOM element at load time. Loading it without the full `index.html` DOM throws.
- Because of that, tests **cannot import app logic**. `tests/utils.test.js`, `timer-logic.test.js`, and `button-behavior.test.js` re-implement the logic locally; `tests/app.test.js` only greps `src/app.js` text; `tests/html.test.js` asserts HTML strings. Tests can pass while real behavior is broken — update the duplicated logic *and* verify in the browser. Consider refactoring logic into importable modules before relying on test coverage.
- Round/break ticking is duplicated: inline `setInterval` bodies in `startRound`/`startBreak` and again in `resumeTimer`. Changes to beeps, countdown class, or phase transitions must be mirrored in all three places.
- The "Pre-start Countdown" setting is stored in `state.countdownSeconds` but never used; `startSession()` starts round 1 immediately and `resumeCountdown()` is dead code. README claims a pre-start countdown — don't assume it works.
- Audio uses Web Audio API and must be created from a user gesture (`initAudio()` runs on the start-pause click). Any test touching sounds needs a mocked `window.AudioContext`/`webkitAudioContext` (see `tests/app.test.js`).
- Timing mixes wall-clock session elapsed (`Date.now()` + `sessionIntervalId`) with per-phase tick countdowns (`intervalId`). Pause clears both; beware drift assumptions when changing pause/resume.
- `.gitignore` excludes `node_modules/` and `package-lock.json` intentionally; don't commit the lockfile.

## Workflow conventions

- TDD: write/update a test under `tests/` before implementation.
- Keep `log.md` in the repo root updated with plans and changes.
- Run a review sub-agent after implementing; fix findings; stop after 4 review/fix cycles.
- Use clear commit messages.
- Keep secrets (passwords, API keys) local in `.env`; never commit them.
- Update `AGENTS.md` whenever a new process improvement is discovered.
