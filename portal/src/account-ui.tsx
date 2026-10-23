import React, { useEffect, useRef, useState } from "react";
import * as api from "./firebase";
import { PasswordFields } from "./password-fields";
import { PasswordInput } from "./PasswordInput";
export { PasswordFields } from "./password-fields";
import { EmailActionPage, ResetRequestPage } from "./auth-action-ui";
import { type AuthActionAdapter } from "./auth-action";
import { validatePassword } from "./password-policy";
import { newPublicId } from "./domain";
import { DevelopmentCheckout } from "./checkout";
import { AppLink, navigate } from "./navigation";
import { errorMessage, type OwnerModel } from "./owner-model";
export function AuthForm({
  mode,
  preparing = false,
  afterSignup = "/app/plans",
  initialEmail = "",
}: {
  mode: "login" | "signup" | "reset";
  preparing?: boolean;
  afterSignup?: "/app/plans" | "/app/checkout";
  initialEmail?: string;
}) {
  return mode === "reset" ? (
    <ResetRequestPage
      adapter={portalActionAdapter}
      search={location.search}
      context={portalContinuationContext()}
      defaultContinueUrl={`${location.origin}/app/profile`}
      portal
      renderLink={portalActionLink}
    />
  ) : (
    <CredentialsForm mode={mode} preparing={preparing} afterSignup={afterSignup} initialEmail={initialEmail}/>
  );
}
function CredentialsForm({
  mode,
  preparing = false,
  afterSignup = "/app/plans",
  initialEmail = "",
}: {
  mode: "login" | "signup" | "reset";
  preparing?: boolean;
  afterSignup?: "/app/plans" | "/app/checkout";
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  useEffect(() => {
    setStatus("");
    setPassword("");
    setConfirmation("");
  }, [mode]);
  const run = async (operation: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    try {
      await operation();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="auth-shell" aria-busy={busy || preparing}>
      <section className="panel auth-panel">
        <p className="eyebrow">Your next hello starts here</p>
        <h1>
          {mode === "signup"
            ? afterSignup === "/app/checkout" ? "Secure your order" : "Make it yours."
            : mode === "reset"
              ? "Reset your password."
              : "Welcome back."}
        </h1>
        <p>
          {mode === "reset"
            ? "We will email a reset link if an account uses this address."
            : ""}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (preparing) return;
            void run(async () => {
              if (mode === "reset") {
                await api.resetEmail(email.trim());
                setStatus(
                  "If an account uses this email, a reset link has been sent.",
                );
              } else if (mode === "signup") {
                const errors = validatePassword(password, confirmation);
                if (errors.length) throw Error(errors.join(" "));
                await api.signup(email.trim(), password);
                navigate(afterSignup,true);
              } else await api.login(email.trim(), password);
            });
          }}
        >
          <label>
            Account email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={preparing}
            />
          </label>
          {mode === "signup" ? (
            <PasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
              disabled={preparing}
            />
          ) : mode !== "reset" ? (
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={preparing}
            />
          ) : null}
          <button
            className="primary"
            disabled={busy || preparing || !api.configured}
          >
            {preparing
              ? "Preparing your profile."
              : busy
                ? "Please wait."
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
          </button>
        </form>
        {mode !== "reset" && (
          <button
            className="google"
            disabled={busy || preparing || !api.configured}
            onClick={() => void run(api.googleLogin)}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48" className="google-mark"><path fill="#4285f4" d="M43.6 20.5H24v8.1h11.3c-1 5.3-5.5 8.1-11.3 8.1a12.7 12.7 0 1 1 0-25.4c3.1 0 5.8 1.1 7.9 3.1l6-6C34.3 5.1 29.5 3 24 3a21 21 0 1 0 0 42c12.1 0 20.1-8.5 20.1-20.4 0-1.5-.2-2.8-.5-4.1Z"/><path fill="#34a853" d="M6.2 35.6 13 30.4A12.7 12.7 0 0 0 24 36.7c3.1 0 5.8-.8 7.8-2.4l6.6 5.1A20.9 20.9 0 0 1 6.2 35.6Z"/><path fill="#fbbc05" d="M3 24c0-3.4.8-6.7 2.3-9.5l7 5.2a12.8 12.8 0 0 0 .7 10.7l-6.8 5.2A20.9 20.9 0 0 1 3 24Z"/><path fill="#ea4335" d="M24 3c5.5 0 10.3 2.1 13.9 5.4l-6 6A11.3 11.3 0 0 0 24 11.3c-5.4 0-10 3.3-11.7 8.4l-7-5.2A21 21 0 0 1 24 3Z"/></svg> Continue with Google
          </button>
        )}
        <div className="text-actions">
          {mode === "signup" ? (
            <AppLink to="/app/sign-in">
              Already have an account? Sign in
            </AppLink>
          ) : (
            <AppLink to="/app/signup">Create an account</AppLink>
          )}
          <AppLink to={mode === "reset" ? "/app/sign-in" : "/app/reset"}>
            {mode === "reset" ? "Back to sign in" : "Forgot password?"}
          </AppLink>
        </div>
        <p role="status" className="notice">
          {status}
        </p>
        {api.emulator &&
          import.meta.env.VITE_ENABLE_MOCK_CHECKOUT === "true" && (
            <AppLink to="/app/checkout">
              Try the development checkout rehearsal â†’
            </AppLink>
          )}
      </section>
    </main>
  );
}
const portalActionAdapter: AuthActionAdapter = {
  configured: api.configured,
  officialActionConfig: Object.freeze({
    projectId: api.auth.app.options.projectId,
    apiKey: api.auth.app.options.apiKey,
  }),
  inspectActionCode: api.inspectActionCode,
  inspectPasswordResetCode: api.inspectPasswordResetCode,
  applyActionCode: api.applyVerificationCode,
  completePasswordReset: api.completePasswordReset,
  resetEmail: api.resetEmail,
};
const portalContinuationContext = () => ({
  emulator: api.emulator,
  projectId: api.app.options.projectId || "",
  currentOrigin: location.origin,
});
const portalActionLink = (to: string, text: string) => (
  <AppLink to={to}>{text}</AppLink>
);
export function ActionPage({ search }: { search: string }) {
  return (
    <EmailActionPage
      adapter={portalActionAdapter}
      search={search}
      context={portalContinuationContext()}
      portal
      renderLink={portalActionLink}
    />
  );
}
export function PlanSelection({ owner }: { owner: OwnerModel }) {
  return (
    <main className="plans-shell">
      <section className="panel plans-panel">
        <p className="eyebrow">Make it yours</p>
        <h1>Choose your plan</h1>
        <p>
          Start with one editable contact profile. Standard and Pro are coming
          soon.
        </p>
        <div className="plan-grid">
          <article className="plan-card selected">
            <h2>Free</h2>
            <p className="plan-price">
              $0<span> / plan</span>
            </p>
            <p>One contact profile, a stable link and a contact download.</p>
            <button
              className="primary"
              disabled={owner.busy || !owner.data}
              onClick={() =>
                void owner.run(async () => {
                  if (!owner.user) return;
                  if (owner.data?.account.freePlanSelected === false)
                    await api.selectFreePlan(owner.user);
                  owner.update((previous) => ({
                    data: previous.data
                      ? {
                          ...previous.data,
                          account: {
                            ...previous.data.account,
                            freePlanSelected: true,
                          },
                        }
                      : null,
                  }));
                  navigate("/app/profile");
                })
              }
            >
              Continue with Free
            </button>
          </article>
          {["Standard", "Pro"].map((name) => (
            <article className="plan-card coming-soon" key={name}>
              <h2>{name}</h2>
              <p>Coming Soon</p>
              <button disabled>{name} â€” Coming Soon</button>
            </article>
          ))}
        </div>
        <p role="status" className="notice">
          {owner.notice}
        </p>
      </section>
      <aside className="panel order-summary">
        <h2>Your HelloCuff</h2>
        <div>
          <span>1 HelloCuff bracelet</span>
          <strong>$24.99</strong>
        </div>
        <p className="shipping">Free Shipping!</p>
        <p className="hint">
          Order preview only. No payment, order or shipment is created here.
        </p>
      </aside>
    </main>
  );
}
export function Settings({
  owner,
}: {
  owner: {
    user: OwnerModel["user"];
    busy: boolean;
    notice: string;
    entitlement: { plan: OwnerModel["entitlement"]["plan"] };
    run: (operation: () => Promise<void>) => Promise<void>;
    update: (patch: { notice: string }) => void;
  };
}) {
  const user = owner.user!;
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
  const [, setProvidersVersion] = useState(0);
  const hasPassword = api.hasPassword(user),
    hasGoogle = user.providerData.some(
      (provider) => provider.providerId === "google.com",
    );
  return (
    <main className="settings-shell">
      <section className="panel settings-panel">
        <p className="eyebrow">Your account</p>
        <h1>Settings</h1>
        <p className="account-email">{user.email}</p>
        <section className="settings-section">
          <h2>Sign-in methods</h2>
          <p>
            {hasGoogle ? "Google is connected." : "Google is not connected."}{" "}
            {hasPassword
              ? "A password is connected."
              : "You can optionally add a password to this same account."}
          </p>
          {!hasPassword && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const errors = validatePassword(password, confirmation);
                if (errors.length) {
                  owner.update({ notice: errors.join(" ") });
                  return;
                }
                void owner.run(async () => {
                  await api.addPassword(user, password, confirmation);
                  setPassword("");
                  setConfirmation("");
                  setProvidersVersion((value) => value + 1);
                  owner.update({
                    notice:
                      "Password added. Google and password sign-in now use this same account.",
                  });
                });
              }}
            >
              <h3>Add a password</h3>
              <p className="hint">
                Confirm your existing Google account in the popup, then add a
                password.
              </p>
              <PasswordFields
                prefix="new"
                password={password}
                confirmation={confirmation}
                onPassword={setPassword}
                onConfirmation={setConfirmation}
                disabled={owner.busy}
              />
              <button className="primary" disabled={owner.busy}>
                Add password
              </button>
            </form>
          )}
          {!hasGoogle && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void owner.run(async () => {
                  await api.linkGoogle(user, currentPassword || undefined);
                  setCurrentPassword("");
                  setProvidersVersion((value) => value + 1);
                  owner.update({
                    notice:
                      "Google connected to this same account. Your profile and link are unchanged.",
                  });
                });
              }}
            >
              <h3>Connect Google</h3>
              {hasPassword && (
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              )}
              <p className="hint">
                If the Google account already belongs to another HelloCuff
                account, nothing will be merged automatically.
              </p>
              <button disabled={owner.busy}>Link Google</button>
            </form>
          )}
          <AppLink to="/app/reset">Reset your password</AppLink>
        </section>
        <p className="notice" role="status">
          {owner.busy ? "Workingâ€¦" : owner.notice}
        </p>
        <section className="settings-section">
          <h2>Your plan</h2>
          <p>{owner.entitlement.plan || "Checking your planâ€¦"}</p>
          <AppLink to="/app/plans">View plans</AppLink>
        </section>
      </section>
    </main>
  );
}
export function Checkout() {
  const [id] = useState(() => {
    try {
      const old = sessionStorage.getItem("hellocuff-active-rehearsal");
      if (old) return old;
      const next = newPublicId();
      sessionStorage.setItem("hellocuff-active-rehearsal", next);
      return next;
    } catch {
      return newPublicId();
    }
  });
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  if (!api.emulator || import.meta.env.VITE_ENABLE_MOCK_CHECKOUT !== "true")
    return (
      <main className="auth-shell">
        <section className="panel">
          <h1>Purchasing is not available.</h1>
          <AppLink to="/app/profile">Your account</AppLink>
        </section>
      </main>
    );
  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">Development only Â· no payment</p>
        <h1>Checkout rehearsal</h1>
        <p>No card, charge, order, shipment or paid entitlement is created.</p>
        <p className="hint">Rehearsal ID: {id}</p>
        <div className="button-row">
          {(["success", "cancel", "failure"] as const).map((result) => (
            <button
              key={result}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                try {
                  setStatus(
                    new DevelopmentCheckout(localStorage).complete(id, result)
                      .status,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Simulate {result}
            </button>
          ))}
        </div>
        <p role="status">
          {status === "success"
            ? "Simulated success recorded. Continue with a new or existing Free account."
            : status === "cancel"
              ? "Canceled. You can retry this rehearsal."
              : status === "failure"
                ? "Simulated failure. Retry when ready."
                : ""}
        </p>
        {status === "success" && (
          <AppLink className="primary link-button" to="/app/signup">
            Continue to account â†’
          </AppLink>
        )}
        <p className="hint">
          Repeated success stays one simulated result. It is never proof of real
          payment.
        </p>
      </section>
    </main>
  );
}
