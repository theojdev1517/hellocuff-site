import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode as firebaseApplyActionCode,
  checkActionCode as firebaseCheckActionCode,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import {
  newPublicId,
  emptyContact,
  validateDraft,
  normalizeContact,
  runtimeConfig,
  resolveEntitlement,
  photoPolicy,
  type EntitlementState,
  type RuntimePlanConfig,
  type Draft,
  type PlanId,
} from "./domain";
import { commitProfile } from "./profile-store";
import { photoAssetIssue } from "./photo-asset";
import { validatePassword } from "./password-policy";
import { validateContinuationUrl } from "./auth-action";
import {
  refreshVerificationStatus,
  readVerificationStatus as readStatus,
  requireVerifiedForPublish,
  requireCurrentSession,
  addPasswordToGoogleAccount,
  linkGoogleToPasswordAccount,
  recordAuthPerformance,
  performanceNow,
} from "./auth-session";
export {
  hasPassword,
  hasGoogle,
  authProviderIds,
  authPerformanceSamples,
  type VerificationStatus,
} from "./auth-session";
const env = import.meta.env;
export const emulator = env.VITE_USE_EMULATORS === "true";
const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
if (
  emulator &&
  (!local ||
    !(env.VITE_FIREBASE_PROJECT_ID || "demo-hellocuff").startsWith("demo-"))
)
  throw Error("Emulator mode is restricted to localhost and demo projects.");
export const configured =
  emulator ||
  !!(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
  );
export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    `${env.VITE_FIREBASE_PROJECT_ID || "demo-hellocuff"}.firebaseapp.com`,
  projectId: env.VITE_FIREBASE_PROJECT_ID || "demo-hellocuff",
  appId: env.VITE_FIREBASE_APP_ID || "demo-app",
});
// An unconfigured build must not hydrate a cached session and refresh its token.
export const auth = configured
  ? getAuth(app)
  : initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);
if (emulator) {
  const authPort = Number(env.VITE_AUTH_EMULATOR_PORT || 9099);
  if (!Number.isInteger(authPort) || authPort < 1024 || authPort > 65535) throw Error("Invalid local Auth emulator port.");
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export const authReady = configured
  ? setPersistence(auth, browserLocalPersistence)
  : Promise.resolve();
const requireConfigured = () => {
  if (!configured)
    throw Error("Firebase web configuration is missing. See portal/README.md.");
};
export const signup = async (
  email: string,
  password: string,
  confirmation?: string,
) => {
  requireConfigured();
  const issues = validatePassword(password, confirmation);
  if (issues.length) throw Error(issues.join(" "));
  await authReady;
  return createUserWithEmailAndPassword(auth, email.trim(), password);
};
export const login = async (email: string, password: string) => {
  requireConfigured();
  await authReady;
  return signInWithEmailAndPassword(auth, email.trim(), password);
};
export const googleLogin = async () => {
  requireConfigured();
  await authReady;
  return signInWithPopup(auth, new GoogleAuthProvider());
};
export const logout = async () => {
  requireConfigured();
  return signOut(auth);
};
export const verifyEmail = async (user: User, continueUrl?:string) => {
  requireConfigured();
  const continuation=continueUrl?validateContinuationUrl(continueUrl,{emulator,projectId:app.options.projectId||"",currentOrigin:location.origin}):null;
  if(continueUrl&&!continuation)throw Error("Invalid continuation URL.");
  return sendEmailVerification(user,continuation?{url:continuation,handleCodeInApp:false}:undefined);
};
export const resetEmail = async (email: string, continueUrl?: string) => {
  requireConfigured();
  const continuation = continueUrl
    ? validateContinuationUrl(continueUrl, {
        emulator,
        projectId: app.options.projectId || "",
        currentOrigin: location.origin,
      })
    : null;
  if (continueUrl && !continuation) throw Error("Invalid continuation URL.");
  return sendPasswordResetEmail(
    auth,
    email.trim(),
    continuation ? { url: continuation, handleCodeInApp: false } : undefined,
  );
};
export const refreshUser = async (u: User) => {
  requireConfigured();
  await authReady;
  return refreshVerificationStatus(u, auth);
};
export const readVerificationStatus = async (u: User) => {
  requireConfigured();
  await authReady;
  return readStatus(u, auth);
};
// Firebase Auth loads the server profile when signing in/restoring a session.
// Read its token too, repairing any mismatch without always forcing a second
// profile reload/token refresh (which would restart active Firestore listens).
export const initialVerificationStatus = async (u: User) => {
  const status = await readVerificationStatus(u);
  return status.emailVerified !== status.tokenEmailVerified
    ? refreshUser(u)
    : status;
};
export const addPassword = async (
  user: User,
  password: string,
  confirmation: string,
) => {
  requireConfigured();
  await authReady;
  return addPasswordToGoogleAccount(user, password, confirmation, auth);
};
export const linkGoogle = async (user: User, currentPassword?: string) => {
  requireConfigured();
  await authReady;
  return linkGoogleToPasswordAccount(user, currentPassword, auth);
};
export const applyVerificationCode = async (code: string) => {
  requireConfigured();
  return firebaseApplyActionCode(auth, code);
};
export const inspectActionCode = async (code: string) => {
  requireConfigured();
  return firebaseCheckActionCode(auth, code);
};
export const inspectPasswordResetCode = async (code: string) => {
  requireConfigured();
  return firebaseVerifyPasswordResetCode(auth, code);
};
export const completePasswordReset = async (
  code: string,
  password: string,
  confirmation?: string,
) => {
  requireConfigured();
  const issues = validatePassword(password, confirmation);
  if (issues.length) throw Error(issues.join(" "));
  return firebaseConfirmPasswordReset(auth, code, password);
};
export interface Account {
  publicId: string;
  freePlanSelected?: boolean;
}
export const tombstone = () => ({
  published: false,
  content: emptyContact(),
  palette: "blue",
  mode: "light",
  configRevision: 0,
  updatedAt: serverTimestamp(),
});
export async function ensureAccount(user: User): Promise<Account> {
  requireConfigured();
  requireCurrentSession(user, auth);
  const ref = doc(db, "accounts", user.uid);
  // Existing accounts need a server read, not a read-only transaction commit.
  // Only confirmed absence enters atomic account/public-ID creation.
  const existing = await getDocFromServer(ref);
  requireCurrentSession(user, auth);
  if (existing.exists()) return existing.data() as Account;
  const id = newPublicId();
  const account = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    requireCurrentSession(user, auth);
    if (snap.exists()) return snap.data() as Account;
    tx.set(ref, {
      publicId: id,
      schemaVersion: 1,
      createdAt: serverTimestamp(),
      freePlanSelected: false,
    });
    tx.set(doc(db, "publicProfiles", id), tombstone());
    return { publicId: id, freePlanSelected: false };
  });
  requireCurrentSession(user, auth);
  return account;
}
export async function selectFreePlan(user: User) {
  requireConfigured();
  requireCurrentSession(user, auth);
  await updateDoc(doc(db, "accounts", user.uid), { freePlanSelected: true });
}
const ownerLoads = new WeakMap<
  User,
  Promise<{ account: Account; draft: Draft | null; published: boolean }>
