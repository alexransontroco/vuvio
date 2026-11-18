#!/usr/bin/env node
// Vuvio-Lab deploy guard.
// Aborts any `firebase deploy` triggered from this worktree so experimental
// work cannot reach the production hosting target (vuvio-bf328).
//
// Fail loudly, print why, and tell the dev how to transfer a feature to main.

import { execSync } from 'node:child_process';

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const branch = currentBranch();
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.error('');
console.error(red('╔══════════════════════════════════════════════════════════╗'));
console.error(red('║  Vuvio-Lab : deploy production BLOQUÉ                    ║'));
console.error(red('╚══════════════════════════════════════════════════════════╝'));
console.error('');
console.error(`  Branche courante : ${yellow(branch)}`);
console.error('  Cette worktree est un environnement expérimental.');
console.error('  Aucune commande `firebase deploy` ne doit cibler vuvio-bf328 ici.');
console.error('');
console.error('  Pour livrer une feature stabilisée :');
console.error('    1. cd /Users/alexandreranson/Desktop/vuvio');
console.error('    2. git checkout main');
console.error('    3. git cherry-pick <sha-des-commits-lab>');
console.error('    4. npm run build && firebase deploy --only hosting:vuvio-bf328');
console.error('');

process.exit(1);
