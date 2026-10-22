import {useGoogleFont} from './google-fonts';
import { useState, type CSSProperties, type ReactNode } from "react";
import { urlOK, website, fontFamily, type Profile, type Plan } from "../functions/uat-contract.mjs";
import { colors } from "./design-preview";
import "./design-preview.css";
import { formatUsPhone } from "./domain";
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (v: number[]) =>
  "#" + v.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
const mix = (color: string, white: boolean, amount: number) =>
  hex(rgb(color).map((n) => n * (1 - amount) + (white ? 255 : 0) * amount));
const luminance = (color: string) =>
  rgb(color)
    .map((n) => {
      const x = n / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    })
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
export function cardColors(color: string, mode: string) {
  const l = luminance(color),
    on = l > 0.179 ? "#000000" : "#ffffff";
  let detail = color;
  const background = mode === "dark" ? "#151f2e" : "#ffffff";
  const contrast = (a: string, b: string) => {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (let n = 0; n < 12 && contrast(detail, background) < 4.5; n++)
    detail = mix(detail, mode === "dark", 0.18);
  return {
    accent: color,
    on,
    detail,
    tint: mix(color, true, 0.88),
    glow: mix(color, true, 0.65),
  };
}
export function UatCard({
  profile,
  branding,
  photo,
  logo,
  onDownload,
  preview = false,
  footer,
}: {
  profile: Profile;
  branding: Plan["branding"];
  photo?: string;
  logo?: string;
  onDownload: () => Promise<void>;
  preview?: boolean;
  footer?: ReactNode;
}) {
  const {failed:fontFailed,retry:retryFont}=useGoogleFont(profile.design.font);
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const d = profile.design,
    c = profile.content,
    safeWebsite=website(c.website),safeCta=website(d.ctaUrl),
    palette = colors.find((p) => p.id === d.color) || colors[0],
    paint = cardColors(
      d.color === "custom" ? d.customColor : palette.accent,
      d.mode,
    );
  const style = {
    "--dp-accent": paint.accent,
    "--dp-tint": paint.tint,
    "--dp-glow": paint.glow,
    "--uc-on-accent": paint.on,
    "--uc-detail": paint.detail,
    "--uc-page-surface":mix(paint.accent,d.mode !== "dark",d.mode === "dark" ? 0.88 : 0.96),
  } as CSSProperties;
  const font = fontFamily(d.font);
  style.fontFamily = branding === "none" ? font : undefined;
  (style as Record<string,unknown>)["--uc-font"]=font;

  return (
    <div
      className={`dp-stage uc-stage uc-public-page${branding === "wallpaper" ? " uc-wallpaper" : ""}`}
      style={style}
      data-appearance={d.mode}
      data-custom-font={branding === "none" ? "true" : undefined}
    >
      <header className="uc-card-page-header"><a href="/" aria-label="HelloCuff home">{branding === "none" && logo ? <img className="uc-header-logo uc-logo" src={logo} alt="Owner's logo"/> : <img className="uc-header-logo uc-default-logo" src={d.mode === "dark" ? "/assets/hellocuff-logo-dark.svg" : "/assets/hellocuff-logo.svg"} alt="HelloCuff" width="160" height="38"/>}</a></header>
      {fontFailed&&preview&&<p className="uc-font-notice" role="status">The selected font could not load. A readable fallback is shown; your selection is retained. <button type="button" onClick={retryFont}>Retry selected font</button></p>}
      <div className="uc-page-center">
      <article
        className="dp-contact uc-contact"
        data-theme={d.theme}
        data-color={d.color}
        data-appearance={d.mode}
        style={branding === "none" ? { fontFamily: font } : undefined}
        aria-label={preview ? "Your card preview" : "Contact card"}
      >
        <div className="dp-card-masthead uc-card-accent" aria-hidden="true"/>
        <div className="dp-identity">
          {photo && (
            <img
              className="uc-avatar"
              src={photo}
              width="96"
              height="96"
              alt="Profile portrait"
            />
          )}
          <h2>{c.name || "Your name"}</h2>
          {c.title && <p className="dp-title">{c.title}</p>}
          {c.company && <p className="dp-company">{c.company}</p>}
        </div>
        {c.bio && <p className="dp-bio uc-bio">{c.bio}</p>}
        <dl className="dp-details">
          {c.phone && (
            <div>
              <dt><span className="sr-only">Phone</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A18 18 0 0 1 3 5c0-1 1-2 2-2Z"/></svg></dt>
              <dd>
                <a href={`tel:${c.phone}`}>{formatUsPhone(c.phone)}</a>
              </dd>
            </div>
          )}
          {c.publicEmail && (
            <div>
              <dt><span className="sr-only">Email</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18v14H3z M3 5l9 8 9-8"/></svg></dt>
              <dd>
                <a href={`mailto:${encodeURIComponent(c.publicEmail)}`}>
                  {c.publicEmail}
                </a>
              </dd>
            </div>
          )}
          {safeWebsite && urlOK(safeWebsite) && (
            <div>
              <dt><span className="sr-only">Website</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></svg></dt>
              <dd>
                <a href={safeWebsite} rel="noopener noreferrer">
                  {c.website.replace(/^https:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <div className="dp-actions">
          <button
            className="dp-save"
            disabled={busy || !c.name.trim()}
            onClick={() => {
              setBusy(true);
              setStatus("");
              void onDownload()
                .catch((e) => setStatus(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Preparing contact..." : "Save my contact"}
          </button>
          {d.ctaLabel && safeCta && urlOK(safeCta) && (
            <a
              className="dp-link uc-cta"
              target="_blank"
              href={safeCta}
              rel="noopener noreferrer"
            >
              {d.ctaLabel}
            </a>
          )}
          {status && (
            <p className="dp-sample-link" role="status">
              {status}
            </p>
          )}
        </div>
      </article>
      <p className="uc-powered">Powered by <a href="/">HelloCuff</a></p>{footer}
      </div>
    </div>
  );
}
