import React, { useEffect, useRef, useState } from "react";
import { PasswordFields } from "./password-fields";
import { validatePassword } from "./password-policy";
import {
  applyEmailAction,
  authActionErrorMessage,
  continuationFromSearch,
  createEmailActionScope,
  inspectEmailAction,
  isInvalidAction,
  parseEmailAction,
  parseFallbackEmailAction,
  officialEmailActionUrl,
  resetEmailAction,
  resetRequestSentMessage,
  resetRequestErrorMessage,
  validateContinuationUrl,
  type AuthActionAdapter,
  type ContinuationContext,
} from "./auth-action";

interface ActionPageProps {
  adapter: AuthActionAdapter;
  search: string;
  context: ContinuationContext;
  portal?: boolean;
  renderLink?: (to: string, text: string) => React.ReactNode;
}
const plainLink = (to: string, text: string) => <a href={to}>{text}</a>;

export function EmailActionPage(props: ActionPageProps) {
  const fallback = parseFallbackEmailAction(props.search);
  if (!fallback) return <SupportedEmailActionPage {...props} />;
  const destination = props.adapter.configured
    ? officialEmailActionUrl(
        props.search,
        props.context,
        props.adapter.officialActionConfig,
      )
    : null;
  const renderLink = props.renderLink || plainLink;
  return (
    <main className="auth-shell">
      <section className="panel auth-panel action-panel">
        <p className="eyebrow">HelloCuff account</p>
        <h1>
          {fallback.mode === "verifyAndChangeEmail"
            ? "Confirm your email change"
            : fallback.mode === "signIn"
              ? "Complete email sign-in"
              : "Review account security"}
        </h1>
        {destination ? (
          <>
            <p>
              Continue to Firebase’s secure HelloCuff page to complete this
              account action. This page has not applied the action.
            </p>
            <a
              className="primary"
              href={destination}
              rel="noreferrer"
              referrerPolicy="no-referrer"
            >
              Continue with Firebase
            </a>
          </>
        ) : (
          <p role="status">This build cannot continue this account action.</p>
        )}
        <div className="text-actions">
          {renderLink("/", "HelloCuff home")}
          {props.portal && renderLink("/app/sign-in", "Sign in")}
        </div>
      </section>
    </main>
  );
}

