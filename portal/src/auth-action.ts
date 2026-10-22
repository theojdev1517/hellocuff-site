import { validatePassword } from "./password-policy";

export const emailActionOperations = {
  resetPassword: "PASSWORD_RESET",
  verifyEmail: "VERIFY_EMAIL",
  recoverEmail: "RECOVER_EMAIL",
} as const;
export type EmailActionMode = keyof typeof emailActionOperations;
export interface EmailAction {
  mode: EmailActionMode;
  code: string;
}
export interface ActionCodeInspection {
  operation: string;
  data?: { email?: string | null; previousEmail?: string | null };
}
export interface TrustedEmailActionConfig {
  readonly projectId?: string;
  readonly apiKey?: string;
}
export interface AuthActionAdapter {
  configured: boolean;
  // Copied only from the initialized Firebase app, never from action parameters.
  officialActionConfig?: TrustedEmailActionConfig;
  inspectActionCode(code: string): Promise<ActionCodeInspection>;
  inspectPasswordResetCode(code: string): Promise<string>;
  applyActionCode(code: string): Promise<void>;
  completePasswordReset(
    code: string,
    password: string,
    confirmation?: string,
  ): Promise<void>;
  resetEmail(email: string, continueUrl?: string): Promise<void>;
}
export interface ContinuationContext {
  emulator: boolean;
  projectId: string;
  currentOrigin: string;
}
export function createEmailActionScope(
  readLocation: () => { pathname: string; search: string },
) {
  let generation = 0;
  return {
    begin(pathname: string, search: string) {
      const own = ++generation;
      let mounted = true;
      return {
        isCurrent: () => {
          const current = readLocation();
          return (
            mounted &&
            own === generation &&
            current.pathname === pathname &&
            current.search === search
          );
        },
        cancel: () => {
          // URL changes must never prevent cleanup from invalidating a request.
          mounted = false;
          if (own === generation) generation++;
        },
      };
    },
  };
}
export const permanentAuthOrigins = [
  "https://hellocuff-e8dec.web.app",
  "https://hellocuff-e8dec.firebaseapp.com",
  "https://hellocuff.com",
] as const;
export const approvedUatOrigin =
  "https://hellocuff-e8dec--uat-l8bne92f.web.app";
