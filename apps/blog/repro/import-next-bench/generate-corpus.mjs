// Generate a synthetic TS project with a controlled file count and cycle density,
// to reproduce the no-cycle performance benchmark. Each 50-file block closes one cycle.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const N = Number(process.argv[2] ?? 1000);          // file count
const out = process.argv[3] ?? `corpus-${N}`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (let i = 0; i < N; i++) {
  const next = (i + 1) % N;
  const blockStart = Math.floor(i / 50) * 50;
  // every 50th file imports back to its block start -> one cycle per block
  const closer = i % 50 === 49 ? `import { f${blockStart} } from './f${blockStart}';\n` : '';
  writeFileSync(
    `${out}/f${i}.ts`,
    `import { f${next} } from './f${next}';\n${closer}export function f${i}() { return ${next}; }\n`,
  );
}
console.log(`Wrote ${N} files to ${out}/ (~${Math.floor(N / 50)} cycles).`);
