#!/usr/bin/env node
/*
 * Verify NEU V3 planning files are internally consistent.
 * Does not claim to validate gameplay, rights or private story canon.
 * This is intentionally independent of the ignored local test suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'AGENTS.md','CLAUDE.md','plans/neu-v3/PLAN.md','plans/neu-v3/TASKS.md',
  'plans/neu-v3/STATUS.md','plans/neu-v3/DEPENDENCIES.md',
  'plans/neu-v3/DECISIONS.md','plans/neu-v3/BUGS.md',
  'plans/neu-v3/requirements.csv','plans/neu-v3/SCENES.md',
  'plans/neu-v3/IMAGE_PROMPTS.md','plans/neu-v3/PLAYTHROUGH.md',
  'plans/neu-v3/RELEASE_GATES.md','assets/manifest.v3.json',
  'design/ART_BIBLE.md','design/SAVE_AND_PROGRESS.md'
];
const problems = [];
for (const rel of required) {
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) problems.push('missing: ' + rel);
  else if (fs.statSync(full).size < 30) problems.push('empty: ' + rel);
}
const req = fs.readFileSync(path.join(root,'plans/neu-v3/requirements.csv'),'utf8')
  .trim().split(/\r?\n/);
const headings = 'id,source,requirement,current_state,proposed_change,owner,dependency,test,status';
if (req[0] !== headings) problems.push('traceability CSV columns changed');
const statusSet = new Set(['UNVERIFIED','BROKEN','PARTIAL','WORKING','NEEDS REDESIGN','IMPLEMENTED','VERIFIED','BLOCKED']);
const ids = new Set();
for (const row of req.slice(1)) {
  // None of the initial CSV fields may contain commas; reject silently invalid rows.
  const parts = row.split(',');
  if (parts.length !== 9) { problems.push('invalid requirement row: ' + row); continue; }
  if (ids.has(parts[0])) problems.push('duplicate requirement: ' + parts[0]);
  ids.add(parts[0]);
  if (!statusSet.has(parts[8])) problems.push('invalid requirement status: ' + parts[0] + ' = ' + parts[8]);
}
if (ids.size < 20) problems.push('traceability coverage unexpectedly shrank');
let asset;
try { asset = JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.v3.json'),'utf8')); }
catch(e){ problems.push('asset manifest invalid JSON: ' + e.message); }
if (asset && (!Array.isArray(asset.groups) || asset.groups.length < 5)) problems.push('asset provenance review queues missing');
const dirs=['memory','.opencode','.worktrees','node_modules'];
const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
for(const d of dirs) if (!ignore.includes(d + '/')) problems.push('expected local-only ignore missing: ' + d);
const deploy=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');
if (!deploy.includes('branches: [main]') || !deploy.includes("path: './dist'"))
  problems.push('deploy gate should remain main-only and dist-only');
if (problems.length) {
  for(const p of problems) console.error('FAIL '+p);
  process.exitCode=1;
} else console.log('v3 plan: '+required.length+' required files, '+ids.size+' requirements, asset review queues, ignore entries and main-only dist deploy configuration checked');
