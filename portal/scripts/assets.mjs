import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
for (const path of ["assets", "fonts", "favicon.svg"])
  cpSync(`../website/${path}`, `public/${path}`, { recursive: true });
