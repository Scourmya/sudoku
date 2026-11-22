# Sudoku app

Personal Sudoku app for Itay's iPhone. It is a PWA (plain HTML/CSS/JS, no build step, no dependencies) hosted on GitHub Pages from the `main` branch root: https://scourmya.github.io/sudoku/ . He installs it with Safari "Add to Home Screen". Pushing to `main` deploys.

## Original goals

- Sudoku game for personal use with classic 9x9 and many sudoku-adjacent variants, organized in menus with a short description of each type.
- Difficulty 1 to 9 for every mode.
- In-game stats: how many puzzles were solved and which ones.
- Ideas borrowed from daily sudoku apps (daily puzzle, streak, calendar).

## Run and test

- Serve locally: `python -m http.server 8000`, open http://localhost:8000 (the service worker is skipped on localhost).
- Engine tests: `node tests/engine.test.mjs` (all 21 modes x 9 levels, checks each puzzle is valid and has exactly one solution, prints tier/givens/time). One mode: `node tests/engine.test.mjs killer 7`. More seeds: `SEEDS=5 node tests/engine.test.mjs`.
- Check UI changes at iPhone size (390x844) in both light and dark mode.

## Layout

- `js/app.js` tabs (Play, Daily, Stats, Settings), mode sheet with level picker, daily logic, stats/history screens
- `js/game.js` play screen: input, notes, undo, hints, mistakes, timer, pause, completion
- `js/board.js` SVG board renderer for all variants (cages, thermos, arrows, dots, XV, inequalities, outside clues, region tints) and tap hit-testing
- `js/storage.js` localStorage: settings, stats, history, saved game, backup export/import
- `js/generator-client.js` web worker wrapper plus one prefetched puzzle per mode+level
- `js/engine/` puzzle engine
  - `modes.js` mode catalog (names, categories, short and full rules), level names, grid sizes for Latin modes
  - `model.js` compiles a puzzle definition into houses, peers, pair relations and units
  - `units.js` constraint logic: killer cage sums, calcudoku cages, arrows, thermos, sandwich, skyscrapers
  - `solver.js` queue-based propagation and backtracking (uniqueness checks)
  - `logic.js` human-style grader (tier 1 singles, 2 locked candidates, 3 pairs, 4 triples/X-Wing, 5 trial and error) and the hint finder
  - `generate.js` builders for each mode and the difficulty plan (PLAN table and per-mode SETTINGS)
- `sw.js` offline cache, `manifest.webmanifest`, `icons/`

## Things to know before changing code

- Generation is deterministic for a given (mode, level, seed). Daily puzzles use seed `daily-YYYY-MM-DD` and history replays regenerate from the stored seed. Keep budgets as node/attempt counts, never wall-clock time, or dailies will differ between devices. If generate.js changes the output, bump `ENGINE_VERSION` in `storage.js`.
- Bump `CACHE` in `sw.js` whenever app files change, otherwise installed copies keep serving the old files. Add new files to its `FILES` list.
- Difficulty: levels 1-4 are singles-only with fewer givens each level, 5/6/7 need tier 2/3/4, 8 and 9 need trial and error (9 needs a deeper search). Mini 6x6 and small Latin grids rarely reach high tiers, so their top levels come out easier.
- Slowest generation is Non-Consecutive level 8 (around 4 s). Keep anything new under a few seconds in `node tests/engine.test.mjs`.
- Stats live only in localStorage on the phone. Keep the stats format backward compatible (`version:1`) or write a migration.

## Code style (Itay's preferences)

- Explicit variable names (`weight`, not `w`), and no spaces around operators (`x=5`, `a+b`).
- Comments only where needed, short, lowercase, standard keyboard characters.
- Keep the existing structure and names. Plain ES modules, no frameworks, no build step.
- User-facing text: plain wording, no em dashes.

## Ideas not done yet

- 16x16 giant sudoku, Samurai, Kakuro
- Multi-cell selection for notes
- Achievements
