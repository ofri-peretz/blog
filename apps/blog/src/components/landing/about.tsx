import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import numbers from "@/data/interlace-numbers.json";

interface AboutProps extends React.HTMLAttributes<HTMLElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function About({
  className,
  "data-testid": testId,
  ...rest
}: AboutProps) {
  return (
    <Section
      data-slot="landing-about"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          About
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
            Building products that matter
          </h2>
        </div>
        <div className="mt-6 grid gap-6 text-muted-foreground sm:grid-cols-2">
          <p>
            Engineering Leader with a decade of experience shipping production
            JavaScript at scale. Currently focused on{" "}
            <span className="text-foreground">AI-native developer tools</span> —
            building static analysis that empowers both humans and AI coding
            assistants to catch security issues before they ship.
          </p>
          <p>
            Architect of the{" "}
            <a
              href="https://eslint.interlace.tools"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Interlace ESLint Ecosystem
            </a>{" "}
            — {numbers.plugins.total} specialized plugins,{" "}
            {numbers.rules.total} rules, covering OWASP Top 10, LLM Security,
            and database hardening. Built for the agentic era.
          </p>
        </div>
      </Container>
    </Section>
  );
}
