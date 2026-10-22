import { getApps, initializeApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
  checkActionCode,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  sendPasswordResetEmail,
} from "firebase/auth";
import { validatePassword } from "./password-policy";
import {
  validateContinuationUrl,
  type AuthActionAdapter,
  type ContinuationContext,
} from "./auth-action";

const env = import.meta.env;
export const emulator = env.VITE_AUTH_USE_EMULATORS === "true";
const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const requestedProject =
  env.VITE_AUTH_PROJECT_ID || (emulator ? "demo-hellocuff" : "");
if (emulator && (!local || !requestedProject.startsWith("demo-")))
  throw Error("Auth-only emulators require localhost and a demo project.");
export const configured =
  emulator ||
  !!(
    requestedProject === "hellocuff-e8dec" &&
    env.VITE_AUTH_API_KEY &&
    env.VITE_AUTH_APP_ID &&
    (!env.VITE_AUTH_AUTH_DOMAIN ||
      env.VITE_AUTH_AUTH_DOMAIN === "hellocuff-e8dec.firebaseapp.com")
  );
const config = configured
  ? {
      apiKey: env.VITE_AUTH_API_KEY || "demo-key",
      projectId: requestedProject,
      authDomain:
        env.VITE_AUTH_AUTH_DOMAIN || `${requestedProject}.firebaseapp.com`,
      appId: env.VITE_AUTH_APP_ID || "demo-app",
    }
  : {
      apiKey: "demo-key",
      projectId: "demo-hellocuff",
      authDomain: "demo-hellocuff.firebaseapp.com",
      appId: "demo-app",
    };
const appName = "hellocuff-auth-actions";
export const app =
  getApps().find((candidate) => candidate.name === appName) ||
  initializeApp(config, appName);
// Never initialize default/local persistence and then switch: no cached portal
// account, refresh token, private listener or account-session observer is restored.
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
if (emulator)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
export const continuationContext: ContinuationContext = {
  emulator,
  projectId: requestedProject,
  currentOrigin: location.origin,
};
const requireConfigured = () => {
  if (!configured) throw Error("Firebase is not configured.");
};
export const authActionAdapter: AuthActionAdapter = {
  configured,
  officialActionConfig: Object.freeze({
    projectId: auth.app.options.projectId,
    apiKey: auth.app.options.apiKey,
  }),
  async inspectActionCode(code) {
    requireConfigured();
    return checkActionCode(auth, code);
  },
  async inspectPasswordResetCode(code) {
    requireConfigured();
    return verifyPasswordResetCode(auth, code);
  },
  async applyActionCode(code) {
    requireConfigured();
    await applyActionCode(auth, code);
  },
  async completePasswordReset(code, password, confirmation) {
    requireConfigured();
    const errors = validatePassword(password, confirmation);
    if (errors.length) throw Error(errors.join(" "));
    await confirmPasswordReset(auth, code, password);
  },
  async resetEmail(email, continueUrl) {
    requireConfigured();
    const continuation = continueUrl
      ? validateContinuationUrl(continueUrl, continuationContext)
      : null;
    if (continueUrl && !continuation) throw Error("Invalid continuation URL.");
    await sendPasswordResetEmail(
      auth,
      email.trim(),
      continuation ? { url: continuation, handleCodeInApp: false } : undefined,
    );
  },
};
