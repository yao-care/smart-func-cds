<script lang="ts">
  /**
   * 本院常模設定。客觀指標計分（`scoreObjectiveIndicator`）的常模優先序為
   * 「本院常模（IndexedDB `normThresholds`，ageGroup × indicator id）→ indicators.yaml 文獻常模」，
   * 由 `QuestionnaireModule` 讀出後以 `normOverrides` 傳入計分引擎。
   * 此頁讓收案單位登錄自己的 mean/std 觀測值，讓 z-score 反映在地族群而非外部文獻母體。
   *
   * 預設值一律從 indicators.yaml 取（含引用出處），不在本檔另訂常數——
   * 兩邊各寫一份會讓設定頁顯示的「系統預設」與實際計分用的常模悄悄分岔。
   */
  import yaml from 'js-yaml';
  import { db, type NormThreshold } from '../../lib/db/schema';
  import { AGE_GROUPS_ADULT, AGE_GROUP_LABELS, type AgeGroupAdult } from '../../lib/utils/age-groups';
  import indicatorsRaw from '../../data/questionnaire/indicators.yaml?raw';
  import { indicatorSchema, type Indicator, type ObjectiveIndicator } from '../../engine/func/questionnaire';
  import { IC_DOMAIN_NAMES } from '../../lib/education/schemas';

  interface MetricDef {
    key: string;
    label: string;
    unit: string;
    /** 文獻常模；該年齡層缺值時為 null（此時本院常模等於「補上缺口」而非覆寫）。 */
    norms: Record<AgeGroupAdult, { mean: number; std: number; citation: string } | null>;
  }

  // 客觀指標＝計分引擎會查常模的指標，直接從 indicators.yaml 推導。
  const METRICS: MetricDef[] = (() => {
    const doc = yaml.load(indicatorsRaw) as Record<string, unknown[]>;
    const out: MetricDef[] = [];
    for (const domain of IC_DOMAIN_NAMES) {
      for (const raw of doc[domain] ?? []) {
        const ind: Indicator = indicatorSchema.parse(raw);
        if (ind.kind !== 'objective') continue;
        const obj = ind as ObjectiveIndicator;
        out.push({
          key: obj.id,
          label: obj.label,
          unit: obj.test.type === 'reaction-time' ? 'ms' : '秒',
          norms: obj.test.norms,
        });
      }
    }
    return out;
  })();

  let activeAgeGroup = $state<AgeGroupAdult>('18-39');
  let rows = $state<NormThreshold[]>([]);
  let dirty = $state<Set<string>>(new Set());
  let saving = $state(false);
  let toast = $state<string | null>(null);

  $effect(() => {
    const ag = activeAgeGroup;
    (async () => {
      rows = await db.normThresholds.where('ageGroup').equals(ag).toArray();
      dirty = new Set();
    })();
  });

  function rowKey(metric: string): string {
    return `${activeAgeGroup}::${metric}`;
  }

  function getRow(metric: string): NormThreshold | null {
    return rows.find((r) => r.metric === metric) ?? null;
  }

  /** 該年齡層的文獻常模；缺值（null）代表 indicators.yaml 未提供此年齡層的常模。 */
  function literatureNorm(metric: string): { mean: number; std: number; citation: string } | null {
    return METRICS.find((m) => m.key === metric)?.norms[activeAgeGroup] ?? null;
  }

  function effectiveMean(metric: string): number | null {
    const r = getRow(metric);
    if (r) return r.mean;
    return literatureNorm(metric)?.mean ?? null;
  }

  function effectiveStd(metric: string): number | null {
    const r = getRow(metric);
    if (r) return r.std;
    return literatureNorm(metric)?.std ?? null;
  }

  function updateRow(metric: string, mean: number, std: number): void {
    const idx = rows.findIndex((r) => r.metric === metric);
    const id = `${activeAgeGroup}::${metric}`;
    const next: NormThreshold = {
      id,
      ageGroup: activeAgeGroup,
      metric,
      mean,
      std,
      source: 'hospital',
      updatedAt: new Date(),
    };
    if (idx >= 0) {
      rows[idx] = next;
    } else {
      rows = [...rows, next];
    }
    dirty = new Set(dirty).add(rowKey(metric));
  }

  function onMeanInput(metric: string, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isNaN(value)) return;
    updateRow(metric, value, effectiveStd(metric) ?? 0);
  }

  function onStdInput(metric: string, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isNaN(value)) return;
    updateRow(metric, effectiveMean(metric) ?? 0, value);
  }

  /**
   * 與 `scorer.ts` 的 `isUsableNorm` 同一組規則：不合格的常模計分時會被忽略，
   * 所以擋在存檔前，避免使用者以為已生效。
   */
  function isRowValid(row: NormThreshold): boolean {
    if (!Number.isFinite(row.mean) || !Number.isFinite(row.std)) return false;
    return row.std > 0 && row.std >= Math.abs(row.mean) * 0.01;
  }

  const invalidDirtyMetrics = $derived(
    [...dirty]
      .map((k) => k.split('::')[1])
      .filter((metric) => {
        const row = getRow(metric);
        return row ? !isRowValid(row) : false;
      }),
  );

  async function resetToDefault(metric: string): Promise<void> {
    const id = `${activeAgeGroup}::${metric}`;
    await db.normThresholds.delete(id);
    rows = rows.filter((r) => r.metric !== metric);
    dirty = new Set([...dirty].filter((k) => k !== rowKey(metric)));
    toast = `${METRICS.find((m) => m.key === metric)?.label}：已還原為預設值`;
    setTimeout(() => (toast = null), 2500);
  }

  async function saveAll(): Promise<void> {
    if (invalidDirtyMetrics.length > 0) return;
    saving = true;
    try {
      for (const key of dirty) {
        const metric = key.split('::')[1];
        const row = getRow(metric);
        if (row) await db.normThresholds.put(row);
      }
      dirty = new Set();
      toast = '已儲存';
      setTimeout(() => (toast = null), 2500);
    } finally {
      saving = false;
    }
  }
