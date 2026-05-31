<script lang="ts">
  import { assessmentStore } from '../../lib/stores/assessment.svelte';
  import { setTriageResult } from '../../lib/db/assessments';
  import { computeTriage, type TriageResult } from '../../engine/func/triage';
  import { buildRadarData } from '../../engine/func/radar-scoring';
  import RadarChart from './RadarChart.svelte';
  import EducationMatch from './EducationMatch.svelte';
  import AssessmentPdfReport from './AssessmentPdfReport.svelte';
  import CollectionPointPicker from './CollectionPointPicker.svelte';
  import { deriveFuncTriggers } from '$lib/education/trigger-derivation';
  import TriggerVideoList from '../education/TriggerVideoList.svelte';

  let triageResult = $state<TriageResult | null>(null);
  let isComputing = $state(true);

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

  // 進入結果頁時，用問卷模組已計算好的分數即時分流（<1 秒）
  $effect(() => {
    const ageGroup = assessmentStore.ageGroup;
    if (!ageGroup) return;
    const pa = assessmentStore.partialAnalysis;

    const result = computeTriage({
      indicatorScores: pa.indicatorScores ?? [],
      domainScores: pa.domainScores ?? [],
      applicableWeights: pa.applicableWeights ?? {},
      ageGroup,
      assessmentDate: new Date().toISOString().slice(0, 10),
    });
    triageResult = result;
    isComputing = false;
    saveResult(result);
  });

  const radarData = $derived(
    triageResult
      ? buildRadarData(triageResult, assessmentStore.partialAnalysis.indicatorScores ?? []).axes.map(a => ({
          domain: a.domain,
          score: a.score,
          band: a.band,
        }))
      : []
  );

  const flaggedDomains = $derived(triageResult?.flaggedDomains ?? []);

  const videoTriggers = $derived(
    triageResult && assessmentStore.ageGroup
      ? deriveFuncTriggers(triageResult, assessmentStore.ageGroup)
      : [],
  );

  async function saveResult(result: TriageResult) {
    if (!assessmentStore.assessment) return;
    await setTriageResult(assessmentStore.assessment.id, result);
    await assessmentStore.complete();
  }
</script>

{#if isComputing || !triageResult}
  <div class="computing">
    <p>正在產生評估結果…</p>
  </div>
{:else}
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

  {#if radarData.length > 0}
    <section class="radar-section" aria-label="各面向評估結果">
      <h3>五大內在能力面向</h3>
      <RadarChart data={radarData} />
    </section>
  {/if}

  {#if triageResult && assessmentStore.ageGroup && (flaggedDomains.length > 0 || triageResult.category !== 'normal')}
    <section class="education-section" aria-label="衛教建議">
      <h3>建議閱讀</h3>
      <EducationMatch
        category={triageResult.category}
        domains={flaggedDomains.length > 0 ? [...new Set(flaggedDomains)] : ['vitality']}
        ageGroup={assessmentStore.ageGroup}
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
    {#if assessmentStore.assessment && triageResult}
      <CollectionPointPicker assessmentId={assessmentStore.assessment.id} {triageResult} />
    {/if}

    {#if assessmentStore.assessment && assessmentStore.patient}
      <AssessmentPdfReport assessment={assessmentStore.assessment} patient={assessmentStore.patient} />
    {/if}

    <a href="/history/" class="btn-history">查看評估紀錄</a>
    <a href="/assess/" class="btn-home">開始新評估</a>
  </div>
</div>
{/if}

<style>
  .result-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* Disclaimer banner */
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

  /* Triage card */
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

  /* Radar section */
  .radar-section {
    text-align: center;
  }

  .radar-section h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-4);
  }

  /* (Detail-table CSS removed — raw metric section moved to physician detail view.) */

  /* Education section */
  .education-section h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-4);
  }

  /* Recommended videos */
  .recommended-videos {
    margin-top: var(--space-7);
  }

  .recommended-videos h2 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-md, 16px);
  }

  /* Action buttons */
  .result-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }

  .btn-history {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-7);
    background: var(--surface);
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-decoration: none;
    min-height: 48px;
    min-width: 200px;
    transition: background 0.2s, color 0.2s;
  }

  .btn-history:hover {
    background: var(--accent);
    color: white;
  }

  .btn-home {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-7);
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-decoration: none;
    min-height: 48px;
    min-width: 200px;
    transition: border-color 0.2s;
  }

  .btn-home:hover {
    border-color: var(--accent);
  }
</style>
