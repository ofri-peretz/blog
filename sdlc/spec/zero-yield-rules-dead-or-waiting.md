---
slug: zero-yield-rules-dead-or-waiting
stage: spec
status: approved
intent: sdlc/intent/zero-yield-rules-dead-or-waiting.md
gathered: 2026-09-07
---

## Thesis

Zero yield is not one state. Running each silent rule against a minimal fixture
separates "waiting" from "inert", and on a real set of six the split was 5–1 —
which no amount of reading the rule list would have told you.

## Ground truth

The six rules are the zero-yield set from the companion measurement
(`sdlc/spec/rule-yield-distribution-own-plugin.md`): 14 rules over 100 `.tsx`
files, 308 findings, six rules at zero.

Each was then run through `ESLint.lintText` on a one-line fixture taken from
that rule's own `invalid` test block, at `error`, with no other rule enabled.

| Rule | Fixture | Fires bare? | Fires configured? | Category |
| --- | --- | --- | --- | --- |
| `react-class-to-hooks` | `class MyComponent extends Component { }` | yes | — | waiting |
| `no-default-test-id` | `function Card({ "data-testid": d = "card" }) {…}` | yes | — | waiting |
| `no-is-prefix-prop` | `interface Props { isLooped: boolean; }` | yes | — | waiting |
| `no-kind-prop-discriminator` | `interface Props { type: "checkbox" \| "radio" \| "switch"; }` | yes | — | waiting |
| `no-wrapper-sub-component` | `function MyButton(props) { return <Button {...props} />; }` | yes | — | waiting |
| `required-attributes` | `<Button />` | **no** | **yes** | **unconfigured** |

Verified 2026-09-07. Counts: 5 waiting, 1 unconfigured, 0 dead.

## The finding the check produced

`required-attributes` does not fire on `<Button />` at `error` with default
options. Its own test fixture supplies
`options: [{ attributes: [{ attribute: 'type' }] }]`, and with those options
present the same fixture reports one error.

This is correct behaviour, not a defect: the rule takes the attribute list from
configuration and has nothing to enforce until given one. But it means the rule
is silent on **every** codebase, forever, until configured — which is a
different fact about a zero than "your code lacks this pattern", and leads to a
different action. Reading the rule list would not surface it. Reading the report
would not surface it. Asking it to fire does.

## Kill criterion, tested

The intent said to abandon if all six turned out to be the same case. They did
not: five fire bare, one requires options. **Survives.** Recorded here because
this criterion came close to killing the piece — had `required-attributes`
behaved like the other five, there would be one observation and no taxonomy.

## Method note

`lintText` needs `cwd` set and a `filePath` inside it, or every result comes
back as "File ignored because outside of base path" with a null `ruleId` — the
same defect that produced a false zero in the companion measurement. Messages
with a null `ruleId` are printed here, never skipped.

## Not verified

- Whether any rule in the wider 122-rule plugin is genuinely dead. The claim is
  scoped to these six; "0 dead" is a statement about this set, not the plugin.
- Whether `required-attributes` is the only options-gated rule in the plugin.
  Not surveyed, and the article does not imply it is.
