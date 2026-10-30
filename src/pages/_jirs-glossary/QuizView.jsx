// 配對測驗與記憶卡：從索引即時出題。seed 決定抽題與選項次序，同 seed 必得同組（可重現、可分享）。
// 選擇題干擾項優先取同類型（逼人讀懂語義而非認字形）；記憶卡讓讀者自評會不會。
import { computed, defineComponent, ref } from 'vue';
import { Check, X, RotateCw, Shuffle } from 'lucide-vue-next';
import { Tabs } from '@phenomcanvas/ui-vue';
import { quizPool, buildQuiz, shuffle, mulberry32 } from './glossary-util';

const MODES = [
  { id: 'mcq', label: '選擇題' },
  { id: 'card', label: '記憶卡' },
];
const DIRS = [
  { id: 'de2zh', label: '德 → 中' },
  { id: 'zh2de', label: '中 → 德' },
];
const DECK = 20; // 記憶卡一疊張數
const QCOUNT = 10; // 選擇題題數

function Controls({ dir, setDir, seed, reseed }) {
  return (
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Tabs variant="quiet" value={dir} onChange={setDir} items={DIRS} label="方向" />
      <button
        type="button"
        onClick={reseed}
        class="inline-flex items-center gap-1.5 rounded-token-md border border-line px-2.5 py-1 text-token-xs text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
      >
        <Shuffle size={13} /> 換一組
      </button>
      <span class="text-token-xs tabular-nums text-ink-faint">第 {seed} 組</span>
    </div>
  );
}

