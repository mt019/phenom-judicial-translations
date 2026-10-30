// 主題聚落：同一批術語換軸看——依類型（單值、六類全填）或依領域（多值、可跨類）分組。
// 每組可展開（預設全開，Accordion 硬規則），組內密集列。組大時封頂並給「到檢索篩此類」的退路。
import { computed, defineComponent, ref } from 'vue';
import { ArrowRight } from 'lucide-vue-next';
import { Accordion, Tabs, useExpandedSet } from '@phenomcanvas/ui-vue';
import TermRow from './TermRow';
import { domainsOf } from './glossary-util';

const AXES = [
  { id: '類型', label: '依類型', get: (t) => [t.類型], distKey: '類型分佈' },
  { id: '領域', label: '依領域', get: domainsOf, distKey: '領域分佈' },
];

const CAP = 40; // 每組最多顯示的列數；超過給計數與退路，不把 1000+ 列全塞進一個展開區

export default defineComponent({
  name: 'ClusterView',
  props: ['terms', '摘要', 'onJump'],
  setup(props) {
  const axisId = ref('類型');
  const setAxisId = next => { axisId.value = typeof next === 'function' ? next(axisId.value) : next; };
  const axis = computed(() => AXES.find((a) => a.id === axisId.value));

  const groups = computed(() => {
    const order = Object.entries(props.摘要[axis.value.distKey]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const bucket = new Map(order.map((k) => [k, []]));
    for (const t of props.terms) {
      for (const v of axis.value.get(t)) if (bucket.has(v)) bucket.get(v).push(t);
    }
    return order.map((k) => ({ key: k, rows: bucket.get(k) })).filter((g) => g.rows.length);
  });

  const ids = computed(() => groups.value.map((g) => g.key));
  const { isOpen, toggle } = useExpandedSet(ids);

  const items = computed(() => groups.value.map((g) => ({
    id: g.key,
    title: <span class="font-semibold text-ink">{g.key}</span>,
    meta: <span class="tabular-nums">{g.rows.length} 組</span>,
    render: () => (
      <>
        <ul>
          {g.rows.slice(0, CAP).map((t, i) => (
            <TermRow key={`${t.de}-${t.zh}-${i}`} t={t} showType={axisId.value === '領域'} />
          ))}
        </ul>
        {g.rows.length > CAP ? (
          <button
            type="button"
            onClick={() => props.onJump(axis.value.id, g.key)}
            class="mt-2 inline-flex items-center gap-1 text-token-xs text-ink-muted transition-colors duration-fast hover:text-accent"
          >
            顯示前 {CAP} 組，共 {g.rows.length} 組——到檢索頁篩「{g.key}」看全部
            <ArrowRight size={13} />
          </button>
        ) : null}
      </>
    ),
  })));

  return () => {
    return (
    <section class="max-w-3xl space-y-4">
      <h2 class="sr-only">主題聚落</h2>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="max-w-xl text-token-sm leading-relaxed text-ink-muted">
          同一份索引換一條軸看：依<strong class="font-semibold text-ink">類型</strong>是每個術語各歸一類；
          依<strong class="font-semibold text-ink">領域</strong>一個術語可落在數個領域，未標領域者歸「未分類」。
        </p>
        <Tabs
          variant="quiet"
          value={axisId.value}
          onChange={setAxisId}
          items={AXES.map((a) => ({ id: a.id, label: a.label }))}
          label="分組軸"
        />
      </div>
      <Accordion items={items.value} isOpen={isOpen} onToggle={toggle} />
    </section>
  );
  };
  },
});
