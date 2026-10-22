export const fields = [
  "name",
  "company",
  "title",
  "phone",
  "publicEmail",
  "website",
  "bio",
] as const;
export type Field = (typeof fields)[number];
export type Contact = Record<Field, string>;
export const caps: Record<Field, number> = {
  name: 120,
  company: 120,
  title: 120,
  phone: 40,
  publicEmail: 254,
  website: 300,
  bio: 500,
};
export const palettes = ["blue", "forest", "plum"] as const;
export const modes = ["light", "dark"] as const;
export type Palette = (typeof palettes)[number];
export type Mode = (typeof modes)[number];
export type PlanId = "free" | "standard" | "pro";
export interface EntitlementState {
  plan: PlanId | null;
  error: string | null;
}
export function resolveEntitlement(
  exists: boolean,
  data: unknown,
): EntitlementState {
  if (!exists) return { plan: "free", error: null };
  const plan =
    data && typeof data === "object"
      ? "plan" in data
        ? data.plan
        : null
      : null;
  if (plan === "free" || plan === "standard" || plan === "pro")
    return { plan, error: null };
  return {
    plan: null,
    error:
      "Assigned plan is invalid. Save and publish are paused; unpublish and removal remain available. Contact support.",
  };
}
export interface Plan {
  profileLimit: number;
  limits: Record<Field, number>;
  palettes: Palette[];
  modes: Mode[];
  photo?: PhotoPolicy;
}
export const photoCaps = {
  maxInputBytes: 32 * 1024 * 1024,
  maxInputPixels: 64_000_000,
  webMaxDimension: 512,
  webMaxBytes: 200 * 1024,
  vcfMaxDimension: 256,
  vcfMaxBytes: 50 * 1024,
  maxUploadsPerDay: 100,
  maxStoredPhotos: 100,
} as const;
export interface PhotoPolicy {
  enabled: boolean;
  maxInputBytes: number;
  maxInputPixels: number;
  webMaxDimension: number;
  webMaxBytes: number;
  vcfMaxDimension: number;
  vcfMaxBytes: number;
  maxUploadsPerDay: number;
  maxStoredPhotos: number;
}
export interface PhotoMetadata {
  id: string;
  webBytes: number;
  vcfBytes: number;
}
export const defaultPhotoPolicy: PhotoPolicy = {
  enabled: true,
  ...photoCaps,
  maxUploadsPerDay: 20,
  maxStoredPhotos: 24,
};
export const disabledPhotoPolicy: PhotoPolicy = {
  ...defaultPhotoPolicy,
  enabled: false,
};
export interface PlanConfig {
  schemaVersion: 1 | 2;
  revision: number;
  plans: Record<PlanId, Plan>;
}
export interface RuntimePlanConfig {
  schemaVersion: 1 | 2;
  revision: number;
  planId: PlanId;
  plan: Plan;
}
export interface Draft {
  content: Contact;
  palette: Palette;
  mode: Mode;
  configRevision: number;
  photo?: PhotoMetadata;
}
export const emptyContact = (): Contact =>
  Object.fromEntries(fields.map((f) => [f, ""])) as Contact;
export const defaultConfig: PlanConfig = {
  schemaVersion: 1,
  revision: 1,
  plans: Object.fromEntries(
    ["free", "standard", "pro"].map((p) => [
      p,
      {
        profileLimit: 1,
        limits: { ...caps },
        palettes: [...palettes],
        modes: [...modes],
      },
    ]),
  ) as PlanConfig["plans"],
};
// Legacy fallback remains photo-disabled. This is an explicitly proposed local
// migration, not a claim that the live plan configuration has been changed.
export const nextConfig: PlanConfig = {
  schemaVersion: 2,
  revision: 2,
  plans: Object.fromEntries(
    (["free", "standard", "pro"] as const).map((id) => [
      id,
      {
        ...defaultConfig.plans[id],
        limits: { ...caps },
        palettes: [...palettes],
        modes: [...modes],
        photo: { ...defaultPhotoPolicy },
      },
    ]),
  ) as PlanConfig["plans"],
};
const exact = (
  o: unknown,
  keys: readonly string[],
): o is Record<string, unknown> =>
  !!o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => k in o);
const validRevision = (v: unknown) =>
  Number.isSafeInteger(v) && Number(v) >= 1 && Number(v) <= 2147483647;
const configEnvelope = (
  v: unknown,
): v is {
  schemaVersion: 1 | 2;
  revision: number;
  plans: Record<PlanId, unknown>;
} =>
  exact(v, ["schemaVersion", "revision", "plans"]) &&
  (v.schemaVersion === 1 || v.schemaVersion === 2) &&
  validRevision(v.revision) &&
  exact(v.plans, ["free", "standard", "pro"]);
export const validPhotoPolicy = (p: unknown): p is PhotoPolicy =>
  exact(p, ["enabled", ...Object.keys(photoCaps)]) &&
  typeof p.enabled === "boolean" &&
  Object.entries(photoCaps).every(
    ([key, cap]) =>
      Number.isInteger(p[key]) &&
      Number(p[key]) >=
        (key === "maxUploadsPerDay" || key === "maxStoredPhotos" ? 0 : 1) &&
      Number(p[key]) <= cap,
  );
