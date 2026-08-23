import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { PostHogProvider } from "#interlace/components/analytics/posthog-provider";
import { VisitorProfileTracker } from "#interlace/components/analytics/visitor-profile-tracker";
import { ThemeProvider } from "@/components/theme-provider";
import { StructuredData } from "@/components/structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ofri Peretz — Engineering Leader & Open Source Creator",
    template: "%s — Ofri Peretz",
  },
  description:
    "Building Products That Matter • Engineering Leadership • Open-Source Contributor. Creator of the Interlace ESLint Ecosystem.",
  metadataBase: new URL("https://ofriperetz.dev"),
  alternates: {
    canonical: "https://ofriperetz.dev",
    // Feed autodiscovery. This <link rel="alternate"> in <head> — NOT a line
    // in robots.txt — is how readers and aggregators find a feed; robots.txt
    // has no field for one. Without this the feed exists but is unlisted.
    types: {
      "application/rss+xml": [
        { url: "https://ofriperetz.dev/rss.xml", title: "Ofri Peretz" },
      ],
    },
  },
  openGraph: {
    title: "Ofri Peretz — Engineering Leader & Open Source Creator",
    description:
      "Building Products That Matter • Engineering Leadership • Open-Source Contributor.",
    url: "https://ofriperetz.dev",
    siteName: "Ofri Peretz",
    locale: "en_US",
    type: "website",
    images: ["/og"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ofriperetzdev",
    creator: "@ofriperetzdev",
    images: ["/og"],
  },
  authors: [{ name: "Ofri Peretz" }],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* PostHog is the only cross-origin runtime dependency: fonts are
            self-hosted by next/font, and article covers now go through
            /_next/image (same-origin) rather than being fetched from dev.to
            by the browser. Warming the TLS handshake here saves ~100-300ms
            on the analytics request without blocking render. */}
        <link rel="preconnect" href="https://us-assets.i.posthog.com" />
        <link rel="preconnect" href="https://us.i.posthog.com" />
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <StructuredData />
        <PostHogProvider app="blog">
          <VisitorProfileTracker />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-2 focus:outline-ring"
            >
              Skip to main content
            </a>
            <AppHeader />
            <div className="flex-1">{children}</div>
            <AppFooter />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
