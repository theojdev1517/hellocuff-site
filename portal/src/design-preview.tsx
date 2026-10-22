import { useState, type CSSProperties } from "react";
import { useSalesMeta } from "./sales-ui";
import "./design-preview.css";

export const themes = [
  ["professional", "Professional"],
  ["minimal", "Minimal"],
  ["playful", "Playful"],
  ["backstage", "Backstage"],
  ["industrial", "Industrial"],
  ["retro", "Retro"],
] as const;
type Theme = (typeof themes)[number][0];
export const colors = [
  {
    id: "blue",
    name: "Blue",
    accent: "#2347bd",
    tint: "#e7edff",
    glow: "#abc4ff",
  },
  {
    id: "teal",
    name: "Teal",
    accent: "#09665e",
    tint: "#def5ef",
    glow: "#88dfd1",
  },
  {
    id: "green",
    name: "Green",
    accent: "#246535",
    tint: "#e4f3e4",
    glow: "#a1dfa7",
  },
  {
    id: "purple",
    name: "Purple",
    accent: "#6d35a2",
    tint: "#f0e6ff",
    glow: "#d3adff",
  },
  {
    id: "red",
    name: "Red",
    accent: "#a52a3a",
    tint: "#ffe7e9",
    glow: "#ffafb9",
  },
  {
    id: "orange",
    name: "Orange",
    accent: "#a34313",
    tint: "#fff0df",
    glow: "#ffc18b",
  },
  {
    id: "gold",
    name: "Gold",
    accent: "#785a05",
    tint: "#fff4ce",
    glow: "#f5d978",
  },
  {
    id: "pink",
    name: "Pink",
    accent: "#a02d6b",
    tint: "#ffe4f2",
    glow: "#ffb4dc",
  },
  {
    id: "slate",
    name: "Slate",
    accent: "#3c5064",
    tint: "#e7edf4",
    glow: "#b8c9dd",
  },
  {
    id: "neutral",
    name: "Neutral",
    accent: "#4c4b47",
    tint: "#efede7",
    glow: "#d7d2c6",
  },
] as const;
type Color = (typeof colors)[number]["id"];

const sample = {
  name: "Morgan Rivera",
  title: "Designer & creative collaborator",
  company: "Example Studio",
  phone: "+1 (202) 555-0147",
  email: "morgan@example.com",
  website: "example.com",
  bio: "Good ideas start with a hello. Let's make something thoughtful together.",
};

function saveSampleContact() {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "UID:urn:hellocuff:design-preview:morgan-rivera",
    `FN:${escape(sample.name)}`,
    "N:Rivera;Morgan;;;",
    `TITLE:${escape(sample.title)}`,
    `ORG:${escape(sample.company)}`,
    "TEL;TYPE=CELL:+12025550147",
    `EMAIL;TYPE=INTERNET:${sample.email}`,
    `URL:https://${sample.website}`,
    `NOTE:${escape(sample.bio)}`,
    "END:VCARD",
    "",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([vcf], { type: "text/vcard;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "morgan-rivera-example.vcf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DesignIcon({ kind }: { kind: "download" | "outbound" | "sparkle" }) {
  const path =
    kind === "download"
      ? "M12 3v12m-5-5 5 5 5-5M5 18v3h14v-3"
      : kind === "outbound"
        ? "M7 17 17 7M7 7h10v10"
        : "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z";
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

export function DesignPreviewPage() {
  useSalesMeta(
    "HelloCuff — Design playground",
    "Explore six contact-card personalities with independent colors and light or dark appearance.",
  );
  const [theme, setTheme] = useState<Theme>("professional");
  const [color, setColor] = useState<Color>("blue");
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [showSampleLink, setShowSampleLink] = useState(false);
  const palette = colors.find((item) => item.id === color) ?? colors[0];
  const themeName = themes.find(([id]) => id === theme)![1];
  const style = {
    "--dp-accent": palette.accent,
    "--dp-tint": palette.tint,
    "--dp-glow": palette.glow,
  } as CSSProperties;
  return (
    <main className="dp-page" id="main-content" tabIndex={-1}>
      <div className="dp-intro">
        <p className="dp-eyebrow">Find your kind of hello</p>
        <h1>Design playground</h1>
        <p>Pick a personality. Choose a color. See it in light or dark.</p>
      </div>
      <div className="dp-layout">
        <section className="dp-controls" aria-label="Preview controls">
          <label htmlFor="design-theme">Theme</label>
          <select
            id="design-theme"
            value={theme}
            onChange={(event) => {
              const value = event.target.value;
              if (themes.some(([id]) => id === value)) setTheme(value as Theme);
            }}
          >
            {themes.map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
          <label htmlFor="design-color">Color</label>
          <select
            id="design-color"
            value={color}
            onChange={(event) => {
              const value = event.target.value;
              if (colors.some((item) => item.id === value))
                setColor(value as Color);
            }}
          >
            {colors.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <fieldset className="dp-appearance">
            <legend>Appearance</legend>
            {(["light", "dark"] as const).map((value) => (
              <label key={value}>
                <input
                  name="design-appearance"
                  type="radio"
                  value={value}
                  checked={appearance === value}
                  onChange={() => setAppearance(value)}
                />
                {value === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <p className="dp-selection" role="status" aria-live="polite">
            {themeName} · {palette.name} ·{" "}
            {appearance === "light" ? "Light" : "Dark"}
          </p>
          <p className="dp-caption">
            Fictional contact. Selections stay in this playground.
          </p>
        </section>
        <div className="dp-stage" data-appearance={appearance} style={style}>
          <article
            className="dp-contact"
            aria-label="Fictional contact card"
            data-theme={theme}
            data-color={color}
            data-appearance={appearance}
          >
            <div className="dp-card-masthead" aria-hidden="true">
              <span className="dp-mark">MR</span>
              <span className="dp-masthead-word">Hello.</span>
              <span className="dp-decoration">
                <DesignIcon kind="sparkle" />
              </span>
            </div>
            <div className="dp-identity">
              <p className="dp-kicker">Let's make a connection</p>
              <h2>{sample.name}</h2>
              <p className="dp-title">{sample.title}</p>
              <p className="dp-company">{sample.company}</p>
            </div>
            <p className="dp-bio">{sample.bio}</p>
            <dl className="dp-details">
              <div>
                <dt>Phone</dt>
                <dd>{sample.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{sample.email}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{sample.website}</dd>
              </div>
            </dl>
            <div className="dp-actions">
              <button
                type="button"
                className="dp-save"
                onClick={saveSampleContact}
              >
                Save my contact <DesignIcon kind="download" />
              </button>
              <button
                type="button"
                className="dp-link"
                onClick={() => setShowSampleLink((shown) => !shown)}
                aria-expanded={showSampleLink}
                aria-controls="design-sample-link"
              >
                Listen to my music <DesignIcon kind="outbound" />
              </button>
              {showSampleLink && (
                <p
                  id="design-sample-link"
                  className="dp-sample-link"
                  role="status"
                >
                  Example link: example.com/music
                </p>
              )}
            </div>
            <div className="dp-card-footer">
              <span>Powered by HelloCuff</span>
              <span>Wear it. Tap it. Say hello.</span>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
