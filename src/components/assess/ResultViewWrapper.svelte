<script lang="ts">
  import { db, type Assessment } from '../../lib/db/schema';
  import RadarChart from './RadarChart.svelte';
  import EducationMatch from './EducationMatch.svelte';
  import AssessmentPdfReport from './AssessmentPdfReport.svelte';
  import { deriveFuncTriggers } from '$lib/education/trigger-derivation';
  import { ageGroupAdult } from '$lib/utils/age-groups';
  import TriggerVideoList from '../education/TriggerVideoList.svelte';
  import CollectionPointPicker from './CollectionPointPicker.svelte';
  import type { AssessmentPatient } from '../../lib/db/schema';

  // Stand-alone result page entry. Reads ?id= from the URL, loads the
  // stored assessment from IndexedDB, and renders the parent-facing
  // simple view using the already-computed triageResult (no recompute).

  let loading = $state(true);
  let error = $state<'invalid' | 'not_found' | null>(null);
  let assessment = $state<Assessment | null>(null);
  let child = $state<AssessmentPatient | null>(null);

  const categoryLabels: Record<string, string> = {
    normal: '功能良好',
    observe: '建議觀察',
    consult: '建議諮詢醫師',
    incomplete: '評估未完成',
  };

  const categoryColors: Record<string, string> = {
    normal: 'var(--color-risk-normal, var(--accent))',
    observe: 'var(--color-risk-advisory, var(--warn))',
    consult: 'var(--color-risk-warning, var(--danger))',
    incomplete: 'var(--text)',
  };

  const categoryBgColors: Record<string, string> = {
    normal: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
    observe: 'color-mix(in srgb, var(--warn) 12%, var(--bg))',
    consult: 'color-mix(in srgb, var(--danger) 14%, var(--bg))',
    incomplete: 'color-mix(in srgb, var(--text) 6%, var(--bg))',
  };

  $effect(() => {
    (async () => {
      try {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          error = 'invalid';
          return;
        }
        const a = await db.assessments.get(id);
        if (!a) {
          error = 'not_found';
          return;
        }
        assessment = a;
        const c = await db.assessmentPatients.get(a.patientId);
        if (c) child = c;
      } finally {
        loading = false;
      }
    })();
  });

  const triageResult = $derived(assessment?.triageResult ?? null);

  const domainScores = $derived.by(() =>
    (triageResult?.domainScores ?? []).map((d) => ({
      domain: d.domain,
      score: d.score,
      band: d.band,
    })),
  );

  const flaggedDomains = $derived(triageResult?.flaggedDomains ?? []);

  const ageGroup = $derived(child?.birthDate ? ageGroupAdult(child.birthDate) : null);

  const videoTriggers = $derived.by(() => {
    if (!triageResult || !ageGroup) return [];
    return deriveFuncTriggers(triageResult, ageGroup);
  });
</script>

{#if loading}
  <p class="status">載入中…</p>
{:else if error === 'invalid'}
  <div class="error-box">
    <p>網址無效。</p>
    <a href="/">返回首頁</a>
  </div>
{:else if error === 'not_found'}
  <div class="error-box">
    <p>找不到此評估紀錄。可能已被刪除，或此網址來自另一台裝置。</p>
    <a href="/history/">查看評估歷史</a>
  </div>
{:else if assessment && triageResult}
  <div class="result-view">
    <div class="disclaimer" role="alert">
      本評估結果僅供參考，不構成醫療診斷。如有疑慮，請諮詢專業醫療人員。
    </div>

    <div
      class="triage-card"
      style="background: {categoryBgColors[triageResult.category]}; border-color: {categoryColors[triageResult.category]};"
    >
      <h2 style="color: {categoryColors[triageResult.category]};">
        {categoryLabels[triageResult.category]}
      </h2>
      <p class="confidence">信心度 {Math.round(triageResult.confidence * 100)}%</p>
      <p class="summary">{triageResult.summary}</p>
    </div>

    {#if domainScores.length > 0}
      <section class="radar-section" aria-label="各面向評估結果">
        <h3>五大內在能力面向</h3>
        <RadarChart data={domainScores} />
      </section>
    {/if}

    {#if ageGroup && (flaggedDomains.length > 0 || triageResult.category !== 'normal')}
      <section class="education-section" aria-label="衛教建議">
        <h3>建議閱讀</h3>
        <EducationMatch
          category={triageResult.category}
          domains={flaggedDomains.length > 0 ? [...new Set(flaggedDomains)] : ['vitality']}
          ageGroup={ageGroup}
        />
      </section>
    {/if}

    {#if videoTriggers.length > 0}
      <section class="recommended-videos" aria-label="建議參考影片">
        <h2>建議參考影片</h2>
        <TriggerVideoList triggers={videoTriggers} />
      </section>
    {/if}

    <div class="result-actions">
      {#if triageResult}
        <CollectionPointPicker assessmentId={assessment.id} {triageResult} />
      {/if}

      {#if child}
        <AssessmentPdfReport {assessment} patient={child} />
      {/if}
      <a href="/history/" class="btn-history">查看評估紀錄</a>
      <a href="/assess/" class="btn-home">開始新評估</a>
    </div>
  </div>
{/if}

<style>
  .status,
  .error-box {
    text-align: center;
    padding: var(--space-8);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .error-box a {
    display: inline-block;
    margin-top: var(--space-3);
    color: var(--accent);
  }

  .result-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .disclaimer {
    padding: var(--space-3) var(--space-4);
    background: color-mix(in srgb, var(--warn) 12%, var(--bg));
    border: 1px solid var(--warn);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--warn);
    text-align: center;
    font-weight: var(--font-medium);
  }

  .triage-card {
    padding: var(--space-7);
    border: 2px solid;
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .triage-card h2 {
    font-size: var(--text-3xl);
    margin-bottom: var(--space-2);
  }

  .confidence {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    margin-bottom: var(--space-3);
  }

  .summary {
    font-size: var(--text-base);
    color: var(--text);
    line-height: var(--lh-base);
  }

  .radar-section,
  .education-section {
    text-align: center;
  }

  .radar-section h3,
  .education-section h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-4);
  }

  .recommended-videos {
    margin-top: var(--space-7);
  }

  .recommended-videos h2 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-md, 16px);
  }

  .result-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }

  .btn-history,
  .btn-home {
    min-height: 44px;
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: var(--text-sm);
    text-align: center;
  }

  .btn-history:hover,
  .btn-home:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
