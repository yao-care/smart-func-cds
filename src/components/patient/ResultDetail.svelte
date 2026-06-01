<script lang="ts">
  import { resolveAssessment, type ResolveError, type Source } from '../../lib/db/assessment-resolver';
  import { isAuthorized } from '../../lib/fhir/client';
  import type { Assessment } from '../../lib/db/schema';
  import { db } from '../../lib/db/schema';
  import { deriveFuncTriggers } from '$lib/education/trigger-derivation';
  import { ageGroupAdult } from '$lib/utils/age-groups';
  import TriggerVideoList from '../education/TriggerVideoList.svelte';

  const DOMAIN_LABELS: Record<string, string> = {
    vitality: '身體活力',
    locomotion: '行動功能',
    cognition: '認知功能',
    psychological: '心理功能',
    sensory: '感官功能',
  };

  const BAND_LABELS: Record<string, string> = {
    high: '良好',
    moderate: '待觀察',
    low: '偏低',
  };

  const CATEGORY_LABELS: Record<string, string> = {
    normal: '功能良好',
    observe: '建議觀察',
    consult: '建議諮詢醫師',
    incomplete: '評估未完成',
  };

  // Physician-facing detail view. Loads assessment via the cross-device
  // resolver (IDB first, FHIR fallback), enforces auth gate before
  // rendering any clinical data, and surfaces explicit error states.

  let loading = $state(true);
  let error = $state<ResolveError | 'invalid' | null>(null);
  let assessment = $state<Assessment | null>(null);
  let source = $state<Source | null>(null);
  let returnUrl = $state<string>('');
  let patientBirthDate = $state<string | null>(null);

  $effect(() => {
    (async () => {
      try {
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          error = 'invalid';
          return;
        }
        returnUrl = `/workspace/result/?id=${encodeURIComponent(id)}`;

        if (!isAuthorized()) {
          // Redirect to the simple result view; do not render any medical data here.
          window.location.replace(`/result/?id=${encodeURIComponent(id)}`);
          return; // loading stays true until redirect lands
        }

        const result = await resolveAssessment(id);
        if (result.ok) {
          assessment = result.assessment;
          source = result.source;
          // Load patient birthDate to derive adult age group for video triggers
          const patient = await db.assessmentPatients.get(result.assessment.patientId).catch(() => null);
          if (patient?.birthDate) patientBirthDate = patient.birthDate;
        } else {
          error = result.error;
        }
      } finally {
        // Stay in loading until redirect navigates away — only switch off
        // when we actually have data or an error to show.
        if (assessment || error) loading = false;
      }
    })();
  });

  const triage = $derived(assessment?.triageResult ?? null);

  const videoTriggers = $derived.by(() => {
    if (!triage || !patientBirthDate) return [];
    const ageGroup = ageGroupAdult(patientBirthDate);
    return deriveFuncTriggers(triage, ageGroup);
  });

  let note = $state('');
  let noteSaveTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (assessment?.physicianNote && note === '') {
      note = assessment.physicianNote;
    }
  });

  function onNoteInput(e: Event) {
    note = (e.target as HTMLTextAreaElement).value;
    if (!assessment) return;
    if (noteSaveTimer) clearTimeout(noteSaveTimer);
    const id = assessment.id;
    const value = note;
    noteSaveTimer = setTimeout(async () => {
      await db.assessments.update(id, {
        physicianNote: value,
        physicianNoteUpdatedAt: new Date(),
      });
    }, 500);
  }

  function relaunchLink(): string {
    return `/workspace/?return=${encodeURIComponent(returnUrl)}`;
  }
</script>

