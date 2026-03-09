import * as sass from "sass";
import * as esbuild from "esbuild";

const result = sass.compile("src/styles/style.scss");
await Bun.write("src/public/style.css", result.css);
console.log("SCSS compiled successfully.");

await esbuild.build({
  entryPoints: [
    { in: "src/client/app.ts", out: "app" },
    { in: "src/client/settings.ts", out: "settings-page" },
  ],
  bundle: true,
  outdir: "src/public",
  format: "esm",
  target: ["es2022"],
  minify: false,
  sourcemap: false,
});

console.log("TypeScript bundled successfully.");
