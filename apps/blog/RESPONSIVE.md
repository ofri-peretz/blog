# Responsiveness & contrast

How this site stays correct at every viewport, and how that is enforced rather
than hoped for.

## The problem with "test responsiveness"

You cannot prove a layout is correct without a layout engine. jsdom — what the
unit tests run in — returns zeros from `getBoundingClientRect`, so no unit test
can ever detect that something overflows. Screenshot diffing can detect it but
tells you only "something moved", goes stale on every copy edit, and is slow.

So the strategy is split by what each tool can actually know:

| | catches | cost | when |
|---|---|---|---|
| **Static rules** (vitest) | *causes* it can name | ~2s, whole suite | every commit |
| **Browser audit** (CDP) | *outcomes*, measured | ~30s, 30 combinations | pre-merge / CI |

Statics are fast but blind to layout. The browser is slow but sees the truth.
Neither alone is enough, and using either for the other's job produces noise.

## The rules

**1. Fixed ratios must match the content's ratio.**
A fixed aspect prevents layout shift, which is why it is right — but the ratio
has to be the *content's*. `aspect-video` (1.78:1) around a 1000×420 cover
(2.38:1) silently crops 25% of it. Both cover-crop bugs on this site were this
mistake. Covers are 1000×420, so cover containers are `aspect-[1000/420]`.

**2. Nothing sizes itself to the viewport it was designed on.**
320px is the narrowest supported width. Layout is driven by container queries
and flex/grid wrapping, not by breakpoint-specific pixel values, so there is no
width "between breakpoints" where the design was never considered.

**3. Targets are at least 24×24 CSS px.**
WCAG 2.2 SC 2.5.8 (AA). A bare `text-sm` link is a 20px box, so standalone nav
links carry an explicit `min-h-6`. Links inside a sentence are exempt by spec
and are not padded.

**4. Contrast is checked on the composited surface, not the token.**
`bg-primary/10` is not `--primary` — it blends with whatever is behind it. A
palette can pass on every flat surface and still fail on its own 10% tint; that
exact bug shipped a 6.63:1 badge in the design-system repo and only axe caught
it, post-deploy. The contrast test composites alpha surfaces explicitly, and it
reads which tints to check *out of the components*, so it cannot go stale.

**5. Data pages are never statically prerendered.**
The production build runs in GitHub Actions, where `SUPABASE_URL` /
`SUPABASE_ANON_KEY` do not exist — they are Sensitive-type vars that
`vercel pull` cannot read back. A prerendered page therefore bakes an *empty*
result and `revalidate` serves it for the full TTL. `/npm` showed "No package
data available" for days against healthy data because of this. Any page reading
Supabase exports `dynamic = "force-dynamic"`; the fetchers still wrap reads in
`unstable_cache`, so the database is hit at most twice a day.

## Running it

```bash
npm test                  # static rules + contrast, ~2s
npm run audit:layout      # real browser, against localhost:3000
npm run audit:layout:prod # real browser, against production
```

The audit drives the Chrome already installed on the machine over CDP, using
node's built-in `WebSocket` (node ≥ 22). No Playwright, no puppeteer, nothing to
install. One browser launch is reused across the whole matrix, which is why 30
route×viewport combinations take ~30s rather than minutes.

It reports four classes, and exits non-zero on any of them:

- **overflow** — the document scrolling sideways, or an element past the
  viewport with no ancestor that clips or scrolls it (a wide `<table>` inside
  `overflow-x-auto` is correct and is not flagged)
- **overlap** — two *in-flow* boxes intersecting. Out-of-flow elements are
  skipped: a heading whose box sits under an absolutely-positioned rail is
  layering on purpose, and flagging it drowns the real signal
- **tap targets** — under 24×24, excluding `sr-only` controls and inline links
- **contrast** — every rendered text node against its true composited
  background, at the AA threshold for its size and weight

## Widths

`320, 360, 390, 768, 1024, 1440`

Chosen for where layout breaks, not for device marketing names: 320 is the
narrowest worth supporting, 360 the most common Android, 390 a modern iPhone,
768 the tablet-portrait boundary, 1024 small-laptop and tablet-landscape, 1440 a
large desktop. Heights are deliberately short so nothing hides below the fold.

## What is deliberately not enforced statically

Horizontal overflow. The obvious rule — flag `whitespace-nowrap` without an
escape hatch — was written, run, and deleted: it fired on ten call sites (tab
labels, badges, metric captions) while the browser audit measured zero overflow
everywhere. Whether text overflows depends on the text, the font and the
container, none of which exist without layout. A rule that is wrong ten times
out of ten gets disabled, and then it protects nothing.
