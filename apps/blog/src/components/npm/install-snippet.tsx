"use client";

// Copy-to-clipboard install command. Defaults to npm; could be extended to
// a tabbed switcher (npm / pnpm / yarn / bun) — see docs/plans/benchmarks-
// surface.md open question #2. v1 keeps it simple.

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallSnippetProps {
  packageName: string;
  className?: string;
}

export function InstallSnippet({ packageName, className }: InstallSnippetProps) {
  const [copied, setCopied] = useState(false);
  const cmd = `npm install --save-dev ${packageName}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs",
        className,
      )}
    >
      <code className="flex-1 truncate text-foreground/90" title={cmd}>
        {cmd}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy install command"}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
