// 譯語表可玩性層的純函式：分面設定、正規化、seeded RNG、測驗題組。
// 資料本身由 jirs-foreign-law 資料倉 sync（scripts/build_glossary.py），這裡只讀不改。

// 一個術語的領域是多值且可空；空＝未分類（與資料倉 摘要.領域分佈 的口徑一致）。
export function domainsOf(t) {
  return t.領域?.length ? t.領域 : ['未分類'];
}

// 分面設定：每一軸的取值與呈現次序（次序本身是內容）。年代按時序、卷次按數字，
// 其餘按資料倉分佈的筆數遞減。counts 直接取 摘要 分佈，chip 上顯示。
export function buildFacets(摘要) {
  const byCountDesc = (dist) => Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return [
    { key: '類型', label: '類型', get: (t) => [t.類型], values: byCountDesc(摘要.類型分佈), counts: 摘要.類型分佈 },
    { key: '領域', label: '領域', get: domainsOf, values: byCountDesc(摘要.領域分佈), counts: 摘要.領域分佈 },
    {
      key: '年代', label: '年代', get: (t) => t.年代 ?? [],
      values: Object.keys(摘要.年代分佈).sort(), counts: 摘要.年代分佈,
    },
    { key: '狀態', label: '狀態', get: (t) => [t.狀態], values: byCountDesc(摘要.狀態分佈), counts: 摘要.狀態分佈 },
    {
      key: '卷次', label: '卷次', get: (t) => t.卷次, values: 摘要.涵蓋卷次,
      counts: null, // 卷次筆數不在摘要，chip 不顯示計數
    },
  ];
}

// 分面篩選：軸內 OR、軸間 AND；某軸未選任何值＝該軸不設限（標準分面檢索語意，
// 空集合合法、不擋內容）。sel 是 { 軸key: Set<value> }。
export function passFacets(t, facets, sel) {
  for (const f of facets) {
    const chosen = sel[f.key];
    if (!chosen || chosen.size === 0) continue;
    const vals = f.get(t);
    if (!vals.some((v) => chosen.has(v))) return false;
  }
  return true;
}

// mulberry32：小而穩的 seeded PRNG，同 seed 必得同序列（測驗可重現）。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 字串雜湊：給裁決選項一個穩定、與 render 無關的洗牌種子（同術語每次同序）。
export function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 適合出題的術語：有德有中、中譯非雜訊、非多譯（多譯有數個正當中譯，當單選題答案會有爭議）、
// 長度適中。用於配對測驗與記憶卡兩者。
export function quizPool(terms) {
  return terms.filter(
    (t) => t.de && t.zh && !t.雜訊 && t.狀態 !== '多譯' && t.zh.length >= 2 && t.zh.length <= 14 && t.de.length <= 42,
  );
}

// 產一組單選題：seed 決定抽哪些題、干擾項與選項次序，故可重現。
// dir='de2zh' 給德文問中譯；'zh2de' 反之。干擾項優先取同類型者（較難、逼人讀懂而非背字形）。
export function buildQuiz(pool, { seed, dir = 'de2zh', count = 10 }) {
  const rng = mulberry32(seed);
  const promptKey = dir === 'de2zh' ? 'de' : 'zh';
  const answerKey = dir === 'de2zh' ? 'zh' : 'de';
  const picked = shuffle(pool, rng).slice(0, Math.min(count, pool.length));
  return picked.map((t, i) => {
    const answer = t[answerKey];
    const sameType = pool.filter((o) => o.類型 === t.類型 && o[answerKey] !== answer);
    const others = sameType.length >= 3 ? sameType : pool.filter((o) => o[answerKey] !== answer);
    const distractSeen = new Set([answer]);
    const distractors = [];
    for (const o of shuffle(others, rng)) {
      if (distractSeen.has(o[answerKey])) continue;
      distractSeen.add(o[answerKey]);
      distractors.push(o[answerKey]);
      if (distractors.length === 3) break;
    }
    const options = shuffle([answer, ...distractors], rng);
    return {
      id: `${t.de}__${i}`,
      prompt: t[promptKey],
      answer,
      options,
      correctIndex: options.indexOf(answer),
      meta: t,
    };
  });
}
