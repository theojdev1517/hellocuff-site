export const policyVersion: string;
export type PlanId = "free" | "standard" | "pro";
export type Profile = {
  id: string;
  label: string;
  revision: number;
  content: Record<
    "name" | "company" | "title" | "phone" | "publicEmail" | "website" | "bio",
    string
  >;
  design: {
    theme: string;
    color: string;
    customColor: string;
    mode: "light" | "dark";
    font: string;
    ctaLabel: string;
    ctaUrl: string;
  };
  photo: string | null;
  logo: string | null;
};
export type Selection = {
  plan: PlanId;
  interval: "monthly" | "annual";
  backup: boolean;
};
export type Plan = {
  profileLimit: number;
  colors: string[];
  themes: string[];
  customColor: boolean;
  cta: boolean;
  logo: boolean;
  branding: "wallpaper" | "footer" | "none";
  fonts: string[];
  monthlyCents: number;
  annualCents: number;
  backupCents: number;
  replacementCents: number;
};
export type Config = {
  enabled: boolean;
  schemaVersion: number;
  revision: number;
  braceletCents: number;
  photo: import("../src/domain").PhotoPolicy;
  limits: Record<string, number>;
  plans: Record<PlanId, Plan>;
};
export const defaults: Config;
export const planIds: PlanId[];
export const themeIds: string[];
export const colorIds: string[];
export const fonts: { id: string; name: string; family: string }[];
export const fields: (keyof Profile["content"])[];
export const fieldCaps: Record<keyof Profile["content"], number>;
export function clone<T>(value: T): T;
export function exact(value: unknown, keys: string[]): boolean;
export function integer(value: unknown, min: number, max: number): boolean;
export function validConfig(value: unknown): value is Config;
export function idOK(value: unknown): boolean;
export function plain(
  value: unknown,
  max: number,
  multiline?: boolean,
): boolean;
export function website(value: string): string;
export function phone(value: string): string;
export function urlOK(value: string): boolean;
export function normalizeContent(value: Profile["content"]): Profile["content"];
export function emptyProfile(id: string, label?: string): Profile;
export function profileErrors(
  profile: Profile,
  plan: Plan,
): Record<string, string>;
export function orderQuote(
  config: Config,
  selection: Selection,
): Selection & {
  braceletCents: number;
  backupCents: number;
  subscriptionCents: number;
  totalCents: number;
  replacementCents: number;
  configRevision: number;
};

export function fontAllowed(plan:Plan,id:string):boolean;
export function fontName(id:string):string;
export function fontFamily(id:string):string;
