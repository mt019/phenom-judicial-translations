// 多譯裁決・你會怎麼譯：一德詞有數個中譯，先讓讀者猜哪個被定為標準，再揭曉理由與真實用例。
// 語境相依那組沒有唯一標準，直接並陳各譯法的脈絡。無脈絡者退回只顯示理由。
import { computed, defineComponent, ref } from 'vue';
import { Check, X } from 'lucide-vue-next';
import { shuffle, strHash, mulberry32 } from './glossary-util';

const DECISION_GROUPS = [
  { key: 'canonical', label: '定標準譯', hint: '兩個以上中譯擇一為準，其餘列次選。先猜再揭曉。' },
  { key: 'context', label: '語境相依', hint: '隨案件脈絡各有正當譯法，並存不擇一；直接看各譯法的用例。' },
];

// 把片段裡與該譯法相符的字染色，讓讀者一眼看到這個詞怎麼落在真實判決文裡。
function highlight(text, term) {
  if (!term || !text.includes(term)) return text;
  const out = [];
  let rest = text;
  let i = 0;
  while (true) {
    const at = rest.indexOf(term);
    if (at === -1) { out.push(rest); break; }
    if (at > 0) out.push(rest.slice(0, at));
    out.push(<mark key={i++} class="rounded-token-sm bg-accent-soft px-0.5 text-accent">{term}</mark>);
    rest = rest.slice(at + term.length);
  }
  return out;
}

function Contexts({ 脈絡 }) {
  if (!脈絡?.length) return null;
  return (
    <ul class="mt-2 space-y-2 border-l-2 border-line pl-3">
      {脈絡.map((c, i) => (
        <li key={i} class="text-token-xs leading-relaxed text-ink-muted">
          <span class="font-semibold text-ink">{c.譯法}</span>
          <span class="mx-1.5 text-ink-faint">·</span>
          <span class="text-ink-faint">{c.案名}（卷 {c.卷}）</span>
          <p class="mt-0.5">…{highlight(c.片段, c.譯法)}…</p>
        </li>
      ))}
    </ul>
  );
}

function Verdict({ r }) {
  return (
    <>
      {r.理由 ? <p class="mt-2 text-token-sm leading-relaxed text-ink-muted">{r.理由}</p> : null}
      <Contexts 脈絡={r.脈絡} />
      {r.證據 ? <p class="mt-2 text-token-xs tabular-nums text-ink-faint">出處 {r.證據}</p> : null}
    </>
  );
}

const RulingChallenge = defineComponent({
  name: 'RulingChallenge',
  props: ['r'],
  setup(props) {
  const guessable = computed(() => props.r.類別 === 'canonical' && props.r.次選?.length > 0);
  const options = computed(() => {
    if (!guessable.value) return [];
    return shuffle([props.r.標準中譯, ...props.r.次選], mulberry32(strHash(props.r.de)));
  });

  const pick = ref(null);
  const setPick = next => { pick.value = typeof next === 'function' ? next(pick.value) : next; };
  const open = ref(false);
  const setOpen = next => { open.value = typeof next === 'function' ? next(open.value) : next; };
  const done = computed(() => pick.value != null || open.value);

  return () => {
    return (
    <li class="border-b border-line-soft py-3 last:border-b-0">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="text-token-base font-semibold text-ink">{props.r.de}</span>
        {done.value ? (
          <span class="text-token-sm text-ink">
            <span class="mr-1.5 text-ink-faint">→</span>{props.r.標準中譯}
          </span>
        ) : null}
      </div>

      {guessable.value && pick.value == null ? (
        <div class="mt-2">
          <p class="mb-1.5 text-token-xs text-ink-faint">哪個被定為標準譯？</p>
          <div class="flex flex-wrap gap-2">
            {options.value.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPick(opt)}
                class="rounded-token-md border border-line px-3 py-1 text-token-sm text-ink transition-colors duration-fast hover:border-accent hover:text-accent"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {guessable.value && pick.value != null ? (
        <div class="mt-2">
          <div class="flex flex-wrap gap-2">
            {options.value.map((opt) => {
              const isKey = opt === props.r.標準中譯;
              const isPick = opt === pick.value;
              return (
                <span
                  key={opt}
                  class={`inline-flex items-center gap-1 rounded-token-md border px-3 py-1 text-token-sm ${
                    isKey
                      ? 'border-accent text-accent'
                      : isPick
                        ? 'border-line text-ink-faint line-through'
                        : 'border-line-soft text-ink-faint'
                  }`}
                >
                  {isKey ? <Check size={13} /> : isPick ? <X size={13} /> : null}
                  {opt}
                </span>
              );
            })}
          </div>
          <p class="mt-1.5 text-token-xs text-ink-muted">
            {pick.value === props.r.標準中譯 ? '答對了。' : '標準譯如上；'}其餘列為次選。
          </p>
          <Verdict r={props.r} />
        </div>
      ) : null}

      {!guessable.value ? (
        open.value ? (
          <Verdict r={props.r} />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            class="mt-1 text-token-xs text-ink-muted underline decoration-line underline-offset-2 transition-colors duration-fast hover:text-accent"
          >
            {props.r.類別 === 'context' ? '看各譯法的用例' : '揭曉理由'}
          </button>
        )
      ) : null}
    </li>
  );
  };
  },
});

export default defineComponent({
  name: 'RulingsView',
  props: ['rulings', 'stats'],
  setup(props) {
  const byGroup = computed(() => {
    const m = new Map(DECISION_GROUPS.map((g) => [g.key, []]));
    for (const r of props.rulings) if (m.has(r.類別)) m.get(r.類別).push(r);
    return m;
  });

  return () => {
    return (
    <section class="max-w-3xl space-y-8">
      <p class="max-w-3xl text-token-sm leading-relaxed text-ink-muted">
        同一德文術語在不同卷次出現多個中譯者，共
        <strong class="mx-1 font-semibold tabular-nums text-ink">{props.rulings.length}</strong>組，已逐一裁決：
        <strong class="mx-1 font-semibold tabular-nums text-ink">{props.stats.canonical}</strong>組定一個標準譯、
        <strong class="mx-1 font-semibold tabular-nums text-ink">{props.stats.context}</strong>組隨案件脈絡並存正當譯法。
        先猜標準譯，再看理由與真實判決用例；出處欄的 <span class="tabular-nums">v12:p275</span> 讀作第 12 輯第 275 頁。
      </p>

      {DECISION_GROUPS.map((g) => {
        const rows = byGroup.value.get(g.key) || [];
        if (!rows.length) return null;
        return (
          <div key={g.key}>
            <h2 class="text-token-lg font-semibold text-ink">
              {g.label}
              <span class="ml-2 text-token-sm font-normal tabular-nums text-ink-faint">{rows.length} 組</span>
            </h2>
            <p class="mb-1 text-token-xs leading-relaxed text-ink-muted">{g.hint}</p>
            <ul>
              {rows.map((r) => <RulingChallenge key={r.de} r={r} />)}
            </ul>
          </div>
        );
      })}
    </section>
  );
  };
  },
});
