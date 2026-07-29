// 一列術語：德詞左、中譯與 meta 右。密集列非卡片。
// 德文術語不用 font-accent（其子集缺空格，多字詞會破字）；用 body 字即可。
// 窄屏：主標 basis-full 先佔滿一行，meta 落到次行靠左，不與德中詞擠成一團。
export default function TermRow({ t, showType = false }) {
  return (
    <li className="border-b border-line-soft py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 sm:justify-between">
        <div className="min-w-0 basis-full sm:basis-auto">
          <span className="text-token-base font-semibold text-ink">{t.de}</span>
          <span className="mx-2 text-ink-faint">·</span>
          <span className={`text-token-base ${t.雜訊 ? 'text-ink-faint line-through' : 'text-ink-muted'}`}>{t.zh}</span>
          {t.是標準譯 ? <span className="ml-2 text-token-xs font-semibold text-accent">標準</span> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-token-xs text-ink-faint">
          {showType && t.類型 ? <span className="text-ink-muted">{t.類型}</span> : null}
          {t.方向?.length ? <span>{t.方向.join('/')}</span> : null}
          <span className="tabular-nums">卷 {t.卷次.join('、')}</span>
          <span className="tabular-nums">×{t.出現次數}</span>
        </div>
      </div>
      {t.標準中譯 && !t.是標準譯 && !t.雜訊 ? (
        <div className="mt-1 text-token-xs text-ink-muted">標準作「{t.標準中譯}」</div>
      ) : null}
    </li>
  );
}
