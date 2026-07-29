import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reports = JSON.parse(await readFile(new URL('../.foreignlaw-snapshot/data/reports.json', import.meta.url)));
const glossary = JSON.parse(await readFile(new URL('../.foreignlaw-snapshot/data/glossary.json', import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../.foreignlaw-snapshot/manifest.json', import.meta.url)));
const assets = JSON.parse(await readFile(new URL('../.foreignlaw-snapshot/assets.json', import.meta.url)));

test('snapshot counts and source revision agree', () => {
  assert.equal(reports['報告'].length, manifest.counts.reports);
  assert.equal(reports['摘要']['案件總數'], manifest.counts.cases);
  assert.equal(glossary['術語'].length, manifest.counts.glossaryTerms);
  assert.equal(reports.source.commit, manifest.dataCommit);
});

test('every public PDF reference is allowlisted and has a stable official id', () => {
  const allowed = new Set(assets.assets.map((asset) => asset.key));
  const files = reports['報告'].flatMap((report) => report['檔案']).filter((file) => file.assetKey);
  assert.equal(files.length, manifest.counts.pdfReferences);
  for (const file of files) {
    assert.match(file.assetKey, /^foreignlaw\/pdf\/(?:\d{10}|cons-\d+-\d{3})\.pdf$/);
    assert.ok(allowed.has(file.assetKey));
  }
});

test('public JSON does not expose repository paths', async () => {
  const text = `${JSON.stringify(reports)}${JSON.stringify(glossary)}`;
  assert.doesNotMatch(text, /\/Users\/|Documents\/NTU|整理路徑|相對路徑/);
});

test('glossary rulings expose the frontend contract', () => {
  assert.ok(Array.isArray(glossary['裁決']));
  assert.equal(glossary['裁決'].length, 73);
  for (const ruling of glossary['裁決']) {
    assert.equal(typeof ruling.de, 'string');
    assert.equal(typeof ruling['標準中譯'], 'string');
    assert.equal(typeof ruling['類別說明'], 'string');
    assert.equal(typeof ruling['理由'], 'string');
  }
});
