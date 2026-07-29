import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
const { render } = await import(pathToFileURL(path.join(root, '.ssr/entry-server.js')));
const origin = 'https://judicial-translations.phenomcanvas.com';

const pages = [
  {
    route: '/',
    file: 'index.html',
    status: 200,
    title: '司法院外國法中譯索引｜Phenom',
    description: '司法院中譯外國法學的完整案件索引、卷冊目錄與 768 件裁判譯文。',
    type: 'CollectionPage',
  },
  {
    route: '/glossary/',
    file: 'glossary/index.html',
    status: 200,
    title: '德中法學關鍵詞索引｜Phenom',
    description: '德國聯邦憲法法院裁判選輯第 6–18 輯的 1,864 組德中法學譯語、多譯裁決與測驗。',
    type: 'Dataset',
  },
  {
    route: '/404.html',
    file: '404.html',
    status: 404,
    title: '找不到這一頁｜Phenom Foreign Law',
    description: '找不到指定的裁判譯文或譯語頁。',
    type: 'WebPage',
    indexable: false,
  },
];

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

for (const page of pages) {
  const canonical = `${origin}${page.route === '/404.html' ? '/404.html' : page.route}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': page.type,
    name: page.title,
    description: page.description,
    url: canonical,
    inLanguage: 'zh-Hant-TW',
    isPartOf: { '@type': 'WebSite', name: 'Phenom Foreign Law', url: `${origin}/` },
  };
  const head = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<meta name="robots" content="${page.indexable === false ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">`,
    `<link rel="canonical" href="${canonical}">`,
    '<meta property="og:locale" content="zh_TW">',
    '<meta property="og:site_name" content="Phenom Foreign Law">',
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    '<meta name="twitter:card" content="summary">',
    `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n    ');
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, head)
    .replace('<div id="root"></div>', `<div id="root">${render(page.route)}</div>`);
  const output = path.join(dist, page.file);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html);
}

await writeFile(path.join(dist, 'sitemap-0.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/glossary/</loc></url></urlset>\n`);
await writeFile(path.join(dist, 'sitemap-index.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>\n`);

console.log(`static render complete: ${pages.length} routes`);
