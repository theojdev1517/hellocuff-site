import {
  cpSync,
  mkdirSync,
  existsSync,
  lstatSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
// Local review only. Keep production landing and Auth-only artifacts unchanged.
const root = process.cwd();
const output = resolve(root, "review-build");
if (
  dirname(output) !== root ||
  (existsSync(output) &&
    (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output))
)
  throw Error("Unsafe local review output");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync("../website", output, { recursive: true });
cpSync("build", output, { recursive: true });
cpSync("build/index.html", "review-build/portal.html");
mkdirSync("review-build/app", { recursive: true });
cpSync("build/index.html", "review-build/app/index.html");
if (!existsSync("review-build/portal.html"))
  throw Error("Portal assembly failed");
console.log(
  "Local sales homepage review-build assembled. Production landing and UAT unchanged; no deployment performed.",
);
