import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = path.resolve(process.env.FOREIGNLAW_SNAPSHOT_DIR || path.join(repo, '.foreignlaw-snapshot'));
const manifest = JSON.parse(await readFile(path.join(snapshot, 'manifest.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(repo, 'data.lock.json'), 'utf8'));
const expected = process.env.EXPECTED_DATA_COMMIT || lock.commit;
if (manifest.kind !== 'phenom-foreignlaw-web-snapshot' || manifest.schemaVersion !== 1) {
  throw new Error('不支援的 foreignlaw snapshot');
}
if (manifest.dataCommit !== expected) {
  throw new Error(`data revision 不符：snapshot=${manifest.dataCommit} expected=${expected}`);
}
for (const file of manifest.files) {
  const body = await readFile(path.join(snapshot, file.path));
  const digest = createHash('sha256').update(body).digest('hex');
  if (body.byteLength !== file.bytes || digest !== file.sha256) {
    throw new Error(`snapshot 完整性不符：${file.path}`);
  }
}
const target = path.join(repo, 'src/data/generated');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(path.join(snapshot, 'data/reports.json'), path.join(target, 'reports.json'));
await cp(path.join(snapshot, 'data/glossary.json'), path.join(target, 'glossary.json'));
await cp(path.join(snapshot, 'manifest.json'), path.join(target, 'manifest.json'));
await cp(path.join(snapshot, 'assets.json'), path.join(target, 'assets.json'));
process.stdout.write(`prepared foreignlaw data ${manifest.dataCommit.slice(0, 12)}\n`);
