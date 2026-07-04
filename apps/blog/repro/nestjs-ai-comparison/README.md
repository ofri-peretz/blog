# Reproduce: "Same NestJS Prompt. Claude vs Gemini"

Backs Dev.to 3781266. Makes the **6 vs 2** counts falsifiable.

## What you add
1. Paste each model's **complete** generated NestJS source under `claude/` and `gemini/`
   (controllers, DTOs, `main.ts`, `jwt.constants.ts`, etc. — the real trees, not excerpts).
2. Fill the run metadata in this README: model ids, Gemini CLI version, run date.
3. (To clear the repro lens past 8.7) run each toolchain **n>1** times and record the spread.

## The prompt (verbatim)
```
Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel.
```

## Run metadata — FILL THESE
- Claude model id: `{{CLAUDE_MODEL_ID}}`  · Gemini CLI: `{{GEMINI_CLI_VERSION}}`
- Run date: `{{RUN_DATE}}`  · temperature/seed: `{{SAMPLING}}`
- Runs per toolchain: `{{N_RUNS}}` (n=1 is the floor; record variance if >1)

## Reproduce
```bash
npm install --save-dev eslint-plugin-nestjs-security eslint-plugin-secure-coding \
  @typescript-eslint/parser eslint
bash run.sh          # lints claude/ and gemini/, writes results/{claude,gemini}.txt
```
Compare the error counts and rule ids in `results/` to the article's side-by-side table.
Note: `no-missing-validation-pipe` runs with `assumeGlobalPipes: true`, so that row is
inspection-derived (see the article footnote), not rule output.
