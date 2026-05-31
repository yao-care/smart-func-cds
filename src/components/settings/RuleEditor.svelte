<script lang="ts">
  import yaml from 'js-yaml';
  import { db } from '$lib/db/schema';
  import type { RuleVersion } from '$lib/db/schema';
  import Button from '../ui/Button.svelte';
  import Toast from '../ui/Toast.svelte';
  import Accordion from '../ui/Accordion.svelte';

  // Default YAML structure expected by the rule engine
  const DEFAULT_YAML = `# Adult CDSS Rules v1.0
# 範例閾值採成人常見值，部署前請依機構臨床指引覆核
rules:
  - id: high_hr
    description: Elevated heart rate
    indicator: 8867-4
    threshold: 100
    level: warning
  - id: low_spo2
    description: Low oxygen saturation
    indicator: 59408-5
    threshold: 92
    operator: lt
    level: critical
`;

  const REQUIRED_RULE_FIELDS = ['id', 'description', 'indicator', 'threshold', 'level'] as const;

  interface ValidationResult {
    valid: boolean;
    errors: string[];
  }

  // State
  let currentYaml = $state(DEFAULT_YAML);
  let editYaml = $state('');
  let isEditing = $state(false);
  let isSaving = $state(false);
  let changedBy = $state('');
  let changeReason = $state('');
  let history = $state<RuleVersion[]>([]);
  let validationResult = $state<ValidationResult | null>(null);
  let toast = $state<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load history on mount
  $effect(() => {
    loadHistory();
    loadCurrentVersion();
  });

  async function loadHistory() {
    try {
      const versions = await db.ruleVersions.orderBy('createdAt').reverse().limit(10).toArray();
      history = versions;
    } catch {
      // IndexedDB not available in SSR
    }
  }

  async function loadCurrentVersion() {
    try {
      const latest = await db.ruleVersions.orderBy('createdAt').last();
      if (latest) {
        currentYaml = latest.yamlContent;
      }
    } catch {
      // Use default
    }
  }

  function startEdit() {
    editYaml = currentYaml;
    isEditing = true;
    validationResult = null;
  }

  function cancelEdit() {
    isEditing = false;
    editYaml = '';
    validationResult = null;
  }

  function validateYaml(content: string): ValidationResult {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = yaml.load(content);
    } catch (e: unknown) {
      return { valid: false, errors: [`YAML 語法錯誤：${e instanceof Error ? e.message : String(e)}`] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, errors: ['規則文件必須是物件格式'] };
    }

    const doc = parsed as Record<string, unknown>;

    if (!Array.isArray(doc['rules'])) {
      errors.push('缺少頂層 "rules" 陣列');
    } else {
      const rules = doc['rules'] as unknown[];
      if (rules.length === 0) {
        errors.push('"rules" 陣列不能為空');
      }
      rules.forEach((rule, idx) => {
        if (typeof rule !== 'object' || rule === null) {
          errors.push(`規則 #${idx + 1} 不是物件`);
          return;
        }
        const r = rule as Record<string, unknown>;
        for (const field of REQUIRED_RULE_FIELDS) {
          if (r[field] === undefined || r[field] === null || r[field] === '') {
            errors.push(`規則 #${idx + 1} (id: ${r['id'] ?? '?'}) 缺少必填欄位：${field}`);
          }
        }
        const validLevels = ['normal', 'advisory', 'warning', 'critical'];
        if (typeof r['level'] === 'string' && !validLevels.includes(r['level'])) {
          errors.push(`規則 #${idx + 1} 的 level 必須是 ${validLevels.join(' / ')} 之一`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  function handleValidate() {
    validationResult = validateYaml(editYaml);
  }

  async function handleSave() {
    const result = validateYaml(editYaml);
    validationResult = result;
    if (!result.valid) return;

    if (!changedBy.trim()) {
      toast = { message: '請填寫修改者姓名', type: 'error' };
      return;
    }
    if (!changeReason.trim()) {
      toast = { message: '請填寫修改原因', type: 'error' };
      return;
    }

    isSaving = true;
    try {
      const id = crypto.randomUUID();
      const entry: RuleVersion = {
        id,
        yamlContent: editYaml,
        changedBy: changedBy.trim(),
        changeReason: changeReason.trim(),
        createdAt: new Date(),
      };
      await db.ruleVersions.add(entry);
      currentYaml = editYaml;
      changedBy = '';
      changeReason = '';
      isEditing = false;
      validationResult = null;
      await loadHistory();
      toast = { message: '規則已儲存成功', type: 'success' };
    } catch (e: unknown) {
      toast = { message: `儲存失敗：${e instanceof Error ? e.message : String(e)}`, type: 'error' };
    } finally {
      isSaving = false;
    }
  }

  function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editYaml = reader.result as string;
      isEditing = true;
      validationResult = null;
    };
    reader.readAsText(file);
    input.value = '';
  }

  async function handleResetDefaults() {
    if (!confirm('確定要重設為預設規則嗎？此操作不可復原。')) return;
    editYaml = DEFAULT_YAML;
    isEditing = true;
    validationResult = null;
  }

  function formatDate(d: Date) {
    return new Date(d).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  }
</script>

{#if toast}
  <div class="toast-container">
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => (toast = null)}
    />
  </div>
{/if}

<div class="rule-editor">
  <div class="section-header">
    <h3>目前規則版本</h3>
    <div class="header-actions">
      <label class="upload-label" for="yaml-upload" aria-label="上傳 YAML 規則檔案">
        <Button variant="secondary" size="sm" onclick={() => document.getElementById('yaml-upload')?.click()}>
          上傳 YAML
        </Button>
      </label>
      <input
        id="yaml-upload"
        type="file"
        accept=".yaml,.yml"
        class="sr-only"
        onchange={handleUpload}
      />
      {#if !isEditing}
        <Button variant="secondary" size="sm" onclick={startEdit}>編輯</Button>
        <Button variant="ghost" size="sm" onclick={handleResetDefaults}>重設預設值</Button>
      {/if}
    </div>
  </div>

  {#if !isEditing}
    <pre class="yaml-display" aria-label="目前規則 YAML 內容">{currentYaml}</pre>
  {:else}
    <div class="edit-section">
      <div class="form-row">
        <label class="form-label" for="changed-by">修改者</label>
        <input
          id="changed-by"
          type="text"
          class="form-input"
          placeholder="請輸入姓名"
          bind:value={changedBy}
          aria-required="true"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="change-reason">修改原因</label>
        <input
          id="change-reason"
          type="text"
          class="form-input"
          placeholder="請描述修改原因"
          bind:value={changeReason}
          aria-required="true"
        />
      </div>
      <textarea
        class="yaml-editor"
        bind:value={editYaml}
        spellcheck="false"
        aria-label="編輯 YAML 規則"
        rows="20"
      ></textarea>

      {#if validationResult}
        <div
          class="validation-result"
          class:valid={validationResult.valid}
          class:invalid={!validationResult.valid}
          role="status"
          aria-live="polite"
        >
          {#if validationResult.valid}
            <span>驗證通過</span>
          {:else}
            <ul class="error-list" aria-label="驗證錯誤">
              {#each validationResult.errors as err}
                <li>{err}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}

      <div class="edit-actions">
        <Button variant="ghost" size="sm" onclick={handleValidate}>驗證 YAML</Button>
        <Button variant="secondary" size="sm" onclick={cancelEdit}>取消</Button>
        <Button
          variant="primary"
          size="sm"
          onclick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '儲存中…' : '儲存'}
        </Button>
      </div>
    </div>
  {/if}

  <Accordion title="版本歷史紀錄" defaultOpen={false}>
    {#if history.length === 0}
      <p class="empty-state">尚無版本紀錄</p>
    {:else}
      <ol class="history-list" aria-label="規則版本歷史">
        {#each history as version}
          <li class="history-item">
            <div class="history-meta">
              <span class="history-date">{formatDate(version.createdAt)}</span>
              <span class="history-author">{version.changedBy}</span>
            </div>
            <p class="history-reason">{version.changeReason}</p>
          </li>
        {/each}
      </ol>
    {/if}
  </Accordion>
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 1100;
  }

  .rule-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .section-header h3 {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .upload-label {
    cursor: pointer;
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

  .yaml-display {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    font-size: var(--text-xs);
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
    line-height: 1.6;
    color: var(--text);
    overflow-x: auto;
    white-space: pre;
    max-height: 400px;
    overflow-y: auto;
  }

  .edit-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .form-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text);
  }

  .form-input {
    height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
    font-size: var(--text-xs);
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .yaml-editor {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
    font-size: var(--text-xs);
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.15s ease;
  }

  .yaml-editor:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .validation-result {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
  }

  .validation-result.valid {
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .validation-result.invalid {
    background: color-mix(in srgb, var(--danger) 14%, var(--bg));
    color: var(--danger);
    border: 1px solid var(--danger);
  }

  .error-list {
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .history-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .history-item {
    padding: var(--space-3);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
  }

  .history-meta {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-1);
    font-size: var(--text-xs);
  }

  .history-date {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .history-author {
    font-weight: var(--font-medium);
    color: var(--text);
  }

  .history-reason {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text);
  }

  .empty-state {
    color: color-mix(in srgb, var(--text), var(--bg) 45%);
    font-size: var(--text-xs);
    text-align: center;
    padding: var(--space-4) 0;
    margin: 0;
  }
</style>
