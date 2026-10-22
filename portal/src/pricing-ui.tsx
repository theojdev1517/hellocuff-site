import { useId, useState } from "react";
import { AppLink } from "./navigation";
import { FaqList, useSalesMeta } from "./sales-ui";
import {
  displayUsd,
  faqs,
  futurePlanPrices,
  productOffer,
} from "./sales-content";
import "./pricing.css";
import { defaults, type Config } from "../functions/uat-contract.mjs";

export function PricingPage({
  signedIn,
  simulation = false,
  onSelect,
  config,
}: {
  signedIn: boolean;
  simulation?: boolean;
  config?: Config;
  onSelect?: (s: {
    plan: "free" | "standard" | "pro";
    interval: "monthly" | "annual";
    backup: boolean;
  }) => void;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const cycleName = useId();
  const rates =
    simulation && config
      ? futurePlanPrices.map((p) => ({
          ...p,
          monthlyCents: config.plans[p.id].monthlyCents,
          annualCents: config.plans[p.id].annualCents,
        }))
      : futurePlanPrices;
  useSalesMeta(
    "HelloCuff Pricing — Your cuff and contact card",
    "Explore the $24.99 HelloCuff bracelet, Free contact profile and upcoming Standard and Pro plans.",
  );
  return (
    <main
      className="pricing-page sales-container"
      id="main-content"
      tabIndex={-1}
    >
      <section className="pricing-intro" aria-labelledby="pricing-title">
        <p className="sales-eyebrow">Your cuff. Your card.</p>
        <h1 id="pricing-title">Pricing</h1>
        <p className="sales-lead">Start with the essentials.</p>
        <p>
          One bracelet to share your link. A contact profile you can make your
          own.
        </p>
      </section>

      <section
        className="pricing-bracelet"
        aria-labelledby="bracelet-offer-title"
      >
        <div>
          <p className="sales-eyebrow">The bracelet</p>
          <h2 id="bracelet-offer-title">Your next hello, on your wrist.</h2>
          <p>Wear it. Tap it. Say hello.</p>
        </div>
        <div className="pricing-bracelet-price">
          <p className="sales-price-label">One-time bracelet purchase</p>
          <p className="pricing-amount">
            {simulation && config
              ? displayUsd(config.braceletCents)
              : productOffer.price}
          </p>
          <p className="sales-shipping">{productOffer.shipping}</p>
        </div>
      </section>

      <section aria-labelledby="profile-plans-title" className="pricing-plans">
        <div className="pricing-plan-heading">
          <div>
            <p className="sales-eyebrow">The profile</p>
            <h2 id="profile-plans-title">Make it yours with Free.</h2>
          </div>
          <p>Your contact details, your style, one place to say hello.</p>
        </div>
        <fieldset className="pricing-selector">
          <legend>Billing period</legend>
          <div className="pricing-segments">
            {(["monthly", "annual"] as const).map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name={cycleName}
                  value={option}
                  checked={cycle === option}
                  onChange={() => setCycle(option)}
                />
                <span>{option === "monthly" ? "Monthly" : "Annual"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="pricing-plan-grid">
          <article
            className="pricing-plan pricing-free"
            aria-labelledby="free-plan-title"
          >
            <div className="pricing-plan-top">
              <h3 id="free-plan-title">Free</h3>
              <span className="pricing-status pricing-current">
                Available now
              </span>
            </div>
            <div className="pricing-plan-rate">
              <p className="pricing-amount">$0</p>
              <p className="pricing-free-promise">
                Free forever.
                <br />
                No subscription required.
              </p>
              <p>Contact card and hosting</p>
            </div>
            <ul>
              <li>One editable contact profile</li>
              <li>Your contact details, website and short bio</li>
              <li>Optional profile photo</li>
              <li>Preset colors and light or dark card styles</li>
              <li>A stable card link and contact-file download</li>
            </ul>
            <AppLink
              className="sales-button"
              to={
                simulation
                  ? "/app/plans"
                  : signedIn
                    ? "/app/profile"
                    : "/app/signup"
              }
            >
              {signedIn ? "Go to your card" : "Start with Free"}
              <span aria-hidden="true">↗</span>
            </AppLink>
          </article>
          {rates.map((plan) => (
            <article
              className="pricing-plan pricing-future"
              key={plan.id}
              id={`pricing-${plan.id}`}
              aria-labelledby={`${plan.id}-plan-title`}
            >
              <div className="pricing-plan-top">
                <h3 id={`${plan.id}-plan-title`}>{plan.name}</h3>
                <span className="pricing-status">
                  {simulation ? "Explore in UAT" : "Coming soon"}
                </span>
              </div>
              <div
                className="pricing-plan-rate"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="pricing-amount">
                  {displayUsd(
                    cycle === "monthly" ? plan.monthlyCents : plan.annualCents,
                  )}
                  <span>{cycle === "monthly" ? "/ month" : "/ year"}</span>
                </p>
                <p>
                  {cycle === "monthly"
                    ? "Billed monthly."
                    : "Prepaid; billed annually."}
                </p>
                {cycle === "annual" && (
                  <p className="pricing-savings">
                    Save {displayUsd(plan.monthlyCents * 12 - plan.annualCents)}{" "}
                    versus 12 monthly payments.
                  </p>
                )}
              </div>
              <ul>
                <li>
                  Ten preset colors, six personality themes and light/dark
                </li>
                <li>One extra custom action button</li>
                {plan.id === "standard" ? (
                  <li>HelloCuff header and small linked footer</li>
                ) : (
                  <>
                    <li>Your uploaded logo in the header; a small linked Powered by HelloCuff below the card</li>
                    <li>
                      Your logo, custom color and a Google Fonts selection
                    </li>
                    <li>Up to three selectable profiles</li>
                  </>
                )}
                <li>
                  Backup with your order{" "}
                  {displayUsd((config || defaults).plans[plan.id].backupCents)}
                </li>
                <li>
                  Later replacement{" "}
                  {displayUsd(
                    (config || defaults).plans[plan.id].replacementCents,
                  )}
                  , shipping included
                </li>
              </ul>
              <button
                type="button"
                disabled={
                  !simulation ||
                  !config ||
                  config.plans[plan.id].profileLimit === 0
                }
                onClick={() =>
                  onSelect?.({ plan: plan.id, interval: cycle, backup: false })
                }
                aria-label={
                  simulation
                    ? `Choose ${plan.name}`
                    : `${plan.name} - coming soon`
                }
              >
                {simulation ? `Choose ${plan.name}` : "Coming soon"}
              </button>
            </article>
          ))}
        </div>
        <p className="pricing-display-note">
          {simulation
            ? "Plans can be explored with simulated checkout in this UAT."
            : "Standard and Pro pricing is provisional."}
        </p>
      </section>
      <section
        className="pricing-questions"
        aria-labelledby="pricing-faq-title"
      >
        <div className="sales-section-heading">
          <h2 id="pricing-faq-title">Before you get started.</h2>
          <AppLink className="sales-text-link" to="/app/faq">
            Read all FAQs <span aria-hidden="true">↗</span>
          </AppLink>
        </div>
        <FaqList
          entries={faqs.filter((entry) =>
            [
              "free-hosting",
              "ordering",
              "other-plans",
              "included-profile",
            ].includes(entry.id),
          )}
        />
      </section>
    </main>
  );
}
