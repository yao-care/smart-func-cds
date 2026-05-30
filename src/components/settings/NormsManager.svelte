<script lang="ts">
  /**
   * Per-hospital norm thresholds. The triage engine first looks up
   * NormThresholds (ageGroup × metric) in IndexedDB; only when the row
   * is missing does it fall back to the bundled defaults. This UI lets
   * a clinic record their own mean/std observations so the radar's
   * "this child vs our population" reading reflects local reality
   * instead of a synthetic prior.
   */
  import { db, type NormThreshold } from '../../lib/db/schema';
  import { AGE_GROUPS_ADULT, AGE_GROUP_LABELS, type AgeGroupAdult } from '../../lib/utils/age-groups';

  // Metrics the objective scorer consults (norms keyed by indicator id).
  // Defaults are placeholders pending literature norms (see indicators.yaml).
  const METRICS: Array<{ key: string; label: string; defaultMean: number; defaultStd: number; unit: string }> = [
    { key: 'cognition.processing_speed', label: '處理速度（反應時間）', defaultMean: 350, defaultStd: 80, unit: 'ms' },
    { key: 'cognition.executive_function', label: '執行功能（TMT-A）', defaultMean: 35, defaultStd: 12, unit: '秒' },
  ];

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

  function effectiveMean(metric: string): number {
    const r = getRow(metric);
    if (r) return r.mean;
    return METRICS.find((m) => m.key === metric)?.defaultMean ?? 0;
  }

  function effectiveStd(metric: string): number {
    const r = getRow(metric);
    if (r) return r.std;
    return METRICS.find((m) => m.key === metric)?.defaultStd ?? 0;
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
    updateRow(metric, value, effectiveStd(metric));
  }

  function onStdInput(metric: string, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isNaN(value)) return;
    updateRow(metric, effectiveMean(metric), value);
  }

  async function resetToDefault(metric: string): Promise<void> {
    const id = `${activeAgeGroup}::${metric}`;
    await db.normThresholds.delete(id);
    rows = rows.filter((r) => r.metric !== metric);
    dirty = new Set([...dirty].filter((k) => k !== rowKey(metric)));
    toast = `${METRICS.find((m) => m.key === metric)?.label}：已還原為預設值`;
    setTimeout(() => (toast = null), 2500);
  }

  async function saveAll(): Promise<void> {
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
      常模用於計算 z-score。每年齡層 × 指標一筆。未填的條目，分流引擎會 fallback 到系統預設值。
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
        <tr class:custom={isCustom}>
          <td>{m.label}</td>
          <td class="muted">{m.unit}</td>
          <td>
            <input
              type="number"
              step="0.01"
              value={effectiveMean(m.key)}
              oninput={(e) => onMeanInput(m.key, e)}
              aria-label={`${m.label} 平均值`}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.01"
              value={effectiveStd(m.key)}
              oninput={(e) => onStdInput(m.key, e)}
              aria-label={`${m.label} 標準差`}
            />
          </td>
          <td class="muted">{isCustom ? '醫院自訂' : '系統預設'}</td>
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
      disabled={dirty.size === 0 || saving}
    >
      {saving ? '儲存中…' : `儲存變更 (${dirty.size})`}
    </button>
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
