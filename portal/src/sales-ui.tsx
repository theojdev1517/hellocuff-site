import { useEffect } from "react";
import { AppLink } from "./navigation";
import {
  examplePerson,
  faqs,
  productOffer,
  type FaqEntry,
} from "./sales-content";
import "./sales.css";

type SalesProps = { signedIn: boolean };

export function useSalesMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const meta = existing ?? document.createElement("meta");
    const previousDescription = meta.content;
    if (!existing) {
      meta.name = "description";
      document.head.append(meta);
    }
    document.title = title;
    meta.content = description;
    return () => {
      document.title = previousTitle;
      if (existing) meta.content = previousDescription;
      else meta.remove();
    };
  }, [title, description]);
}

function NextStep({
  signedIn,
  className = "",
}: SalesProps & { className?: string }) {
  return (
    <AppLink
      className={`sales-button ${className}`}
      to={signedIn ? "/app/profile" : "/app/plans"}
    >
      {signedIn ? "Go to your card" : "Sign Up"}
      <span aria-hidden="true">↗</span>
    </AppLink>
  );
}

export function FaqList({ entries }: { entries: FaqEntry[] }) {
  return (
    <div className="sales-faq-list">
      {entries.map((entry) => (
        <details key={entry.id} id={entry.id}>
          <summary>
            {entry.question}
            <span aria-hidden="true">+</span>
          </summary>
          <p>{entry.answer}</p>
        </details>
      ))}
    </div>
  );
}

function ExampleCard() {
  return (
    <figure
      className="sales-example"
      id="example-card"
      aria-labelledby="example-caption"
    >
      <figcaption id="example-caption" className="sr-only">Example contact card</figcaption>
      <div className="sales-example-card">
        <div className="sales-example-cover">
          <span>Say hello.</span>
          <img src="/assets/hellocuff-icon.svg" alt="" width="42" height="42" />
        </div>
        <div className="sales-avatar" aria-hidden="true">
          MR
        </div>
        <div className="sales-example-copy">
          <p className="sales-example-name">{examplePerson.name}</p>
          <p className="sales-example-title">
            {examplePerson.title}
            <br />
            {examplePerson.company}
          </p>
          <p>{examplePerson.bio}</p>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{examplePerson.email}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>{examplePerson.website}</dd>
            </div>
          </dl>
          <p className="sales-example-note">
            Your details. Your style. One place to say hello.
          </p>
        </div>
      </div>
    </figure>
  );
}

function CuffIllustration() {
  return (
    <div
      className="sales-cuff"
      role="img"
      aria-label="Illustration of a bracelet linking to an online contact card"
    >
      <svg viewBox="0 0 240 150" aria-hidden="true" focusable="false">
        <ellipse
          cx="115"
          cy="81"
          rx="88"
          ry="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="27"
        />
        <ellipse
          cx="115"
          cy="70"
          rx="88"
          ry="46"
          fill="none"
          stroke="#426cfa"
          strokeWidth="25"
        />
        <path
          d="M48 45c22-21 72-26 111-10"
          fill="none"
          stroke="#a9c8ff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect
          x="86"
          y="16"
          width="57"
          height="44"
          rx="14"
          fill="#142d55"
          transform="rotate(8 114 38)"
        />
        <path
          d="M108 29q8 8 0 16m7-20q12 12 0 24m7-28q16 16 0 32"
          fill="none"
          stroke="#b9deff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M193 33q9 9 0 18m8-24q15 15 0 30"
          fill="none"
          stroke="#275efe"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span>Bracelet illustration</span>
    </div>
  );
}

