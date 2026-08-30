---
kind: intent
slug: 2026-08-30-reader-depth
opened: 2026-08-30
status: open
---

# Intent: find out why nobody reads a second article

## What

Diagnose — before building anything else — why readers average 1.16 pages
across a corpus of 90 articles, when four separate navigation affordances
already exist to carry them onward.

## Why now

Because this is the cheapest growth available. Moving pages-per-reader from
1.16 to 2 doubles reading without a single new visitor, and we currently have
145 readers a month to work with.

But the framing that matters is this: **we have already built the feature four
times.** The series pager, the Threads section, the corpus map, and the resume
offer all exist and are instrumented. In thirty days they produced 3 clicks
between them, from one person, and `series:pager_click`, `article:thread_click`
and `series:resume_click` did not fire at all.

So the question is not "what should we build to increase depth". It is "why did
four attempts fail", and building a fifth before answering that would be the
most expensive way to learn nothing.

## Constraints

- Classic pagination with URL state; never infinite scroll.
- Any new UI ships from the Interlace DS first.
- The honest confound: at 145 readers a month, a genuinely good affordance
  might still show near-zero clicks. The diagnosis has to account for volume
  before concluding the design is at fault.
- Do not add a fifth affordance in this intent. That is the failure mode being
  guarded against.

## How we will know it worked

- A written finding that distinguishes between the three candidate
  explanations: too little traffic to register, readers arriving with no intent
  to continue (search hits looking for one answer), or affordances that are
  present but not persuasive.
- **Only then**, a decision: fix one existing affordance, remove some, or
  accept the number and stop spending on it.

Success for this intent is a conclusion, not a metric moving.

## Not doing

- Not building a "read next" component. That is the fifth attempt, and it is
  exactly what this intent exists to prevent until the diagnosis is done.
- Not removing anything yet. Removal is a valid outcome but needs the finding
  first.
- Not tuning copy on the existing affordances before knowing whether copy is
  the problem.