export const validPhotoMetadata = (
  value: unknown,
  policy: PhotoPolicy = defaultPhotoPolicy,
): value is PhotoMetadata =>
  validPhotoPolicy(policy) &&
  exact(value, ["id", "webBytes", "vcfBytes"]) &&
  typeof value.id === "string" &&
  /^[a-f0-9]{32}$/.test(value.id) &&
  Number.isInteger(value.webBytes) &&
  Number(value.webBytes) > 0 &&
  Number(value.webBytes) <= policy.webMaxBytes &&
  Number.isInteger(value.vcfBytes) &&
  Number(value.vcfBytes) > 0 &&
  Number(value.vcfBytes) <= policy.vcfMaxBytes;
export const validPlan = (p: unknown, schemaVersion?: 1 | 2): p is Plan =>
  ((exact(p, ["profileLimit", "limits", "palettes", "modes"]) &&
    schemaVersion !== 2) ||
    (exact(p, ["profileLimit", "limits", "palettes", "modes", "photo"]) &&
      schemaVersion !== 1 &&
      validPhotoPolicy(p.photo))) &&
  Number.isInteger(p.profileLimit) &&
  Number(p.profileLimit) >= 0 &&
  Number(p.profileLimit) <= 1 &&
  exact(p.limits, fields) &&
  fields.every(
    (f) =>
      Number.isInteger((p.limits as Record<string, unknown>)[f]) &&
      Number((p.limits as Record<string, unknown>)[f]) >=
        (f === "name" ? 1 : 0) &&
      Number((p.limits as Record<string, unknown>)[f]) <= caps[f],
  ) &&
  Array.isArray(p.palettes) &&
  p.palettes.length >= 1 &&
  p.palettes.length <= 3 &&
  p.palettes.every((x) => palettes.includes(x)) &&
  Array.isArray(p.modes) &&
  p.modes.length >= 1 &&
  p.modes.length <= 2 &&
  p.modes.every((x) => modes.includes(x));
export const validConfig = (v: unknown): v is PlanConfig =>
  configEnvelope(v) &&
  Object.values(v.plans).every((p) => validPlan(p, v.schemaVersion));
