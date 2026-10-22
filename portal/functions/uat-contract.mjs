import {website,urlOK} from "./uat-url.mjs";
import {catalogFamilies} from "./uat-font-catalog.mjs";
// Shared by the UAT browser and server. No production entitlement writes.
export const policyVersion = "uat-2026-10-22-v3";
export const planIds = ["free", "standard", "pro"];
export const themeIds = [
  "professional",
  "minimal",
  "playful",
  "backstage",
  "industrial",
  "retro",
];
export const colorIds = [
  "blue",
  "teal",
  "green",
  "purple",
  "red",
  "orange",
  "gold",
  "pink",
  "slate",
  "neutral",
];
export const fonts = [
  { id: "outfit", name: "Outfit", family: '"Outfit", sans-serif' },
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    family: '"DP Jakarta", sans-serif',
  },
  { id: "space", name: "Space Grotesk", family: '"DP Space", sans-serif' },
];
const catalogSet = new Set(catalogFamilies);
export const fontAllowed = (plan, id) => typeof id === "string" && (plan.fonts.includes(id) && fonts.some(f => f.id === id) || plan.fonts.includes("google-catalog") && id.startsWith("google:") && catalogSet.has(id.slice(7)));
export function fontName(id) { return fonts.find(f => f.id === id)?.name || (typeof id === "string" && id.startsWith("google:") && catalogSet.has(id.slice(7)) ? id.slice(7) : "Outfit"); }
export function fontFamily(id) { return fonts.find(f => f.id === id)?.family || JSON.stringify(fontName(id)) + ", sans-serif"; }
export const fields = [
  "name",
  "company",
  "title",
  "phone",
  "publicEmail",
  "website",
  "bio",
];
export const fieldCaps = {
  name: 120,
  company: 120,
  title: 120,
  phone: 40,
  publicEmail: 254,
  website: 300,
  bio: 500,
};
export const defaults = {
  schemaVersion: 1,
  revision: 2,
  enabled: true,
  braceletCents: 2499,
  photo: {
    enabled: true,
    maxInputBytes: 33554432,
    maxInputPixels: 64000000,
    webMaxDimension: 512,
    webMaxBytes: 204800,
    vcfMaxDimension: 256,
    vcfMaxBytes: 51200,
    maxUploadsPerDay: 20,
    maxStoredPhotos: 16,
  },
  limits: {
    requestsPerDay: 10000,
    accounts: 200,
    ordersPerAccount: 10,
    writesPerAccountDay: 200,
    writesPerDay: 10000,
    uploadsPerDay: 200,
    requestsPerMinute: 300,
  },
  plans: {
    free: {
      profileLimit: 1,
      colors: ["blue", "green", "purple"],
      themes: ["professional"],
      customColor: false,
      cta: false,
      logo: false,
      branding: "wallpaper",
      fonts: ["outfit"],
      monthlyCents: 0,
      annualCents: 0,
      backupCents: 1499,
      replacementCents: 1999,
    },
    standard: {
      profileLimit: 1,
      colors: [...colorIds],
      themes: [...themeIds],
      customColor: false,
      cta: true,
      logo: false,
      branding: "footer",
      fonts: ["outfit"],
      monthlyCents: 199,
      annualCents: 1999,
      backupCents: 999,
      replacementCents: 1499,
    },
    pro: {
      profileLimit: 3,
      colors: [...colorIds, "custom"],
      themes: [...themeIds],
      customColor: true,
      cta: true,
      logo: true,
      branding: "none",
      fonts: [...fonts.map((f) => f.id), "google-catalog"],
      monthlyCents: 499,
      annualCents: 4999,
      backupCents: 499,
      replacementCents: 999,
    },
  },
};
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const exact = (value, keys) =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((k) => Object.hasOwn(value, k));
export const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const list = (v, allowed, max = allowed.length) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.length <= max &&
  new Set(v).size === v.length &&
  v.every((x) => allowed.includes(x));
export function validConfig(c) {
  if (
    !exact(c, Object.keys(defaults)) ||
    c.schemaVersion !== 1 ||
    typeof c.enabled !== "boolean" ||
    !integer(c.revision, 1, 2147483647) ||
    !integer(c.braceletCents, 1, 100000) ||
    !exact(c.plans, planIds) ||
    !exact(c.photo, Object.keys(defaults.photo)) ||
    !exact(c.limits, Object.keys(defaults.limits))
  )
    return false;
  if (
    c.photo.enabled !== true ||
    Object.entries(defaults.photo).some(
      ([k, v]) =>
        k !== "enabled" &&
        !integer(
          c.photo[k],
          k.startsWith("maxUploads") || k === "maxStoredPhotos" ? 0 : 1,
          v,
        ),
    )
  )
    return false;
  if (
    Object.entries(defaults.limits).some(
      ([k, v]) => !integer(c.limits[k], 0, v),
    )
  )
    return false;
  if (c.plans.free.monthlyCents !== 0 || c.plans.free.annualCents !== 0)
    return false;
  return planIds.every((id) => {
    const p = c.plans[id],
      d = defaults.plans[id];
    return (
      exact(p, Object.keys(d)) &&
      integer(p.profileLimit, 0, d.profileLimit) &&
      list(p.colors, d.colors) &&
      list(p.themes, d.themes) &&
      list(p.fonts, d.fonts) &&
      ["cta", "logo", "customColor"].every(
        (k) => typeof p[k] === "boolean" && (!p[k] || d[k]),
      ) &&
      p.branding === d.branding &&
      ["monthlyCents", "annualCents", "backupCents", "replacementCents"].every(
        (k) => integer(p[k], 0, 100000),
      )
    );
  });
}
export const idOK = (id) => typeof id === "string" && /^[a-f0-9]{32}$/.test(id);
export const plain = (s, max, multiline = false) =>
  typeof s === "string" &&
  s.length <= max &&
  !(
    multiline
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
      : /[<>\u0000-\u001f\u007f]/
  ).test(s);
