/**
 * Newsletter capture locks.
 *
 * The promises this feature makes: an address is only stored with recorded
 * consent, the form never claims success it did not achieve, it never becomes
 * an oracle for who is already subscribed, and the anon key it runs on can
 * add a subscriber but never read the list back.
 *
 * The RLS half is verified against production separately (an anon SELECT
 * returns [] and an anon DELETE removes nothing, checked 2026-08-31) — a
 * database policy cannot be asserted from a unit test, so what is pinned here
 * is the code that depends on it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(path.resolve(SRC, rel), "utf-8");

const ACTION = read("app/actions/subscribe.ts");
const COMPONENT = read("components/article-subscribe.tsx");

describe("consent is not optional", () => {
  it("rejects a submission with no consent field, whatever the markup said", () => {
    // `required` on the checkbox is advice to a browser, not a constraint on
    // anyone POSTing the action directly.
    expect(ACTION).toMatch(/if \(!formData\.get\("consent"\)\)/);
  });

  it("stores WHEN consent happened, not merely that it did", () => {
    // consent_at is defaulted by the table; the action must not invent its
    // own value or the column stops meaning "the moment they agreed".
    expect(ACTION).not.toContain("consent_at");
  });
});

describe("the form never lies about what happened", () => {
  it("a missing database config is an error, never a cheerful success", () => {
    // The short_link_click outage was twenty days of exactly this shape: a
    // correct-looking response over a dropped write.
    expect(ACTION).toMatch(/if \(!url \|\| !key\)/);
    expect(ACTION).toMatch(/status: "error"[\s\S]{0,120}unavailable/);
  });

  it("an insert failure is surfaced, not swallowed", () => {
    expect(ACTION).toMatch(/if \(error\)/);
    expect(ACTION).toContain('status: "error"');
  });

  it("the success event fires on a settled OK, never on submit", () => {
    expect(COMPONENT).toMatch(/state\.status === "ok"[\s\S]{0,200}newsletter:subscribe/);
    // Once per mount — a re-render must not re-count a subscriber.
    expect(COMPONENT).toContain("fired.current = true");
  });
});

describe("the form is not an oracle", () => {
  it("an already-subscribed address gets the same answer as a new one", () => {
    // 23505 is the unique violation. Answering differently would let anyone
    // test whether a given person is on the list.
    expect(ACTION).toContain('error.code === "23505"');
    const dupBranch = ACTION.slice(ACTION.indexOf('error.code === "23505"'));
    expect(dupBranch).toMatch(/status: "ok"/);
  });

  it("a filled honeypot is answered exactly like a success", () => {
    // Telling a bot it was caught teaches whoever wrote it to skip the field.
    const honeypot = ACTION.slice(ACTION.indexOf('formData.get("website")'));
    expect(honeypot.slice(0, 400)).toMatch(/status: "ok"/);
  });
});

describe("the DS owns the form, the app owns the destination", () => {
  it("renders the vendored DS component rather than an app-local form", () => {
    expect(COMPONENT).toContain('from "@/components/ui/newsletter-form"');
    // NewsletterForm renders its own form element; wrapping it in another
    // would nest them and browsers drop the inner one. Assert on CODE, not
    // prose — the first version of this line matched the comment above it
    // explaining the rule, which is a lock that can never fail.
    const code = COMPONENT.split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(code).not.toMatch(/<form[\s>]/);
    expect(COMPONENT).toContain("action={formAction}");
  });

  it("the vendored chain is under drift watch", () => {
    const drift = readFileSync(
      path.resolve(SRC, "../../../scripts/check-vendored-drift.mjs"),
      "utf-8",
    );
    for (const file of [
      "components/ui/newsletter-form.tsx",
      "components/ui/form.tsx",
      "components/ui/input.tsx",
      "components/ui/checkbox.tsx",
      "components/ui/button.tsx",
      "components/ui/stack.tsx",
    ]) {
      expect(drift, `${file} is vendored but unwatched`).toContain(`"${file}"`);
      expect(read(file)).toContain("VENDORED from the Interlace DS");
    }
  });

  it("records which article earned the subscription", () => {
    expect(ACTION).toContain("source_slug");
    expect(COMPONENT).toContain('formData.set("source_slug", currentSlug)');
  });

  it("only stores an attribution slug it can verify", () => {
    // The field arrives from the client; a direct POST can claim anything.
    // Unverified attribution is worse than none, because it looks like data.
    expect(ACTION).toContain("getAllArticleSlugs()");
    expect(ACTION).toMatch(/getAllArticleSlugs\(\)\.includes\(claimed\)/);
    // Unknown slug degrades to null — the subscription still stands, only its
    // provenance is unknown.
    expect(ACTION).toMatch(/\? claimed\s*:\s*null/);
  });
});
