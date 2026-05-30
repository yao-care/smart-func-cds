<script lang="ts">
interface Props {
  data: Array<{
    domain: string;
    /** 0-100 functional score; null = domain not measured. */
    score: number | null;
    band?: 'high' | 'moderate' | 'low' | null;
  }>;
  size?: number;
  title?: string;
  showLegend?: boolean;
}
const { data, size = 320, title = '五大內在能力面向', showLegend = true }: Props = $props();

const domainLabels: Record<string, string> = {
  vitality: '身體活力',
  locomotion: '行動功能',
  cognition: '認知功能',
  psychological: '心理功能',
  sensory: '感官功能',
};

const BAND_COLOR: Record<'high' | 'moderate' | 'low', string> = {
  high: 'var(--color-risk-normal, var(--accent))',
  moderate: 'var(--color-risk-advisory, var(--warn))',
  low: 'var(--color-risk-warning, var(--danger))',
};

// Plot value: untested domains render at 0 with a dashed axis + 未測 label.
function plotScore(score: number | null): number {
  return score ?? 0;
}

const center = $derived(size / 2);
const radius = $derived(size / 2 - 60);
const angleStep = $derived(data.length > 0 ? (2 * Math.PI) / data.length : 0);

function polarToCartesian(angle: number, r: number): { x: number; y: number } {
  return {
    x: center + r * Math.cos(angle - Math.PI / 2),
    y: center + r * Math.sin(angle - Math.PI / 2),
  };
}
</script>

<div class="radar-wrap">
  <header class="radar-header">
    <h3>{title}</h3>
    {#if showLegend}
      <p class="legend">100 = 功能良好　·　40-69 = 待觀察　·　&lt;40 = 偏低</p>
    {/if}
  </header>
  <svg viewBox="-48 -48 {size + 96} {size + 96}" width={size} height={size} class="radar-chart" role="img" aria-label="內在能力面向雷達圖">
    {#if data.length >= 3}
      <polygon
        points={data.map((_, i) => {
          const p = polarToCartesian(angleStep * i, radius);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="none"
        stroke="var(--line)"
        stroke-width="1"
      />
      <!-- per-axis spokes; dashed when that domain is not measured -->
      {#each data as d, i}
        {@const tip = polarToCartesian(angleStep * i, radius)}
        <line
          x1={center} y1={center} x2={tip.x} y2={tip.y}
          stroke="var(--line)"
          stroke-width="1"
          stroke-dasharray={d.score === null ? '4 4' : undefined}
        />
      {/each}
      <polygon
        points={data.map((d, i) => {
          const p = polarToCartesian(angleStep * i, radius * plotScore(d.score) / 100);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="var(--accent)"
        fill-opacity="0.18"
        stroke="var(--accent)"
        stroke-width="2"
      />
      <!-- band-coloured vertex dots -->
      {#each data as d, i}
        {#if d.score !== null}
          {@const p = polarToCartesian(angleStep * i, radius * plotScore(d.score) / 100)}
          <circle cx={p.x} cy={p.y} r="4" fill={d.band ? BAND_COLOR[d.band] : 'var(--accent)'} />
        {/if}
      {/each}
    {/if}

    {#each data as d, i}
      {@const angle = angleStep * i - Math.PI / 2}
      {@const labelPos = polarToCartesian(angleStep * i, radius + 22)}
      {@const anchor = Math.cos(angle) > 0.25 ? 'start' : Math.cos(angle) < -0.25 ? 'end' : 'middle'}
      <text
        x={labelPos.x}
        y={labelPos.y}
        class="radar-label"
        text-anchor={anchor}
      >
        {domainLabels[d.domain] ?? d.domain}<tspan x={labelPos.x} dy="1.25em" class="radar-score">{d.score === null ? '未測' : d.score}</tspan>
      </text>
    {/each}
  </svg>
</div>

<style>
.radar-wrap { display: flex; flex-direction: column; align-items: center; }
.radar-header { text-align: center; }
.radar-header h3 { font-size: var(--text-lg); margin: 0 0 var(--space-1) 0; }
.radar-header .legend {
  font-size: var(--text-sm);
  color: var(--text);
  opacity: 0.7;
  margin: 0 0 var(--space-4) 0;
}
.radar-chart { display: block; }
.radar-label { font-size: var(--text-sm); fill: var(--text); }
.radar-score { font-size: var(--text-sm); fill: var(--accent); font-weight: var(--font-bold); }
</style>