export function HomePage({ signedIn }: SalesProps) {
  useSalesMeta(
    "HelloCuff — A business card for your wrist",
    "Meet HelloCuff: a bracelet linked to an editable contact card. See how it works, explore a contact card and find answers to your questions.",
  );
  return (
    <main className="sales-home" id="main-content" tabIndex={-1}>
      <section
        className="sales-hero sales-container"
        aria-labelledby="sales-title"
      >
        <div className="sales-hero-copy">
          <p className="sales-eyebrow">A business card for your wrist</p>
          <h1 id="sales-title">
            Your next hello,
            <br />
            <span>just a tap away.</span>
          </h1>
          <p className="sales-lead">
            You make the introduction.
            <br />
            HelloCuff helps you share the details.
          </p>
          <p className="sales-intro">
            A bracelet linked to your own contact card. Share who you are, give
            people a way to stay in touch, and keep your public details up to
            date.
          </p>
          <div className="sales-free-promise">
            <p>Free forever. No subscription required.</p>
            <span>Your Free contact card and hosting.</span>
          </div>
          <div className="sales-hero-actions">
            <a className="sales-button" href="#how-it-works">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <CuffIllustration />
        </div>
        <ExampleCard />
      </section>

      <section
        className="sales-how"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="sales-container">
          <p className="sales-eyebrow">From hello to staying in touch</p>
          <h2 id="how-title">A simple way to share.</h2>
          <ol className="sales-steps">
            <li>
              <span className="sales-step-number">01</span>
              <h3>Make it yours.</h3>
              <p>
                Add the details you want to share, choose your card's style and
                publish when you are ready.
              </p>
            </li>
            <li>
              <span className="sales-step-number">02</span>
              <h3>Make the connection.</h3>
              <p>
                A tap opens your bracelet's link. You can share the link directly, too.
              </p>
            </li>
            <li>
              <span className="sales-step-number">03</span>
              <h3>Keep the conversation going.</h3>
              <p>
                Your visitor can view your card and download your contact
                details. No HelloCuff account is needed to view a published
                card.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section
        className="sales-benefits sales-container"
        aria-labelledby="benefits-title"
      >
        <div>
          <p className="sales-eyebrow">More room for you</p>
          <h2 id="benefits-title">
            Your details can change.
            <br />
            Your card's link stays.
          </h2>
        </div>
        <div className="sales-benefit-grid">
          <article>
            <span aria-hidden="true">↗</span>
            <h3>Share the useful things.</h3>
            <p>
              Bring your name, work, phone, public email, website, short bio and
              optional photo into one contact card.
            </p>
          </article>
          <article>
            <span aria-hidden="true">↻</span>
            <h3>Keep your page current.</h3>
            <p>
              Edit, save and publish new details using the same link. Previously
              downloaded contacts remain separate copies.
            </p>
          </article>
          <article>
            <span aria-hidden="true">✓</span>
            <h3>Choose what you show.</h3>
            <p>
              Preview a private draft and publish when you’re ready. You can unpublish your card later.
            </p>
          </article>
        </div>
      </section>

      <section
        className="sales-offer sales-container"
        aria-labelledby="offer-title"
      >
        <div className="sales-offer-copy">
          <p className="sales-eyebrow">Start with the essentials</p>
          <h2 id="offer-title">
            One cuff.
            <br />A card that's yours.
          </h2>
        </div>
        <div className="sales-offer-action">
          <p className="sales-price-label">One-time bracelet purchase</p>
          <p className="sales-price">{productOffer.price}</p>
          <p className="sales-shipping">{productOffer.shipping}</p>
          <NextStep signedIn={signedIn} />
        </div>
      </section>

      <section
        className="sales-faq sales-container"
        aria-labelledby="home-faq-title"
      >
        <div className="sales-section-heading">
          <div>
            <p className="sales-eyebrow">A few things you might be wondering</p>
            <h2 id="home-faq-title">Good questions.</h2>
          </div>
          <AppLink className="sales-text-link" to="/app/faq">
            Read all FAQs <span aria-hidden="true">↗</span>
          </AppLink>
        </div>
        <FaqList entries={faqs.filter((entry) => entry.featured)} />
      </section>

      <section
        className="sales-closing sales-container"
        aria-labelledby="closing-title"
      >
        <p className="sales-eyebrow">Wear it. Tap it. Say hello.</p>
        <h2 id="closing-title">
          Give your next hello
          <br />
          somewhere to go.
        </h2>
        <NextStep signedIn={signedIn} />
        <p>Set up your profile. Choose what you share.</p>
      </section>
    </main>
  );
}

export function FaqPage({ signedIn }: SalesProps) {
  useSalesMeta(
    "HelloCuff FAQ — How your contact card works",
    "Answers about sharing, editing, privacy and saving a HelloCuff contact card, plus current ordering availability.",
  );
  return (
    <main
      className="sales-faq-page sales-container"
      id="main-content"
      tabIndex={-1}
    >
      <div className="sales-faq-intro">
        <p className="sales-eyebrow">A little more about HelloCuff</p>
        <h1>FAQ</h1>
        <p className="sales-lead">
          Good questions.
          <br />
          Straightforward answers.
        </p>
        <p>
          How the card works, what you can share, and what to expect before
          getting started.
        </p>
      </div>
      <section className="sales-why"><h2>Why HelloCuff?</h2><p>A paper business card is easy to misplace, and printed details stay frozen even when your work changes. HelloCuff puts your introduction on your wrist and your current details one tap away.</p><p>Share your contact information, website and next step in one place. Update your page instead of printing another stack. Keep the conversation moving after the first hello.</p></section><FaqList entries={faqs} />
      <div className="sales-faq-next">
        <h2>Your card starts with you.</h2>
        <NextStep signedIn={signedIn} />
      </div>
    </main>
  );
}
