import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] || 'http://127.0.0.1:4197/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const timezoneId = process.argv[3] || process.env.JUDICIAL_TIMEZONE || 'Asia/Taipei';
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(base.hostname);
const evidence = resolve(process.env.JUDICIAL_EVIDENCE_DIR || '.test-evidence/vue-browser');
mkdirSync(evidence, { recursive: true });
const readData = name => JSON.parse(readFileSync(new URL(`../src/data/generated/${name}.json`, import.meta.url), 'utf8'));
const reports = readData('reports'), glossary = readData('glossary');
const short = { 德國聯邦憲法法院裁判選輯: '德國', 歐洲人權法院裁判選譯: '歐洲人權', 美國聯邦最高法院憲法判決選譯: '美國', 日本國最高法院裁判選譯: '日本' };
const cases = reports.報告.flatMap(r => r.檔案.filter(f => f.類型 === '案件' && f.案名).map(f => ({ ...f, 譯者: f.譯者 || [], 爭點: f.爭點 || '', 系列短: short[r.系列] || (r.分類 === '歐洲人權法院／公約資料' ? '歐洲人權' : r.分類), 輯次: r.輯次 })));
const checks = [], errors = [], screenshots = [], skipped = [];
const browser = await chromium.launch();
const contexts = [];
function record(description) { checks.push(description); console.log('PASS', description); }
const url = path => new URL(path.replace(/^\//, ''), base).href;
const regex = text => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
async function until(check, description) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > 20000) throw new Error(`Timed out: ${description}`);
    await new Promise(resolve => setTimeout(resolve, 75));
  }
}
async function createContext(width, height) {
  const c = await browser.newContext({ viewport: { width, height }, timezoneId });
  contexts.push(c);
  c.on('page', p => {
    p.on('pageerror', e => errors.push({ kind: 'runtime', url: p.url(), message: e.message }));
    p.on('console', m => {
      if (m.type() === 'error' || /hydration|\[Vue warn\]/i.test(m.text())) errors.push({ kind: m.type(), url: p.url(), message: m.text() });
    });
  });
  return c;
}
async function ready(p) {
  await p.waitForFunction(() => Boolean(document.getElementById('root')?.__vue_app__));
  await p.locator('h1').waitFor();
}
async function load(p, path = '') {
  const r = await p.goto(url(path), { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(r.status(), 200, `HTTP ${path}`); await ready(p);
}
async function tab(p, label) {
  await p.getByRole('tab', { name: label, exact: true }).click();
  await until(async () => await p.getByRole('tab', { name: label, exact: true }).getAttribute('aria-selected') === 'true', `tab ${label}`);
}
async function query(p, key, value) {
  await until(() => new URL(p.url()).searchParams.get(key) === value, `query ${key}=${value}`);
}
async function count(p, selector, n) {
  await until(async () => await p.locator(selector).count() === n, `${selector}: ${n}`);
}
async function exactText(p, text) { await p.getByText(text, { exact: true }).first().waitFor(); }
async function overflow(p) { assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal page overflow'); }
async function shot(p, name) {
  const path = resolve(evidence, `${name}.png`); await p.screenshot({ path }); screenshots.push(path);
}
async function pdfProbe(c, target) {
  const r = await c.request.get(target, { headers: { Range: 'bytes=0-1023' }, timeout: 60000 });
  assert([200, 206].includes(r.status()), `PDF HTTP ${r.status()}: ${target}`);
  assert.match(r.headers()['content-type'] || '', /application\/pdf/i, 'real PDF content type');
  assert.equal((await r.body()).subarray(0, 5).toString(), '%PDF-', 'real PDF bytes');
}
try {
  const desktop = await createContext(1440, 1000), p = await desktop.newPage();
  await load(p, '?keep=regression'); await overflow(p);
  const initialDaily = await p.getByText('今日一案', { exact: true }).first().locator('..').textContent();
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready(p);
  assert.equal(await p.getByText('今日一案', { exact: true }).first().locator('..').textContent(), initialDaily, 'daily case stable after hydration/reload in selected timezone');
  await tab(p, '案件索引'); await query(p, 'view', 'cases');
  assert.equal(new URL(p.url()).searchParams.get('keep'), 'regression');
  await exactText(p, `${cases.length} / ${cases.length} 件`);
  const search = p.getByRole('searchbox', { name: '搜尋案名、爭點或譯者…', exact: true });
  const sample = cases.find(c => c.譯者?.length && c.案名.length > 3);
  assert(sample, 'searchable translated case exists');
  const needle = sample.案名.slice(0, 4);
  await search.fill(needle);
  const matched = cases.filter(c => c.案名.toLowerCase().includes(needle.toLowerCase()) || (c.爭點 || '').toLowerCase().includes(needle.toLowerCase()) || c.譯者.some(t => t.includes(needle)));
  await exactText(p, `${matched.length} / ${cases.length} 件`);
  await p.getByRole('button', { name: '清除搜尋', exact: true }).click();
  assert.equal(await search.inputValue(), ''); await exactText(p, `${cases.length} / ${cases.length} 件`);
  await p.getByRole('button', { name: sample.系列短, exact: true }).click();
  const seriesCases = cases.filter(c => c.系列短 === sample.系列短);
  await exactText(p, `${seriesCases.length} / ${cases.length} 件`);
  await p.locator('button[aria-haspopup="listbox"]').click();
  const translator = sample.譯者[0];
  await p.getByRole('listbox').getByRole('option').filter({ hasText: translator }).first().click();
  const combined = seriesCases.filter(c => c.譯者.includes(translator));
  await exactText(p, `${combined.length} / ${cases.length} 件`);
  await search.fill(needle);
  const combinedSearch = combined.filter(c => c.案名.toLowerCase().includes(needle.toLowerCase()) || (c.爭點 || '').toLowerCase().includes(needle.toLowerCase()) || c.譯者.some(t => t.includes(needle)));
  await exactText(p, `${combinedSearch.length} / ${cases.length} 件`);
  assert(combinedSearch.length > 0);
  await p.goBack(); await query(p, 'view', null);
  await p.getByRole('heading', { name: '外國法翻譯索引', exact: true }).waitFor();
  record('Case search updates without blur; series/translator/search combine with exact exported counts; Back restores overview and unrelated query survives');

  await tab(p, '卷冊目錄');
  const foldSection = p.locator('section').filter({ has: p.getByRole('button', { name: '全部展開', exact: true }) });
  const folds = foldSection.locator('button[aria-expanded]');
  assert.equal(await folds.count(), reports.報告.length);
  assert.equal(await foldSection.locator('button[aria-expanded="true"]').count(), reports.報告.length, 'volumes initially expanded');
  await p.getByRole('button', { name: '全部收合', exact: true }).click();
  await until(async () => await foldSection.locator('button[aria-expanded="true"]').count() === 0, 'all volumes collapse');
  await folds.first().click(); assert.equal(await folds.first().getAttribute('aria-expanded'), 'true');
  await p.getByRole('button', { name: '全部展開', exact: true }).click();
  await until(async () => await foldSection.locator('button[aria-expanded="true"]').count() === reports.報告.length, 'all volumes expand');
  record('Every exported volume initially opens; individual and all-volume folds work');

  await load(p, 'glossary/?keep=regression');
  const gsearch = p.getByRole('searchbox', { name: '搜尋德文或中文術語…', exact: true });
  const gterm = glossary.術語.find(t => t.de.length > 4);
  await gsearch.fill(gterm.de);
  const gmatched = glossary.術語.filter(t => t.de.toLowerCase().includes(gterm.de.toLowerCase()) || t.zh.includes(gterm.de));
  await exactText(p, `${gmatched.length} / ${glossary.術語.length} 組`);
  await p.getByRole('button', { name: '清除搜尋', exact: true }).click();
  const type = gterm.類型, typeCount = glossary.術語.filter(t => t.類型 === type).length;
  const typeButton = p.locator('button[aria-pressed]').filter({ hasText: regex(type) }).first();
  await typeButton.click(); assert.equal(await typeButton.getAttribute('aria-pressed'), 'true');
  await exactText(p, `${typeCount} / ${glossary.術語.length} 組`);
  await p.getByRole('button', { name: '隨機一詞', exact: true }).click();
  await p.getByRole('button', { name: '清除全部篩選', exact: true }).click();
  await exactText(p, `${glossary.術語.length} / ${glossary.術語.length} 組`);
  record('Glossary live bilingual search, shared facet chips, random draw and clear match exported term counts');

  await tab(p, '聚落'); await query(p, 'tab', 'cluster');
  assert.equal(new URL(p.url()).searchParams.get('keep'), 'regression');
  const cluster = p.locator('section').filter({ has: p.getByRole('heading', { name: '主題聚落', exact: true }) });
  const typeGroups = Object.keys(glossary.摘要.類型分佈).filter(type => glossary.術語.some(t => t.類型 === type));
  assert.equal(await cluster.locator('button[aria-expanded="true"]').count(), typeGroups.length);
  await tab(p, '依領域');
  const domainGroups = Object.keys(glossary.摘要.領域分佈).filter(domain => glossary.術語.some(t => (t.領域?.length ? t.領域 : ['未分類']).includes(domain)));
  await until(async () => await cluster.locator('button[aria-expanded="true"]').count() === domainGroups.length, 'domain groups update and default open');
  const firstFold = cluster.locator('button[aria-expanded]').first(); await firstFold.click();
  assert.equal(await firstFold.getAttribute('aria-expanded'), 'false'); await firstFold.click();
  record('Glossary clusters reactively regroup by type/domain with working per-group accordion');

  await tab(p, '多譯裁決');
  const ruling = glossary.裁決.find(r => r.類別 === 'canonical' && r.次選?.length);
  assert(ruling, 'real guessable ruling');
  const rulingRow = p.locator('li').filter({ has: p.getByText(ruling.de, { exact: true }) }).first();
  await rulingRow.getByRole('button', { name: ruling.標準中譯, exact: true }).click();
  await rulingRow.getByText('答對了。其餘列為次選。', { exact: true }).waitFor();
  if (ruling.理由) assert((await rulingRow.textContent()).includes(ruling.理由));
  const reveal = p.getByRole('button', { name: '看各譯法的用例', exact: true }).first();
  assert(await reveal.count(), 'context ruling exists');
  await reveal.click();
  record('A real translation ruling accepts the correct choice and reveals reasons; contextual ruling reveals examples');

  await tab(p, '測驗');
  const quiz = p.locator('section').filter({ has: p.getByRole('heading', { name: '配對測驗', exact: true }) });
  await exactText(p, '已答 0 / 10');
  const question = quiz.locator('ol > li').first();
  await question.getByRole('button').first().click(); await exactText(p, '已答 1 / 10');
  assert(await question.getByRole('button').first().isDisabled());
  await tab(p, '中 → 德'); await exactText(p, '已答 0 / 10');
  await question.getByRole('button').first().click(); await exactText(p, '已答 1 / 10');
  await p.getByRole('button', { name: '換一組', exact: true }).click();
  await exactText(p, '第 2 組'); await exactText(p, '已答 0 / 10');
  await tab(p, '記憶卡'); await exactText(p, '1 / 20');
  await quiz.getByRole('button').filter({ hasText: '點一下翻面' }).click();
  await quiz.getByRole('button', { name: '會了', exact: true }).click(); await exactText(p, '2 / 20');
  await tab(p, '德 → 中'); await exactText(p, '1 / 20');
  assert(await quiz.getByText('點一下翻面', { exact: true }).isVisible());
  await tab(p, '選擇題'); await exactText(p, '已答 0 / 10');
  record('MCQ accepts/locks answers; direction and reseed reset answers; cards flip/advance and reset with direction');
  await tab(p, '關於');
  await p.getByRole('heading', { name: '關於這份譯語表', exact: true }).waitFor();
  assert((await p.locator('main').textContent()).includes(glossary.狀態說明), 'candidate-worktable scope retained');
  await overflow(p); await shot(p, 'desktop-glossary');

  await p.getByRole('button', { name: 'Larger text', exact: true }).first().click();
  await until(async () => (await p.getByRole('button', { name: 'Reset text size', exact: true }).first().textContent()).trim() === '110%', 'larger reading size');
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready(p);
  assert.equal((await p.getByRole('button', { name: 'Reset text size', exact: true }).first().textContent()).trim(), '110%');
  await p.getByRole('button', { name: 'Reset text size', exact: true }).first().click();
  await p.getByRole('button', { name: '外觀', exact: true }).first().click();
  const palette = p.getByRole('menu').locator('button[aria-label][aria-pressed="false"]').first(), paletteName = await palette.getAttribute('aria-label');
  await palette.click();
  assert(await p.evaluate(() => localStorage.getItem('canvaslab:palette')), 'palette stored');
  await p.keyboard.press('Escape'); await count(p, '[role="menu"]', 0);
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready(p);
  await p.getByRole('button', { name: '外觀', exact: true }).first().click();
  assert.equal(await p.getByRole('button', { name: paletteName, exact: true }).getAttribute('aria-pressed'), 'true');
  await p.keyboard.press('Escape');
  record('Font size and named appearance palette persist after SSR reload');

  if (local) {
    skipped.push({ group: 'PDF delivery and modal controls', reason: 'Local Pages preview has no private R2 binding; this group must pass on the public deployment.' });
  } else {
    await load(p, '?view=cases');
    const pdfCase = cases.find(c => c.assetKey);
    assert(pdfCase, 'mirrored case exists');
    await p.getByRole('searchbox').fill(pdfCase.案名);
    const trigger = p.getByRole('button', { name: pdfCase.案名, exact: true }).first();
    const previousOverflow = await p.evaluate(() => document.body.style.overflow);
    await trigger.click();
    const dialog = p.getByRole('dialog'); await dialog.waitFor();
    const expected = new URL(`/pdf/${encodeURIComponent(pdfCase.assetKey.replace(/^foreignlaw\/pdf\//, ''))}`, base.origin).href;
    assert.equal(new URL(await dialog.locator('iframe').getAttribute('src'), base).href, expected, 'iframe exact same-site allowlisted PDF');
    await pdfProbe(desktop, expected);
    assert.equal(await p.evaluate(() => document.body.style.overflow), 'hidden');
    const newTab = dialog.getByRole('link', { name: '新分頁', exact: true });
    assert.equal(new URL(await newTab.getAttribute('href'), base).href, expected);
    const popupPromise = p.waitForEvent('popup'); await newTab.click(); const popup = await popupPromise;
    await until(() => popup.url() === expected, 'same-site PDF opens new tab'); await popup.close();
    await p.keyboard.press('Escape'); await count(p, '[role="dialog"]', 0);
    assert.equal(await p.evaluate(() => document.body.style.overflow), previousOverflow);
    assert(await trigger.evaluate(el => el === document.activeElement), 'PDF close restores trigger focus');
    await p.getByRole('button', { name: '隨機翻閱一篇 →', exact: true }).click(); await dialog.waitFor();
    const firstRandom = new URL(await dialog.locator('iframe').getAttribute('src'), base);
    assert.equal(firstRandom.origin, base.origin); assert(firstRandom.pathname.startsWith('/pdf/'));
    await dialog.getByRole('button', { name: '換一篇', exact: true }).click();
    const randomTarget = new URL(await dialog.locator('iframe').getAttribute('src'), base);
    await pdfProbe(desktop, randomTarget.href);
    const thread = dialog.getByRole('button').filter({ hasText: /^同法院（/ }).filter({ visible: true }).first();
    await thread.click();
    const threadTarget = new URL(await dialog.locator('iframe').getAttribute('src'), base);
    assert.equal(threadTarget.origin, base.origin);
    assert(cases.some(c => c.assetKey && new URL(`/pdf/${encodeURIComponent(c.assetKey.replace(/^foreignlaw\/pdf\//, ''))}`, base.origin).href === threadTarget.href), 'thread target belongs to actual exported allowlist');
    await p.keyboard.press('Escape'); await count(p, '[role="dialog"]', 0);
    record('Public PDF bytes, exact iframe, new tab, Escape/scroll/focus restore, reroll and related court thread');
  }

  const mobile = await createContext(390, 844), m = await mobile.newPage();
  await load(m); await overflow(m); await tab(m, '案件索引');
  await exactText(m, `${cases.length} / ${cases.length} 件`); await overflow(m);
  await shot(m, 'mobile-cases');
  await load(m, 'glossary/'); await overflow(m);
  await tab(m, '測驗'); await exactText(m, '已答 0 / 10'); await overflow(m);
  await shot(m, 'mobile-quiz');
  if (!local) {
    await load(m); await m.getByRole('button', { name: '隨機翻閱一篇 →', exact: true }).click();
    await m.getByRole('dialog').waitFor();
    assert.equal(await m.evaluate(() => document.body.style.overflow), 'hidden');
    await overflow(m); await shot(m, 'mobile-pdf');
    await m.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click();
    await count(m, '[role="dialog"]', 0);
    assert.notEqual(await m.evaluate(() => document.body.style.overflow), 'hidden');
  }
  record('Desktop/mobile pages retain accessible controls and fit viewport without horizontal overflow');
  assert.deepEqual(errors, [], 'runtime, console and hydration errors');
  writeFileSync(resolve(evidence, 'acceptance.json'), JSON.stringify({ base: base.href, timezoneId, checks, skipped, screenshots, errors, pdfVerified: !local }, null, 2) + '\n');
  console.log(`PASS ${checks.length} Judicial browser groups; ${skipped.length} explicitly skipped; PDF verified: ${!local}`);
} catch (error) {
  writeFileSync(resolve(evidence, 'failure.json'), JSON.stringify({ base: base.href, timezoneId, checks, skipped, screenshots, errors, failure: error.stack }, null, 2) + '\n');
  throw error;
} finally {
  await Promise.all(contexts.map(c => c.close())); await browser.close();
}
