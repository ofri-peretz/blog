import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import { SectionIndex } from "@/components/ui/section-index";
import numbers from "@/data/interlace-numbers.json";

interface AgendaProps extends React.HTMLAttributes<HTMLElement> {
  /** 1-based position in the homepage sequence — the numbered eyebrow. */
  index: number;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

/**
 * The agenda section — replaces the old About + Philosophy + Skills trio.
 *
 * Brand decision (2026-08-24): this site does not sell a developer's skill
 * list ("TypeScript, React, Kafka" says hire-me-as-a-dev). It sells a
 * technical leader with an agenda — ideas, shipped products, and measurable
 * impact. The three statements below ARE the agenda; the closing line ties
 * them to what actually shipped.
 */
// Scale check for this copy: each statement is a claim about where the
// industry is going, not about a tool or a personal working style — and the
// delivery stays flat. No superlatives; the numbers are the only loudness.
const IDEAS = [
  {
    title: "Code is changing authors",
    body: "Most production code will soon be written by machines. The trust layer — review, analysis, policy — has to change authors with it: findings a coding agent can act on, standards that survive the handoff from human judgment to automated repair.",
  },
  {
    title: "Evidence over confidence",
    body: "The industry runs on unverifiable claims. Public numbers should carry their methodology, benchmarks should publish their weights, and a marketing claim should expire unless it re-earns its place. I hold my own work to that bar first.",
  },
  {
    title: "Leadership in the open",
    body: "Trust doesn't scale through authority; it scales through work anyone can audit. Transparent methods, documented decisions, code in public — the same discipline whether the room is an engineering org or an open ecosystem.",
  },
] as const;

export function Agenda({
  index,
  className,
  "data-testid": testId,
  ...rest
}: AgendaProps) {
  return (
    <Section
      data-slot="landing-agenda"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <SectionIndex value={index} data-testid="agenda-index" className="mb-3">
          The agenda
        </SectionIndex>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar className="size-20 shrink-0 ring-2 ring-border ring-offset-4 ring-offset-background">
            <AvatarImage
              src="/ofri-profile.png"
              alt="Ofri Peretz"
              loading="lazy"
            />
            <AvatarFallback className="text-base">OP</AvatarFallback>
          </Avatar>
          <h2 className="text-3xl font-semibold tracking-tight">
            Software is changing authors. Trust has to keep up.
          </h2>
        </div>
        <dl className="mt-8 grid gap-8 sm:grid-cols-3">
          {IDEAS.map((idea) => (
            <div key={idea.title}>
              <dt className="font-semibold text-foreground">{idea.title}</dt>
              <dd className="mt-2 text-muted-foreground">{idea.body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-3xl text-muted-foreground">
          This agenda is behind the{" "}
          <a
            href="https://eslint.interlace.tools"
            className="text-foreground underline underline-offset-4"
          >
            Interlace ESLint Ecosystem
          </a>{" "}
          — {numbers.plugins.total} plugins, {numbers.rules.total} rules,
          covering OWASP Top 10, LLM security, and database hardening — behind
          the writing below, and behind how I run distributed engineering
          teams at Snappy.
        </p>
      </Container>
    </Section>
  );
}
