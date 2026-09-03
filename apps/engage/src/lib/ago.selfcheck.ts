/** Self-check for ago.ts — `npx tsx src/lib/ago.selfcheck.ts`. */
import assert from "node:assert/strict";
import { ago, iso } from "./ago";
const now = Date.parse("2026-09-03T12:00:00Z");
assert.equal(ago(null, now), null, "no source → no stamp, never a fake one");
assert.equal(ago("", now), null);
assert.equal(ago("garbage", now), null);
assert.equal(ago("2026-09-03T11:59:30Z", now), "30s ago");
assert.equal(ago("2026-09-03T11:15:00Z", now), "45m ago");
assert.equal(ago("2026-09-03T04:00:00Z", now), "8h ago");
assert.equal(ago("2026-09-01", Date.parse("2026-09-03T00:00:00Z")), "2d ago", "a date-only ingest row is read as midnight UTC");
assert.equal(ago(now - 90_000, now), "2m ago", "epoch millis accepted");
assert.equal(iso("2026-09-01"), "2026-09-01T00:00:00.000Z");
console.log("ago.selfcheck: ok");
