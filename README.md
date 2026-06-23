# Minesweeper

A small browser-based Minesweeper game with an optional fair AI assistant.

The project is intentionally lightweight: no frontend framework, no runtime dependencies, and no server required. Open `index.html` directly in a modern browser, or use the bundled single-file build in `dist/index.html`.

## Features

- Classic Minesweeper gameplay with five difficulty levels from 9 x 9 to 30 x 30.
- Mobile-friendly flag mode for touch devices.
- Fair AI assistant that only reads revealed numbers and flags.
- AI hint, one-step AI move, and auto-play takeover modes.
- Constraint-based solving with exact local enumeration and probability fallback.

## Quick Start

### Option 1: Open directly

Open this file in a modern browser:

```text
index.html
```

No install step is required.

### Option 2: Use the bundled build

Open:

```text
dist/index.html
```

This file contains the HTML, CSS, game logic, solver, and UI code in one document.

### Option 3: Rebuild `dist/index.html`

Node.js is only needed if you want to regenerate the bundled file.

```bash
npm run build
```

## Controls

| Control | English | 中文 |
|---|---|---|
| Left click | Reveal a cell | 翻开格子 |
| Right click | Toggle a flag | 插旗/取消插旗 |
| Flag mode | Use flags on touch devices | 触屏设备插旗 |
| AI hint | Highlight the current AI recommendation | 高亮 AI 当前建议 |
| AI step | Let AI make one move | AI 执行一步 |
| AI takeover | Let AI play continuously | AI 自动接管 |

## Project Structure

```text
minesweeper-small-solver -v2/
├── index.html              # Page structure and script entry points
├── css/
│   └── styles.css          # Layout, board, cell states, and AI highlights
├── js/
│   ├── minesweeper.js      # Game model and rules; no DOM access
│   ├── solver.js           # Fair AI solver; reads only public board state
│   └── app.js              # DOM events, rendering, timer, and AI controls
├── scripts/
│   └── build.mjs           # Builds the single-file dist/index.html
├── dist/
│   ├── index.html          # Bundled single-file version
│   └── source/             # Source snapshots used by the bundled version
├── LICENSE.md
└── package.json
```

## AI Strategy

The AI is not a neural network and does not read hidden mines. It is a small discrete-math solver.

For every revealed numbered cell, the solver builds a constraint:

```text
sum(adjacent unknown cells) = number - adjacent flags
```

Each unknown cell is treated as a binary variable:

```text
0 = safe
1 = mine
```

The solver then works in layers:

1. Basic rules: if a constraint needs `0` more mines, all its unknown cells are safe; if it needs all remaining unknowns to be mines, all are flagged.
2. Subset reasoning: if one constraint is contained in another, subtract them to derive new safe cells or mines.
3. Component splitting: independent frontier regions are separated so enumeration stays small.
4. Local enumeration: each connected frontier component is searched as a 0/1 constraint problem.
5. Global mine-count weighting: local solutions are weighted against the total mines left, including unknown cells outside the frontier.
6. Probability choice: when no certain move exists, the AI picks the lowest estimated mine probability, with a tiny preference for information-rich cells.

The solver has search limits to avoid freezing the browser. If a component is too large, it falls back to a lightweight probability estimate.

## Development

The source is plain JavaScript wrapped in browser globals. There is no bundler dependency; `scripts/build.mjs` simply inlines the source files into `dist/index.html`.

Useful commands:

```bash
npm run build
npm run check
```

`npm run check` only performs JavaScript syntax checks with Node.js. It does not run browser UI tests.

## Notes

- The UI text is bilingual Chinese / English.
- The AI is meant for casual play and demonstration, not competitive solver benchmarking.
- Because Minesweeper can require guessing, AI takeover can still lose.
- The first click is safe because the game places mines after the first reveal and excludes the first cell's neighborhood.

## License

See [LICENSE.md](LICENSE.md).

## Development Notes

This project was developed with the assistance of AI tools (including ChatGPT 5.5).

All generated code and documentation were reviewed, modified, and validated by the project maintainer.