const Mcq = defineComponent({
  name: 'Mcq',
  props: ['pool', 'seed', 'dir'],
  setup(props) {
  const questions = computed(() => buildQuiz(props.pool, { seed: props.seed, dir: props.dir, count: QCOUNT }));
  const answers = ref({});
  const setAnswers = next => { answers.value = typeof next === 'function' ? next(answers.value) : next; };
  const answered = computed(() => Object.keys(answers.value).length);
  const right = computed(() => questions.value.filter((q) => answers.value[q.id] === q.correctIndex).length);

  return () => {
    return (
    <div>
      <div class="mb-3 flex items-baseline justify-between border-b border-line-soft pb-2">
        <span class="text-token-xs tabular-nums text-ink-faint">已答 {answered.value} / {questions.value.length}</span>
        {answered.value === questions.value.length ? (
          <span class="text-token-sm font-semibold tabular-nums text-ink">答對 {right.value} / {questions.value.length}</span>
        ) : null}
      </div>
      <ol class="space-y-5">
        {questions.value.map((q, i) => {
          const pick = answers.value[q.id];
          const isDone = pick != null;
          return (
            <li key={q.id} class="flex gap-3">
              <span class="shrink-0 text-token-sm tabular-nums text-ink-faint">{i + 1}</span>
              <div class="min-w-0 flex-1">
                <p class="text-token-base font-semibold text-ink">{q.prompt}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt, oi) => {
                    const picked = pick === oi;
                    const key = isDone && oi === q.correctIndex;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={isDone}
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                        class={`rounded-token-md border px-3 py-1 text-token-sm transition-colors duration-fast ${
                          isDone
                            ? key
                              ? 'border-accent text-accent'
                              : picked
                                ? 'border-line text-ink-faint line-through'
                                : 'border-line-soft text-ink-faint'
                            : 'border-line text-ink hover:border-accent hover:text-accent'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {isDone ? (
                  <p class="mt-1.5 flex items-center gap-1.5 text-token-xs text-ink-faint">
                    {pick === q.correctIndex
                      ? <><Check size={13} class="text-accent" /><span class="text-accent">答對</span></>
                      : <><X size={13} /><span>答錯</span></>}
                    <span class="ml-1">{q.meta.類型} · 卷 {q.meta.卷次.join('、')}</span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
  };
  },
});

const Flashcards = defineComponent({
  name: 'Flashcards',
  props: ['pool', 'seed', 'dir'],
  setup(props) {
  const deck = computed(() => shuffle(props.pool, mulberry32(props.seed * 2654435761 >>> 0)).slice(0, DECK));
  const idx = ref(0);
  const setIdx = next => { idx.value = typeof next === 'function' ? next(idx.value) : next; };
  const flipped = ref(false);
  const setFlipped = next => { flipped.value = typeof next === 'function' ? next(flipped.value) : next; };
  const marks = ref({});
  const setMarks = next => { marks.value = typeof next === 'function' ? next(marks.value) : next; }; // id -> true(會) / false(不會)

  const t = computed(() => deck.value[idx.value]);
  const prompt = computed(() => props.dir === 'de2zh' ? t.value?.de : t.value?.zh);
  const answer = computed(() => props.dir === 'de2zh' ? t.value?.zh : t.value?.de);
  const done = computed(() => idx.value >= deck.value.length);

  const mark = (know) => {
    setMarks((p) => ({ ...p, [t.value.de]: know }));
    setFlipped(false);
    setIdx((i) => i + 1);
  };
  const restart = () => { setIdx(0); setFlipped(false); setMarks({}); };

  return () => {
    if (done.value) {
    const know = Object.values(marks.value).filter(Boolean).length;
    return (
      <div class="max-w-md rounded-token-md border border-line-soft p-6 text-center">
        <p class="text-token-base text-ink">這疊翻完了。</p>
        <p class="mt-1 text-token-sm tabular-nums text-ink-muted">會 {know} / {deck.value.length}</p>
        <button
          type="button"
          onClick={restart}
          class="mt-4 inline-flex items-center gap-1.5 rounded-token-md border border-line px-3 py-1.5 text-token-sm text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
        >
          <RotateCw size={14} /> 再翻一次這疊
        </button>
      </div>
    );
  }

  return (
    <div class="max-w-md">
      <div class="mb-2 flex items-baseline justify-between">
        <span class="text-token-xs tabular-nums text-ink-faint">{idx.value + 1} / {deck.value.length}</span>
        <span class="text-token-xs text-ink-faint">{t.value.類型}</span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        class="flex min-h-[8rem] w-full flex-col items-center justify-center gap-2 rounded-token-md border border-line px-5 py-8 text-center transition-colors duration-fast hover:border-accent"
      >
        <span class="text-token-lg font-semibold text-ink">{prompt.value}</span>
        {flipped.value ? (
          <span class="text-token-base text-ink-muted">{answer.value}</span>
        ) : (
          <span class="text-token-xs text-ink-faint">點一下翻面</span>
        )}
        {flipped.value && t.value.標準中譯 && t.value.標準中譯 !== answer.value ? (
          <span class="text-token-xs text-ink-faint">標準作「{t.value.標準中譯}」</span>
        ) : null}
      </button>
      {flipped.value ? (
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => mark(false)}
            class="flex-1 rounded-token-md border border-line px-3 py-1.5 text-token-sm text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            還不熟
          </button>
          <button
            type="button"
            onClick={() => mark(true)}
            class="flex-1 rounded-token-md border border-accent bg-accent-soft px-3 py-1.5 text-token-sm text-accent transition-colors duration-fast"
          >
            會了
          </button>
        </div>
      ) : (
        <p class="mt-3 text-token-xs text-ink-faint">翻面後自評會不會，卡片會往下一張。</p>
      )}
    </div>
  );
  };
  },
});

export default defineComponent({
  name: 'QuizView',
  props: ['terms'],
  setup(props) {
  const pool = computed(() => quizPool(props.terms));
  const mode = ref('mcq');
  const setMode = next => { mode.value = typeof next === 'function' ? next(mode.value) : next; };
  const dir = ref('de2zh');
  const setDir = next => { dir.value = typeof next === 'function' ? next(dir.value) : next; };
  const seed = ref(1);
  const setSeed = next => { seed.value = typeof next === 'function' ? next(seed.value) : next; };

  return () => {
    return (
    <section class="max-w-3xl space-y-4">
      <h2 class="sr-only">配對測驗</h2>
      <p class="max-w-xl text-token-sm leading-relaxed text-ink-muted">
        從
        <strong class="mx-1 font-semibold tabular-nums text-ink">{pool.value.length}</strong>
        組譯法明確的術語即時出題。選擇題的其他選項多取自同類型術語，考的是語義不是字形；同一組號永遠出同一份題目。
      </p>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tabs variant="quiet" value={mode.value} onChange={setMode} items={MODES} label="題型" />
        <Controls dir={dir.value} setDir={setDir} seed={seed.value} reseed={() => setSeed((s) => s + 1)} />
      </div>
      {mode.value === 'mcq'
        ? <Mcq key={`mcq-${seed.value}-${dir.value}`} pool={pool.value} seed={seed.value} dir={dir.value} />
        : <Flashcards key={`card-${seed.value}-${dir.value}`} pool={pool.value} seed={seed.value} dir={dir.value} />}
    </section>
  );
  };
  },
});