const localHost = (hostname: string) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
export function validateContinuationUrl(
  value: unknown,
  context: ContinuationContext,
): string | null {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 1500 ||
    !/^https?:\/\//.test(value) ||
    /[\s\\<>"`%\x00-\x1f\x7f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    const authority = value.slice(value.indexOf("//") + 2).split(/[/?#]/, 1)[0];
    const rawPath = value.slice(value.indexOf("//") + 2 + authority.length);
    if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) return null;
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      value.includes("?") ||
      value.includes("#") ||
      url.pathname.includes("%")
    )
      return null;
    const knownOrigin = [...permanentAuthOrigins, approvedUatOrigin].includes(
      url.origin,
    );
    let demoLocal = false;
    if (context.emulator && context.projectId.startsWith("demo-")) {
      const current = new URL(context.currentOrigin);
      demoLocal =
        localHost(current.hostname) &&
        localHost(url.hostname) &&
        authority === current.host &&
        url.origin === current.origin &&
        url.protocol === "http:";
    }
    if (
      (!knownOrigin && !demoLocal) ||
      (knownOrigin &&
        (url.protocol !== "https:" ||
          authority.includes(":") ||
          authority !== url.host)) ||
      authority.includes("@")
    )
      return null;
    // Only routes already implemented by the portal. Query/fragment continuations
    // are intentionally unsupported, so nested action secrets/open redirects fail closed.
    if (
      ![
        "/",
        "/app",
        "/app/sign-in",
        "/app/profile",
        "/app/settings",
        "/app/plans",
        "/app/signup",
      ].includes(url.pathname) &&
      !/^\/p\/[a-f0-9]{32}$/.test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function continuationFromSearch(
  search: string,
  context: ContinuationContext,
) {
  const params = new URLSearchParams(search);
  return params.getAll("continueUrl").length === 1
    ? validateContinuationUrl(params.get("continueUrl"), context)
    : null;
}
export function parseEmailAction(search: string): EmailAction | null {
  const params = new URLSearchParams(search);
  if (
    ["mode", "oobCode", "apiKey", "continueUrl"].some(
      (key) => params.getAll(key).length > 1,
    )
  )
    return null;
  const mode = params.get("mode"),
    code = params.get("oobCode");
  if (
    !mode ||
    !Object.hasOwn(emailActionOperations, mode) ||
    !code ||
    code.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(code)
  )
    return null;
  // apiKey is never used to select/configure a project. The trusted adapter owns it.
  return { mode: mode as EmailActionMode, code };
}
export const officialEmailActionHandler =
  "https://hellocuff-e8dec.firebaseapp.com/__/auth/action";
export const fallbackEmailActionModes = {
  verifyAndChangeEmail: "VERIFY_AND_CHANGE_EMAIL",
  signIn: "EMAIL_SIGNIN",
  revertSecondFactorAddition: "REVERT_SECOND_FACTOR_ADDITION",
} as const;
export type FallbackEmailActionMode = keyof typeof fallbackEmailActionModes;
export interface FallbackEmailAction {
  mode: FallbackEmailActionMode;
  code: string;
  lang?: string;
}
export function parseFallbackEmailAction(
  search: string,
): FallbackEmailAction | null {
  const params = new URLSearchParams(search);
  if (
    ["mode", "oobCode", "apiKey", "continueUrl", "lang"].some(
      (key) => params.getAll(key).length > 1,
    )
  )
    return null;
  const mode = params.get("mode"),
    code = params.get("oobCode"),
    lang = params.get("lang");
  if (
    !mode ||
    !Object.hasOwn(fallbackEmailActionModes, mode) ||
    !code ||
    code.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(code) ||
    (lang !== null &&
      (!lang ||
        lang.length > 35 ||
        !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(lang)))
  )
    return null;
  return {
    mode: mode as FallbackEmailActionMode,
    code,
    ...(lang ? { lang } : {}),
  };
}
// Building this link makes no SDK request and never applies/consumes a code.
// Only a deliberate click can leave this page for the fixed official handler.
export function officialEmailActionUrl(
  search: string,
  context: ContinuationContext,
  config?: TrustedEmailActionConfig,
): string | null {
  const action = parseFallbackEmailAction(search);
  if (
    !action ||
    context.emulator ||
    context.projectId !== "hellocuff-e8dec" ||
    config?.projectId !== "hellocuff-e8dec" ||
    typeof config.apiKey !== "string" ||
    !/^[A-Za-z0-9_-]{20,100}$/.test(config.apiKey)
  )
    return null;
  const url = new URL(officialEmailActionHandler);
  url.searchParams.set("mode", action.mode);
  url.searchParams.set("oobCode", action.code);
  url.searchParams.set("apiKey", config.apiKey);
  const continuation = continuationFromSearch(search, context);
  if (continuation) url.searchParams.set("continueUrl", continuation);
  if (action.lang) url.searchParams.set("lang", action.lang);
  // Every other incoming parameter, including apiKey and arbitrary destinations,
  // is discarded. Unknown action modes never reach this fixed destination.
  return url.href;
}
export function actionModeMatches(mode: EmailActionMode, operation: string) {
  return emailActionOperations[mode] === operation;
}
export const invalidActionError = () =>
  Object.assign(Error("This link is no longer valid."), {
    code: "auth/invalid-action-code",
  });
export const isInvalidAction = (error: unknown) =>
  [
    "auth/expired-action-code",
    "auth/invalid-action-code",
    "auth/user-disabled",
    "auth/user-not-found",
  ].includes((error as { code?: string })?.code || "");
export function authActionErrorMessage(error: unknown): string {
  if (isInvalidAction(error)) return "This link is no longer valid.";
  const code = (error as { code?: string })?.code;
  if (code === "auth/network-request-failed")
    return "Could not connect. Check your connection and try again.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait a little, then try again.";
  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  )
    return "Choose a password that meets every requirement, then try again.";
  if (code === "auth/invalid-email")
    return "Enter a valid account email address.";
  return "The action could not be completed. Please try again.";
}
export const resetRequestSentMessage =
  "If an account uses this email, a reset link has been sent.";
export function resetRequestErrorMessage(error: unknown) {
  return (error as { code?: string })?.code === "auth/user-not-found"
    ? resetRequestSentMessage
    : authActionErrorMessage(error);
}
const requireCurrentAction = (isCurrent: () => boolean) => {
  if (!isCurrent())
    throw Object.assign(Error("This action was canceled."), {
      code: "auth/action-cancelled",
    });
};
export async function inspectEmailAction(
  adapter: AuthActionAdapter,
  action: EmailAction,
) {
  if (!adapter.configured) throw Error("Firebase is not configured.");
  const info = await adapter.inspectActionCode(action.code);
  if (!actionModeMatches(action.mode, info.operation))
    throw invalidActionError();
  if (action.mode === "resetPassword")
    await adapter.inspectPasswordResetCode(action.code);
  return info;
}
export async function applyEmailAction(
  adapter: AuthActionAdapter,
  action: EmailAction,
  isCurrent: () => boolean = () => true,
) {
  requireCurrentAction(isCurrent);
  if (action.mode === "resetPassword") throw invalidActionError();
  const info = await inspectEmailAction(adapter, action);
  requireCurrentAction(isCurrent);
  await adapter.applyActionCode(action.code);
  return info;
}
export async function resetEmailAction(
  adapter: AuthActionAdapter,
  action: EmailAction,
  password: string,
  confirmation: string,
  isCurrent: () => boolean = () => true,
) {
  requireCurrentAction(isCurrent);
  if (action.mode !== "resetPassword") throw invalidActionError();
  const errors = validatePassword(password, confirmation);
  if (errors.length) throw Error(errors.join(" "));
  await inspectEmailAction(adapter, action);
  requireCurrentAction(isCurrent);
  await adapter.completePasswordReset(action.code, password, confirmation);
}
