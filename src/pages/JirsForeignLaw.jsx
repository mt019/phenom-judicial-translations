// DATA — 由 jirs-foreign-law 資料倉 sync（scripts/sync_canvas.py）。canvas 只管前端：
// 此頁只吃輕量 metadata；PDF 全文由資料倉部署站以 URL 提供，不進本倉。
//
// 版型走共用殼 RailLayout（左欄常駐導覽＋滿寬工作區，v0.1.31 從這一頁抽上去）。內容模型
// 出自本資料自身的結構——544 個附檔裡有 444 個是「單一裁判譯文」，那才是法律研究者檢索的
// 單位，所以主軸是「案件索引」（可搜案名／譯者、依系列篩），卷冊目錄與陽春清單保留為另一檢視。
import { computed, defineComponent, onMounted, ref } from 'vue';
import { ExternalLink, BookMarked, Dices } from 'lucide-vue-next';
import {
  AccordionItem,
  AppearanceMenu,
  Dropdown,
  FontSizeControl,
  PdfViewer,
  RailLayout,
  SearchField,
  useExpandedSet,
  useFontScale,
  useTabParam,
} from '@phenomcanvas/ui-vue';
import data from '../data/generated/reports.json';

const pdfUrl = (assetKey) => `/pdf/${encodeURIComponent(assetKey.replace(/^foreignlaw\/pdf\//, ''))}`;

const VIEWS = [
  { id: 'overview', label: '總覽' },
  { id: 'cases', label: '案件索引' },
  { id: 'volumes', label: '卷冊目錄' },
  { id: 'about', label: '關於' },
];

const SERIES_SHORT = {
  德國聯邦憲法法院裁判選輯: '德國',
  歐洲人權法院裁判選譯: '歐洲人權',
  美國聯邦最高法院憲法判決選譯: '美國',
  日本國最高法院裁判選譯: '日本',
};
// 有些歐洲人權法院裁判不在編號選譯系列裡（系列=null，分類＝公約資料），仍屬同一法院——
// 按分類收斂成同一個短標，案件索引的法院篩選才不會多出一個空白籤。
const CAT_SHORT = {
  '歐洲人權法院／公約資料': '歐洲人權',
};
const seriesShort = (r) => SERIES_SHORT[r.系列] || CAT_SHORT[r.分類] || r.分類;

function fmtBytes(b) {
  if (!b) return '';
  const mb = b / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

// 系列年跨距：有查證初版年就用初版年，否則採入時間軸日期；再版日不列入（西德輯1 以 1990 起算）。
function yearRange(reports) {
  const ys = [];
  for (const r of reports) {
    if (r.初版年月) ys.push(Number(r.初版年月.slice(0, 4)));
    else if (r.採入時間線 && r.採信年月ISO) ys.push(Number(r.採信年月ISO.slice(0, 4)));
  }
  if (!ys.length) return null;
  const a = Math.min(...ys), b = Math.max(...ys);
  return a === b ? `${a}` : `${a}–${b}`;
}

function volSpan(reports) {
  const vs = reports.map((r) => r.輯次).filter((v) => v != null);
  if (!vs.length) return null;
  const a = Math.min(...vs), b = Math.max(...vs);
  return a === b ? `輯 ${a}` : `輯 ${a}–${b}`;
}

// 水平量條：實色淡彩填充、無外框——避開「淺色色塊＋外圈細線」的陽春感（底層鐵律）。
function HBar({ value, max }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <span class="inline-block h-2.5 w-full align-middle">
      <span class="block h-2.5 rounded-[2px]"
        style={{ width: `${pct}%`, background: 'color-mix(in oklab, var(--c-accent) 55%, var(--c-paper))' }} />
    </span>
  );
}


