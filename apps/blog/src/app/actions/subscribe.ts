"use server";

import { createClient } from "@supabase/supabase-js";

import { getAllArticleSlugs } from "@/lib/source";

/**
 * Newsletter capture. Phase one is CAPTURE ONLY — nothing is sent.
 *
 * That is deliberate and it is why there is no confirmation token here: a
 * double opt-in loop exists to confirm an address before you mail it, and we
 * do not mail. When there is a first issue to send, that issue does the
 * confirming — it carries the unsubscribe link, and anyone who did not mean
 * to sign up leaves on the spot.
 *
 * The table is insert-only for the anon key (RLS: one INSERT policy, no
 * select/update/delete), verified against production on 2026-08-31: an
 * anon SELECT returns `[]` and an anon DELETE removes nothing. So the worst
 * a leaked anon key does here is add rows — it cannot read the list out.
 */

export type SubscribeState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

// Deliberately permissive. Strict address validation rejects real addresses
// (plus-tags, new TLDs, quoted locals) far more often than it catches typos,
// and the only thing we actually need to know is that there is a local part,
// an @, and a dot-bearing domain.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribe(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // The DS NewsletterForm renders a honeypot `website` field: sr-only,
  // aria-hidden, tabIndex -1. A human never fills it; naive bots do. Answer
  // exactly as we would on success — telling a bot it was detected just
  // teaches whoever wrote it to skip the field next time.
  if (typeof formData.get("website") === "string" && formData.get("website")) {
    return { status: "ok", message: "Thanks — you're on the list." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }
  // The consent box is `required` in the markup, but markup is a suggestion
  // to anyone posting the form directly, and consent is the one field whose
  // absence makes the row worthless.
  if (!formData.get("consent")) {
    return { status: "error", message: "Please tick the consent box to subscribe." };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Never claim success we cannot back: a cheerful message over a dropped
    // address is the exact failure mode that made short_link_click look
    // healthy for twenty days.
    console.error("[subscribe] SUPABASE_URL / SUPABASE_ANON_KEY missing");
    return { status: "error", message: "Signup is unavailable right now. Try again later." };
  }

  // Attribution is only worth keeping if it is true. The field arrives from
  // the client, and nothing stops a direct POST to this action carrying an
  // arbitrary string — which would quietly corrupt the one question this
  // column exists to answer ("which writing earns subscriptions"). Unknown
  // slugs are stored as null rather than rejected: the subscription is still
  // valid, only its provenance is unknown. (Review: CWE-20.)
  const claimed = String(formData.get("source_slug") ?? "").trim();
  const source_slug = claimed && getAllArticleSlugs().includes(claimed) ? claimed : null;

  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.from("subscribers").insert({ email, source_slug });

  if (error) {
    // 23505 = unique violation: this address is already subscribed. Say the
    // same thing as a fresh signup. Distinguishing them turns the form into
    // an oracle for "is this person on the list", which is a privacy leak
    // dressed up as helpfulness.
    if (error.code === "23505") {
      return { status: "ok", message: "Thanks — you're on the list." };
    }
    console.error("[subscribe] insert failed:", error.code, error.message);
    return { status: "error", message: "Something went wrong. Try again later." };
  }

  return { status: "ok", message: "Thanks — you're on the list." };
}
