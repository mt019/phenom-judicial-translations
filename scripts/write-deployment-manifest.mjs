import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotManifestBody = await readFile(path.join(repo, 'src/data/generated/manifest.json'));
const snapshot = JSON.parse(snapshotManifestBody);
// In the ops deployment workflow GITHUB_SHA identifies phenom-ops, not this
// checked-out public web repository. Only accept an explicit override; otherwise
// derive the immutable revision from this repository itself.
let webCommit = process.env.EXPECTED_WEB_COMMIT || '';
if (!webCommit) webCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const deployment = {
  schemaVersion: 1,
  site: 'judicial-translations',
  hostname: 'judicial-translations.phenomcanvas.com',
  webRepository: 'mt019/phenom-judicial-translations',
  webCommit,
  dataRepository: 'mt019/phenom-judicial-translations-data',
  dataCommit: snapshot.dataCommit,
  snapshotManifestSha256: createHash('sha256').update(snapshotManifestBody).digest('hex'),
  pdfBase: 'https://judicial-translations.phenomcanvas.com/pdf',
  counts: snapshot.counts,
};
await writeFile(path.join(repo, 'dist/deployment-manifest.json'), `${JSON.stringify(deployment, null, 2)}\n`);
