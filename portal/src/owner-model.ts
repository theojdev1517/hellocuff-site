import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import * as api from "./firebase";
import {
  emptyContact,
  type Draft,
  type RuntimePlanConfig,
  type EntitlementState,
  type PhotoMetadata,
} from "./domain";
import type { ProcessedPhoto } from "./photos";
import { cleanupPhotos, photoStorageReady } from "./photos";
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const known: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/email-already-in-use":
      "An account already uses this email. Sign in with its existing method, or request a password reset.",
    "auth/account-exists-with-different-credential":
      "This email uses another sign-in method. Sign in with that method, then add Google from Settings.",
    "auth/credential-already-in-use":
      "That sign-in method belongs to another account. No accounts were merged. Sign in to the original account or use a different method.",
    "auth/provider-already-linked":
      "This sign-in method is already connected to your account.",
    "auth/popup-closed-by-user":
      "Google sign-in was canceled. Nothing changed; you can try again.",
    "auth/cancelled-popup-request":
      "Google sign-in was canceled. Nothing changed; you can try again.",
    "auth/popup-blocked": "Allow the Google sign-in popup, then try again.",
    "auth/requires-recent-login":
      "For your security, sign in again and retry. Your saved profile stays on this account.",
    "auth/user-mismatch":
      "Choose the Google account that already belongs to this HelloCuff account.",
    "auth/expired-action-code": "This link is no longer valid.",
    "auth/invalid-action-code": "This link is no longer valid.",
    "auth/weak-password":
      "Choose a password that meets every item in the checklist.",
    "auth/password-does-not-meet-requirements":
      "Choose a password that meets every item in the checklist.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/operation-not-allowed":
      "This sign-in method is not enabled for this environment.",
    "auth/network-request-failed":
      "Connection failed. Check your network and retry.",
    "permission-denied":
      "The server could not accept this change. Check the highlighted details or refresh verification and try again. Your edits remain here.",
    unavailable:
      "The service is unavailable. Your edits remain here; reconnect and retry.",
  };
  return (
    (code && known[code]) ||
    (error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.")
  );
}
type OwnerData = Awaited<ReturnType<typeof api.loadOwner>>;
type Verification = Awaited<ReturnType<typeof api.refreshUser>>;
export const emptyDraft = (): Draft => ({
  content: emptyContact(),
  palette: "blue",
  mode: "light",
  configRevision: 1,
});
interface OwnerState {
  uid: string | null;
  data: OwnerData | null;
  draft: Draft;
  config: RuntimePlanConfig | null;
  entitlement: EntitlementState;
  notice: string;
  dirty: boolean;
  busy: boolean;
  loadError: boolean;
  verification: Verification | null;
  loadMs: number | null;
  pendingPhoto: ProcessedPhoto | null;
  uploadedPhoto: PhotoMetadata | null;
}
const blankOwner = (uid: string | null): OwnerState => ({
  uid,
  data: null,
  draft: emptyDraft(),
  config: null,
  entitlement: { plan: null, error: null },
  notice: "",
  dirty: false,
  busy: false,
  loadError: false,
  verification: null,
  loadMs: null,
  pendingPhoto: null,
  uploadedPhoto: null,
});
// One owner session per UID, independent of Profile/Settings/Plans route changes.
export function useOwnerModel(user: User | null, authRevision: number) {
  const uid = user?.uid || null;
  const [stored, setStored] = useState<OwnerState>(() => blankOwner(uid));
  // Never render data from the previous UID while effects are being replaced.
  const state = stored.uid === uid ? stored : blankOwner(uid);
  const lock = useRef<symbol | null>(null),
    verificationRequest = useRef<Promise<Verification> | null>(null),
    initialVerificationRequest = useRef<Promise<Verification> | null>(null),
    verificationEpoch = useRef(0);
  const update = (
    patch: Partial<OwnerState> | ((value: OwnerState) => Partial<OwnerState>),
  ) =>
    setStored((previous) =>
      previous.uid === uid
        ? {
            ...previous,
            ...(typeof patch === "function" ? patch(previous) : patch),
          }
        : previous,
    );
  const refreshVerification = async () => {
    if (!user) throw Error("Sign in to refresh verification.");
    if (!verificationRequest.current) {
      ++verificationEpoch.current;
      const pending = api.refreshUser(user);
      verificationRequest.current = pending;
      void pending
        .finally(() => {
          if (verificationRequest.current === pending)
            verificationRequest.current = null;
        })
        .catch(() => {});
    }
    const requestEpoch = verificationEpoch.current;
    const result = await verificationRequest.current;
    if (verificationEpoch.current === requestEpoch)
      update({ verification: result });
    return result;
  };
  const load = async () => {
    if (!user) return;
    const loadingUid = user.uid,
      started = performance.now();
    update({ loadError: false });
    try {
      const data = await api.loadOwner(user);
      if (api.auth.currentUser?.uid !== loadingUid) return;
      const duration = performance.now() - started;
      performance.measure("hellocuff:owner-load", {
        start: started,
        end: performance.now(),
      });
      update((previous) => ({
        data,
        loadMs: duration,
        loadError: false,
        draft: previous.dirty ? previous.draft : data.draft || emptyDraft(),
        notice: data.draft
          ? previous.notice
          : "Add your details, save a draft, then publish when you are ready.",
      }));
    } catch (error) {
      update({ notice: errorMessage(error), loadError: true });
    }
  };
  useEffect(() => {
    lock.current = null;
    verificationRequest.current = null;
    initialVerificationRequest.current = null;
    const initialEpoch = ++verificationEpoch.current;
    setStored(blankOwner(uid));
    if (!user) return;
    let alive = true;
    const started = performance.now();
    void api
      .loadOwner(user)
      .then((data) => {
        if (!alive || api.auth.currentUser?.uid !== uid) return;
        performance.measure("hellocuff:owner-load", {
          start: started,
          end: performance.now(),
        });
        setStored((previous) =>
          previous.uid === uid
            ? {
                ...previous,
                data,
                draft: data.draft || emptyDraft(),
                loadMs: performance.now() - started,
              }
            : previous,
        );
      })
      .catch((error) => {
        if (alive)
          setStored((previous) =>
            previous.uid === uid
              ? { ...previous, notice: errorMessage(error), loadError: true }
              : previous,
          );
      });
    const refresh = api.initialVerificationStatus(user);
    initialVerificationRequest.current = refresh;
    void refresh
      .then((verification) => {
        if (alive && verificationEpoch.current === initialEpoch)
          setStored((previous) =>
            previous.uid === uid ? { ...previous, verification } : previous,
          );
      })
      .catch((error) => {
        if (alive && verificationEpoch.current === initialEpoch)
          setStored((previous) =>
            previous.uid === uid
              ? { ...previous, notice: errorMessage(error) }
              : previous,
          );
      })
      .finally(() => {
        if (initialVerificationRequest.current === refresh)
          initialVerificationRequest.current = null;
      });
    const stop = api.watchEntitlement(user, (entitlement) => {
      if (alive)
        setStored((previous) =>
          previous.uid === uid ? { ...previous, entitlement } : previous,
        );
    });
    return () => {
      alive = false;
      stop();
    };
  }, [uid]);
  useEffect(() => {
    if (!user || !state.entitlement.plan) return;
    let alive = true;
    update({ config: null });
    const stop = api.watchConfig((config) => {
      if (alive) update({ config });
    }, state.entitlement.plan);
    return () => {
      alive = false;
      stop();
    };
  }, [uid, state.entitlement.plan]);
  useEffect(() => {
    if (!photoStorageReady || !state.data?.account.publicId) return;
    // A bounded, age-gated pass also recovers assets from interrupted prior sessions.
    void cleanupPhotos(state.data.account.publicId).catch(() => {
      console.warn("Photo cleanup will retry in a later session.");
    });
  }, [uid, state.data?.account.publicId]);
  useEffect(() => {
    if (!user) return;
    if (verificationRequest.current || initialVerificationRequest.current)
      return;
    let alive = true;
    const requestEpoch = verificationEpoch.current;
    void api
      .readVerificationStatus(user)
      .then((verification) => {
        if (alive && verificationEpoch.current === requestEpoch)
          update({ verification });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, authRevision]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - (state.verification?.checkedAt || 0) > 1500)
        void refreshVerification().catch((error) =>
          update({ notice: errorMessage(error) }),
        );
    };
    addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [uid, state.verification?.checkedAt]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (state.dirty) event.preventDefault();
    };
    addEventListener("beforeunload", before);
    return () => removeEventListener("beforeunload", before);
  }, [state.dirty]);
  const run = async (operation: () => Promise<void>) => {
    if (lock.current || !user) return;
    const operationId = Symbol("owner-operation");
    lock.current = operationId;
    update({ busy: true, notice: "" });
    try {
      await operation();
    } catch (error) {
      update({ notice: errorMessage(error) });
    } finally {
      // A previous UID's completion cannot unlock the next owner's operation.
      if (lock.current === operationId) {
        lock.current = null;
        update({ busy: false });
      }
    }
  };
  return { ...state, user, update, load, run, refreshVerification };
}
export type OwnerModel = ReturnType<typeof useOwnerModel>;