>();
export function loadOwner(user: User) {
  requireConfigured();
  requireCurrentSession(user, auth);
  const pending = ownerLoads.get(user);
  if (pending) return pending;
  const started = performanceNow();
  const request = (async () => {
    const accountRequest = ensureAccount(user);
    // The private draft is independent of public-ID lookup. Start both reads
    // together; published status starts as soon as its server account is known.
    const draftRequest = getDocFromServer(doc(db, "drafts", user.uid));
    const publishedRequest = accountRequest.then((account) => {
      requireCurrentSession(user, auth);
      return getDocFromServer(doc(db, "publicProfiles", account.publicId));
    });
    const [account, draft, published] = await Promise.all([
      accountRequest,
      draftRequest,
      publishedRequest,
    ]);
    requireCurrentSession(user, auth);
    return {
      account,
      draft: draft.exists() ? (draft.data() as Draft) : null,
      published: published.data()?.published === true,
    };
  })().finally(() => {
    ownerLoads.delete(user);
    recordAuthPerformance("owner-load", started);
  });
  ownerLoads.set(user, request);
  return request;
}
export function watchEntitlement(
  user: User,
  next: (status: EntitlementState) => void,
) {
  if (!configured) {
    next({ plan: null, error: "Firebase is not configured." });
    return () => {};
  }
  return onSnapshot(
    doc(db, "entitlements", user.uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      // Absence grants Free only after a server-confirmed snapshot.
      if (!snapshot.metadata.fromCache)
        next(resolveEntitlement(snapshot.exists(), snapshot.data()));
    },
    () =>
      next({
        plan: null,
        error:
          "Assigned plan is unavailable. Save and publish are paused; unpublish and removal remain available.",
      }),
  );
}
export function watchConfig(
  next: (config: RuntimePlanConfig | null) => void,
  plan: PlanId = "free",
) {
  if (!configured) {
    next(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, "appConfig", "plans"),
    (snap) => next(snap.exists() ? runtimeConfig(snap.data(), plan) : null),
    () => next(null),
  );
}
export async function saveDraft(
  user: User,
  draft: Draft,
  config: RuntimePlanConfig,
  plan: PlanId,
  publish: boolean,
  publicId: string,
) {
  requireConfigured();
  requireCurrentSession(user, auth);
  if (!navigator.onLine)
    throw Error(
      "You are offline. Your edits are still on this screen; reconnect and retry.",
    );
  const normalized = { ...draft, content: normalizeContact(draft.content) };
  const errors = validateDraft(normalized, config, plan);
  if (errors.length) throw Error(errors.join(" "));
  if (normalized.photo) {
    const asset = await getDocFromServer(
      doc(db, "photoAssets", user.uid, "items", normalized.photo.id),
    );
    requireCurrentSession(user, auth);
    const issue = photoAssetIssue(
      normalized.photo,
      asset.data(),
      photoPolicy(config, plan),
    );
    if (issue) throw Error(issue);
  }
  if (publish) await requireVerifiedForPublish(user, auth);
  const value = {
    ...normalized,
    configRevision: config.revision,
    updatedAt: serverTimestamp(),
  };
  // Transactions fail offline instead of queuing a misleading later publish.
  await commitProfile(db, user.uid, publicId, value, publish);
}
export async function unpublish(publicId: string) {
  requireConfigured();
  if (!navigator.onLine) throw Error("Reconnect to unpublish.");
  await setDoc(doc(db, "publicProfiles", publicId), tombstone());
}
export async function clearProfile(user: User, publicId: string) {
  requireConfigured();
  if (!navigator.onLine) throw Error("Reconnect to remove profile data.");
  const b = writeBatch(db);
  b.delete(doc(db, "drafts", user.uid));
  b.set(doc(db, "publicProfiles", publicId), tombstone());
  await b.commit();
}
export const readPublic = async (id: string) => {
  requireConfigured();
  return getDocFromServer(doc(db, "publicProfiles", id));
};
