<script lang="ts">
  import { db } from '$lib/db/schema';
  import type { Alert } from '$lib/db/schema';
  import Button from '../ui/Button.svelte';
  import Badge from '../ui/Badge.svelte';
  import Toast from '../ui/Toast.svelte';
  import Accordion from '../ui/Accordion.svelte';

  interface ModelInfo {
    id: string;
    filename: string;
    size: number;
    uploadedAt: Date;
    isCurrent: boolean;
  }

  /**
   * 只放「本地回饋資料算得出來」的指標。
   * Recall／F1 需要漏報（false negative）的真實事件標註，零後端架構下沒有這個來源，
   * 故不列入——寧可少一格，也不要顯示假數字讓臨床端誤判模型表現。
   */
  interface PrecisionMetrics {
    precision: number;
    falsePositiveRate: number;
    sampleCount: number;
  }

  const MODEL_STORAGE_KEY = 'cdss-model-versions';

  function loadModelVersions(): ModelInfo[] {
    try {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function persistModelVersions(list: ModelInfo[]) {
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(list));
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDate(d: Date): string {
    return new Date(d).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  }

  // State
  let models = $state<ModelInfo[]>([]);
  let toast = $state<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  let isExporting = $state(false);
  let metrics = $state<PrecisionMetrics | null>(null);
  let isLoadingMetrics = $state(false);

  $effect(() => {
    models = loadModelVersions();
  });

  const currentModel = $derived(models.find((m) => m.isCurrent) ?? null);

  function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.onnx')) {
      toast = { message: '只接受 .onnx 格式的模型檔案', type: 'error' };
      input.value = '';
      return;
    }

    const newModel: ModelInfo = {
      id: crypto.randomUUID(),
      filename: file.name,
      size: file.size,
      uploadedAt: new Date(),
      isCurrent: false,
    };

    const updated = models.map((m) => ({ ...m }));
    updated.push(newModel);
    models = updated;
    persistModelVersions(models);
    toast = { message: `模型檔案「${file.name}」已上傳`, type: 'success' };
    input.value = '';
  }

  function handleSwitch(id: string) {
    const target = models.find((m) => m.id === id);
    if (!target || target.isCurrent) return;
    if (!confirm(`確定要切換到模型「${target.filename}」嗎？`)) return;
    models = models.map((m) => ({ ...m, isCurrent: m.id === id }));
    persistModelVersions(models);
    toast = { message: `已切換至模型「${target.filename}」`, type: 'success' };
  }

  function handleDelete(id: string) {
    const target = models.find((m) => m.id === id);
    if (!target) return;
    if (target.isCurrent) {
      toast = { message: '無法刪除目前使用中的模型', type: 'error' };
      return;
    }
    if (!confirm(`確定要刪除模型「${target.filename}」嗎？`)) return;
    models = models.filter((m) => m.id !== id);
    persistModelVersions(models);
    toast = { message: `已刪除模型「${target.filename}」`, type: 'info' };
  }

  async function loadMetrics() {
    isLoadingMetrics = true;
    try {
      // Count false positives from alerts table
      const allAlerts: Alert[] = await db.alerts.toArray();
      const fpAlerts = allAlerts.filter((a) => a.status === 'false_positive');
      const totalAlerts = allAlerts.length;
      const fpCount = fpAlerts.length;

      // 臨床端標記為 false_positive 的警示＝誤報；其餘視為真陽性。
      // 這只支撐 precision 與誤報率，不足以推得 recall（見 PrecisionMetrics 註解）。
      const truePositives = totalAlerts - fpCount;
      const precision = totalAlerts > 0 ? truePositives / totalAlerts : 0;
      const falsePositiveRate = totalAlerts > 0 ? fpCount / totalAlerts : 0;

      metrics = { precision, falsePositiveRate, sampleCount: totalAlerts };
    } catch {
      toast = { message: '無法載入精度指標', type: 'error' };
    } finally {
      isLoadingMetrics = false;
    }
  }

  async function handleExportCsv() {
    isExporting = true;
    try {
      const alerts: Alert[] = await db.alerts.toArray();

      const headers = [
        'id',
        'patientId',
        'riskLevel',
        'status',
        'ruleVersion',
        'modelVersion',
        'createdAt',
        'false_positive',
      ];

      const rows = alerts.map((a) => [
        a.id,
        a.patientId,
        a.riskLevel,
        a.status,
        a.ruleVersion,
        a.modelVersion ?? '',
        new Date(a.createdAt).toISOString(),
        a.status === 'false_positive' ? '1' : '0',
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast = { message: `已匯出 ${alerts.length} 筆回饋資料`, type: 'success' };
    } catch (e: unknown) {
      toast = {
        message: `匯出失敗：${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      };
    } finally {
      isExporting = false;
    }
  }

  function pct(v: number) {
    return `${(v * 100).toFixed(1)}%`;
  }
</script>

{#if toast}
  <div class="toast-container">
    <Toast message={toast.message} type={toast.type} onClose={() => (toast = null)} />
  </div>
{/if}

<div class="model-manager">
  <!-- Current Model Info -->
  <section class="model-section" aria-labelledby="current-model-heading">
    <h3 id="current-model-heading">目前模型</h3>
    {#if currentModel}
      <div class="model-card current">
        <div class="model-card-info">
          <span class="model-filename">{currentModel.filename}</span>
          <Badge variant="normal">使用中</Badge>
        </div>
        <dl class="model-meta">
          <div class="meta-row">
            <dt>大小</dt>
            <dd>{formatBytes(currentModel.size)}</dd>
          </div>
          <div class="meta-row">
            <dt>上傳時間</dt>
            <dd>{formatDate(currentModel.uploadedAt)}</dd>
          </div>
          <div class="meta-row">
            <dt>模型 ID</dt>
            <dd class="mono">{currentModel.id.slice(0, 8)}…</dd>
          </div>
        </dl>
      </div>
    {:else}
      <div class="no-model" role="status">
        <p>尚未設定模型，使用內建規則引擎</p>
      </div>
    {/if}
  </section>

  <!-- Upload Section -->
  <section class="model-section" aria-labelledby="upload-model-heading">
    <h3 id="upload-model-heading">上傳新模型</h3>
    <div class="upload-area">
      <label class="upload-label" for="model-upload">
        <div class="upload-box" role="button" tabindex="0" aria-label="選擇 ONNX 模型檔案">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4M8 8l4-4 4 4" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="color-mix(in srgb, var(--text), var(--bg) 30%)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="upload-text">點選上傳 .onnx 模型</span>
          <span class="upload-hint">僅接受 ONNX 格式</span>
        </div>
      </label>
      <input
        id="model-upload"
        type="file"
        accept=".onnx"
        class="sr-only"
        onchange={handleUpload}
      />
    </div>
  </section>

  <!-- Precision Metrics -->
  <Accordion title="精度指標" defaultOpen={false}>
    {#if !metrics}
      <div class="metrics-placeholder">
        <p class="metrics-note">
          指標由臨床端的警示回饋（標記為誤報者）計算。Recall／F1 需要漏報事件的標註，
          本系統無此資料來源，故不提供。
        </p>
        <Button variant="secondary" size="sm" onclick={loadMetrics} disabled={isLoadingMetrics}>
          {isLoadingMetrics ? '計算中…' : '計算指標'}
        </Button>
      </div>
    {:else}
      <dl class="metrics-grid" aria-label="模型精度指標">
        <div class="metric-card">
          <dt>Precision</dt>
          <dd class="metric-value">{pct(metrics.precision)}</dd>
        </div>
        <div class="metric-card metric-card-warn">
          <dt>False Positive Rate</dt>
          <dd class="metric-value">{pct(metrics.falsePositiveRate)}</dd>
        </div>
      </dl>
      <p class="sample-count">
        樣本數：{metrics.sampleCount} 筆警示（僅含本機資料；Recall／F1 因缺漏報標註不計算）
      </p>
    {/if}
  </Accordion>

  <!-- All Model Versions -->
  {#if models.length > 0}
    <Accordion title={`所有版本（${models.length}）`} defaultOpen={false}>
      <ul class="versions-list" aria-label="模型版本列表">
        {#each models as model (model.id)}
          <li class="version-item" class:is-current={model.isCurrent}>
            <div class="version-info">
              <span class="version-filename">{model.filename}</span>
              <span class="version-meta">{formatBytes(model.size)} · {formatDate(model.uploadedAt)}</span>
            </div>
            <div class="version-actions">
              {#if model.isCurrent}
                <Badge variant="normal">使用中</Badge>
              {:else}
                <Button variant="secondary" size="sm" onclick={() => handleSwitch(model.id)}>切換</Button>
                <Button variant="danger" size="sm" onclick={() => handleDelete(model.id)}>刪除</Button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </Accordion>
  {/if}

  <!-- Export CSV -->
  <section class="model-section" aria-labelledby="export-heading">
    <h3 id="export-heading">回饋資料匯出</h3>
    <p class="export-description">
      匯出所有警示記錄（含 false_positive 標記）為 CSV，用於模型再訓練。
    </p>
    <Button
      variant="secondary"
      size="md"
      onclick={handleExportCsv}
      disabled={isExporting}
    >
      {isExporting ? '匯出中…' : '匯出回饋 CSV'}
    </Button>
  </section>
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 1100;
  }

  .model-manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .model-section h3 {
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    color: var(--text);
    margin: 0 0 var(--space-3) 0;
  }

  .model-card {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    background: var(--surface);
  }

  .model-card.current {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    border-color: var(--accent);
  }

  .model-card-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }

  .model-filename {
    font-weight: var(--font-bold);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text);
  }

  .model-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
  }

  .meta-row {
    display: flex;
    gap: var(--space-3);
    font-size: var(--text-xs);
  }

  .meta-row dt {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    min-width: 80px;
    flex-shrink: 0;
  }

  .meta-row dd {
    color: var(--text);
    margin: 0;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .no-model {
    padding: var(--space-6);
    text-align: center;
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-xs);
    border: 1px dashed var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .no-model p {
    margin: 0;
  }

  /* Upload area */
  .upload-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .upload-label {
    cursor: pointer;
    display: block;
  }

  .upload-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-7);
    border: 2px dashed var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    transition: border-color 0.15s ease, background-color 0.15s ease;
    text-align: center;
  }

  .upload-label:hover .upload-box,
  .upload-label:focus-within .upload-box {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--bg), var(--text) 5%);
  }

  .upload-text {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text);
  }

  .upload-hint {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Metrics */
  .metrics-placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .metrics-note {
    margin: 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-3);
    margin: 0;
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
    text-align: center;
  }

  .metric-card dt {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric-value {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--text);
    margin: 0;
  }

  .metric-card-warn .metric-value {
    color: var(--warn);
  }

  .sample-count {
    margin: var(--space-3) 0 0 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  /* Versions list */
  .versions-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .version-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--bg);
    flex-wrap: wrap;
  }

  .version-item.is-current {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    border-color: var(--accent);
  }

  .version-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .version-filename {
    font-weight: var(--font-medium);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text);
    word-break: break-all;
  }

  .version-meta {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .version-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* Export */
  .export-description {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    line-height: var(--lh-xs);
  }
</style>
