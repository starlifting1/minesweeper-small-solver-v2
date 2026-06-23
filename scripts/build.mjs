import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [html, css, model, solver, app] = await Promise.all([
  readFile(resolve(projectRoot, "index.html"), "utf8"),
  readFile(resolve(projectRoot, "css/styles.css"), "utf8"),
  readFile(resolve(projectRoot, "js/minesweeper.js"), "utf8"),
  readFile(resolve(projectRoot, "js/solver.js"), "utf8"),
  readFile(resolve(projectRoot, "js/app.js"), "utf8")
]);

const bundledHtml = html
  .replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}</style>`)
  .replace('<script src="js/minesweeper.js" defer></script>', "")
  .replace('<script src="js/solver.js" defer></script>', "")
  .replace('<script src="js/app.js" defer></script>', "")
  .replace(
    "</body>",
    `<script>\n${model}</script>\n<script>\n${solver}</script>\n<script>\n${app}</script>\n</body>`
  );

const outputDirectory = resolve(projectRoot, "dist");
const sourceDirectory = resolve(outputDirectory, "source");
await mkdir(outputDirectory, { recursive: true });
await mkdir(sourceDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "index.html"), bundledHtml);
await Promise.all([
  writeFile(resolve(sourceDirectory, "index.html"), html),
  writeFile(resolve(sourceDirectory, "index.html.txt"), html),
  writeFile(resolve(sourceDirectory, "styles.css.txt"), css),
  writeFile(resolve(sourceDirectory, "minesweeper.js.txt"), model),
  writeFile(resolve(sourceDirectory, "solver.js.txt"), solver),
  writeFile(resolve(sourceDirectory, "app.js.txt"), app)
]);

console.log("Built dist/index.html");
