# Sudoku

A personal Sudoku app for iPhone, built as an installable web app (PWA). It works offline, generates every puzzle on the phone and keeps stats locally.

**Play:** https://scourmya.github.io/sudoku/

## Install on iPhone

1. Open the link above in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the home screen. It runs full screen and works without internet.

## What's in it

**21 puzzle types in 5 menus**, each with a short rule description:

| Menu | Modes |
|---|---|
| Classic | Classic 9×9, Mini 6×6 |
| Extra Regions | Sudoku X, Windoku, Jigsaw, Disjoint Groups |
| Math Clues | Killer, Sandwich, Arrow, Thermo, Kropki, Consecutive, XV, Even/Odd, Greater Than |
| Anti Rules | Anti-Knight, Anti-King, Non-Consecutive |
| Other Puzzles | Calcudoku (KenKen style), Futoshiki, Skyscrapers |

**Difficulty 1 to 9.** A built-in human-style solver rates each puzzle by the hardest technique it needs:

| Level | Name | What it takes |
|---|---|---|
| 1–3 | Gentle, Easy, Easy+ | Singles only, with fewer starting digits each level |
| 4 | Moderate | As few digits as singles allow |
| 5 | Tricky | Locked candidates |
| 6 | Hard | Naked or hidden pairs |
| 7 | Expert | Triples or X-Wing |
| 8 | Master | A little trial and error |
| 9 | Fiendish | Serious trial and error |

For Calcudoku, Futoshiki and Skyscrapers the grid also grows with the level (4×4 up to 8×8). Every puzzle is checked to have exactly one solution.

**Playing:** notes (pencil marks), undo, erase, hints that explain *why* a digit goes in a cell, mistake checking (off, conflicts or instant), highlighting, a timer with pause, auto-save and resume, fill or clear all notes, and restart.

**Daily puzzles:** a Daily Classic that ramps up through the week (peaks on Saturday) and a Daily Variant that rotates through all the other modes. There's a calendar with every solved day marked and a streak counter. Past days can be played from the calendar.

**Stats:** total solved, time spent, finish rate, daily streaks, a table per mode and level (solved, best, average), and a full history of every solved puzzle. Any puzzle in the history can be replayed. Backups can be exported and imported from Settings.

## Project layout

```
index.html, css/style.css     app shell and styles
js/app.js                     menus, daily, stats, settings
js/game.js                    play screen: input, notes, undo, hints, timer
js/board.js                   svg board renderer for every variant
js/storage.js                 settings, stats, history, saved game (localStorage)
js/generator-client.js        web worker wrapper with puzzle prefetching
js/engine/                    puzzle engine (no dependencies)
  model.js                    turns a puzzle definition into houses, peers and constraints
  units.js                    cage, arrow, thermo, sandwich, skyscraper and calcudoku logic
  solver.js                   propagation and backtracking (uniqueness check)
  logic.js                    human-style grader and hint finder
  generate.js                 puzzle builders and difficulty tuning
  modes.js                    mode catalog and descriptions
sw.js, manifest.webmanifest   offline cache and install metadata
tests/engine.test.mjs         generates every mode at every level and verifies it
```

## Development

No build step. Serve the folder and open it:

```
python3 -m http.server 8000
```

Engine tests (needs Node 18+):

```
node tests/engine.test.mjs            # all modes, all levels
node tests/engine.test.mjs killer 7   # one mode and level
SEEDS=5 node tests/engine.test.mjs    # more seeds per level
```

When changing app files, bump `CACHE` in `sw.js` so installed copies pick up the update.
