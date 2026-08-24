import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import numbers from "@/data/interlace-numbers.json";

interface AgendaProps extends React.HTMLAttributes<HTMLElement> {
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
const IDEAS = [
  {
    title: "Security tooling must be AI-native",
    body: "Static analysis is no longer read only by humans. Every rule ships LLM-readable messages with CWE/OWASP metadata and remediation guidance, so the coding agents writing tomorrow's code can fix what they flag.",
  },
  {
    title: "Claims need evidence",
    body: "A public number should trace to a source. Benchmarks with open methodology, regression locks in CI, marketing claims that carry expiry dates — measurement you can audit beats confidence you can't.",
  },
  {
    title: "Build in public",
    body: "Open source is the ultimate learning accelerator. Transparent, well-documented code builds trust, gives back to the community, and keeps the work state-of-the-art.",
  },
] as const;

export function Agenda({
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
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          The agenda
        </p>
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
            Ideas worth shipping
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
          The agenda ships as the{" "}
          <a
            href="https://eslint.interlace.tools"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Interlace ESLint Ecosystem
          </a>{" "}
          — {numbers.plugins.total} plugins, {numbers.rules.total} rules,
          covering OWASP Top 10, LLM security, and database hardening — and as
          the writing below. Behind it: a decade shipping production JavaScript
          at scale, currently leading distributed engineering teams at Snappy.
        </p>
      </Container>
    </Section>
  );
}
