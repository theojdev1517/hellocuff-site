import { useEffect, useId, useRef, useState } from "react";
import * as api from "./firebase";
import { AppLink, navigate } from "./navigation";
import { errorMessage, type OwnerModel } from "./owner-model";

export function Header({
  owner,
  route,
  authReady,
  publicSite = false,
  publicCardPrefix = "/p/",
  signupHref,
}: {
  owner: Pick<OwnerModel, "user" | "dirty" | "busy"> & {
    data: { account: { publicId: string } } | null;
  };
  route: string;
  authReady: boolean;
  publicSite?: boolean;
  publicCardPrefix?: string;
  signupHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const host = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<"first" | "last">("first");
  const items = () =>
    Array.from(
      panel.current?.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>(
        "a[href], button:not(:disabled)",
      ) || [],
    );
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) toggle.current?.focus();
  };
  useEffect(() => setOpen(false), [route, owner.user?.uid]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const available = items();
      (firstFocus.current === "last"
        ? available.at(-1)
        : available[0]
      )?.focus();
    });
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const signOut = async () => {
    if (
      busy ||
      owner.busy ||
      (owner.dirty && !confirm("Discard unsaved edits and sign out?"))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.logout();
      close();
      navigate("/app/sign-in", true);
    } catch (failure) {
      close();
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="site-header-bar">
      <header
        className={`site-header${!owner.user && authReady ? " site-header-public" : ""}`}
      >
        <a href="/" aria-label="HelloCuff home">
          <picture>
            {publicSite && (
              <source
                media="(prefers-color-scheme: dark)"
                srcSet="/assets/hellocuff-logo-dark.svg"
              />
            )}
            <img
              src="/assets/hellocuff-logo.svg"
              alt="HelloCuff"
              width="190"
              height="45"
            />
          </picture>
        </a>
        <nav aria-label="Main navigation">
          {owner.user ? (
            <div
              className="account-menu"
              ref={host}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setOpen(false);
              }}
            >
              <button
                className="account-menu-toggle"
                type="button"
                ref={toggle}
                aria-label="Account menu"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => {
                  firstFocus.current = "first";
                  setOpen((value) => !value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    if (!open) {
                      firstFocus.current =
                        event.key === "ArrowUp" ? "last" : "first";
                      setOpen(true);
                    } else {
                      const available = items();
                      (event.key === "ArrowUp"
                        ? available.at(-1)
                        : available[0]
                      )?.focus();
                    }
                  }
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  {open ? (
                    <path d="m6 6 12 12M18 6 6 18" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              {open && (
                <div
                  className="account-menu-panel"
                  role="group"
                  aria-label="Account links"
                  id={menuId}
                  ref={panel}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    const available = items();
                    if (!available.length) return;
                    event.preventDefault();
                    const index = available.indexOf(
                      document.activeElement as HTMLAnchorElement,
                    );
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? available.length - 1
                          : (index +
                              (event.key === "ArrowDown" ? 1 : -1) +
                              available.length) %
                            available.length;
                    available[next]?.focus();
                  }}
                >
                  <AppLink
                    to="/app/profile"
                    aria-current={route === "/app/profile" ? "page" : undefined}
                    onClick={() => close(true)}
                  >
                    profile
                  </AppLink>
                  {owner.data ? (
                    <AppLink
                      to={`${publicCardPrefix}${owner.data.account.publicId}`} target="_blank" rel="noopener noreferrer"
                      aria-current={
                        route ===
                        `${publicCardPrefix}${owner.data.account.publicId}`
                          ? "page"
                          : undefined
                      }
                      onClick={() => close(true)}
                    >
                      view your card
                    </AppLink>
                  ) : (
                    <button type="button" disabled>
                      view your card
                    </button>
                  )}
                  <AppLink
                    to="/app/settings"
                    aria-current={
                      route === "/app/settings" ? "page" : undefined
                    }
                    onClick={() => close(true)}
                  >
                    settings
                  </AppLink>
                  <button
                    type="button"
                    disabled={busy || owner.busy}
                    onClick={() => void signOut()}
                  >
                    sign out
                  </button>
                </div>
              )}
            </div>
          ) : authReady ? (
            <div className="public-nav">
              <AppLink
                to="/app/faq"
                aria-current={route === "/app/faq" ? "page" : undefined}
              >
                FAQ
              </AppLink>
              <AppLink
                to="/app/pricing"
                aria-current={route === "/app/pricing" ? "page" : undefined}
              >
                Pricing
              </AppLink>
              {signupHref&&<AppLink className="header-signup" to={signupHref}>Sign Up</AppLink>}
              <AppLink
                to={
                  route.startsWith("/p/")
                    ? "/app/sign-in?next=" + encodeURIComponent(route)
                    : "/app/sign-in"
                }
                aria-current={route === "/app/sign-in" ? "page" : undefined}
              >
                Sign In
              </AppLink>
            </div>
          ) : null}
        </nav>
      </header>
      {error && (
        <p className="notice global-notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
