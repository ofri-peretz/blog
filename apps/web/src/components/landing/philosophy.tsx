import { Heart } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

interface PhilosophyProps extends React.HTMLAttributes<HTMLElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function Philosophy({
  className,
  "data-testid": testId,
  ...rest
}: PhilosophyProps) {
  return (
    <Section
      data-slot="landing-philosophy"
      data-testid={testId}
      divider="bottom"
      spacing="tight"
      className={cn(className)}
      {...rest}
    >
      <Container size="content">
        <div className="rounded-xl border border-border bg-linear-to-br from-muted/40 to-accent/30 p-10 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-foreground/70" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Open Source Philosophy
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Open source is the ultimate learning accelerator. By building in
            public, I stay state-of-the-art, give back to the community, and
            build trust through transparent, well-documented code.
          </p>
        </div>
      </Container>
    </Section>
  );
}