// 卷冊裡一個附檔的一行呈現：案件顯示案名＋譯者，其餘（前置／主題節／全文）如實標示。
// cons 官網補齊的卷走絕對連結、新分頁開啟（其 PDF 不在本倉、無法頁內 iframe）。
function FileRow({ f, onView }) {
  const isCase = f.類型 === '案件';
  const label = (isCase && f.案名) ? f.案名 : f.檔名.replace(/^\d+[_、.\s]*/, '').replace(/\.pdf$/i, '');
  const ext = f.外部連結 && !f.assetKey;  // 有 R2 PDF 就頁內看，沒下載到才退官網
  const open = () => (ext
    ? window.open(f.外部連結, '_blank', 'noopener,noreferrer')
    : onView({ ...f, 顯示名: label }));
  return (
    <li class="flex items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <button type="button" onClick={open}
        class="min-w-0 flex-1 truncate text-left text-token-sm text-ink transition-colors duration-fast hover:text-accent"
        title={ext ? `${label}（官網開啟）` : label}>
        {label}
        {isCase && f.譯者?.length ? <span class="ml-2 text-token-xs text-ink-muted">{f.譯者.join('、')} 譯</span> : null}
        {f.作者 ? <span class="ml-2 text-token-xs text-ink-muted">{f.作者}{f.角色 ? ` ${f.角色}` : ''}</span> : null}
        {!isCase && f.類型 !== '前置' ? <span class="ml-2 text-token-xs text-ink-faint">{f.類型}</span> : null}
        {ext ? <ExternalLink size={11} class="ml-1 inline align-baseline text-ink-faint" /> : null}
      </button>
      <span class="hidden shrink-0 text-token-xs tabular-nums text-ink-muted sm:inline">
        {f.頁數 ? `${f.頁數} 頁 · ` : ''}{fmtBytes(f.位元組)}
      </span>
    </li>
  );
}

// 逐卷官方外鏈：JIRS 卷有官方詳情頁，憲法法庭補齊卷另有完整文件下載。收在卷冊展開頂端。
function VolumeSource({ r }) {
  if (!r.官方詳情頁 && !r.完整文件連結) return null;
  const linkCls = 'text-ink-muted underline decoration-line transition-colors duration-fast hover:text-accent';
  return (
    <p class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-token-xs text-ink-faint">
      <span>{r.來源系統 === 'cons' ? '憲法法庭官網' : 'JIRS 官方'}</span>
      {r.官方詳情頁 ? <a href={r.官方詳情頁} target="_blank" rel="noreferrer" class={linkCls}>官方詳情頁 <ExternalLink size={10} class="inline align-baseline" /></a> : null}
      {r.完整文件連結 ? <a href={r.完整文件連結} target="_blank" rel="noreferrer" class={linkCls}>完整文件下載 <ExternalLink size={10} class="inline align-baseline" /></a> : null}
      {r.ISBN ? <span class="tabular-nums">ISBN {r.ISBN}</span> : null}
    </p>
  );
}

