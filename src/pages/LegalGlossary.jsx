// DATA — 由 jirs-foreign-law 資料倉 sync（scripts/sync_canvas.py）。
// 德國聯邦憲法法院裁判選輯第 6–18 輯的德中法學關鍵詞索引，候選工作表（非定稿辭典）。
import { useMemo, useState } from 'react';
import { Library, Shuffle } from 'lucide-react';
import {
  AppearanceMenu,
  DashboardLayout,
  FontSizeControl,
  SearchField,
  useFontScale,
  useTabParam,
} from '@phenomcanvas/ui';
import data from '../data/generated/glossary.json';
import TermRow from './_jirs-glossary/TermRow';
import FacetBar from './_jirs-glossary/FacetBar';
import ClusterView from './_jirs-glossary/ClusterView';
import RulingsView from './_jirs-glossary/RulingsView';
import QuizView from './_jirs-glossary/QuizView';
import { buildFacets, passFacets, mulberry32 } from './_jirs-glossary/glossary-util';

const TABS = [
  { id: 'search', label: '檢索' },
  { id: 'cluster', label: '聚落' },
  { id: 'rulings', label: '多譯裁決' },
  { id: 'quiz', label: '測驗' },
  { id: 'about', label: '關於' },
];

const LIST_CAP = 400;

