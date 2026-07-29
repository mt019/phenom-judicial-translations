import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(repo, 'dist');
const read = (rel) => readFile(path.join(dist, rel), 'utf8');
const home = await read('index.html');
const glossary = await read('glossary/index.html');
const notFound = await read('404.html');
const sitemap = await read('sitemap-0.xml');
const manifest = JSON.parse(await read('deployment-manifest.json'));
const clientJsFiles = (await readdir(path.join(dist, 'assets'))).filter((name) => name.endsWith('.js'));
const clientJs = (await Promise.all(clientJsFiles.map((name) => read(`assets/${name}`)))).join('\n');
const executable = `${home}\n${glossary}\n${clientJs}`;
const checks = [
  [home.includes('<title>司法院外國法中譯索引'), '首頁 title'],
  [home.includes('https://judicial-translations.phenomcanvas.com/'), '首頁 canonical'],
  [home.includes('application/ld+json'), '首頁 JSON-LD'],
  [home.includes('data-search-root'), '首頁搜尋'],
  [executable.includes('/pdf/'), '同站 PDF 路由'],
  [glossary.includes('https://judicial-translations.phenomcanvas.com/glossary/'), 'glossary canonical'],
  [glossary.includes('工作表'), 'glossary 狀態'],
  [glossary.includes('data-glossary-root'), 'glossary 搜尋'],
  [executable.includes('Abwägung'), '多譯裁決德文標題'],
  [executable.includes('衡量') && executable.includes('定稿標準譯'), '多譯裁決結果'],
  [notFound.includes('找不到這一頁'), '404'],
  [sitemap.includes('/glossary/'), 'sitemap glossary'],
  [manifest.counts.cases === 768, '案件數'],
  [manifest.counts.glossaryTerms === 1864, '術語數'],
  [/^[a-f0-9]{64}$/.test(manifest.snapshotManifestSha256), 'snapshot manifest SHA-256'],
];
for (const [ok, label] of checks) if (!ok) throw new Error(`build 驗證失敗：${label}`);
const size = (await stat(path.join(dist, 'index.html'))).size + (await stat(path.join(dist, 'glossary/index.html'))).size;
if (size > 6_000_000) throw new Error('兩個搜尋頁 HTML 異常超過 6 MB');
process.stdout.write(`build 驗證通過：${manifest.webCommit.slice(0, 12)} + ${manifest.dataCommit.slice(0, 12)}\n`);
