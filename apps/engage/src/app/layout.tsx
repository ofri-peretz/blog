import type { Metadata } from "next";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engage · control room",
  description: "Local-only DEV community control room.",
  // Declaring the apple-touch icon stops the browser probing
  // /apple-touch-icon.png by convention and 404ing on every load. Next's
  // file-based `apple-icon.*` convention only accepts png/jpg, so an SVG has to
  // be declared here. One icon file, three references — never a second copy.
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` is required: THEME_SCRIPT writes `data-theme`
    // and `.dark` onto <html> before React runs, so the server markup and the
    // pre-hydration DOM deliberately disagree.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Blocking, inline, in <head> — that is the whole point. A theme applied
          in an effect is a white flash on every load: the document paints
          Interlace light, React mounts, an effect reads localStorage, and only
          then does it repaint into the palette the reader actually chose.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        {/*
          The control room has no shared chrome — every route paints its own
          header — so the theme control lives in the layout, pinned, and is the
          one element every route inherits.
        */}
        <div className="fixed top-3 right-3 z-50">
          <ThemeSwitcher size="sm" align="end" />
        </div>
        {children}
      </body>
    </html>
  );
}
