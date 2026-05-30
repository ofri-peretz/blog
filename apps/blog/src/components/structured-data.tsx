const SITE_URL = "https://ofriperetz.dev";

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ofri Peretz",
  url: SITE_URL,
  image: `${SITE_URL}/ofri-profile.webp`,
  jobTitle: "Engineering Leader",
  description:
    "Engineering Leader & Open Source Creator. Building security-focused ESLint plugins with 35K+ downloads.",
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
    "A collection of 18+ production-ready ESLint plugins with 332 security rules designed for the AI/Agentic era.",
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
