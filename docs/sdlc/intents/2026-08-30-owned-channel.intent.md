---
kind: intent
slug: 2026-08-30-owned-channel
opened: 2026-08-30
status: open
---

# Intent: be able to reach a reader twice

## What

Capture email addresses on the blog, so that a reader who liked something has
a way to hear from us again — and we have a way to reach them that does not
belong to another company.

## Why now

Because it is the largest structural gap in the entire funnel, and it has been
open the whole time. There is no email capture anywhere on the property.

Around 145 people read the blog in August and averaged 1.16 pages each. They
arrive, read one thing, and leave, and nothing we own records that they were
ever here. Dev.to followers belong to Dev.to. npm downloads are anonymous by
construction — roughly 29,000 a month that tell us nothing about who. Every
channel we currently have is rented.

This also gates the commercial argument. A paid layer for organisations needs
people to talk to when it exists; a list built slowly starting now is worth
far more than a launch announcement with nobody to send it to.

## Constraints

- **An address is a promise.** Confirmed opt-in, an unsubscribe that works
  from the first email, and a plain statement of what we will send and how
  often. Anything less and the asset is worthless anyway.
- No third-party marketing script on the page. Our CSP and header contract is
  part of the deploy, and a tag manager is not going into it for this.
- UI ships from the Interlace DS first; the blog consumes. No app-local
  authoring without a reason.
- No inline `style={{…}}`; Tailwind classes with bracket syntax for arbitrary
  values.
- Personal data may never ride in a URL or query string.

## How we will know it worked

- **Tier 2, count:** confirmed subscribers, as an absolute number. First
  milestone is simply above zero; the honest second milestone is 25.
- **Tier 4, quality:** confirmation rate — of addresses submitted, the share
  that complete double opt-in. A collapse there means the offer is unclear or
  the confirmation mail is landing in spam, and both are fixable.

Counts, not rates, on the primary metric: at 145 readers a month a conversion
percentage would swing wildly on single-digit changes.

## Not doing

- **Not choosing a sending provider yet.** The asset is the list; the tool
  that mails it is a later, reversible decision. Buying an ESP before there
  are subscribers is buying a pipeline for water we do not have.
- No popup, no interstitial, no exit-intent modal. They would earn more
  addresses and cost more trust than they are worth on a site whose entire
  argument is that we do careful work.
- Not sending anything yet. Capture first; the first issue is its own intent.
