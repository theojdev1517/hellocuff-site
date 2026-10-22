import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Hosting preview only. This script makes no management/API writes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = "hellocuff-e8dec";
const appId = "1:416465164479:web:c1056c6e6688935b648e0a";
const activated = process.argv.includes("--activate");
// A public SDK storageBucket string is not proof that a bucket exists. Require
// the operator's explicit reviewed bucket for an enabled next-build artifact.
const photoBucket = process.env.HELLOCUFF_PHOTO_STORAGE_BUCKET || "";
if (activated && !/^hellocuff-e8dec(?:[.-][a-z0-9.-]+)$/.test(photoBucket))
  throw Error(
    "Enabled photo UAT needs HELLOCUFF_PHOTO_STORAGE_BUCKET set to the actual approved bucket. No deployment performed.",
  );
const response = await fetch(
  `https://${project}.web.app/__/firebase/init.json`,
);
if (!response.ok)
  throw Error(`Public SDK configuration returned ${response.status}`);
const sdk = await response.json();
if (
  sdk.projectId !== project ||
  sdk.appId !== appId ||
  !sdk.apiKey ||
  sdk.authDomain !== `${project}.firebaseapp.com`
)
  throw Error("Unexpected existing Firebase web app configuration");
const env = {
  ...process.env,
  VITE_USE_EMULATORS: "false",
  VITE_UAT_SIMULATION: "true",
  VITE_ENABLE_DESIGN_PREVIEW: "true",
  VITE_ENABLE_MOCK_CHECKOUT: "false",
  VITE_FIREBASE_PROJECT_ID: project,
  VITE_FIREBASE_API_KEY: sdk.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: sdk.authDomain,
  VITE_FIREBASE_APP_ID: appId,
  VITE_FIREBASE_STORAGE_BUCKET: activated ? photoBucket : "",
  VITE_PUBLIC_PHOTO_ENDPOINT: activated ? "/media/photo" : "",
};
for (const [script, args] of [
  ["node_modules/typescript/bin/tsc", ["--noEmit"]],
  ["scripts/assets.mjs", []],
  ["node_modules/vite/bin/vite.js", ["build", "--outDir", "uat-app-build"]],
]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
const output = resolve(root, "uat-build");
if (output !== resolve(root, "uat-build") || dirname(output) !== root)
  throw Error("Unsafe UAT output path");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(resolve(root, "../website"), output, { recursive: true });
cpSync(resolve(root, "uat-app-build"), output, { recursive: true });
const noindex = (html) =>
  /<meta\s+name=["']robots["'][^>]*>/i.test(html)
    ? html.replace(
        /<meta\s+name=["']robots["'][^>]*>/i,
        '<meta name="robots" content="noindex, nofollow">',
      )
    : html.replace(
        /<\/head>/i,
        '<meta name="robots" content="noindex, nofollow"></head>',
      );
let portal = noindex(readFileSync(resolve(output, "index.html"), "utf8"));
portal = portal.replace(
  /<\/head>/i,
  '<link rel="stylesheet" href="/uat-notice.css"></head>',
);
const notice = activated
  ? '<aside class="uat-notice" aria-label="UAT environment">UAT preview</aside><div id="root"></div>'
  : '<aside class="uat-notice" aria-label="UAT environment">UAT preview — account controls unavailable</aside><fieldset class="uat-controls" disabled aria-label="Account controls pending backend approval"><div id="root"></div></fieldset>';
portal = portal.replace('<div id="root"></div>', notice);
writeFileSync(resolve(output, "portal.html"), portal);
// Future approved UAT builds render the public sales homepage at / using the
// same portal shell. Production website/ and Auth-only assembly stay separate.
writeFileSync(resolve(output, "index.html"), portal);
mkdirSync(resolve(output, "app"), { recursive: true });
writeFileSync(resolve(output, "app/index.html"), portal);
writeFileSync(
  resolve(output, "uat-notice.css"),
  ".uat-notice{font:400 12px/1.4 system-ui,sans-serif;background:#f4f8ff;color:#4d678d;border-bottom:1px solid #d3dff0;padding:5px 16px;text-align:center}@media(prefers-color-scheme:dark){.uat-notice{background:#0c1425;color:#a6b9d5;border-color:#304565}}.uat-controls{border:0;margin:0;padding:0;min-width:0;width:100%}.uat-controls :disabled{cursor:not-allowed}",
);
writeFileSync(resolve(output, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(
  `UAT build ready: real existing public Firebase config; emulator/mock flags false; controls ${activated ? "enabled after approved backend activation" : "disabled pending backend approval"}; noindex applied. No deployment performed.`,
);