export {website,urlOK} from "./uat-url.mjs";

export function phone(value) {
  const d = value.replace(/\D/g, "");
  return /^(1)?[2-9][0-9]{2}[2-9][0-9]{6}$/.test(d) ? `+1${d.slice(-10)}` : value.trim();
}
export function normalizeContent(c) {
  return Object.fromEntries(
    fields.map((k) => [
      k,
      typeof c?.[k] !== "string"
        ? c?.[k]
        : k === "bio"
          ? c[k]
              .normalize("NFC")
              .replace(/\r\n?/g, "\n")
              .split("\n")
              .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
              .join("\n")
              .trim()
          : k === "website"
            ? website(c[k])
            : k === "phone"
              ? phone(c[k])
              : c[k].normalize("NFC").replace(/\s+/g, " ").trim(),
    ]),
  );
}
export const emptyProfile = (id, label = "My card") => ({
  id,
  label,
  revision: 0,
  content: Object.fromEntries(fields.map((k) => [k, ""])),
  design: {
    theme: "professional",
    color: "blue",
    customColor: "#2347bd",
    mode: "light",
    font: "outfit",
    ctaLabel: "",
    ctaUrl: "",
  },
  photo: null,
  logo: null,
});
export function profileErrors(profile, plan) {
  const errors = {};
  if (
    !exact(profile, [
      "id",
      "label",
      "revision",
      "content",
      "design",
      "photo",
      "logo",
    ]) ||
    !idOK(profile.id) ||
    !integer(profile.revision, 0, 2147483647) ||
    !plain(profile.label, 40) ||
    !profile.label.trim()
  )
    return { profile: "The profile format is invalid." };
  const c = profile.content,
    d = profile.design;
  if (!exact(c, fields)) return { profile: "Invalid contact fields." };
  fields.forEach((k) => {
    if (!plain(c[k], fieldCaps[k], k === "bio"))
      errors[k] = `Use up to ${fieldCaps[k]} characters of plain text.`;
  });
  if (typeof c.name !== "string" || !c.name.trim())
    errors.name = "Name is required.";
  if (!urlOK(c.website))
    errors.website =
      "Use a website such as example.com or https://example.com.";
  if (c.phone && !/^\+1[2-9][0-9]{2}[2-9][0-9]{6}$/.test(c.phone))
    errors.phone = "Enter a 10-digit US phone number, optionally with +1.";
  if (
    c.publicEmail &&
    !/^[^\s<>@]+@[^\s<>@]+\.[A-Za-z]{2,}$/.test(c.publicEmail)
  )
    errors.publicEmail = "Enter a valid public email address.";
  if (
    !exact(d, [
      "theme",
      "color",
      "customColor",
      "mode",
      "font",
      "ctaLabel",
      "ctaUrl",
    ])
  )
    return { ...errors, design: "Invalid card design." };
  if (
    !plan.themes.includes(d.theme) ||
    !plan.colors.includes(d.color) ||
    (d.color === "custom" && !plan.customColor) ||
    !["light", "dark"].includes(d.mode) ||
    !fontAllowed(plan, d.font) ||
    !/^#[a-fA-F0-9]{6}$/.test(d.customColor)
  )
    errors.design = "Choose a design included in your current plan.";
  if (
    !plain(d.ctaLabel, 40) ||
    !urlOK(d.ctaUrl) ||
    !!d.ctaLabel !== !!d.ctaUrl ||
    (!plan.cta && (d.ctaLabel || d.ctaUrl))
  )
    errors.cta =
      "Add a button label and safe HTTPS link included in your plan, or clear both.";
  for (const kind of ["photo", "logo"])
    if (profile[kind] !== null && !idOK(profile[kind]))
      errors[kind] = "Invalid image reference.";
  if (profile.logo && !plan.logo)
    errors.logo =
      "Your current plan does not include a logo. Remove it before saving.";
  return errors;
}
export function orderQuote(c, selection) {
  if (
    !validConfig(c) ||
    !exact(selection, ["plan", "interval", "backup"]) ||
    !planIds.includes(selection.plan) ||
    !["monthly", "annual"].includes(selection.interval) ||
    typeof selection.backup !== "boolean"
  )
    throw Error("Invalid plan selection.");
  const p = c.plans[selection.plan];
  const subscriptionCents =
    selection.interval === "annual" ? p.annualCents : p.monthlyCents;
  return {
    ...selection,
    braceletCents: c.braceletCents,
    backupCents: selection.backup ? p.backupCents : 0,
    subscriptionCents,
    totalCents:
      c.braceletCents +
      (selection.backup ? p.backupCents : 0) +
      subscriptionCents,
    replacementCents: p.replacementCents,
    configRevision: c.revision,
  };
}
