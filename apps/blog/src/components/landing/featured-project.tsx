import Link from "next/link";
import { BorderBeam } from "@/components/ui/border-beam";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import numbers from "@/data/interlace-numbers.json";

interface FeaturedProjectProps extends React.HTMLAttributes<HTMLElement> {
  stars?: number;
  downloads?: number;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function FeaturedProject({
  stars,
  downloads,
  className,
  "data-testid": testId,
  ...rest
}: FeaturedProjectProps) {
  return (
    <Section
      data-slot="landing-featured-project"
      data-testid={testId}
      tone="muted"
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Featured
        </p>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-8 shadow-sm sm:p-10">
          <BorderBeam size={250} duration={12} delay={9} />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Interlace ESLint Ecosystem
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {numbers.plugins.total} specialized plugins. {numbers.rules.total}{" "}
            rules. 100% OWASP Top 10 coverage. Built for the AI/Agentic era — LLM-friendly error messages
            mean Claude / Cursor / Copilot can fix vulnerabilities without
            context.
          </p>
          {(stars !== undefined || downloads !== undefined) && (
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {stars !== undefined && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground">★ Stars</dt>
                  <dd className="font-semibold tabular-nums">
                    {stars.toLocaleString()}
                  </dd>
                </div>
              )}
              {downloads !== undefined && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground">npm downloads</dt>
                  <dd className="font-semibold tabular-nums">
                    {downloads.toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="https://eslint.interlace.tools"
              className={buttonVariants({ variant: "default" })}
            >
              Explore docs
            </Link>
            <Link
              href="https://github.com/ofri-peretz/eslint"
              className={buttonVariants({ variant: "outline" })}
            >
              ★ Star on GitHub
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
