import { build } from "esbuild";
import { mkdirSync, existsSync } from "fs";

const entries = {
  content: "src/content/contentScript.ts",
  background: "src/background/background.ts",
  popup: "src/popup/popup.ts",
};

if (!existsSync("dist")) mkdirSync("dist");

for (const [name, entryPoint] of Object.entries(entries)) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile: `dist/${name}.js`,
    target: "chrome100",
    format: "iife",
    minify: false,
    logLevel: "info",
  });
}

console.log("Build complete: dist/content.js, dist/background.js, dist/popup.js");
