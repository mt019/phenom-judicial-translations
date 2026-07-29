// 分面篩選列：每軸一列，label ＋ 可切換 chip。軸內 OR、軸間 AND（語意見 glossary-util）。
// 密集 chip、無卡片；窄屏 chip 自然換行，label 用 basis-full 讓它獨佔一行不擠壓 chip。

function FacetRow({ facet, selected, onToggle, onClear }) {
  const active = selected && selected.size > 0;
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="mr-1 w-8 shrink-0 text-token-xs text-ink-faint sm:w-10">{facet.label}</span>
      {facet.values.map((v) => {
        const on = active && selected.has(v);
        const n = facet.counts ? facet.counts[v] : null;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(facet.key, v)}
            aria-pressed={on}
            className={`rounded-token-md border px-2 py-0.5 text-token-xs transition-colors duration-fast ${
              on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-faint hover:border-accent hover:text-accent'
            }`}
          >
            {v}
            {n != null ? <span className="ml-1 tabular-nums opacity-70">{n}</span> : null}
          </button>
        );
      })}
      {active ? (
        <button
          type="button"
          onClick={() => onClear(facet.key)}
          className="ml-0.5 text-token-xs text-ink-faint underline decoration-line underline-offset-2 transition-colors duration-fast hover:text-accent"
        >
          清除
        </button>
      ) : null}
    </div>
  );
}

export default function FacetBar({ facets, sel, onToggle, onClear, onClearAll }) {
  const anyActive = facets.some((f) => sel[f.key] && sel[f.key].size > 0);
  return (
    <div className="space-y-2">
      {facets.map((f) => (
        <FacetRow key={f.key} facet={f} selected={sel[f.key]} onToggle={onToggle} onClear={onClear} />
      ))}
      {anyActive ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-token-xs text-ink-muted underline decoration-line underline-offset-2 transition-colors duration-fast hover:text-accent"
        >
          清除全部篩選
        </button>
      ) : null}
    </div>
  );
}
