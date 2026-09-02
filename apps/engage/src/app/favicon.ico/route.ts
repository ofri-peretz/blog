import { redirect } from "next/navigation";

/**
 * Browsers probe /favicon.ico regardless of the <link rel="icon"> we declare,
 * so the app served a 404 on every page load. The icon itself was never broken
 * — `app/icon.svg` renders correctly in the tab — but a permanent 404 in the
 * console is exactly the kind of harmless-looking noise that trains you to
 * ignore the console, and this app's whole job is surfacing real problems.
 *
 * A redirect rather than a duplicated binary: one icon, one source.
 */
export function GET(): never {
  redirect("/icon.svg");
}
