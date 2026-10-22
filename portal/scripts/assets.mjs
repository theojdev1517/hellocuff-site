import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
for (const path of ["assets", "fonts", "favicon.svg"])
  cpSync(`../website/${path}`, `public/${path}`, { recursive: true });

// Distribute decoder notices and unmodified source separately from lazy runtime chunks.
mkdirSync("public/licenses/heif", { recursive: true });
for (const name of ["README.md", "LICENSE.heic-to.txt", "COPYING.GPL3.txt", "libheif-no-eval.js"])
  cpSync(`src/vendor/${name}`, `public/licenses/heif/${name}`);
