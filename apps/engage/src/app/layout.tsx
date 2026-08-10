import type { Metadata } from "next";
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
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
