import numbers from "@/data/interlace-numbers.json";
import { getCachedNpmAlltimeTotal } from "@/lib/supabase-data";

const SITE_URL = "https://ofriperetz.dev";

// Compact form for prose ("433K"), so the JSON-LD blurb doesn't churn on
// every single download while still tracking the real figure.
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

// Was a hardcoded "35K+ downloads" — 12x understated by 2026-08-26 (the real
// figure was 433,686) and injected into every page's Person schema, which is
// what search engines read. Any metric frozen into static metadata rots; this
// now comes from the same v_npm_alltime_ecosystem read the homepage, /npm and
// /scorecard use, so all four state one number.
const buildPersonSchema = (npmDownloads: number) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ofri Peretz",
  url: SITE_URL,
  image: `${SITE_URL}/ofri-profile.webp`,
  jobTitle: "Engineering Leader",
  description: `Engineering Leader & Open Source Creator. Building security-focused ESLint plugins with ${compact(npmDownloads)}+ downloads.`,
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
});

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

export async function StructuredData() {
  // Degrade to omitting the claim rather than 500-ing the whole layout, and
  // never fall back to a stale literal — a wrong number in schema.org markup
  // is worse than no number.
  let npmDownloads: number | null = null;
  try {
    npmDownloads = await getCachedNpmAlltimeTotal();
  } catch (err) {
    console.error("[structured-data] npm total", err);
  }
  const personSchema = buildPersonSchema(npmDownloads ?? 0);
  if (!npmDownloads) {
    personSchema.description =
      "Engineering Leader & Open Source Creator. Building security-focused ESLint plugins.";
  }
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
