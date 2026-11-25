---
name: verify
description: Run the blog locally and read the changed page at 390px and desktop, before committing.
---

# Verify a change by running it

Lint and tests say the parts hold; this says a reader sees the right page. Paste the URL and what
you read back into the commit's `Verified-by:` receipt.

## Boot

- Blog: `npm run dev -w blog` serves <http://localhost:3000>; ready when `/` answers 200.
- Engage (the control room): `npm run dev -w engage` serves <http://localhost:7777>.

## Drive and inspect

Open the changed page in a browser tool at 390px and at desktop width, in light and dark. Read the
page text, follow its links, and check the console is clean. An article change opens
`/articles/<slug>` and compares the rendered title, numbers and code blocks with the source.
Engage runs `npm run smoke -w engage`, which boots its own server and fails on a blank route.

## Feature map

| Feature | Reach it by | Working means |
| --- | --- | --- |
| Home | <http://localhost:3000/> | latest articles listed, no layout break at 390px |
| An article | `/articles/<slug>` (file in `apps/blog/content/articles/`) | title, body, code blocks and images render |
| Article as markdown | `/md/<slug>` | 200, the article's text |
| RSS and sitemap | `/rss.xml`, `/sitemap.xml` | 200, the new article listed |
| llms.txt | `/llms.txt`, `/llms-full.txt` | 200 |
| Scorecard | `/scorecard` | renders its numbers |
| Engage routes | `npm run smoke -w engage` | exit 0 |
| dev.to publish | `npm run publish:devto:dry` | dry run lists the article, publishes nothing |

## When it fails

Fix the page, not this skill. A row that no longer runs is fixed in its own commit. After three
failed rounds, stop and show the person the output.
