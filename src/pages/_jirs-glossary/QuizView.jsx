// 配對測驗與記憶卡：從索引即時出題。seed 決定抽題與選項次序，同 seed 必得同組（可重現、可分享）。
// 選擇題干擾項優先取同類型（逼人讀懂語義而非認字形）；記憶卡讓讀者自評會不會。
import { useMemo, useState } from 'react';
import { Check, X, RotateCw, Shuffle } from 'lucide-react';
import { Tabs } from '@phenomcanvas/ui';
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Tabs variant="quiet" value={dir} onChange={setDir} items={DIRS} label="方向" />
      <button
        type="button"
        onClick={reseed}
        className="inline-flex items-center gap-1.5 rounded-token-md border border-line px-2.5 py-1 text-token-xs text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
      >
        <Shuffle size={13} /> 換一組
      </button>
      <span className="text-token-xs tabular-nums text-ink-faint">第 {seed} 組</span>
    </div>
  );
}

function Mcq({ pool, seed, dir }) {
  const questions = useMemo(() => buildQuiz(pool, { seed, dir, count: QCOUNT }), [pool, seed, dir]);
  const [answers, setAnswers] = useState({});
  const answered = Object.keys(answers).length;
  const right = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between border-b border-line-soft pb-2">
        <span className="text-token-xs tabular-nums text-ink-faint">已答 {answered} / {questions.length}</span>
        {answered === questions.length ? (
          <span className="text-token-sm font-semibold tabular-nums text-ink">答對 {right} / {questions.length}</span>
        ) : null}
      </div>
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const pick = answers[q.id];
          const isDone = pick != null;
          return (
            <li key={q.id} className="flex gap-3">
              <span className="shrink-0 text-token-sm tabular-nums text-ink-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-token-base font-semibold text-ink">{q.prompt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt, oi) => {
                    const picked = pick === oi;
                    const key = isDone && oi === q.correctIndex;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={isDone}
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                        className={`rounded-token-md border px-3 py-1 text-token-sm transition-colors duration-fast ${
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
                  <p className="mt-1.5 flex items-center gap-1.5 text-token-xs text-ink-faint">
                    {pick === q.correctIndex
                      ? <><Check size={13} className="text-accent" /><span className="text-accent">答對</span></>
                      : <><X size={13} /><span>答錯</span></>}
                    <span className="ml-1">{q.meta.類型} · 卷 {q.meta.卷次.join('、')}</span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Flashcards({ pool, seed, dir }) {
  const deck = useMemo(
    () => shuffle(pool, mulberry32(seed * 2654435761 >>> 0)).slice(0, DECK),
    [pool, seed],
  );
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState({}); // id -> true(會) / false(不會)

  const t = deck[idx];
  const prompt = dir === 'de2zh' ? t?.de : t?.zh;
  const answer = dir === 'de2zh' ? t?.zh : t?.de;
  const done = idx >= deck.length;

  const mark = (know) => {
    setMarks((p) => ({ ...p, [t.de]: know }));
    setFlipped(false);
    setIdx((i) => i + 1);
  };
  const restart = () => { setIdx(0); setFlipped(false); setMarks({}); };

  if (done) {
    const know = Object.values(marks).filter(Boolean).length;
    return (
      <div className="max-w-md rounded-token-md border border-line-soft p-6 text-center">
        <p className="text-token-base text-ink">這疊翻完了。</p>
        <p className="mt-1 text-token-sm tabular-nums text-ink-muted">會 {know} / {deck.length}</p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 inline-flex items-center gap-1.5 rounded-token-md border border-line px-3 py-1.5 text-token-sm text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
        >
          <RotateCw size={14} /> 再翻一次這疊
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-token-xs tabular-nums text-ink-faint">{idx + 1} / {deck.length}</span>
        <span className="text-token-xs text-ink-faint">{t.類型}</span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[8rem] w-full flex-col items-center justify-center gap-2 rounded-token-md border border-line px-5 py-8 text-center transition-colors duration-fast hover:border-accent"
      >
        <span className="text-token-lg font-semibold text-ink">{prompt}</span>
        {flipped ? (
          <span className="text-token-base text-ink-muted">{answer}</span>
        ) : (
          <span className="text-token-xs text-ink-faint">點一下翻面</span>
        )}
        {flipped && t.標準中譯 && t.標準中譯 !== answer ? (
          <span className="text-token-xs text-ink-faint">標準作「{t.標準中譯}」</span>
        ) : null}
      </button>
      {flipped ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => mark(false)}
            className="flex-1 rounded-token-md border border-line px-3 py-1.5 text-token-sm text-ink-muted transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            還不熟
          </button>
          <button
            type="button"
            onClick={() => mark(true)}
            className="flex-1 rounded-token-md border border-accent bg-accent-soft px-3 py-1.5 text-token-sm text-accent transition-colors duration-fast"
          >
            會了
          </button>
        </div>
      ) : (
        <p className="mt-3 text-token-xs text-ink-faint">翻面後自評會不會，卡片會往下一張。</p>
      )}
    </div>
  );
}

export default function QuizView({ terms }) {
  const pool = useMemo(() => quizPool(terms), [terms]);
  const [mode, setMode] = useState('mcq');
  const [dir, setDir] = useState('de2zh');
  const [seed, setSeed] = useState(1);

  return (
    <section className="max-w-3xl space-y-4">
      <h2 className="sr-only">配對測驗</h2>
      <p className="max-w-xl text-token-sm leading-relaxed text-ink-muted">
        從
        <strong className="mx-1 font-semibold tabular-nums text-ink">{pool.length}</strong>
        組譯法明確的術語即時出題。選擇題的其他選項多取自同類型術語，考的是語義不是字形；同一組號永遠出同一份題目。
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tabs variant="quiet" value={mode} onChange={setMode} items={MODES} label="題型" />
        <Controls dir={dir} setDir={setDir} seed={seed} reseed={() => setSeed((s) => s + 1)} />
      </div>
      {mode === 'mcq'
        ? <Mcq pool={pool} seed={seed} dir={dir} />
        : <Flashcards pool={pool} seed={seed} dir={dir} />}
    </section>
  );
}