{#if loading}
  <p class="status">載入中…</p>
{:else if error === 'invalid'}
  <div class="error-box"><p>網址無效。</p></div>
{:else if error === 'token_expired'}
  <div class="error-box">
    <p>Session 過期，請重新登入醫院 FHIR Server。</p>
    <a href={relaunchLink()} class="relaunch-link">回工作台登入 →</a>
  </div>
{:else if error === 'forbidden'}
  <div class="error-box"><p>沒有檢視此評估的權限。</p></div>
{:else if error === 'not_found'}
  <div class="error-box"><p>找不到此評估紀錄。</p></div>
{:else if error === 'network'}
  <div class="error-box"><p>連線失敗，請稍後再試。</p></div>
{:else if assessment && triage}
  <article class="detail">
    <header class="summary-bar">
      <div>
        <span class="label">受測者識別碼</span>
        <span class="value">{assessment.patientId.slice(0, 8)}…</span>
      </div>
      <div>
        <span class="label">評估日期</span>
        <span class="value">
          {(assessment.startedAt instanceof Date ? assessment.startedAt : new Date(assessment.startedAt)).toLocaleDateString('zh-TW')}
        </span>
      </div>
      <div>
        <span class="label">分類</span>
        <span class="value">{triage.category}</span>
      </div>
      <div class="source-badge" class:source-fhir={source === 'fhir'}>
        {source === 'fhir' ? '來自 FHIR Server' : '本地紀錄'}
      </div>
    </header>

    <section aria-label="分流判定">
      <h3>分流判定</h3>
      <div class="triage-summary">
        <span class="triage-cat triage-{triage.category}">{CATEGORY_LABELS[triage.category]}</span>
        <span class="muted">信心度 {Math.round(triage.confidence * 100)}%</span>
        <span class="muted">·</span>
        <span class="muted">已測面向 {triage.completedDomains ?? triage.domainScores?.length ?? 0} / 5</span>
      </div>
      <details class="rule-detail">
        <summary>分流判定規則</summary>
        <ul>
          <li><strong>consult（建議諮詢）</strong>：任一面向偏低、或 ≥ 2 個面向待觀察、或臨床切點達 consult 等級</li>
          <li><strong>observe（建議觀察）</strong>：1 個面向待觀察，或有 advisory 切點</li>
          <li><strong>normal（功能良好）</strong>：所有已測面向皆良好且無 advisory 切點</li>
          <li><strong>incomplete（未完成）</strong>：完成面向 &lt; 3</li>
          <li>面向分級：score ≥ 70 良好；40-69 待觀察；&lt; 40 偏低</li>
        </ul>
      </details>
    </section>

    <section aria-label="各面向分數">
      <h3>各面向分數</h3>
      {#if triage.domainScores && triage.domainScores.length > 0}
        <table class="metric-table">
          <thead>
            <tr>
              <th>面向</th>
              <th>功能分數</th>
              <th>能力分量</th>
              <th>症狀分量</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {#each triage.domainScores as d}
              <tr class:anomaly={d.band === 'low'}>
                <td>{DOMAIN_LABELS[d.domain] ?? d.domain}</td>
                <td class="num">{d.score}</td>
                <td class="num norm">{d.capacityScore ?? '—'}</td>
                <td class="num norm">{d.symptomScore ?? '—'}</td>
                <td><span class="status-pill status-{d.band === 'high' ? 'normal' : 'anomaly'}">{BAND_LABELS[d.band] ?? d.band}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if triage.clinicalCutoffs && triage.clinicalCutoffs.length > 0}
          <h4 class="cutoff-head">臨床切點警示</h4>
          <ul class="cutoff-list">
            {#each triage.clinicalCutoffs as c}
              <li>
                <span class="status-pill status-anomaly">{c.severity === 'consult' ? '建議諮詢' : '注意'}</span>
                {DOMAIN_LABELS[c.domain] ?? c.domain} · {c.flagLabel}
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        <p class="muted">此評估未保留面向細節，可能來自精簡 FHIR 紀錄。</p>
      {/if}
    </section>

    <section aria-label="事件時序">
      <h3>事件時序</h3>
      {#if source === 'fhir'}
        <p class="muted">此資料來自 FHIR Server，無原始事件紀錄。</p>
      {:else}
        <p class="muted">事件 timeline 渲染待後續迭代加上。</p>
      {/if}
    </section>

    <section aria-label="醫師備註">
      <h3>醫師備註</h3>
      <textarea
        class="note-input"
        rows="4"
        placeholder="輸入備註（自動暫存到本地，點下方按鈕儲存到 FHIR）"
        value={note}
        oninput={onNoteInput}
      ></textarea>
      <p class="muted small">草稿自動暫存；提交到 FHIR 為下次迭代功能。</p>
    </section>

    {#if videoTriggers.length > 0}
      <section class="recommended-videos" aria-label="建議分享給受測者的衛教影片">
        <h2>建議分享給受測者的衛教影片</h2>
        <TriggerVideoList triggers={videoTriggers} />
      </section>
    {/if}
  </article>
{/if}

<style>
  .status,
  .error-box {
    text-align: center;
    padding: var(--space-8);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .relaunch-link {
    display: inline-block;
    margin-top: var(--space-3);
    color: var(--accent);
    text-decoration: none;
    font-weight: var(--font-medium);
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .summary-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .summary-bar .label {
    display: block;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .summary-bar .value {
    font-weight: var(--font-medium);
  }

  .source-badge {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--bg), var(--text) 5%);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-xs);
  }

  .source-badge.source-fhir {
    background: color-mix(in srgb, var(--warn) 12%, var(--bg));
    color: var(--warn);
  }

  section h3 {
    font-size: var(--text-base);
    margin-bottom: var(--space-2);
  }

  .metric-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
  }

  .metric-table th,
  .metric-table td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
    text-align: left;
  }

  .metric-table td.num {
    font-family: var(--font-mono);
    text-align: right;
  }

  .metric-table tr.anomaly {
    background: color-mix(in srgb, var(--danger) 14%, var(--bg));
  }

  .metric-table td.norm {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-xs);
  }

  .triage-summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: var(--text-sm);
  }

  .triage-cat {
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }

  .triage-normal { background: color-mix(in srgb, var(--accent) 12%, var(--bg)); color: var(--accent); }
  .triage-observe { background: color-mix(in srgb, var(--warn) 12%, var(--bg)); color: var(--warn); }
  .triage-consult { background: color-mix(in srgb, var(--danger) 14%, var(--bg)); color: var(--danger); }
  .triage-incomplete { background: color-mix(in srgb, var(--text) 8%, var(--bg)); color: color-mix(in srgb, var(--text), var(--bg) 20%); }

  .cutoff-head { font-size: var(--text-sm); margin: var(--space-4) 0 var(--space-2); }
  .cutoff-list { margin: 0; padding-left: var(--space-5); font-size: var(--text-sm); line-height: 1.8; }

  .rule-detail {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .rule-detail summary {
    cursor: pointer;
    color: var(--accent);
    margin-bottom: var(--space-1);
  }

  .rule-detail ul {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
    line-height: 1.6;
  }

  .status-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .status-pill.status-normal { background: color-mix(in srgb, var(--accent) 12%, var(--bg)); color: var(--accent); }
  .status-pill.status-anomaly { background: color-mix(in srgb, var(--danger) 14%, var(--bg)); color: var(--danger); }

  .muted {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-sm);
  }

  .muted.small {
    font-size: var(--text-xs);
  }

  .note-input {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font: inherit;
  }

  .recommended-videos {
    margin-top: var(--space-7);
  }

  .recommended-videos h2 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-md, 16px);
  }
</style>
