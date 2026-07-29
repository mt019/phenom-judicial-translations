// DATA — 由 jirs-foreign-law 資料倉 sync（scripts/sync_canvas.py）。canvas 只管前端：
// 此頁只吃輕量 metadata；PDF 全文由資料倉部署站以 URL 提供，不進本倉。
//
// 版型學中研院法研所出版品頁（IiasPublications）：左側常駐導覽欄＋主欄索引。但內容模型
// 出自本資料自身的結構——544 個附檔裡有 444 個是「單一裁判譯文」，那才是法律研究者檢索的
// 單位，所以主軸是「案件索引」（可搜案名／譯者、依系列篩），卷冊目錄與陽春清單保留為另一檢視。
import { useMemo, useState, useCallback } from 'react';
import { ExternalLink, BookMarked, Dices } from 'lucide-react';
import {
  AccordionItem,
  AppearanceMenu,
  BackLink,
  Dropdown,
  Eyebrow,
  FontSizeControl,
  PdfViewer,
  SearchField,
  SHELL_PAD_X_RAIL,
  useExpandedSet,
  useFontScale,
  useTabParam,
} from '@phenomcanvas/ui';
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
    <span className="inline-block h-2.5 w-full align-middle">
      <span className="block h-2.5 rounded-[2px]"
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
    <li className="flex items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <button type="button" onClick={open}
        className="min-w-0 flex-1 truncate text-left text-token-sm text-ink transition-colors duration-fast hover:text-accent"
        title={ext ? `${label}（官網開啟）` : label}>
        {label}
        {isCase && f.譯者?.length ? <span className="ml-2 text-token-xs text-ink-muted">{f.譯者.join('、')} 譯</span> : null}
        {f.作者 ? <span className="ml-2 text-token-xs text-ink-muted">{f.作者}{f.角色 ? ` ${f.角色}` : ''}</span> : null}
        {!isCase && f.類型 !== '前置' ? <span className="ml-2 text-token-xs text-ink-faint">{f.類型}</span> : null}
        {ext ? <ExternalLink size={11} className="ml-1 inline align-baseline text-ink-faint" /> : null}
      </button>
      <span className="hidden shrink-0 text-token-xs tabular-nums text-ink-muted sm:inline">
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
    <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-token-xs text-ink-faint">
      <span>{r.來源系統 === 'cons' ? '憲法法庭官網' : 'JIRS 官方'}</span>
      {r.官方詳情頁 ? <a href={r.官方詳情頁} target="_blank" rel="noreferrer" className={linkCls}>官方詳情頁 <ExternalLink size={10} className="inline align-baseline" /></a> : null}
      {r.完整文件連結 ? <a href={r.完整文件連結} target="_blank" rel="noreferrer" className={linkCls}>完整文件下載 <ExternalLink size={10} className="inline align-baseline" /></a> : null}
      {r.ISBN ? <span className="tabular-nums">ISBN {r.ISBN}</span> : null}
    </p>
  );
}