function SupportedEmailActionPage({
  adapter,
  search,
  context,
  portal = false,
  renderLink = plainLink,
}: ActionPageProps) {
  const action = parseEmailAction(search);
  const mode = action?.mode,
    code = action?.code;
  const continuation = continuationFromSearch(search, context);
  const [status, setStatus] = useState(""),
    [valid, setValid] = useState(false),
    [invalid, setInvalid] = useState(false),
    [completed, setCompleted] = useState(false),
    [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const scope = useRef(createEmailActionScope(() => location));
  const activeScope = useRef<ReturnType<
    ReturnType<typeof createEmailActionScope>["begin"]
  > | null>(null);
  const pathname = location.pathname;
  const lock = useRef(false),
    consumed = useRef(false);
  useEffect(() => {
    const request = scope.current.begin(pathname, search);
    activeScope.current = request;
    const current = request.isCurrent;
    lock.current = false;
    consumed.current = false;
    setStatus("");
    setValid(false);
    setInvalid(false);
    setCompleted(false);
    setBusy(false);
    setPassword("");
    setConfirmation("");
    if (!adapter.configured)
      setStatus("Firebase is not configured. Account actions are unavailable.");
    else if (!action) {
      setInvalid(true);
      setStatus("This link is no longer valid.");
    } else {
      setBusy(true);
      void inspectEmailAction(adapter, action)
        .then(() => {
          if (current()) setValid(true);
        })
        .catch((error) => {
          if (current()) {
            setInvalid(isInvalidAction(error));
            setStatus(authActionErrorMessage(error));
          }
        })
        .finally(() => {
          if (current()) setBusy(false);
        });
    }
    return request.cancel;
  }, [adapter, search, pathname]);
  const run = async (reset: boolean) => {
    if (
      !action ||
      !valid ||
      lock.current ||
      consumed.current ||
      !adapter.configured
    )
      return;
    const current = activeScope.current?.isCurrent || (() => false);
    if (!current()) return;
    if (reset) {
      const errors = validatePassword(password, confirmation);
      if (errors.length) {
        setStatus(errors.join(" "));
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setStatus("");
    try {
      if (reset)
        await resetEmailAction(
          adapter,
          action,
          password,
          confirmation,
          current,
        );
      else await applyEmailAction(adapter, action, current);
      if (!current()) return;
      consumed.current = true;
      setCompleted(true);
      setValid(false);
      setPassword("");
      setConfirmation("");
      setStatus(
        mode === "resetPassword"
          ? "Password changed. Sign in with your new password."
          : mode === "verifyEmail"
            ? "Email verified. Return to your profile to continue."
            : "Your previous email address has been restored. Reset your password to secure your account.",
      );
    } catch (error) {
      if (current()) {
        const expired = isInvalidAction(error);
        setInvalid(expired);
        if (expired) setValid(false);
        setStatus(authActionErrorMessage(error));
      }
    } finally {
      if (current()) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const resetPath = continuation
    ? `/app/reset?continueUrl=${encodeURIComponent(continuation)}`
    : "/app/reset";
  return (
    <main className="auth-shell">
      <section className="panel auth-panel action-panel">
        <p className="eyebrow">HelloCuff account</p>
        <h1>
          {invalid
            ? "This link is no longer valid"
            : mode === "verifyEmail"
              ? "Verify your email"
              : mode === "recoverEmail"
                ? "Recover your email"
                : "Choose a new password"}
        </h1>
        {invalid && (
          <p>
            {mode === "verifyEmail"
              ? "Sign in to request a new verification email."
              : mode === "recoverEmail"
                ? "This recovery link has expired or was already used. If needed, request a password reset."
                : "Request a new password reset link to continue."}
          </p>
        )}
        {mode === "recoverEmail" && !invalid && !completed && (
          <p>
            Restore the previous email address for this account if you did not
            authorize the change.
          </p>
        )}
        {(mode === "verifyEmail" || mode === "recoverEmail") && !invalid && (
          <button
            className="primary"
            disabled={!valid || busy || completed || !adapter.configured}
            onClick={() => void run(false)}
          >
            {mode === "verifyEmail"
              ? "Confirm email verification"
              : "Restore previous email"}
          </button>
        )}
        {mode === "resetPassword" && valid && adapter.configured && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(true);
            }}
          >
            <PasswordFields
              prefix="new"
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
              disabled={busy}
            />
            <button className="primary" disabled={busy}>
              Set new password
            </button>
          </form>
        )}
        <p role="status" className="notice">
          {status || (busy ? "Checking your link." : "")}
        </p>
        {completed && continuation && (
          <p>{renderLink(continuation, "Continue to HelloCuff")}</p>
        )}
        <div className="text-actions">
          {(mode !== "verifyEmail" || invalid) &&
            renderLink(
              resetPath,
              completed && mode === "recoverEmail"
                ? "Reset your password"
                : "Request a new reset link",
            )}
          {portal && renderLink("/app/sign-in", "Sign in")}
          {!portal && renderLink("/", "HelloCuff home")}
        </div>
        {portal && renderLink("/app/profile", "Return to your account")}
        {!invalid && !valid && !busy && !completed && adapter.configured && (
          <button
            onClick={() => {
              const current = activeScope.current?.isCurrent || (() => false);
              if (!action || !current()) return;
              setBusy(true);
              void inspectEmailAction(adapter, action)
                .then(() => {
                  if (current()) {
                    setValid(true);
                    setStatus("");
                  }
                })
                .catch((error) => {
                  if (current()) {
                    setInvalid(isInvalidAction(error));
                    setStatus(authActionErrorMessage(error));
                  }
                })
                .finally(() => {
                  if (current()) setBusy(false);
                });
            }}
          >
            Retry link check
          </button>
        )}
      </section>
    </main>
  );
}

export function ResetRequestPage({
  adapter,
  search,
  context,
  portal = false,
  renderLink = plainLink,
  defaultContinueUrl,
}: ActionPageProps & { defaultContinueUrl?: string }) {
  const continuation =
    continuationFromSearch(search, context) ||
    validateContinuationUrl(defaultContinueUrl, context);
  const [email, setEmail] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    lock.current = false;
    setBusy(false);
    setStatus("");
    return () => {
      generation.current++;
    };
  }, [search]);
  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">Your next hello starts here</p>
        <h1>Reset your password.</h1>
        <p>We will email a reset link if an account uses this address.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (lock.current || !adapter.configured) return;
            lock.current = true;
            setBusy(true);
            setStatus("");
            const own = generation.current;
            void adapter
              .resetEmail(email.trim(), continuation || undefined)
              .then(() => {
                if (own === generation.current)
                  setStatus(resetRequestSentMessage);
              })
              .catch((error) => {
                if (own === generation.current)
                  setStatus(resetRequestErrorMessage(error));
              })
              .finally(() => {
                if (own === generation.current) {
                  lock.current = false;
                  setBusy(false);
                }
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
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy || !adapter.configured}>
            {busy ? "Please wait." : "Send reset link"}
          </button>
        </form>
        <div className="text-actions">
          {portal
            ? renderLink("/app/sign-in", "Back to sign in")
            : renderLink("/", "HelloCuff home")}
        </div>
        <p role="status" className="notice">
          {status ||
            (!adapter.configured
              ? "Firebase is not configured. Account actions are unavailable."
              : "")}
        </p>
      </section>
    </main>
  );
}
