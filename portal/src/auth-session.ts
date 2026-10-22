import { FirebaseError } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  getIdTokenResult,
  linkWithPopup,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  updatePassword,
  type User,
  type UserCredential,
  type Auth,
} from "firebase/auth";
import { validatePassword } from "./password-policy";

export interface VerificationStatus {
  uid: string;
  emailVerified: boolean;
  tokenEmailVerified: boolean;
  verifiedForPublish: boolean;
  providers: string[];
  checkedAt: number;
  durationMs: number;
}

export interface AuthPerformanceSample {
  operation: "verification-refresh" | "verification-read" | "owner-load";
  durationMs: number;
}
const samples: AuthPerformanceSample[] = [];
export const performanceNow = () => globalThis.performance?.now() ?? Date.now();
export function recordAuthPerformance(operation: AuthPerformanceSample["operation"], started: number) {
  const ended = performanceNow();
  samples.push({ operation, durationMs: Math.max(0, ended - started) });
  // Owner loading is measured by the owner model. These contain timing only.
  if (operation !== "owner-load" && globalThis.performance?.measure) {
    globalThis.performance.measure(`hellocuff:${operation}`, { start: started, end: ended });
  }
  if (samples.length > 30) samples.shift();
}
// Deliberately contains no emails, IDs, credentials or tokens.
export const authPerformanceSamples = () => samples.map(sample => ({ ...sample }));

export function requireCurrentSession(user: User, auth: Auth = getAuth()) {
  if (auth.currentUser?.uid !== user.uid)
    throw new FirebaseError("auth/user-mismatch", "Your account session changed. Sign in again before continuing.");
}
export const authProviderIds = (user: User) => [...new Set(user.providerData.map(provider => provider.providerId))];
export const hasPassword = (user: User) => authProviderIds(user).includes("password");
export const hasGoogle = (user: User) => authProviderIds(user).includes("google.com");

async function verificationStatus(user: User, fresh: boolean, auth: Auth): Promise<VerificationStatus> {
  requireCurrentSession(user, auth);
  const started = performanceNow();
  try {
    if (fresh) await reload(user);
    requireCurrentSession(user, auth);
    const result = await getIdTokenResult(user, fresh);
    requireCurrentSession(user, auth);
    if (result.claims.sub !== user.uid)
      throw new FirebaseError("auth/user-mismatch", "The authentication token does not match this account. Sign in again.");
    const emailVerified = user.emailVerified === true;
    const tokenEmailVerified = result.claims.email_verified === true;
    return {
      uid: user.uid,
      emailVerified,
      tokenEmailVerified,
      verifiedForPublish: emailVerified && tokenEmailVerified,
      providers: authProviderIds(user),
      checkedAt: Date.now(),
      durationMs: Math.max(0, performanceNow() - started),
    };
  } finally {
    recordAuthPerformance(fresh ? "verification-refresh" : "verification-read", started);
  }
}
const refreshes = new WeakMap<User, Promise<VerificationStatus>>();
export const readVerificationStatus = (user: User, auth: Auth = getAuth()) => verificationStatus(user, false, auth);
export function refreshVerificationStatus(user: User, auth: Auth = getAuth()): Promise<VerificationStatus> {
  try { requireCurrentSession(user, auth); }
  catch (error) { return Promise.reject(error); }
  const existing = refreshes.get(user);
  if (existing) return existing;
  const pending = verificationStatus(user, true, auth).finally(() => refreshes.delete(user));
  refreshes.set(user, pending);
  return pending;
}
export async function requireVerifiedForPublish(user: User, auth: Auth = getAuth()): Promise<VerificationStatus> {
  // user.emailVerified and the token's email_verified are independent snapshots.
  // Always refresh both immediately before publishing; UI readiness is not proof.
  const status = await refreshVerificationStatus(user, auth);
  if (!status.verifiedForPublish)
    throw new FirebaseError("auth/email-not-verified", "Verify your email before publishing. Your profile edits are still here.");
  return status;
}

function requireSameUid(user: User, result: UserCredential, auth: Auth) {
  if (result.user.uid !== user.uid)
    throw new FirebaseError("auth/user-mismatch", "The selected sign-in belongs to another account. No profile was moved or merged.");
  requireCurrentSession(user, auth);
}

export async function addPasswordToGoogleAccount(user: User, password: string, confirmation: string, auth: Auth = getAuth()): Promise<User> {
  requireCurrentSession(user, auth);
  const issues = validatePassword(password, confirmation);
  if (issues.length) throw new Error(issues.join(" "));
  if (hasPassword(user))
    throw new FirebaseError("auth/provider-already-linked", "This account already has a password. Use password reset if you need a new one.");
  if (!hasGoogle(user) || !user.email)
    throw new FirebaseError("auth/operation-not-allowed", "Add a password is available after signing in with Google.");
  // Reauthentication confirms control of this existing Google identity. It never
  // calls createUserWithEmailAndPassword or signs into a second account.
  const reauthenticated = await reauthenticateWithPopup(user, new GoogleAuthProvider());
  requireSameUid(user, reauthenticated, auth);
  // Set the password on this authenticated identity without changing its email.
  // This public SDK operation also adds password sign-in to Google-first users.
  // It avoids the CLI 15.34 Auth emulator's same-email linkWithCredential bug;
  // the application uses this real operation in both emulator and live modes.
  await updatePassword(user, password);
  requireCurrentSession(user, auth);
  await refreshVerificationStatus(user, auth);
  if (!hasPassword(user))
    throw new FirebaseError("auth/internal-error", "The password change could not be confirmed. Sign in with Google again and check Settings before retrying.");
  return user;
}

export async function linkGoogleToPasswordAccount(user: User, currentPassword?: string, auth: Auth = getAuth()): Promise<UserCredential> {
  requireCurrentSession(user, auth);
  if (hasGoogle(user))
    throw new FirebaseError("auth/provider-already-linked", "Google is already linked to this account.");
  if (!hasPassword(user) || !user.email || !currentPassword)
    throw new FirebaseError("auth/requires-recent-login", "Enter this account's current password to confirm linking Google.");
  // Existing passwords may predate the new composition policy. Reauthentication
  // must accept their real credential rather than trapping existing customers.
  const reauthenticated = await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  requireSameUid(user, reauthenticated, auth);
  const linked = await linkWithPopup(user, new GoogleAuthProvider());
  requireSameUid(user, linked, auth);
  await refreshVerificationStatus(user, auth);
  return linked;
}