export default defineComponent({
  name: 'JirsForeignLaw',
  setup() {
  const {scale, setScale: setScale} = useFontScale();
  const [view, setView] = useTabParam('view', 'overview');
  const viewing = ref(null);
  const setViewing = next => { viewing.value = typeof next === 'function' ? next(viewing.value) : next; };
  const q = ref('');
  const setQ = next => { q.value = typeof next === 'function' ? next(q.value) : next; };
  const seriesFilter = ref('all');
  const setSeriesFilter = next => { seriesFilter.value = typeof next === 'function' ? next(seriesFilter.value) : next; };
  const translatorFilter = ref('all');
  const setTranslatorFilter = next => { translatorFilter.value = typeof next === 'function' ? next(translatorFilter.value) : next; };

  const { 報告: reports, 時間軸: timeline, 主導人: leadership, 摘要, 來源 } = data;

  const series = computed(() => {
    const m = new Map();
    for (const r of reports) {
      if (!r.系列) continue;
      if (!m.has(r.系列)) m.set(r.系列, []);
      m.get(r.系列).push(r);
    }
    return [...m.entries()]
      .map(([name, rs]) => ({ name, order: rs[0].系列排序 ?? 99, reports: rs.slice().sort((a, b) => (a.輯次 ?? 0) - (b.輯次 ?? 0)) }))
      .sort((a, b) => a.order - b.order);
  });

  const standalone = computed(() => {
    const m = new Map();
    for (const r of reports) {
      if (r.系列) continue;
      if (!m.has(r.分類)) m.set(r.分類, []);
      m.get(r.分類).push(r);
    }
    return [...m.entries()];
  });

  // 案件索引：把每個「案件」型附檔攤平成一筆，帶上所屬系列／輯／年，供搜尋與篩選。
  const cases = computed(() => {
    const out = [];
    for (const r of reports) {
      for (const f of r.檔案) {
        if (f.類型 !== '案件' || !f.案名) continue; // 無案名（官網僅給編號）不進可檢索索引
        out.push({
          案名: f.案名, 譯者: f.譯者 || [], 爭點: f.爭點 || '',
          系列: r.系列, 系列短: seriesShort(r), 輯次: r.輯次,
          年: (r.採信年月ISO || r.初版年月 || r.官方頁面日期 || '').slice(0, 4),
          assetKey: f.assetKey, 外部連結: f.外部連結, 頁數: f.頁數, 位元組: f.位元組,
        });
      }
    }
    return out;
  });

  const caseSeries = computed(() => [...new Set(cases.value.map((c) => c.系列短))]);
  const caseTranslators = computed(() => {
    const c = new Map();
    for (const cs of cases.value) for (const t of cs.譯者) c.set(t, (c.get(t) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  });

  const filteredCases = computed(() => {
    const needle = q.value.trim().toLowerCase();
    return cases.value.filter((c) => {
      if (seriesFilter.value !== 'all' && c.系列短 !== seriesFilter.value) return false;
      if (translatorFilter.value !== 'all' && !c.譯者.includes(translatorFilter.value)) return false;
      if (!needle) return true;
      return c.案名.toLowerCase().includes(needle) || c.爭點.toLowerCase().includes(needle) || c.譯者.some((t) => t.includes(q.value.trim()));
    });
  });

  // 隨機翻閱／換一篇／順藤摸瓜／每日一案——把索引變成可漫遊的東西。
  // pool 只取 R2 有穩定 asset key 者，換一篇的迴圈才不會彈到官網新分頁而斷掉。
  const rollPool = computed(() => cases.value.filter((c) => c.assetKey));
  const rollCase = ref(null);
  const setRollCase = next => { rollCase.value = typeof next === 'function' ? next(rollCase.value) : next; };
  const openCase = (c) => {
    setRollCase(c);
    setViewing({ assetKey: c.assetKey, 顯示名: c.案名, 頁數: c.頁數, 位元組: c.位元組 });
  };
  const roll = (pool) => {
    const p = pool && pool.length ? pool : rollPool.value;
    if (p.length) openCase(p[Math.floor(Math.random() * p.length)]);
  };
  // 每日一案：以當天日期當 seed，一整天固定同一篇（瀏覽器端 Date，非 sandbox）。
  const daySeed = () => { const d = new Date(); return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); };
  const dailySeed = ref(globalThis.__PHENOM_DAILY_SEED__ ?? daySeed());
  onMounted(() => { dailySeed.value = daySeed(); });
  const daily = computed(() => rollPool.value.length ? rollPool.value[dailySeed.value % rollPool.value.length] : null);
  const threadsFor = (c) => (c ? [
    c.譯者.length ? { label: `同譯者（${c.譯者[0]}）`, run: () => roll(rollPool.value.filter((x) => x.譯者.some((t) => c.譯者.includes(t)))) } : null,
    { label: `同法院（${c.系列短}）`, run: () => roll(rollPool.value.filter((x) => x.系列短 === c.系列短)) },
    c.輯次 != null ? { label: `同卷（輯${c.輯次}）`, run: () => roll(rollPool.value.filter((x) => x.系列短 === c.系列短 && x.輯次 === c.輯次)) } : null,
  ].filter(Boolean) : []);

  const reportIds = computed(() => reports.map((r) => r.序號));
  const acc = useExpandedSet(reportIds);
  const maxPages = computed(() => Math.max(...timeline.map((t) => t.頁數)));

  return () => {
    return (
    <>
      <RailLayout
        scale={scale.value}
        back={{ href: 'https://phenomcanvas.com/', label: '' }}
        backIndexHref="https://phenomcanvas.com/all"
        headerRight={<><AppearanceMenu /><FontSizeControl scale={scale.value} onChange={setScale} /></>}
        eyebrow="司法院中譯外國法學"
        title="外國法翻譯索引"
        onHome={() => { setView('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        homeTitle="回本頁首頁（總覽）"
        nav={{ label: '檢視', value: view.value, onChange: setView, items: VIEWS }}
        rail={<>
              <div class="mt-5 border-t border-line-soft pt-4">
                <button type="button" onClick={() => roll(rollPool.value)}
                  class="inline-flex items-center gap-2 text-token-sm text-ink-muted transition-colors duration-fast hover:text-accent">
                  <Dices size={15} class="text-ink-faint" /> 隨機翻閱一篇 →
                </button>
                <p class="mt-1 hidden text-token-xs leading-relaxed text-ink-faint lg:block">從 {rollPool.value.length} 篇裁判裡擲一篇；翻開後可「換一篇」，或順藤摸瓜到同譯者／同法院／同卷。</p>
              </div>
              {daily.value ? (
                <div class="mt-4 border-t border-line-soft pt-4">
                  <div class="text-token-xs font-semibold uppercase tracking-wide text-ink-faint">今日一案</div>
                  <button type="button" onClick={() => openCase(daily.value)}
                    class="mt-1 block text-left text-token-sm leading-snug text-ink transition-colors duration-fast hover:text-accent">{daily.value.案名}</button>
                  <div class="mt-0.5 text-token-xs text-ink-muted">
                    {daily.value.譯者.length ? `${daily.value.譯者.join('、')} 譯 · ` : ''}{daily.value.系列短}{daily.value.輯次 != null ? `·輯${daily.value.輯次}` : ''}
                  </div>
                </div>
              ) : null}
              <div class="mt-4 border-t border-line-soft pt-4">
                <a href="/glossary/"
                  class="inline-flex items-center gap-2 text-token-sm text-ink-muted transition-colors duration-fast hover:text-accent">
                  <BookMarked size={15} class="text-ink-faint" /> 德中法學譯語表 →
                </a>
                <p class="mt-1 hidden text-token-xs leading-relaxed text-ink-faint lg:block">德國選輯附錄的德中關鍵詞索引，與本頁互為經緯。</p>
              </div>
        </>}
      >

              {view.value === 'overview' ? (
                <section class="max-w-3xl space-y-8">
                  {daily.value ? (
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-line pl-3">
                      <span class="shrink-0 text-token-xs font-semibold uppercase tracking-wide text-ink-faint">今日一案</span>
                      <button type="button" onClick={() => openCase(daily.value)}
                        class="text-token-sm text-ink transition-colors duration-fast hover:text-accent">{daily.value.案名}</button>
                      <span class="shrink-0 text-token-xs text-ink-muted">
                        {daily.value.譯者.length ? `${daily.value.譯者.join('、')} 譯 · ` : ''}{daily.value.系列短}{daily.value.輯次 != null ? `·輯${daily.value.輯次}` : ''}
                      </span>
                    </div>
                  ) : null}
                  <div class="space-y-4">
                    <h2 class="text-token-lg font-semibold text-ink">這是什麼</h2>
                    <p class="text-token-base leading-relaxed text-ink-muted">
                      司法院自 1990 年起，以「中譯外國法學」為名，分批把外國憲法法院裁判與法制資料譯成中文出版。
                      主力是<strong class="font-semibold text-ink">德國聯邦憲法法院裁判選輯</strong>（輯 1–18，連載逾三十年）與
                      <strong class="font-semibold text-ink">歐洲人權法院裁判選譯</strong>（六輯），另有美國、日本、韓國、法國資料。
                    </p>
                    <p class="text-token-base leading-relaxed text-ink-muted">
                      官方入口把每筆報告拆成數十個附檔、只能逐一強制下載，前面還擋著一層防自動下載的安全檢查。這裡把整批
                      <strong class="mx-1 font-semibold tabular-nums text-ink">{摘要.檔案總數}</strong>件全文收攏，其中
                      <strong class="mx-1 font-semibold tabular-nums text-ink">{摘要.案件總數}</strong>件是可逐案檢索的單一裁判譯文——
                      到<button type="button" onClick={() => setView('cases')} class="text-accent underline decoration-line hover:decoration-accent">案件索引</button>
                      直接搜案名或譯者，到<button type="button" onClick={() => setView('volumes')} class="text-accent underline decoration-line hover:decoration-accent">卷冊目錄</button>按輯次瀏覽並頁內翻閱 PDF。
                    </p>
                  </div>

                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">連載選輯</h2>
                    <p class="mb-2 text-token-sm leading-relaxed text-ink-muted">
                      四套連號出版的裁判選譯，各按輯次接續。館藏未必自第一輯起——美國自第六輯、日本僅存第二輯。
                    </p>
                    <ul>
                      {series.value.map((s) => {
                        const cc = cases.value.filter((c) => c.系列 === s.name).length;
                        return (
                          <li key={s.name} class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 last:border-b-0">
                            <span class="basis-full text-token-sm text-ink sm:min-w-0 sm:flex-1">{s.name}</span>
                            <span class="shrink-0 text-token-xs tabular-nums text-ink-muted">{volSpan(s.reports)}</span>
                            <span class="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-24 sm:text-right">{yearRange(s.reports) || '—'}</span>
                            <span class="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-16 sm:text-right">{cc ? `${cc} 案` : '按主題'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">出版節奏</h2>
                    <p class="mb-3 text-token-sm leading-relaxed text-ink-muted">每年整理後的裁判正文頁數；缺席年份即當年無新輯出版，最高峰在 2022 年。</p>
                    <ul class="space-y-1">
                      {timeline.map((t) => (
                        <li key={t.年} class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span class="w-10 shrink-0 text-token-xs font-semibold tabular-nums text-ink">{t.年}</span>
                          <span class="w-20 shrink-0 sm:w-32"><HBar value={t.頁數} max={maxPages.value} /></span>
                          <span class="w-14 shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-16">{t.頁數} 頁</span>
                          <span class="min-w-0 basis-full truncate text-token-xs text-ink-muted sm:flex-1" title={t.主要觀察}>{t.主要觀察}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">召集與選案</h2>
                    <p class="mb-2 text-token-sm leading-relaxed text-ink-muted">明確出現在例言、序言或簡介中的主導性角色（保守人工校正表）。</p>
                    <div>
                      {leadership.map((p) => (
                        <div key={p.姓名} class="border-b border-line-soft py-2.5 last:border-b-0">
                          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span class="text-token-base font-semibold text-ink">{p.姓名}</span>
                            <span class="text-token-xs text-accent">{p.明確角色}</span>
                            <span class="text-token-xs text-ink-muted">— {p.涉及資料}</span>
                          </div>
                          {p.證據 ? <p class="mt-1 text-token-xs leading-relaxed text-ink-muted">{p.證據}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {view.value === 'cases' ? (
                <section class="space-y-4">
                  <div>
                    <h2 class="text-token-lg font-semibold text-ink">案件索引</h2>
                    <p class="mt-1 max-w-3xl text-token-sm leading-relaxed text-ink-muted">
                      {摘要.案件總數} 件單一裁判譯文，橫跨全部卷冊。搜案名、爭點或譯者、依系列篩選；點案名即頁內翻閱該裁判 PDF
                      （少數尚未鏡像者附 <ExternalLink size={11} class="inline align-baseline" />、於官網開啟）。
                      日本第一輯官網僅給編號，案名與爭點已據該卷目次還原一併收入；美國第六–八輯按基本權主題分節、非逐案，僅見卷冊目錄。
                    </p>
                  </div>

                  <SearchField value={q.value} onChange={setQ} placeholder="搜尋案名、爭點或譯者…" />

                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="mr-1 text-token-xs text-ink-faint">系列</span>
                    <button type="button" onClick={() => setSeriesFilter('all')}
                      class={`rounded-token-md border px-2 py-0.5 text-token-xs transition-colors duration-fast ${seriesFilter.value === 'all' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted'}`}>全部</button>
                    {caseSeries.value.map((s) => (
                      <button key={s} type="button" onClick={() => setSeriesFilter(s)}
                        class={`rounded-token-md border px-2 py-0.5 text-token-xs transition-colors duration-fast ${seriesFilter.value === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted'}`}>{s}</button>
                    ))}
                    <Dropdown
                      class="ml-1"
                      value={translatorFilter.value}
                      onChange={setTranslatorFilter}
                      buttonClassName="min-w-[7rem] justify-between"
                      options={[{ value: 'all', label: '全部譯者' },
                        ...caseTranslators.value.map(([t, n]) => ({ value: t, label: t, hint: String(n) }))]}
                    />
                  </div>

                  <p class="text-token-xs tabular-nums text-ink-muted">{filteredCases.value.length} / {cases.value.length} 件</p>

                  <ul>
                    {filteredCases.value.slice(0, 500).map((c, i) => (
                      <li key={`${c.assetKey}-${i}`} class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 last:border-b-0">
                        <button type="button"
                          onClick={() => (c.assetKey
                            ? setViewing({ assetKey: c.assetKey, 顯示名: c.案名, 頁數: c.頁數, 位元組: c.位元組 })
                            : window.open(c.外部連結, '_blank', 'noopener,noreferrer'))}
                          class="min-w-0 basis-full truncate text-left text-token-sm text-ink transition-colors duration-fast hover:text-accent sm:flex-1"
                          title={c.assetKey ? c.案名 : `${c.案名}（官網開啟）`}>
                          {c.案名}{c.assetKey ? null : <ExternalLink size={11} class="ml-1 inline align-baseline text-ink-faint" />}
                        </button>
                        {c.譯者?.length ? <span class="shrink-0 text-token-xs text-ink-muted">{c.譯者.join('、')} 譯</span> : null}
                        <span class="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-24 sm:text-right">{c.系列短}·輯{c.輯次}</span>
                        <span class="shrink-0 text-token-xs tabular-nums text-ink-faint sm:w-12 sm:text-right">{c.年}</span>
                        {c.爭點 ? <p class="basis-full truncate text-token-xs text-ink-muted" title={c.爭點}>{c.爭點}</p> : null}
                      </li>
                    ))}
                  </ul>
                  {filteredCases.value.length > 500 ? (
                    <p class="pt-2 text-token-xs text-ink-faint">只顯示前 500 件；輸入關鍵字或縮小系列以進一步篩選。</p>
                  ) : null}
                  {filteredCases.value.length === 0 ? (
                    <p class="py-6 text-token-sm text-ink-muted">沒有符合的案件。清除搜尋或改選系列／譯者。</p>
                  ) : null}
                </section>
              ) : null}

              {view.value === 'volumes' ? (
                <section class="space-y-10">
                  <div class="flex items-center gap-3 text-token-xs text-ink-muted">
                    <button type="button" onClick={acc.expandAll} class="transition-colors duration-fast hover:text-accent">全部展開</button>
                    <span class="text-line">·</span>
                    <button type="button" onClick={acc.collapseAll} class="transition-colors duration-fast hover:text-accent">全部收合</button>
                  </div>

                  {series.value.map((s) => (
                    <div key={s.name}>
                      <h2 class="text-token-lg font-semibold text-ink">{s.name}</h2>
                      <p class="mb-2 flex flex-wrap items-center gap-x-2 text-token-xs tabular-nums text-ink-muted">
                        <span>{volSpan(s.reports)}</span><span class="text-line">·</span>
                        <span>{s.reports.length} 輯</span>
                        {yearRange(s.reports) ? <><span class="text-line">·</span><span>{yearRange(s.reports)}</span></> : null}
                        <span class="text-line">·</span><span>{s.reports.reduce((n, r) => n + r.檔案數, 0)} 件全文</span>
                      </p>
                      <div>
                        {s.reports.map((r) => (
                          <AccordionItem key={r.序號} id={r.序號} isOpen={acc.isOpen(r.序號)} onToggle={acc.toggle}
                            title={
                              <span class="flex items-baseline gap-3">
                                <span class="w-12 shrink-0 tabular-nums text-ink-faint">輯 {r.輯次}</span>
                                <span class="min-w-0 font-semibold text-ink">{r.報告名稱}</span>
                              </span>
                            }
                            meta={
                              <span class="tabular-nums text-ink-muted">
                                {r.採信年月ISO || r.官方頁面日期} · {r.檔案數} 件
                                {r.是修訂再版 ? <span class="ml-1 text-ink-faint" title={`${r.日期口徑}｜初版 ${r.初版年月}（民國79年）·2020 修訂再版`}>· 初版 {r.初版年月}</span>
                                  : !r.採入時間線 ? <span class="ml-1 text-ink-faint" title={r.日期口徑}>· 日期非翻譯時間</span> : null}
                              </span>
                            }
                          >
                            <VolumeSource r={r} />
                            <ul>{r.檔案.map((f, i) => <FileRow key={i} f={f} onView={setViewing} />)}</ul>
                          </AccordionItem>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <h2 class="text-token-lg font-semibold text-ink">單本文獻</h2>
                    <p class="mb-2 text-token-xs text-ink-muted">不成連載的法規、司法互助與指引資料，按來源歸類。</p>
                    {standalone.value.map(([cat, rs]) => (
                      <div key={cat} class="mt-4 first:mt-2">
                        <h3 class="mb-1 text-token-sm font-semibold text-ink-muted">{cat}</h3>
                        <div>
                          {rs.map((r) => (
                            <AccordionItem key={r.序號} id={r.序號} isOpen={acc.isOpen(r.序號)} onToggle={acc.toggle}
                              title={<span class="font-semibold text-ink">{r.報告名稱}</span>}
                              meta={<span class="tabular-nums text-ink-muted">{r.採信年月ISO || r.官方頁面日期} · {r.檔案數} 件</span>}
                            >
                              <VolumeSource r={r} />
                              <ul>{r.檔案.map((f, i) => <FileRow key={i} f={f} onView={setViewing} />)}</ul>
                            </AccordionItem>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {view.value === 'about' ? (
                <section class="max-w-3xl space-y-5">
                  <h2 class="text-token-lg font-semibold text-ink">關於這份索引</h2>
                  <p class="text-token-base leading-relaxed text-ink-muted">
                    全文為離線整理後的可讀鏡像。官方入口是 JIRS 電子出版品檢索系統，把每筆報告拆成數十個附檔、只能逐一強制下載，
                    前面還擋著一層防自動下載的安全檢查，網路上也找不到現成的存檔。這裡把 {摘要.官方報告數} 筆報告、{摘要.檔案總數} 件附檔收攏起來，可以檢索。
                  </p>
                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">附檔怎麼分類</h2>
                    <p class="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                      每個 PDF 依檔名歸為四類：<strong class="text-ink">案件</strong>（單一裁判譯文，{摘要.附檔類型?.案件} 件，案件索引的母體）、
                      <strong class="text-ink">前置</strong>（封面例言目次索引，{摘要.附檔類型?.前置} 件）、
                      <strong class="text-ink">主題節</strong>（美國選輯按基本權分節，{摘要.附檔類型?.主題節} 件）、
                      <strong class="text-ink">全文</strong>（單本法規全文，{摘要.附檔類型?.全文} 件）。這四類涵蓋全部附檔，沒有落在分類之外的檔案。
                    </p>
                  </div>
                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">日期怎麼採信</h2>
                    <p class="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                      日期只在官方日期可合理視為司法院翻譯或初版時間時才採入節奏圖。德國選輯第 1 輯以「西德」舊名於民國 79 年（1990）
                      由司法院初版，corpus 內的 2020-10 為修訂再版，排序仍以輯次為準，不因再版日漂到序列中間。
                    </p>
                  </div>
                  <div>
                    <h2 class="mb-2 text-token-lg font-semibold text-ink">資料來源</h2>
                    <p class="mb-3 text-token-sm leading-relaxed text-ink-muted">
                      原始出版品來自兩個官方系統。各卷的官方詳情頁與完整文件連結收在卷冊目錄逐卷附上，此處為系統層入口。
                    </p>
                    <ul class="space-y-2">
                      {(來源.系統清單 || []).map((s) => (
                        <li key={s.名稱} class="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                          <a href={s.入口} target="_blank" rel="noreferrer" class="font-semibold text-ink underline decoration-line hover:text-accent">{s.名稱} <ExternalLink size={11} class="inline align-baseline" /></a>
                          {/* 匯文明朝體把全形直線 U+FF5C 畫成 281/1000 寬（同半形），兩邊各補一個
                              半形空格（333）才湊得出一個全形的間距。nbsp 在這套字體裡是 1000，太寬。 */}
                          <span class="mt-0.5 block text-token-xs text-ink-faint">{s.涵蓋}<span class="whitespace-nowrap"> ｜ </span>{s.備註}</span>
                        </li>
                      ))}
                    </ul>
                    {(來源.書目查證 || []).length ? (
                      <p class="mt-3 border-l-2 border-line pl-3 text-token-xs leading-relaxed text-ink-faint">
                        書目查證：{來源.書目查證.join('；')}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

      </RailLayout>

      {viewing.value ? (
        <PdfViewer
          src={pdfUrl(viewing.value.assetKey)}
          title={viewing.value.顯示名}
          subtitle={`${viewing.value.頁數 ? `${viewing.value.頁數} 頁 · ` : ''}${fmtBytes(viewing.value.位元組)}`}
          onClose={() => { setViewing(null); setRollCase(null); }}
          roll={rollCase.value ? { onReroll: () => roll(rollPool.value), threads: threadsFor(rollCase.value) } : null} />
      ) : null}
    </>
  );
  };
  },
});
