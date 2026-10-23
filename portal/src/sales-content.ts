export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  featured?: boolean;
}

// Content shared by the sales homepage and public FAQ. Commercial terms beyond
// the owner-approved display price/shipping headline remain deliberately unset.
export const productOffer = {
  price: "$24.99",
  shipping: "Free Shipping",
};

// Proposed future display prices recovered from the owner's October 19 ideas.
// These values are not billing products, entitlements or active subscriptions.
export const futurePlanPrices = [
  { id: "standard", name: "Standard", monthlyCents: 199, annualCents: 1999 },
  { id: "pro", name: "Pro", monthlyCents: 499, annualCents: 4999 },
] as const;

export const displayUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const faqs: FaqEntry[] = [
  {
    id: "what-is-hellocuff",
    question: "What is HelloCuff?",
    answer:
      "HelloCuff is a business card for your wrist: a bracelet linked to your own online contact card. Your card brings the details you choose to share into one place.",
    featured: true,
  },
  {
    id: "how-sharing-works",
    question: "How does sharing work?",
    answer:
      "A tap opens the bracelet's link in a browser. Your visitor can view your public card and download a contact file using Save contact. You can also share your card's link directly.",
  },
  {
    id: "recipient-account",
    question: "Does the other person need a HelloCuff account?",
    answer:
      "No HelloCuff account is needed to open a published card in a browser or download its contact file. An internet connection is needed to load the card. Saving the file to Contacts depends on the visitor's phone and contacts app.",
    featured: true,
  },
  {
    id: "free-hosting",
    question: "Is the Free plan really free?",
    answer: `Yes. Free forever. No subscription required. Your Free contact card and its hosting cost $0. The bracelet is a one-time ${productOffer.price} purchase with ${productOffer.shipping}. Standard and Pro are optional; your Free plan won't automatically become a paid plan.`,
    featured: true,
  },
  {
    id: "included-profile",
    question: "What can I put on my card?",
    answer:
      "Your card comes with one editable contact profile with your name, company, title, phone number, email, website, short bio, and a photo. Only the name is required; you decide which other fields you want to share.",
  },
  {
    id: "update-details",
    question: "Can I change my details later?",
    answer:
      "Yes. Sign in, edit your card, then save and publish your changes. Your card keeps the same link when its details change, so those edits do not require a different bracelet link.",
    featured: true,
  },
  {
    id: "saved-contacts",
    question: "Will changes update contacts someone has already saved?",
    answer:
      "No. Updates appear on your public card and in future contact downloads. Saved contacts do not automatically sync. Visitors can return to your card to download your latest details.",
    featured: true,
  },
  {
    id: "public-details",
    question: "Which information is public?",
    answer:
      "You choose the details and photo on your published card. Anyone with its link can view and download that published information. Saved drafts stay private until you publish.",
    featured: true,
  },
  {
    id: "unpublish-card",
    question: "Can I take my card offline?",
    answer:
      "Yes. You can unpublish your card so it is no longer available to visitors through HelloCuff. This cannot recall information or photos that someone has already downloaded or copied.",
  },

];

export const examplePerson = {
  name: "Morgan Rivera",
  company: "Example Studio",
  title: "Designer & creative collaborator",
  email: "morgan@example.com",
  website: "example.com",
  bio: "Good ideas start with a hello. Let's make something thoughtful together.",
};
