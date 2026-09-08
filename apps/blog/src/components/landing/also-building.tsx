import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionIndex } from "@/components/ui/section-index";
import { cn } from "@/lib/utils";

interface AlsoBuildingProps extends React.HTMLAttributes<HTMLElement> {
  /** 1-based position in the homepage sequence — the numbered eyebrow. */
  index: number;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

/**
 * The other two products, each given its own room.
 *
 * The homepage argues for three things now — the ESLint ecosystem above, and
 * these. They are at genuinely different stages, and the section says so
 * rather than flattening them into a matched set: Serverless ships today and
 * links to what you can install; burgee has no npm page to link, so the only
 * honest ask is a star.
 *
 * Deliberately NOT on /npm: that page is a metrics surface scoped to the
 * ESLint plugins, and a row reading "0 downloads" markets nothing. The
 * homepage is where the site argues for the work, so a pre-release product
 * belongs here — the ask is a GitHub star now, which is the only signal a
 * package can earn before its first install.
 *
 * One card per product, stacked full-width, rather than a three-up grid: at
 * this width a grid gives each product a column too narrow for the sentence
 * that explains it, and the explanation is the point. Stacking also keeps the
 * reading order identical at every breakpoint.
 */

/** A mark is optional. See `serverless` below for why it has none. */
interface Product {
  name: string;
  tagline: string;
  /** Rendered as a `Badge`; says what stage the thing is at. */
  status: string;
  statusVariant: "secondary" | "outline";
  /**
   * Set the name in mono only when the name is something you TYPE. `burgee`
   * is a command; "Interlace Serverless" is a product. Mono is also much
   * wider per character, which matters at the reflow width below.
   */
  mono?: boolean;
  mark?: { src: string; className: string };
  body: React.ReactNode;
  actions: { href: string; label: string; variant: "default" | "outline" }[];
  testId: string;
}

const PRODUCTS: Product[] = [
  {
    name: "Interlace Serverless",
    tagline: "TypeScript-first plugins for the Serverless Framework",
    status: "3 plugins live",
    statusVariant: "outline",
    /*
     * No mark, on purpose.
     *
     * The obvious candidate — `serverless-logo.svg` in that repo — is the
     * Serverless Framework's OWN bolt (#FD5750, taken from serverless.com).
     * It belongs on a "works with" badge, not standing in as the identity of
     * a product that is ours; a reader scanning marks would read it as their
     * logo on our card. Until these plugins have a mark of their own, the
     * name carries the card.
     */
    body: (
      <>
        <code className="font-mono text-sm">defineConfig</code> and typed plugin
        helpers, per-function IAM roles with strict validation, and API Gateway
        caching with flush and cleanup hooks — for Serverless Framework v4+,
        each plugin independently versioned on top of a shared devkit.
      </>
    ),
    actions: [
      {
        href: "https://serverless.interlace.tools",
        label: "Read the docs",
        variant: "default",
      },
      {
        href: "https://www.npmjs.com/package/@interlace/serverless-devkit",
        label: "View on npm",
        variant: "outline",
      },
    ],
    testId: "also-building-serverless",
  },
  {
    name: "Interlace Design System",
    tagline: "The components this site is built from",
    /*
     * Short, because `Badge` is `whitespace-nowrap shrink-0` by design — it
     * is a label, not a sentence, and it will not wrap or shrink for anyone.
     * "146 in the registry" pushed the document 43px sideways at 320px/200%
     * and took the whole flex row with it. The count still gets said, in the
     * body, where it can wrap.
     */
    status: "146 items",
    statusVariant: "outline",
    /*
     * No mark for the same reason as Serverless: the DS has no standalone
     * mark of its own yet, and borrowing the Interlace wordmark used in the
     * site chrome would read as the site's identity rather than this
     * product's.
     */
    body: (
      <>
        Not an npm dependency — a shadcn-style registry of 146 items you
        install FROM, so the component lands in your tree and stays yours to
        edit. This blog
        consumes it that way (
        <code className="font-mono text-sm">@interlace</code> →{" "}
        <code className="font-mono text-sm">ds.interlace.tools</code>), which
        is why every page here is also a working example of it.
      </>
    ),
    actions: [
      {
        href: "https://interlace.tools",
        label: "See the system",
        variant: "default",
      },
      {
        href: "https://storybook.interlace.tools",
        label: "Browse Storybook",
        variant: "outline",
      },
    ],
    testId: "also-building-design-system",
  },
  {
    name: "burgee",
    mono: true,
    tagline: "An agent-native CLI framework",
    status: "Coming soon",
    statusVariant: "secondary",
    /*
     * The mark is `burgee-flag.svg` (from the burgee repo's brand-assets,
     * which are generated by its `npm run brand`). The flag is used rather
     * than either lockup because the lockups bake in their own background
     * rect — dark or light — which would sit as a coloured block inside this
     * card in one of the two themes. The flag is transparent and reads on
     * both.
     */
    mark: { src: "/burgee-flag.svg", className: "size-16 sm:size-20" },
    body: (
      <>
        Drop-in compatible with commander and yargs, so an existing CLI keeps
        working. Declare a command once and{" "}
        <code className="font-mono text-sm">help</code>,{" "}
        <code className="font-mono text-sm">--json</code>,{" "}
        <code className="font-mono text-sm">--schema</code>,{" "}
        <code className="font-mono text-sm">--mcp</code> and shell completions
        are all projected from that single declaration — so the CLI a human
        reads is the same one an agent can call, without a second interface to
        keep in sync.
      </>
    ),
    actions: [
      {
        href: "https://github.com/ofri-peretz/burgee",
        label: "★ Star on GitHub",
        variant: "default",
      },
    ],
    testId: "also-building-burgee",
  },
];

export function AlsoBuilding({
  index,
  className,
  "data-testid": testId,
  ...rest
}: AlsoBuildingProps) {
  return (
    <Section
      data-slot="landing-also-building"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <SectionIndex value={index} data-testid="also-building-index" className="mb-3">
          Also building
        </SectionIndex>
        <div className="flex flex-col gap-6">
          {PRODUCTS.map((product) => (
            <div
              key={product.name}
              data-testid={product.testId}
              className="rounded-xl border border-border bg-card p-8 shadow-sm sm:p-10"
            >
              {/* `min-w-0` is load-bearing. A flex item will not shrink below
                  its content's min-content width by default, so a long name
                  in a card whose padding is rem-based blows the item out and
                  the DOCUMENT scrolls sideways — WCAG 1.4.10. Measured at
                  375px with text at 200%: the card's content box is ~117px
                  and "Interlace Serverless" wanted 276px, pushing the page to
                  405px. `burgee` never hit it only because it is short. */}
              <div className="flex min-w-0 flex-col items-start gap-6 sm:flex-row sm:items-center">
                {product.mark ? (
                  <Image
                    src={product.mark.src}
                    alt=""
                    width={72}
                    height={72}
                    className={cn(
                      "shrink-0 rounded-lg",
                      product.mark.className,
                    )}
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    {/* `overflow-wrap: anywhere`, not `break-words`: only
                        `anywhere` reduces the element's min-content width, and
                        min-content is what sizes a flex item. `break-words`
                        looked like it worked at 375px and still scrolled the
                        document by 43px at 320px — the audit's narrowest
                        width. Same distinction as /foundations. */}
                    <h2
                      className={cn(
                        "text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl",
                        product.mono && "font-mono",
                      )}
                    >
                      {product.name}
                    </h2>
                    <Badge variant={product.statusVariant}>
                      {product.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {product.tagline}
                  </p>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-muted-foreground">
                {product.body}
              </p>

              {/* buttonVariants sets `whitespace-nowrap`, so at 320px with text at
                  200% these labels cannot wrap and push the document sideways —
                  a WCAG 1.4.10 reflow failure the layout audit catches. Allowing
                  the label to wrap inside a width-bounded button fixes it without
                  shortening the copy or special-casing a breakpoint. */}
              <div className="mt-8 flex flex-wrap gap-3">
                {product.actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={cn(
                      buttonVariants({ variant: action.variant }),
                      "h-auto max-w-full whitespace-normal text-center",
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
