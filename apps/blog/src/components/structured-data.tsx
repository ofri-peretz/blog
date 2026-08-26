import numbers from "@/data/interlace-numbers.json";

const SITE_URL = "https://ofriperetz.dev";

// The description carried a hardcoded "35K+ downloads" until 2026-08-26, by
// which point the real figure was 433,686 — a 12x understatement shipped to
// search engines on every page. A download count has no business in static
// metadata: it rots the moment it is written. Reading it live was worse — it
// put a Supabase round-trip in the request path of EVERY page on the site,
// because this renders in the root layout, all to decorate a blurb. The claim
// is simply gone. Downloads are stated where they are measured and refreshed:
// the homepage impact card, /npm, and /scorecard, all on v_npm_alltime_ecosystem.
const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ofri Peretz",
  url: SITE_URL,
  image: `${SITE_URL}/ofri-profile.webp`,
  jobTitle: "Engineering Leader",
  description:
    "Engineering Leader & Open Source Creator. Building security-focused ESLint plugins.",
  worksFor: {
    "@type": "Organization",
    name: "Snappy",
    url: "https://snappy.com",
  },
  sameAs: [
    "https://github.com/ofri-peretz",
    "https://x.com/ofriperetzdev",
    "https://www.linkedin.com/in/ofri-peretz/",
    "https://dev.to/ofri-peretz",
    "https://medium.com/@ofriperetzdev",
  ],
  knowsAbout: [
    "TypeScript",
    "JavaScript",
    "ESLint",
    "Application Security",
    "React",
    "Node.js",
    "Engineering Leadership",
    "Open Source Software",
    "AI-Native Development",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ofri Peretz",
  alternateName: "ofriperetz.dev",
  url: SITE_URL,
  description:
    "Personal portfolio of Ofri Peretz — Engineering Leader & Open Source Creator",
  author: { "@type": "Person", name: "Ofri Peretz" },
};

const ecosystemSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Interlace ESLint Ecosystem",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Cross-platform",
  description:
    `A collection of ${numbers.plugins.total} production-ready ESLint plugins with ${numbers.rules.total} rules designed for the AI/Agentic era.`,
  author: { "@type": "Person", name: "Ofri Peretz", url: SITE_URL },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: "https://github.com/ofri-peretz/eslint",
};

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ecosystemSchema) }}
      />
    </>
  );
}
