# The artifact chain

This directory is the blog's software development lifecycle, in the shape
Anthropic's [AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)
describes. Six stages, six committed files. Where the playbook says "code",
we say "article"; everything else maps one-to-one.

```
intent/  ->  spec/  ->  plan/  ->  content/articles/  ->  review/  ->  incident/
   1          2          3               4                  5            6
   |                                                                     |
   +---------------------------- reopens as intent ----------------------+
```

The chain is the audit trail. A published article should be traceable back
through its review, its draft plan, its evidence, and the intent that
proposed it — by someone who was not in the room.

## The six stages

| #   | Stage    | Artifact                                | Human owns                                             | Agent owns                                             |
| --- | -------- | --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| 1   | Plan     | `sdlc/intent/<slug>.md`                 | Originating and approving; the kill call               | Drafting the intent from conversation                  |
| 2   | Design   | `sdlc/spec/<slug>.md`                   | Completeness; escalating evidence that kills the claim | Gathering ground truth from source, never memory       |
| 3   | Build    | `sdlc/plan/<slug>.md` + the article     | Interrogating the outline; voice                       | Writing strictly against the spec                      |
| 4   | Test     | `sdlc/review/<slug>.json` + frontmatter | New lenses; adjudicating an unfair score               | Running the panel until all five lenses clear          |
| 5   | Deploy   | `REVIEW.md` + the PR thread             | Approving and merging — the only publish route         | Reviewing, fixing its own findings; never approving    |
| 6   | Maintain | `sdlc/incident/<date>-<slug>.md`        | Triage: rewrite, retire, or ignore                     | Detecting on schedule; opening an intent with evidence |

## The rules that are enforced, not asserted

Every rule below used to live in prose. Each now has a mechanism, because a
rule an agent can read but a machine cannot check is a rule that erodes.

| Rule                                             | Mechanism                                                    |
| ------------------------------------------------ | ------------------------------------------------------------ |
| No published article without a quality score     | `sdlc-quality-lock.test.ts` — monotonic ratchet              |
| No article published below 9.5 on any lens       | `sdlc-quality-lock.test.ts`                                  |
| No numeric claim without a reproducing command   | `sdlc-spec-evidence-lock.test.ts`                            |
| A published slug / `devto_id` is immutable       | `.claude/hooks/freeze-identifiers.mjs` (deterministic block) |
| Claims go stale silently                         | `scripts/sdlc/detect-stale-claims.mjs`, weekly               |
| Landscape framing, never "beat" / "win" / "moat" | `REVIEW.md` pass 2 + `sdlc-spec-evidence-lock.test.ts`       |

## The ratchet

83 of the 90 articles in this repo were published before the chain existed
and carry no score. A gate that failed them all on day one would be reverted
by lunchtime, so the quality lock is a **ratchet**, not a cliff:

- a _new_ published article MUST carry a `quality` block — no exceptions;
- an article already in `sdlc/baseline/unscored.json` MAY omit one;
- that baseline file may only ever **shrink**. Adding a slug to it fails CI.

The corpus is measured at a mean of 5.7/10 against a floor of 9.5. The
ratchet is how 5.7 becomes 9.5 without a flag day.

## Working the chain

```bash
npm run sdlc:new -- <slug>        # scaffold intent + spec + plan from templates
npm run sdlc:verify               # spec claims still hold (staleness)
npm run sdlc:links                # link health across published articles
npm run sdlc:reception            # dev.to reception control bands
npm run sdlc:detect               # all three detectors; opens intents on breach
```

Templates live beside each stage directory as `TEMPLATE.md`. They are not
suggestions — the locks parse the fields they define.