</script>

<section class="norms-manager">
  <header class="manager-header">
    <p class="header-note">
      常模用於計算客觀測驗的 z-score。每年齡層 × 指標一筆：<strong>填了就以本院常模計分</strong>，
      未填則沿用 indicators.yaml 的文獻常模（來源見下表）。標準差需大於 0，否則計分時會被忽略。
    </p>
  </header>

  <nav class="age-tabs" aria-label="年齡層">
    {#each AGE_GROUPS_ADULT as ag}
      <button
        type="button"
        class="age-tab"
        class:active={activeAgeGroup === ag}
        onclick={() => (activeAgeGroup = ag)}
      >
        {AGE_GROUP_LABELS[ag]}
      </button>
    {/each}
  </nav>

  <table class="norms-table">
    <thead>
      <tr>
        <th>指標</th>
        <th>單位</th>
        <th>平均值 (mean)</th>
        <th>標準差 (std)</th>
        <th>來源</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each METRICS as m}
        {@const row = getRow(m.key)}
        {@const isCustom = !!row}
        {@const lit = literatureNorm(m.key)}
        {@const invalid = !!row && !isRowValid(row)}
        <tr class:custom={isCustom} class:invalid>
          <td>{m.label}</td>
          <td class="muted">{m.unit}</td>
          <td>
            <input
              type="number"
              step="0.01"
              value={effectiveMean(m.key) ?? ''}
              oninput={(e) => onMeanInput(m.key, e)}
              aria-label={`${m.label} 平均值`}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.01"
              value={effectiveStd(m.key) ?? ''}
              oninput={(e) => onStdInput(m.key, e)}
              aria-invalid={invalid}
              aria-label={`${m.label} 標準差`}
            />
          </td>
          <td class="muted">
            {#if isCustom}
              本院常模
            {:else if lit}
              文獻常模：{lit.citation}
            {:else}
              此年齡層無文獻常模——未填則此指標不計分
            {/if}
          </td>
          <td>
            {#if isCustom}
              <button type="button" class="btn-link danger" onclick={() => resetToDefault(m.key)}>還原預設</button>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="actions">
    <button
      type="button"
      class="btn-save"
      onclick={saveAll}
      disabled={dirty.size === 0 || saving || invalidDirtyMetrics.length > 0}
    >
      {saving ? '儲存中…' : `儲存變更 (${dirty.size})`}
    </button>
    {#if invalidDirtyMetrics.length > 0}
      <span class="warn-note" role="alert">標準差需大於 0（且不得小於平均值的 1%），否則計分時會被忽略。</span>
    {/if}
    {#if toast}<span class="toast">{toast}</span>{/if}
  </div>
</section>

<style>
  .norms-manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .manager-header {
    padding: var(--space-3) var(--space-4);
    background: color-mix(in srgb, var(--bg), var(--text) 5%);
    border-radius: var(--radius-md);
  }

  .header-note {
    margin: 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .age-tabs {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
  }

  .age-tab {
    padding: var(--space-2) var(--space-4);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    cursor: pointer;
    min-height: 40px;
  }

  .age-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .norms-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .norms-table th,
  .norms-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--line);
    text-align: left;
  }

  .norms-table tr.custom {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
  }

  .norms-table tr.invalid {
    background: color-mix(in srgb, var(--danger) 10%, var(--bg));
  }

  .norms-table input[aria-invalid='true'] {
    border-color: var(--danger);
  }

  .warn-note {
    font-size: var(--text-xs);
    color: var(--danger);
  }

  .norms-table input[type='number'] {
    width: 100px;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font: inherit;
  }

  .muted {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-xs);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-save {
    padding: var(--space-2) var(--space-5);
    background: var(--accent);
    color: white;
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
    min-height: 36px;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: var(--text-xs);
    padding: 0;
  }

  .btn-link.danger { color: var(--danger); }

  .toast {
    font-size: var(--text-xs);
    color: var(--accent);
  }
</style>
