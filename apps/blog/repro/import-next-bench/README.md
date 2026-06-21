# Reproduce: circular-dependency audit + no-cycle benchmark

Backs Dev.to 3785504 (Payload 508) and 3688612 (no-cycle 0-cycles). Two independent harnesses.

## A. The madge audit table (508 / 17 / 8 / 5 / 0)
Pin every repo to the SHA used in the article so the counts match (cycle counts drift with the repo).
Edit the `{{*_SHA}}` and `{{MADGE_VERSION}}` placeholders in `madge-audit.sh`, then:
```bash
bash madge-audit.sh      # clones each repo at its pinned SHA, runs madge --circular
```
The summary line in `results/<repo>.txt` is the cycle count. These come from a **third-party
tool on public repos** — the audit is reproducible by anyone.

## B. The no-cycle speedup benchmark (~26× / ~55× / >100×)
Synthetic corpus + timing harness for the `no-cycle` rule only. Disclosure: `eslint-plugin-import-next`
is Ofri's plugin; this harness is what makes the benchmark falsifiable.
```bash
npm i -D eslint eslint-plugin-import eslint-plugin-import-next @typescript-eslint/parser
node generate-corpus.mjs 1000 corpus-1000     # also try 5000, 10000
node benchmark.mjs corpus-1000 5              # median of 5 runs, prints both timings + speedup
```
Record: Node version, `eslint-plugin-import` `{{EPI_VERSION}}`, `eslint-plugin-import-next`
`{{FIX_VERSION}}`, machine (article used an M2 MacBook Pro). The 10K row is a lower bound —
`eslint-plugin-import` was killed at a 10-minute operator cap.

> ponytail: minimum harness per number. No CI, no packaging — clone, run, compare.