export default function LegalGlossary() {
  const [scale, setScale] = useFontScale();
  const [tab, setTab] = useTabParam('tab', 'search');
  const [q, setQ] = useState('');
  const [drawn, setDrawn] = useState(null);

  const { 術語: terms, 裁決: rulings, 來源卷次對照: legend, 摘要, 來源, 狀態說明 } = data;
  const stats = 摘要.裁決統計;

  const facets = useMemo(() => buildFacets(摘要), [摘要]);
  const [sel, setSel] = useState(() => Object.fromEntries(facets.map((f) => [f.key, new Set()])));

  const toggleFacet = (key, val) => setSel((prev) => {
    const next = new Set(prev[key]);
    next.has(val) ? next.delete(val) : next.add(val);
    return { ...prev, [key]: next };
  });
  const clearFacet = (key) => setSel((prev) => ({ ...prev, [key]: new Set() }));
  const clearAll = () => setSel(Object.fromEntries(facets.map((f) => [f.key, new Set()])));

  // 聚落頁的「篩此類」跳回檢索：只留該軸該值，其餘清空，切到檢索頁。
  const jumpToSearch = (key, val) => {
    setSel(Object.fromEntries(facets.map((f) => [f.key, f.key === key ? new Set([val]) : new Set()])));
    setQ('');
    setDrawn(null);
    setTab('search');
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return terms.filter((t) => {
      if (!passFacets(t, facets, sel)) return false;
      if (!needle) return true;
      return t.de.toLowerCase().includes(needle) || t.zh.includes(q.trim());
    });
  }, [terms, q, facets, sel]);

  // 隨機翻閱：從當前篩選結果抽一組，種子取結果長度＋當前抽數，避免用 Math.random 也能連抽不同。
  const draw = () => {
    if (!filtered.length) return;
    const seed = (filtered.length * 2654435761 + (drawn ? drawn._n + 1 : 1)) >>> 0;
    const i = Math.floor(mulberry32(seed)() * filtered.length);
    setDrawn({ ...filtered[i], _n: drawn ? drawn._n + 1 : 1 });
  };

  return (
    <div data-glossary-root>
    <DashboardLayout
      scale={scale}
      headerRight={<><AppearanceMenu /><FontSizeControl scale={scale} onChange={setScale} /></>}
      eyebrow="Phenom · 德語法學譯語表"
      title="德中法學關鍵詞索引"
      titleClassName="font-display"
      summary="德國聯邦憲法法院裁判選輯第 6–18 輯附錄的德中／中德關鍵詞索引，彙整成一份可檢索的雙語對照。這是候選工作表，非權威定稿：含真正異譯、跨輯用語差異與待裁決項。"
      tabs={{ label: '視圖', value: tab, onChange: setTab, items: TABS }}
      refreshKey={tab}
      /* 這頁整欄都是密集文字列（術語表、裁決），是閱讀型而非寬表格型；在較寬視窗給抬頭／
         分頁／內文一條更往內的共同左基準線，貼著頁緣讀起來累。 */
      leftRailTop={
        <div className="mb-4 border-b border-line-soft pb-4">
          <a href="/"
            className="inline-flex items-center gap-2 text-token-sm text-ink-muted transition-colors duration-fast hover:text-accent">
            <Library size={15} className="text-ink-faint" /> 外國法翻譯索引 →
          </a>
          <p className="mt-1 text-token-xs leading-relaxed text-ink-faint">本表出自德國選輯，回到全套裁判譯文與案件索引。</p>
        </div>
      }
    >
      {tab === 'search' ? (
        <section className="max-w-3xl space-y-4">
          <h2 className="sr-only">檢索</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={q} onChange={setQ}
              placeholder="搜尋德文或中文術語…"
              className="min-w-0 flex-1 sm:max-w-md"
            />
            <button
              type="button" onClick={draw}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-token-md border border-line px-2.5 py-2 text-token-xs text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
            >
              <Shuffle size={14} /> 隨機一詞
            </button>
          </div>

          {drawn ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-accent pl-3">
              <span className="text-token-base font-semibold text-ink">{drawn.de}</span>
              <span className="text-token-base text-ink-muted">{drawn.zh}</span>
              <span className="text-token-xs text-ink-faint">{drawn.類型} · 卷 {drawn.卷次.join('、')}</span>
            </div>
          ) : null}

          <FacetBar facets={facets} sel={sel} onToggle={toggleFacet} onClear={clearFacet} onClearAll={clearAll} />

          <p className="text-token-xs tabular-nums text-ink-muted">{filtered.length} / {terms.length} 組</p>

          <ul>
            {filtered.slice(0, LIST_CAP).map((t, i) => <TermRow key={`${t.de}-${t.zh}-${i}`} t={t} />)}
          </ul>
          {filtered.length > LIST_CAP ? (
            <p className="pt-2 text-token-xs text-ink-faint">只顯示前 {LIST_CAP} 組；縮小篩選或輸入關鍵字以進一步篩選。</p>
          ) : null}
          {filtered.length === 0 ? (
            <p className="pt-2 text-token-sm text-ink-muted">目前篩選沒有符合的術語；放寬條件或清除篩選。</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'cluster' ? <ClusterView terms={terms} 摘要={摘要} onJump={jumpToSearch} /> : null}

      {tab === 'rulings' ? <RulingsView rulings={rulings} stats={stats} /> : null}

      {tab === 'quiz' ? <QuizView terms={terms} /> : null}

      {tab === 'about' ? (
        <section className="max-w-3xl space-y-5">
          <h2 className="text-token-lg font-semibold text-ink">關於這份譯語表</h2>
          <p className="text-token-base leading-relaxed text-ink-muted">
            {來源.名稱}，涵蓋{來源.涵蓋卷次}，母體為{來源.母體}。共
            <strong className="mx-1 font-semibold tabular-nums text-ink">{摘要.術語對數}</strong>組去重後的德中對照，其中
            <strong className="mx-1 font-semibold tabular-nums text-ink">{摘要.多譯德詞數}</strong>個德文術語有多個中譯，
            已於「多譯裁決」逐一處理。
          </p>
          <p className="border-l-2 border-line pl-3 text-token-sm leading-relaxed text-ink-muted">{狀態說明}</p>
          <div>
            <h2 className="mb-2 text-token-lg font-semibold text-ink">來源卷次</h2>
            <ul>
              {Object.entries(legend).map(([sid, info]) => (
                <li key={sid} className="flex gap-3 border-b border-line-soft py-1.5 text-token-sm text-ink-muted last:border-b-0">
                  <span className="w-14 shrink-0 tabular-nums text-ink">第 {info.卷} 輯</span>
                  <span>{info.索引}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </DashboardLayout>
    </div>
  );
}