// Runtime matches rules: complete envelope plus this UID's assigned plan only.
export function runtimeConfig(
  value: unknown,
  planId: PlanId,
): RuntimePlanConfig | null {
  if (
    !configEnvelope(value) ||
    !validPlan(value.plans[planId], value.schemaVersion)
  )
    return null;
  return {
    schemaVersion: value.schemaVersion,
    revision: value.revision,
    planId,
    plan: value.plans[planId],
  };
}
export function photoPolicy(
  config: PlanConfig | RuntimePlanConfig | null | undefined,
  planId: PlanId = "free",
): PhotoPolicy {
  const current =
    config && ("planId" in config ? config : runtimeConfig(config, planId));
  return current &&
    current.planId === planId &&
    current.schemaVersion === 2 &&
    validRevision(current.revision) &&
    validPlan(current.plan, 2) &&
    validPhotoPolicy(current.plan.photo)
    ? { ...current.plan.photo }
    : { ...disabledPhotoPolicy };
}
// Non-bio fields stay single-line. Bios are literal text, including angle brackets
// and line feeds, and must only be rendered through text nodes, never supplied HTML.
export const textSafe = (s: string) => !/[<>\x00-\x1f\x7f]/.test(s);
export const bioSafe = (s: string) => !/[\x00-\x09\x0b-\x1f\x7f]/.test(s);
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[<>"\\\x00-\x20\x7f]/.test(trimmed) || trimmed.startsWith("//"))
    return trimmed;
  const source = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (!/^https?:\/\//i.test(source)) return trimmed;
  const authority = source.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0];
  if (authority.includes(":") || authority.includes("@")) return trimmed;
  try {
    const url = new URL(source);
    if (url.username || url.password || url.port) return trimmed;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return trimmed;
  }
}
export function normalizeUsPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  else if (trimmed.startsWith("+")) return trimmed;
  return digits.length === 10 ? `+1${digits}` : trimmed;
}
export function formatUsPhone(value: string): string {
  if (!/^\+?[0-9\s().-]*$/.test(value)) return value;
  let digits = value.replace(/\D/g, "");
  if (
    value.trim().startsWith("+") &&
    !(digits.length === 11 && digits.startsWith("1"))
  )
    return value;
  if (digits.startsWith("1") && digits.length > 10) digits = digits.slice(1);
  if (digits.length > 10) return value;
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
export function normalizeField(field: Field, value: string): string {
  if (field === "bio")
    return value
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
      .join("\n")
      .trim();
  if (field === "website") return normalizeWebsite(value);
  if (field === "phone") return normalizeUsPhone(value);
  if (field === "publicEmail")
    return value
      .trim()
      .replace(/@([^@]+)$/, (_, host: string) => `@${host.toLowerCase()}`);
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}
export function normalizeContact(contact: Contact): Contact {
  return Object.fromEntries(
    fields.map((field) => [field, normalizeField(field, contact[field])]),
  ) as Contact;
}
export const safeWebsite = (s: string) =>
  s === "" ||
  /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?([/?#][A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*)?$/.test(
    s,
  );
export const safeEmail = (s: string) =>
  s === "" ||
  /^[A-Za-z0-9.!#$%&'*+\/?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
    s,
  );
export const safePhone = (s: string) =>
  s === "" || /^\+1[2-9][0-9]{9}$/.test(normalizeUsPhone(s));
export type DraftFieldErrors = Partial<
  Record<Field | "profile" | "theme" | "photo" | "config", string>
>;
export function validateDraftFields(
  d: Draft,
  config: PlanConfig | RuntimePlanConfig,
  planId: PlanId = "free",
): DraftFieldErrors {
  const current = "planId" in config ? config : runtimeConfig(config, planId);
  if (
    !current ||
    ![1, 2].includes(current.schemaVersion) ||
    current.planId !== planId ||
    !validRevision(current.revision) ||
    !validPlan(current.plan, current.schemaVersion)
  )
    return {
      config: "Plan configuration is unavailable or invalid. Saving is paused.",
    };
  const p = current.plan;
  const errors: DraftFieldErrors = {};
  if (p.profileLimit !== 1)
    errors.profile =
      "Your plan currently does not allow a profile. Your saved data is retained.";
  if (
    !exact(d.content, fields) ||
    fields.some((f) => typeof d.content[f] !== "string")
  )
    return { profile: "Invalid contact fields." };
  for (const f of fields) {
    const value = d.content[f];
    if (!(f === "bio" ? bioSafe(value) : textSafe(value)))
      errors[f] =
        f === "bio"
          ? "Bio contains unsupported control characters. Plain text and line breaks are welcome."
          : "Use a single line of plain text without angle brackets or control characters.";
    else if (value.length > p.limits[f])
      errors[f] = `Use up to ${p.limits[f]} characters.`;
  }
  if (!d.content.name.trim()) errors.name = "Name is required.";
  if (!safeWebsite(d.content.website))
    errors.website =
      "Enter a website such as example.com or https://example.com.";
  if (!safeEmail(d.content.publicEmail))
    errors.publicEmail = "Enter a valid public email address.";
  if (!safePhone(d.content.phone))
    errors.phone =
      "Enter a US phone number with 10 digits, optionally starting with +1. Extensions are not supported.";
  if (!p.palettes.includes(d.palette) || !p.modes.includes(d.mode))
    errors.theme = "Choose a theme currently included in your plan.";
  if (d.photo !== undefined) {
    const policy = photoPolicy(current, planId);
    if (!policy.enabled)
      errors.photo =
        "Your current plan configuration does not allow a new photo. Your saved photo is retained until you remove or replace it.";
    else if (!validPhotoMetadata(d.photo, policy))
      errors.photo =
        "The photo reference or optimized file size is invalid for your current plan.";
  }
  return errors;
}
export function validateDraft(
  d: Draft,
  config: PlanConfig | RuntimePlanConfig,
  planId: PlanId = "free",
): string[] {
  return Object.values(validateDraftFields(d, config, planId));
}
export const newPublicId = () => crypto.randomUUID().replaceAll("-", "");
export function escapeVcf(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line: string) {
  let result = "",
    bytes = 0;
  for (const c of line) {
    const n = new TextEncoder().encode(c).length;
    if (bytes + n > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += c;
    bytes += n;
  }
  return result;
}
export function vcfFilename(name: string): string {
  let base = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  base = Array.from(base).slice(0, 80).join("").replace(/-+$/g, "");
  if (!base) base = "HelloCuff-contact";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base))
    base = `HelloCuff-${base}`;
  return `${base}.vcf`;
}
export function toVcf(
  c: Contact,
  publicId: string,
  photo?: Uint8Array,
): string {
  if (!safeWebsite(c.website))
    throw Error("The contact website must be a safe HTTPS address.");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:hellocuff-profile:${escapeVcf(publicId)}`,
    `FN:${escapeVcf(c.name)}`,
    `N:;${escapeVcf(c.name)};;;`,
  ];
  if (c.company) lines.push(`ORG:${escapeVcf(c.company)}`);
  if (c.title) lines.push(`TITLE:${escapeVcf(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVcf(c.phone)}`);
  if (c.publicEmail)
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVcf(c.publicEmail)}`);
  if (c.website) lines.push(`URL:${c.website}`);
  if (c.bio) lines.push(`NOTE:${escapeVcf(c.bio)}`);
  if (photo) {
    if (
      photo.length < 5 ||
      photo.length > photoCaps.vcfMaxBytes ||
      photo[0] !== 0xff ||
      photo[1] !== 0xd8 ||
      photo[2] !== 0xff ||
      photo[photo.length - 2] !== 0xff ||
      photo[photo.length - 1] !== 0xd9
    )
      throw Error(
        "The contact photo must be an optimized JPEG no larger than 50 KiB.",
      );
    let binary = "";
    for (const byte of photo) binary += String.fromCharCode(byte);
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${btoa(binary)}`);
  }
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}
