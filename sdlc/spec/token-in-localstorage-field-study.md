---
slug: token-in-localstorage-field-study
stage: spec
status: approved
intent: sdlc/intent/token-in-localstorage-field-study.md
gathered: 2026-09-14
---

## Thesis

The localStorage-vs-cookie argument is the one frontend developers have with
each other most often and measure least. Across 189 public repositories that
touch web storage, **13 put a credential in it (11 of them bearer tokens) — and 7 of
those 13 are government digital services.**

Two numbers matter more than the headline: the practice is **rarer** than the
discourse implies, and the linter that found it is **right 13 times out of 19**.

## Ground truth

`corpus-truth/storage-sweep.mts`, published `eslint-plugin-browser-security`
2.1.5 on eslint 9.39.5, over `eslint/tmp/adopt`.

| Claim                                          | Value                | Command                                                     | Version                        | Verified   |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------- | ------------------------------ | ---------- |
| candidate source files                         | 258,117              | `npx tsx storage-sweep.mts <root>` → `candidateFiles`        | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| **files touching web storage**                 | **1,423** ← denominator | same run → `storageFiles`                                 | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| repositories touching web storage              | 189                  | same run → `storageRepos.length`                             | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| `no-jwt-in-storage` — findings / files / repos  | 45 / 39 / 19         | same run → `rules[…]`                                        | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| `no-sensitive-localstorage` — findings / repos  | 3 / 2                | same run                                                     | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| `no-sensitive-sessionstorage` — findings / repos| 1 / 1                | same run                                                     | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| `no-cookie-auth-tokens` — findings              | 0                    | same run                                                     | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| parse errors                                    | 16                   | same run → `parseErrors`                                     | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| duplicate clones among the 19 flagged repos     | 0                    | `dedupe.ts` content fingerprint                              | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| **flagged repos that really store a credential** | **13 of 19**         | manual read of all 39 files, table below                     | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |
| of those 13, government digital services        | **7**                | table below                                                  | browser-security 2.1.5 / eslint 9.39.5 | 2026-09-14 |

## Every finding, read

**True — a credential in web storage (13 repos; 11 bearer tokens):**

| repo | evidence | gov |
| --- | --- | --- |
| City-of-Helsinki_kukkuu-admin | `localStorage.setItem(API_TOKEN, user.access_token)` + refresh | ✅ |
| GSA_srt-ui | `localStorage.setItem('token', data.token)` | ✅ |
| ONSdigital_eq-author-app | `localStorage.setItem("accessToken", user.ra)` + refresh | ✅ |
| bcgov_sso-requests | `sessionStorage.setItem(TOKEN_SESSION, JSON.stringify(tokens))` | ✅ |
| betagouv_sante-psy | `window.localStorage.setItem('xsrfToken', xsrfToken)` | ✅ |
| betagouv_zacharie | `window.localStorage.setItem(NATIVE_TOKEN_KEY, token)` | ✅ |
| cds-snc_canadalogin-user-selfservice-webapp | `localStorage.setItem("token", response.access_token)` ×4 | ✅ |
| cloudflare_cloudflare-os | `localStorage.setItem('authToken', token)` ×4 | |
| kubernetes-sigs_headlamp | `localStorage.setItem(BACKSTAGE_TOKEN_STORAGE_KEY, token)` | |
| mozilla_fxa | `localStorage.setItem(NAMESPACE, …)` in `lib/session.js` | |
| solidjs_solid-playground | `localStorage.setItem('token', x)` | |
| wix_skills | `window.localStorage.setItem(TOKEN_STORAGE_KEY, …)` | |
| twilio_twilio-voice-notification-app | `sessionStorage.setItem(SESSION_STORAGE_PASSCODE_KEY, passcode)` — a credential, not a bearer token | |

**False — flagged, but not a credential (6 repos).** Every one is the rule
matching an *identifier name* rather than proving a credential:

| repo | what is actually stored |
| --- | --- |
| Amsterdam_mijn-amsterdam-frontend | `_cobrowse_widget_session` = `{id, state}` of a co-browse session |
| aws-samples_saas-reference-architecture-ecs | `app_authServer` = a server URL |
| cloudflare_agents | `sessionId` in nine demo clients |
| open-telemetry_opentelemetry-js | a telemetry session in `LocalStorageSessionStore` |
| TanStack_router | an example `user` object in two auth demos |
| vercel_examples | `{sandboxId, timestamp}` |

That is **13/19 = 68% precision** for `no-jwt-in-storage` on real source, and the
misses are the name-inference class: `sessionId`, `authServer`, `AUTH_STATUS_KEY`.

## Instrument defect found and fixed

The first verification pass reported **567** files where the sweep found 39. A
single-rule ESLint config still emits a message for every `eslint-disable`
comment naming a rule that is not loaded, and the check printed every message
instead of filtering on `ruleId`. Nearly all 567 were `jsx-a11y` and
`@next/next` disable comments. The sweep filters correctly; the checker did not.

Also corrected: an earlier pass concluded "there is no localStorage rule" from
the 2026-08-10 `sdk-exposure` dataset. That dataset's plugin map is SDK-scoped
and never included `browser-security`. **Absence from one instrument is not
absence.**

## What this changes in the article

**Lead with the government count, not the rate.** 13 of 189 is ~7%, which reads
as "rare, move on". 7 of the 13 being public-sector services is the fact that
makes a reader check their own repo.

**Publish the 68% precision.** The article is evidence that our own rule
over-reports, and saying so is what makes the 12 believable. Per the dogfooding
doctrine, a measured loss is published, not buried.

**`no-cookie-auth-tokens` fired zero times across 1,423 files.** Report it — a
rule that never fires in a corpus this size is a finding about the rule.
