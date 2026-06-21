// Time eslint-plugin-import vs eslint-plugin-import-next (no-cycle only) on a corpus.
// Reports the median of R runs for each, plus the speedup.
import { execSync } from 'node:child_process';

const dir = process.argv[2] ?? 'corpus-1000';
const R = Number(process.argv[3] ?? 5);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function timeRun(config) {
  const samples = [];
  for (let i = 0; i < R; i++) {
    const t0 = process.hrtime.bigint();
    try {
      execSync(`npx eslint --no-config-lookup -c ${config} '${dir}/**/*.ts'`, { stdio: 'ignore' });
    } catch { /* lint errors expected; we're timing, not asserting */ }
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return median(samples);
}

const imp = timeRun('config.import.mjs');
const next = timeRun('config.import-next.mjs');
console.log(`files=${dir} runs=${R}`);
console.log(`eslint-plugin-import:      ${imp.toFixed(2)} ms`);
console.log(`eslint-plugin-import-next: ${next.toFixed(2)} ms`);
console.log(`speedup: ${(imp / next).toFixed(1)}x`);
