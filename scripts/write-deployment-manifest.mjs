import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotManifestBody = await readFile(path.join(repo, 'src/data/generated/manifest.json'));
const snapshot = JSON.parse(snapshotManifestBody);
let webCommit = process.env.GITHUB_SHA || '';
if (!webCommit) webCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const deployment = {
  schemaVersion: 1,
  site: 'foreignlaw',
  hostname: 'foreignlaw.phenomcanvas.com',
  webRepository: 'mt019/phenom-foreignlaw',
  webCommit,
  dataRepository: 'mt019/phenom-foreignlaw-data',
  dataCommit: snapshot.dataCommit,
  snapshotManifestSha256: createHash('sha256').update(snapshotManifestBody).digest('hex'),
  assetOrigin: process.env.PUBLIC_ASSET_BASE || 'https://assets.phenomcanvas.com',
  counts: snapshot.counts,
};
await writeFile(path.join(repo, 'dist/deployment-manifest.json'), `${JSON.stringify(deployment, null, 2)}\n`);
