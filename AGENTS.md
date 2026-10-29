# Random Round Timer

Static BJJ round timer: vanilla HTML/CSS/JS in `src/`, no build step, no runtime dependencies. `src/index.html` is the app entry; `src/app.js` holds all timer logic and synth audio; `src/style.css` holds styling.

## Commands

- `npm install` — installs only Vitest + jsdom (dev)
- `npm test` — run all tests once (`vitest run`)
- `npm run test:watch` — watch mode
- `npx vitest run tests/timer-logic.test.js` — run one test file
- `npx vitest run -t "should pause"` — run tests matching a name
- `cd src && python3 -m http.server 8000` — serve the app (or open `src/index.html` directly)
- `git push origin main` — runs the test suite, then deploys `src/` to GitHub Pages via Actions

There is no lint, typecheck, formatter, or codegen. Verification = `npm test` plus a manual browser check for UI/audio changes.

## Deployment

- `.github/workflows/deploy.yml` runs two jobs on every push to `main` (and via manual dispatch): `test` (`npm install` + `npm test` on Node 20) and `deploy` (publishes **only `src/`** to GitHub Pages). `deploy` has `needs: test`, so any failing test blocks deployment; a green test run triggers it.
- `package-lock.json` is gitignored, so CI uses `npm install`, not `npm ci`.
- One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow's `configure-pages` step uses `enablement: true` to attempt this automatically.
- URL: https://mheiker-cyber.github.io/Random-Round-Timer/ — all asset paths are relative, so the project subpath works with no base-path config.
- No build step: the artifact is the checked-in `src/` directory (`index.html`, `style.css`, `app.js`).

## Architecture / gotchas

- `src/app.js` is a **classic browser script**, not an ES module: no exports/imports, and it queries every DOM element at load time. Loading it without the full `index.html` DOM throws.
- `tests/integration-buttons.test.js` is the real behavioral test: it injects `index.html`'s body into jsdom, evaluates the actual `src/app.js` (via `new Function`), mocks `AudioContext`/`alert`/dialog methods, and drives the buttons with fake timers. Extend this file for behavior changes. `tests/utils.test.js`, `timer-logic.test.js`, and `button-behavior.test.js` only re-implement logic locally; `tests/app.test.js` greps source and `tests/html.test.js` asserts HTML strings.
- Phase ticking is consolidated: `startPhaseTimer`/`runPhaseInterval` handle rounds and breaks, `runCountdownInterval` handles the pre-start countdown, and `resumePhaseTimer` resumes from `state.timeRemaining`. Change beep/countdown-class/transition logic in those helpers, not per phase.
- The pre-start countdown is implemented: `startSession()` reads `#countdown` (empty/invalid falls back to 5, `0` skips it), runs a `countdown` phase, then starts round 1. It can be paused/resumed like any phase.
- Every control is bound **exactly once** (no `document`-level delegation, no duplicate fallback bindings). A second listener on `#startPauseBtn` makes one click start *and* immediately pause — the integration test guards against this.
- Audio uses Web Audio API and must be created from a user gesture (`initAudio()` runs on the start-pause click). Any test touching sounds needs a mocked `window.AudioContext`/`webkitAudioContext` and a `typeof optionsModal.showModal === 'function'` stand-in for jsdom `<dialog>`.
- Timing mixes wall-clock session elapsed (`Date.now()` + `sessionIntervalId`) with per-phase tick countdowns (`intervalId`). Pause clears both; resume re-bases `sessionStartTime` from `sessionElapsedSeconds`. Session elapsed excludes paused time.
- End conditions: rounds mode ends after the final round with **no trailing break** (`nextBreak` uses `currentRound >= totalRounds`); time mode ends from `updateSessionElapsed` and from break projection checks.
- `.gitignore` excludes `node_modules/` and `package-lock.json` intentionally; don't commit the lockfile.

## Workflow conventions

- TDD: write/update a test under `tests/` before implementation.
- Keep `log.md` in the repo root updated with plans and changes.
- Run a review sub-agent after implementing; fix findings; stop after 4 review/fix cycles.
- Use clear commit messages.
- Keep secrets (passwords, API keys) local in `.env`; never commit them.
- Update `AGENTS.md` whenever a new process improvement is discovered.