export default function JirsForeignLaw() {
  const [scale, setScale] = useFontScale();
  const [view, setView] = useTabParam('view', 'overview');
  const [viewing, setViewing] = useState(null);
  const [q, setQ] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [translatorFilter, setTranslatorFilter] = useState('all');

  const { 報告: reports, 時間軸: timeline, 主導人: leadership, 摘要, 來源 } = data;

  const series = useMemo(() => {
    const m = new Map();
    for (const r of reports) {
      if (!r.系列) continue;
      if (!m.has(r.系列)) m.set(r.系列, []);
      m.get(r.系列).push(r);
    }
    return [...m.entries()]
      .map(([name, rs]) => ({ name, order: rs[0].系列排序 ?? 99, reports: rs.slice().sort((a, b) => (a.輯次 ?? 0) - (b.輯次 ?? 0)) }))
      .sort((a, b) => a.order - b.order);
  }, [reports]);

  const standalone = useMemo(() => {
    const m = new Map();
    for (const r of reports) {
      if (r.系列) continue;
      if (!m.has(r.分類)) m.set(r.分類, []);
      m.get(r.分類).push(r);
    }
    return [...m.entries()];
  }, [reports]);

  // 案件索引：把每個「案件」型附檔攤平成一筆，帶上所屬系列／輯／年，供搜尋與篩選。
  const cases = useMemo(() => {
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
  }, [reports]);

  const caseSeries = useMemo(() => [...new Set(cases.map((c) => c.系列短))], [cases]);
  const caseTranslators = useMemo(() => {
    const c = new Map();
    for (const cs of cases) for (const t of cs.譯者) c.set(t, (c.get(t) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [cases]);

  const filteredCases = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases.filter((c) => {
      if (seriesFilter !== 'all' && c.系列短 !== seriesFilter) return false;
      if (translatorFilter !== 'all' && !c.譯者.includes(translatorFilter)) return false;
      if (!needle) return true;
      return c.案名.toLowerCase().includes(needle) || c.爭點.toLowerCase().includes(needle) || c.譯者.some((t) => t.includes(q.trim()));
    });
  }, [cases, q, seriesFilter, translatorFilter]);

  // 隨機翻閱／換一篇／順藤摸瓜／每日一案——把索引變成可漫遊的東西。
  // pool 只取 R2 有穩定 asset key 者，換一篇的迴圈才不會彈到官網新分頁而斷掉。
  const rollPool = useMemo(() => cases.filter((c) => c.assetKey), [cases]);
  const [rollCase, setRollCase] = useState(null);
  const openCase = useCallback((c) => {
    setRollCase(c);
    setViewing({ assetKey: c.assetKey, 顯示名: c.案名, 頁數: c.頁數, 位元組: c.位元組 });
  }, []);
  const roll = useCallback((pool) => {
    const p = pool && pool.length ? pool : rollPool;
    if (p.length) openCase(p[Math.floor(Math.random() * p.length)]);
  }, [rollPool, openCase]);
  // 每日一案：以當天日期當 seed，一整天固定同一篇（瀏覽器端 Date，非 sandbox）。
  const daily = useMemo(() => {
    if (!rollPool.length) return null;
    const d = new Date();
    const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
    return rollPool[seed % rollPool.length];
  }, [rollPool]);
  const threadsFor = useCallback((c) => (c ? [
    c.譯者.length ? { label: `同譯者（${c.譯者[0]}）`, run: () => roll(rollPool.filter((x) => x.譯者.some((t) => c.譯者.includes(t)))) } : null,
    { label: `同法院（${c.系列短}）`, run: () => roll(rollPool.filter((x) => x.系列短 === c.系列短)) },
    c.輯次 != null ? { label: `同卷（輯${c.輯次}）`, run: () => roll(rollPool.filter((x) => x.系列短 === c.系列短 && x.輯次 === c.輯次)) } : null,
  ].filter(Boolean) : []), [roll, rollPool]);

  const reportIds = useMemo(() => reports.map((r) => r.序號), [reports]);
  const acc = useExpandedSet(reportIds);
  const maxPages = Math.max(...timeline.map((t) => t.頁數));

  return (
    <>
      <main data-search-root className="min-h-screen bg-paper paper-texture text-ink" style={{ '--reader-scale': scale }}>
        <div className={`mx-auto max-w-7xl ${SHELL_PAD_X_RAIL}`}>
          <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">

            {/* ── 左側常駐導覽欄（IIAS 式） ── */}
            <aside className="contents lg:block lg:py-5 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:border-r lg:pr-5">
              <div className="flex items-center justify-between gap-2 pt-5 lg:flex-col lg:items-start lg:gap-3 lg:pt-0">
                {/* 這頁自己刻了左欄，返回鍵走共用元件＋全站配置，不寫死落點。 */}
                <BackLink className="shrink-0 whitespace-nowrap text-token-sm text-ink-faint transition-colors duration-fast hover:text-accent" />
                <div className="flex shrink-0 items-center gap-2">
                  <AppearanceMenu /><FontSizeControl scale={scale} onChange={setScale} />
                </div>
              </div>
              <button type="button"
                onClick={() => { setView('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="group mt-4 block text-left"
                title="回本頁首頁（總覽）">
                <Eyebrow className="mb-1">司法院中譯外國法學</Eyebrow>
                <h1 className="font-display text-token-lg leading-tight text-ink transition-colors duration-fast group-hover:text-accent lg:text-token-xl">外國法翻譯索引</h1>
              </button>
              {/* 窄屏吸頂時換行，不橫捲（見 validate-shell-chrome.mjs 的吸頂欄規則）。
                  lg 起改成左欄的直排格線，本來就不會有橫向問題。 */}
              <nav className="sticky top-0 z-20 mt-5 flex flex-wrap gap-1 border-b border-line-soft bg-paper py-2 lg:static lg:z-auto lg:grid lg:gap-0.5 lg:border-b-0 lg:bg-transparent lg:py-0">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" onClick={() => setView(v.id)}
                    className={`shrink-0 rounded-token-md px-2.5 py-1.5 text-left text-token-sm transition-colors duration-fast ${
                      view === v.id ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-muted hover:text-ink'
                    }`}
                  >{v.label}</button>
                ))}
              </nav>
              <div className="mt-5 border-t border-line-soft pt-4">
                <button type="button" onClick={() => roll(rollPool)}
                  className="inline-flex items-center gap-2 text-token-sm text-ink-muted transition-colors duration-fast hover:text-accent">
                  <Dices size={15} className="text-ink-faint" /> 隨機翻閱一篇 →
                </button>
                <p className="mt-1 hidden text-token-xs leading-relaxed text-ink-faint lg:block">從 {rollPool.length} 篇裁判裡擲一篇；翻開後可「換一篇」，或順藤摸瓜到同譯者／同法院／同卷。</p>
              </div>
              {daily ? (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <div className="text-token-xs font-semibold uppercase tracking-wide text-ink-faint">今日一案</div>
                  <button type="button" onClick={() => openCase(daily)}
                    className="mt-1 block text-left text-token-sm leading-snug text-ink transition-colors duration-fast hover:text-accent">{daily.案名}</button>
                  <div className="mt-0.5 text-token-xs text-ink-muted">
                    {daily.譯者.length ? `${daily.譯者.join('、')} 譯 · ` : ''}{daily.系列短}{daily.輯次 != null ? `·輯${daily.輯次}` : ''}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 border-t border-line-soft pt-4">
                <a href="/glossary/"
                  className="inline-flex items-center gap-2 text-token-sm text-ink-muted transition-colors duration-fast hover:text-accent">
                  <BookMarked size={15} className="text-ink-faint" /> 德中法學譯語表 →
                </a>
                <p className="mt-1 hidden text-token-xs leading-relaxed text-ink-faint lg:block">德國選輯附錄的德中關鍵詞索引，與本頁互為經緯。</p>
              </div>
            </aside>

            {/* ── 主欄 ── */}
            <div className="reader-scale min-w-0 py-8">

              {view === 'overview' ? (
                <section className="max-w-3xl space-y-8">
                  {daily ? (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-line pl-3">
                      <span className="shrink-0 text-token-xs font-semibold uppercase tracking-wide text-ink-faint">今日一案</span>
                      <button type="button" onClick={() => openCase(daily)}
                        className="text-token-sm text-ink transition-colors duration-fast hover:text-accent">{daily.案名}</button>
                      <span className="shrink-0 text-token-xs text-ink-muted">
                        {daily.譯者.length ? `${daily.譯者.join('、')} 譯 · ` : ''}{daily.系列短}{daily.輯次 != null ? `·輯${daily.輯次}` : ''}
                      </span>
                    </div>
                  ) : null}
                  <div className="space-y-4">
                    <h2 className="text-token-lg font-semibold text-ink">這是什麼</h2>
                    <p className="text-token-base leading-relaxed text-ink-muted">
                      司法院自 1990 年起，以「中譯外國法學」為名，分批把外國憲法法院裁判與法制資料譯成中文出版。
                      主力是<strong className="font-semibold text-ink">德國聯邦憲法法院裁判選輯</strong>（輯 1–18，連載逾三十年）與
                      <strong className="font-semibold text-ink">歐洲人權法院裁判選譯</strong>（六輯），另有美國、日本、韓國、法國資料。
                    </p>
                    <p className="text-token-base leading-relaxed text-ink-muted">
                      官方入口把每筆報告拆成數十個附檔、只能逐一強制下載，前面還擋著一層防自動下載的安全檢查。這裡把整批
                      <strong className="mx-1 font-semibold tabular-nums text-ink">{摘要.檔案總數}</strong>件全文收攏，其中
                      <strong className="mx-1 font-semibold tabular-nums text-ink">{摘要.案件總數}</strong>件是可逐案檢索的單一裁判譯文——
                      到<button type="button" onClick={() => setView('cases')} className="text-accent underline decoration-line hover:decoration-accent">案件索引</button>
                      直接搜案名或譯者，到<button type="button" onClick={() => setView('volumes')} className="text-accent underline decoration-line hover:decoration-accent">卷冊目錄</button>按輯次瀏覽並頁內翻閱 PDF。
                    </p>
                  </div>

                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">連載選輯</h2>
                    <p className="mb-2 text-token-sm leading-relaxed text-ink-muted">
                      四套連號出版的裁判選譯，各按輯次接續。館藏未必自第一輯起——美國自第六輯、日本僅存第二輯。
                    </p>
                    <ul>
                      {series.map((s) => {
                        const cc = cases.filter((c) => c.系列 === s.name).length;
                        return (
                          <li key={s.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 last:border-b-0">
                            <span className="basis-full text-token-sm text-ink sm:min-w-0 sm:flex-1">{s.name}</span>
                            <span className="shrink-0 text-token-xs tabular-nums text-ink-muted">{volSpan(s.reports)}</span>
                            <span className="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-24 sm:text-right">{yearRange(s.reports) || '—'}</span>
                            <span className="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-16 sm:text-right">{cc ? `${cc} 案` : '按主題'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">出版節奏</h2>
                    <p className="mb-3 text-token-sm leading-relaxed text-ink-muted">每年整理後的裁判正文頁數；缺席年份即當年無新輯出版，最高峰在 2022 年。</p>
                    <ul className="space-y-1">
                      {timeline.map((t) => (
                        <li key={t.年} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="w-10 shrink-0 text-token-xs font-semibold tabular-nums text-ink">{t.年}</span>
                          <span className="w-20 shrink-0 sm:w-32"><HBar value={t.頁數} max={maxPages} /></span>
                          <span className="w-14 shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-16">{t.頁數} 頁</span>
                          <span className="min-w-0 basis-full truncate text-token-xs text-ink-muted sm:flex-1" title={t.主要觀察}>{t.主要觀察}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">召集與選案</h2>
                    <p className="mb-2 text-token-sm leading-relaxed text-ink-muted">明確出現在例言、序言或簡介中的主導性角色（保守人工校正表）。</p>
                    <div>
                      {leadership.map((p) => (
                        <div key={p.姓名} className="border-b border-line-soft py-2.5 last:border-b-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-token-base font-semibold text-ink">{p.姓名}</span>
                            <span className="text-token-xs text-accent">{p.明確角色}</span>
                            <span className="text-token-xs text-ink-muted">— {p.涉及資料}</span>
                          </div>
                          {p.證據 ? <p className="mt-1 text-token-xs leading-relaxed text-ink-muted">{p.證據}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {view === 'cases' ? (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-token-lg font-semibold text-ink">案件索引</h2>
                    <p className="mt-1 max-w-3xl text-token-sm leading-relaxed text-ink-muted">
                      {摘要.案件總數} 件單一裁判譯文，橫跨全部卷冊。搜案名、爭點或譯者、依系列篩選；點案名即頁內翻閱該裁判 PDF
                      （少數尚未鏡像者附 <ExternalLink size={11} className="inline align-baseline" />、於官網開啟）。
                      日本第一輯官網僅給編號，案名與爭點已據該卷目次還原一併收入；美國第六–八輯按基本權主題分節、非逐案，僅見卷冊目錄。
                    </p>
                  </div>

                  <SearchField value={q} onChange={setQ} placeholder="搜尋案名、爭點或譯者…" />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-token-xs text-ink-faint">系列</span>
                    <button type="button" onClick={() => setSeriesFilter('all')}
                      className={`rounded-token-md border px-2 py-0.5 text-token-xs transition-colors duration-fast ${seriesFilter === 'all' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted'}`}>全部</button>
                    {caseSeries.map((s) => (
                      <button key={s} type="button" onClick={() => setSeriesFilter(s)}
                        className={`rounded-token-md border px-2 py-0.5 text-token-xs transition-colors duration-fast ${seriesFilter === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted'}`}>{s}</button>
                    ))}
                    <Dropdown
                      className="ml-1"
                      value={translatorFilter}
                      onChange={setTranslatorFilter}
                      buttonClassName="min-w-[7rem] justify-between"
                      options={[{ value: 'all', label: '全部譯者' },
                        ...caseTranslators.map(([t, n]) => ({ value: t, label: t, hint: String(n) }))]}
                    />
                  </div>

                  <p className="text-token-xs tabular-nums text-ink-muted">{filteredCases.length} / {cases.length} 件</p>

                  <ul>
                    {filteredCases.slice(0, 500).map((c, i) => (
                      <li key={`${c.assetKey}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 last:border-b-0">
                        <button type="button"
                          onClick={() => (c.assetKey
                            ? setViewing({ assetKey: c.assetKey, 顯示名: c.案名, 頁數: c.頁數, 位元組: c.位元組 })
                            : window.open(c.外部連結, '_blank', 'noopener,noreferrer'))}
                          className="min-w-0 basis-full truncate text-left text-token-sm text-ink transition-colors duration-fast hover:text-accent sm:flex-1"
                          title={c.assetKey ? c.案名 : `${c.案名}（官網開啟）`}>
                          {c.案名}{c.assetKey ? null : <ExternalLink size={11} className="ml-1 inline align-baseline text-ink-faint" />}
                        </button>
                        {c.譯者?.length ? <span className="shrink-0 text-token-xs text-ink-muted">{c.譯者.join('、')} 譯</span> : null}
                        <span className="shrink-0 text-token-xs tabular-nums text-ink-muted sm:w-24 sm:text-right">{c.系列短}·輯{c.輯次}</span>
                        <span className="shrink-0 text-token-xs tabular-nums text-ink-faint sm:w-12 sm:text-right">{c.年}</span>
                        {c.爭點 ? <p className="basis-full truncate text-token-xs text-ink-muted" title={c.爭點}>{c.爭點}</p> : null}
                      </li>
                    ))}
                  </ul>
                  {filteredCases.length > 500 ? (
                    <p className="pt-2 text-token-xs text-ink-faint">只顯示前 500 件；輸入關鍵字或縮小系列以進一步篩選。</p>
                  ) : null}
                  {filteredCases.length === 0 ? (
                    <p className="py-6 text-token-sm text-ink-muted">沒有符合的案件。清除搜尋或改選系列／譯者。</p>
                  ) : null}
                </section>
              ) : null}

              {view === 'volumes' ? (
                <section className="space-y-10">
                  <div className="flex items-center gap-3 text-token-xs text-ink-muted">
                    <button type="button" onClick={acc.expandAll} className="transition-colors duration-fast hover:text-accent">全部展開</button>
                    <span className="text-line">·</span>
                    <button type="button" onClick={acc.collapseAll} className="transition-colors duration-fast hover:text-accent">全部收合</button>
                  </div>

                  {series.map((s) => (
                    <div key={s.name}>
                      <h2 className="text-token-lg font-semibold text-ink">{s.name}</h2>
                      <p className="mb-2 flex flex-wrap items-center gap-x-2 text-token-xs tabular-nums text-ink-muted">
                        <span>{volSpan(s.reports)}</span><span className="text-line">·</span>
                        <span>{s.reports.length} 輯</span>
                        {yearRange(s.reports) ? <><span className="text-line">·</span><span>{yearRange(s.reports)}</span></> : null}
                        <span className="text-line">·</span><span>{s.reports.reduce((n, r) => n + r.檔案數, 0)} 件全文</span>
                      </p>
                      <div>
                        {s.reports.map((r) => (
                          <AccordionItem key={r.序號} id={r.序號} isOpen={acc.isOpen(r.序號)} onToggle={acc.toggle}
                            title={
                              <span className="flex items-baseline gap-3">
                                <span className="w-12 shrink-0 tabular-nums text-ink-faint">輯 {r.輯次}</span>
                                <span className="min-w-0 font-semibold text-ink">{r.報告名稱}</span>
                              </span>
                            }
                            meta={
                              <span className="tabular-nums text-ink-muted">
                                {r.採信年月ISO || r.官方頁面日期} · {r.檔案數} 件
                                {r.是修訂再版 ? <span className="ml-1 text-ink-faint" title={`${r.日期口徑}｜初版 ${r.初版年月}（民國79年）·2020 修訂再版`}>· 初版 {r.初版年月}</span>
                                  : !r.採入時間線 ? <span className="ml-1 text-ink-faint" title={r.日期口徑}>· 日期非翻譯時間</span> : null}
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
                    <h2 className="text-token-lg font-semibold text-ink">單本文獻</h2>
                    <p className="mb-2 text-token-xs text-ink-muted">不成連載的法規、司法互助與指引資料，按來源歸類。</p>
                    {standalone.map(([cat, rs]) => (
                      <div key={cat} className="mt-4 first:mt-2">
                        <h3 className="mb-1 text-token-sm font-semibold text-ink-muted">{cat}</h3>
                        <div>
                          {rs.map((r) => (
                            <AccordionItem key={r.序號} id={r.序號} isOpen={acc.isOpen(r.序號)} onToggle={acc.toggle}
                              title={<span className="font-semibold text-ink">{r.報告名稱}</span>}
                              meta={<span className="tabular-nums text-ink-muted">{r.採信年月ISO || r.官方頁面日期} · {r.檔案數} 件</span>}
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

              {view === 'about' ? (
                <section className="max-w-3xl space-y-5">
                  <h2 className="text-token-lg font-semibold text-ink">關於這份索引</h2>
                  <p className="text-token-base leading-relaxed text-ink-muted">
                    全文為離線整理後的可讀鏡像。官方入口是 JIRS 電子出版品檢索系統，把每筆報告拆成數十個附檔、只能逐一強制下載，
                    前面還擋著一層防自動下載的安全檢查，網路上也找不到現成的存檔。這裡把 {摘要.官方報告數} 筆報告、{摘要.檔案總數} 件附檔收攏起來，可以檢索。
                  </p>
                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">附檔怎麼分類</h2>
                    <p className="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                      每個 PDF 依檔名歸為四類：<strong className="text-ink">案件</strong>（單一裁判譯文，{摘要.附檔類型?.案件} 件，案件索引的母體）、
                      <strong className="text-ink">前置</strong>（封面例言目次索引，{摘要.附檔類型?.前置} 件）、
                      <strong className="text-ink">主題節</strong>（美國選輯按基本權分節，{摘要.附檔類型?.主題節} 件）、
                      <strong className="text-ink">全文</strong>（單本法規全文，{摘要.附檔類型?.全文} 件）。這四類涵蓋全部附檔，沒有落在分類之外的檔案。
                    </p>
                  </div>
                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">日期怎麼採信</h2>
                    <p className="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                      日期只在官方日期可合理視為司法院翻譯或初版時間時才採入節奏圖。德國選輯第 1 輯以「西德」舊名於民國 79 年（1990）
                      由司法院初版，corpus 內的 2020-10 為修訂再版，排序仍以輯次為準，不因再版日漂到序列中間。
                    </p>
                  </div>
                  <div>
                    <h2 className="mb-2 text-token-lg font-semibold text-ink">資料來源</h2>
                    <p className="mb-3 text-token-sm leading-relaxed text-ink-muted">
                      原始出版品來自兩個官方系統。各卷的官方詳情頁與完整文件連結收在卷冊目錄逐卷附上，此處為系統層入口。
                    </p>
                    <ul className="space-y-2">
                      {(來源.系統清單 || []).map((s) => (
                        <li key={s.名稱} className="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">
                          <a href={s.入口} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-line hover:text-accent">{s.名稱} <ExternalLink size={11} className="inline align-baseline" /></a>
                          {/* 匯文明朝體把全形直線 U+FF5C 畫成 281/1000 寬（同半形），兩邊各補一個
                              半形空格（333）才湊得出一個全形的間距。nbsp 在這套字體裡是 1000，太寬。 */}
                          <span className="mt-0.5 block text-token-xs text-ink-faint">{s.涵蓋}<span className="whitespace-nowrap"> ｜ </span>{s.備註}</span>
                        </li>
                      ))}
                    </ul>
                    {(來源.書目查證 || []).length ? (
                      <p className="mt-3 border-l-2 border-line pl-3 text-token-xs leading-relaxed text-ink-faint">
                        書目查證：{來源.書目查證.join('；')}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

            </div>
          </div>
        </div>
      </main>

      {viewing ? (
        <PdfViewer
          src={pdfUrl(viewing.assetKey)}
          title={viewing.顯示名}
          subtitle={`${viewing.頁數 ? `${viewing.頁數} 頁 · ` : ''}${fmtBytes(viewing.位元組)}`}
          onClose={() => { setViewing(null); setRollCase(null); }}
          roll={rollCase ? { onReroll: () => roll(rollPool), threads: threadsFor(rollCase) } : null} />
      ) : null}
    </>
  );
}
