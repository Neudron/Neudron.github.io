#!/usr/bin/env node
/* changelog.mjs — group commit subjects by prefix (ultraplan H4).
   node _scripts/changelog.mjs [range]   default range: last 30 commits.
   Prints Markdown to stdout; redirect it where you want it. Not published
   (CHANGELOG.md is not in the deploy stage list). */
import { execFileSync } from 'node:child_process';
const range = process.argv[2] || '-30';
const out = execFileSync('git', ['log', range, '--no-merges', '--pretty=%h\t%ad\t%s', '--date=short'], { encoding: 'utf8' });
const groups = {};
for (const line of out.trim().split('\n').filter(Boolean)) {
  const [h, d, s] = line.split('\t');
  const m = s.match(/^([a-z0-9 \-]+?):\s*(.*)$/i);
  const k = m ? m[1].toLowerCase() : 'other';
  (groups[k] = groups[k] || []).push(`- ${m ? m[2] : s} (${h}, ${d})`);
}
const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
console.log('# Changelog\n');
for (const k of order) console.log(`## ${k}\n\n${groups[k].join('\n')}\n`);
