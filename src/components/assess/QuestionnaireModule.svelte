<script lang="ts">
  import yaml from 'js-yaml';
  import { assessmentStore } from '../../lib/stores/assessment.svelte';
  import { recordEvent } from '../../lib/db/assessment-events';
  import indicatorsRaw from '../../data/questionnaire/indicators.yaml?raw';
  import {
    indicatorSchema,
    type Indicator,
    type LikertIndicator,
    type LikertQuestion,
  } from '../../engine/func/questionnaire';
  import { scoreAssessment, isDetailRevealed } from '../../engine/func/scorer';
  import { IC_DOMAIN_NAMES, type ICDomain } from '../../lib/education/schemas';
  import CrisisResources from './CrisisResources.svelte';

  const DOMAIN_LABELS: Record<ICDomain, string> = {
    vitality: '身體活力',
    locomotion: '行動功能',
    cognition: '認知功能',
    psychological: '心理功能',
    sensory: '感官功能',
  };

  // ---- Load + validate indicators (build-time YAML embedded via ?raw) ----
  const ALL_INDICATORS: Indicator[] = (() => {
    const doc = yaml.load(indicatorsRaw) as Record<string, unknown[]>;
    const out: Indicator[] = [];
    for (const domain of IC_DOMAIN_NAMES) {
      const list = doc[domain] ?? [];
      for (const ind of list) out.push(indicatorSchema.parse(ind));
    }
    return out;
  })();

  // Only Likert indicators are answerable in S1. Objective indicators have null
  // norms (not yet scorable) and are surfaced as "not measured" in the result.
  const ageGroup = $derived(assessmentStore.ageGroup);

  const likertIndicators = $derived<LikertIndicator[]>(
    ALL_INDICATORS.filter(
      (ind): ind is LikertIndicator =>
        ind.kind === 'likert' &&
        (!ind.ageApplicability || (ageGroup !== null && ind.ageApplicability.includes(ageGroup)))
    )
  );

  // FlatQuestion — 一個待呈現題目的顯示與作答內容
  interface FlatQuestion {
    indicatorId: string;
    domain: ICDomain;
    domainLabel: string;
    indicatorLabel: string;
    questionId: string;
    text: string;
    options: { label: string; score: number }[];
    clinicallyReviewed: boolean;
  }

  // ---- Module state ----
  let answers = $state<Record<string, number>>({});
  let lastAnswerLabel = $state<string | null>(null);
  let phase = $state<'asking' | 'summary'>('asking');
  let isSaving = $state(false);
  let showCrisis = $state(false);

  // 即時域分數（只反映已作答題；未答的 detail 指標自然不計入 → band = screener band）
  // 單次 scoreAssessment；bandByDomain 與 domainSummary 共用同一結果避免重複計算。
  const assessmentResult = $derived.by(() => {
    if (!ageGroup) return null;
    return scoreAssessment({ indicators: ALL_INDICATORS, answers, objectiveResults: {}, ageGroup });
  });

  const bandByDomain = $derived<Partial<Record<ICDomain, 'high' | 'moderate' | 'low'>>>(
    assessmentResult
      ? Object.fromEntries(assessmentResult.domainScores.map(d => [d.domain, d.band]))
      : {}
  );

  function toFlat(ind: LikertIndicator, q: LikertQuestion): FlatQuestion {
    return {
      indicatorId: ind.id,
      domain: ind.domain,
      domainLabel: DOMAIN_LABELS[ind.domain],
      indicatorLabel: ind.label,
      questionId: q.id,
      text: q.text,
      options: q.options,
      clinicallyReviewed: true,
    };
  }

  // 答案驅動的可見題：螢檢題恆顯示；指標層 detail 於域 band != high 時顯示；
  // 題層 detail 於同指標 revealDetailWhen 觸發時顯示。
  const visibleQuestions = $derived.by<FlatQuestion[]>(() => {
    const out: FlatQuestion[] = [];
    for (const ind of likertIndicators) {
      if (ind.tier === 'detail') {
        const band = bandByDomain[ind.domain];
        if (!band || band === 'high') continue; // 螢檢未完成或正常 → 不展開整個 detail 指標
      }
      const detailRevealed = isDetailRevealed(ind, answers);
      for (const q of ind.questions) {
        if (q.tier === 'detail' && !detailRevealed) continue;
        out.push(toFlat(ind, q));
      }
    }
    return out;
  });

  // 下一個未作答的可見題；皆作答完畢則 null。
  const currentQuestion = $derived<FlatQuestion | null>(
    visibleQuestions.find(q => answers[q.questionId] === undefined) ?? null
  );
  const answeredCount = $derived(Object.keys(answers).length);
  const visibleTotal = $derived(visibleQuestions.length);
  const rawPct = $derived(visibleTotal > 0 ? Math.round((answeredCount / visibleTotal) * 100) : 0);
  // 自適應問卷長度未知：detail 解鎖會讓 visibleTotal 跳增、原始比例倒退。
  // 進度條改為單調不倒退（標準 adaptive UX）——解鎖時暫停而非後退，待作答追上再前進。
  let peakPct = $state(0);
  $effect(() => {
    if (rawPct > peakPct) peakPct = rawPct;
  });

  // ---- Per-domain summary (capacity 0-100 from scorer) ----
  const domainSummary = $derived(
    !assessmentResult
      ? []
      : IC_DOMAIN_NAMES.map(domain => {
          const d = assessmentResult.domainScores.find(ds => ds.domain === domain);
          return {
            domain,
            label: DOMAIN_LABELS[domain],
            score: d?.score ?? null,
            band: d?.band ?? null,
          };
        })
  );

  // ---- Answer handler ----
  async function handleAnswer(option: { label: string; score: number }) {
    if (!currentQuestion || isSaving) return;
    isSaving = true;
    lastAnswerLabel = option.label;
    const qid = currentQuestion.questionId;
    const domain = currentQuestion.domain;
    const indicatorId = currentQuestion.indicatorId;
    const questionText = currentQuestion.text;

    // 安全：自我傷害意念螢檢題（全體必答）勾選非零 → 立即顯示危機資源
    if (qid === 'psychological.self_harm.q1' && option.score > 0) {
      showCrisis = true;
    }

    answers = { ...answers, [qid]: option.score };

    const assessment = assessmentStore.assessment;
    const patient = assessmentStore.patient;
    if (assessment && patient) {
      await recordEvent({
        assessmentId: assessment.id,
        patientId: patient.id,
        moduleType: 'questionnaire',
        eventType: 'questionnaire_answer',
        timestamp: new Date(),
        data: {
          questionId: qid,
          indicatorId,
          domain,
          questionText,
          answerLabel: option.label,
          score: option.score,
          ageGroup,
        },
        qualityFlags: { isComplete: true, isAnomaly: false },
      });
    }

    await new Promise(r => setTimeout(r, 320));
    lastAnswerLabel = null;
    isSaving = false;

    // currentQuestion 為 derived：設定 answers 後若已無未答可見題 → 進摘要
    if (!currentQuestion) {
      persistScoresToStore();
      phase = 'summary';
    }
  }

  function persistScoresToStore(): void {
    if (!ageGroup) return;
    const { indicatorScores, domainScores, applicableWeights } = scoreAssessment({
      indicators: ALL_INDICATORS,
      answers,
      objectiveResults: {},
      ageGroup,
    });
    assessmentStore.addAnalysis({
      answers,
      objectiveResults: {},
      indicatorScores,
      domainScores,
      applicableWeights,
    });
  }

  async function handleFinish() {
    persistScoresToStore();
    await assessmentStore.nextStep();
  }
</script>

<div class="questionnaire">
  {#if phase === 'asking' && currentQuestion}
    <div class="progress-bar-wrap" role="progressbar" aria-valuenow={peakPct} aria-valuemin={0} aria-valuemax={100}>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: {peakPct}%"></div>
      </div>
      <span class="progress-label" data-testid="progress-label" data-answered={answeredCount} data-visible-total={visibleTotal}>已完成 {answeredCount} 題</span>
    </div>

    <div class="domain-badge" data-testid="current-question-id" data-question-id={currentQuestion.questionId}>{currentQuestion.domainLabel} · {currentQuestion.indicatorLabel}</div>

    <CrisisResources visible={showCrisis} />

    <h2 class="question-text">{currentQuestion.text}</h2>

    {#if lastAnswerLabel}
      <div class="feedback-banner" role="status">已記錄，下一題</div>
    {/if}

    <div class="options-list">
      {#each currentQuestion.options as option (option.label)}
        <button
          class="option-btn"
          class:selected={answers[currentQuestion.questionId] === option.score}
          disabled={isSaving}
          data-score={option.score}
          onclick={() => handleAnswer(option)}
        >
          {option.label}
        </button>
      {/each}
    </div>

  {:else if phase === 'summary'}
    <div class="summary">
      <div class="summary-icon" aria-hidden="true">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="28" cy="28" r="28" style="fill: color-mix(in srgb, var(--accent) 12%, var(--bg));"/>
          <path d="M16 28.5l8 8 16-16" style="stroke: var(--accent);" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="summary-title">問卷完成！</h2>
      <p class="summary-desc">以下是五大內在能力面向的初步摘要</p>

      <div class="domain-bars">
        {#each domainSummary as d (d.domain)}
          <div class="domain-row">
            <span class="domain-name">{d.label}</span>
            <div class="bar-track">
              {#if d.score !== null}
                <div
                  class="bar-fill"
                  class:bar-high={d.band === 'high'}
                  class:bar-mid={d.band === 'moderate'}
                  class:bar-low={d.band === 'low'}
                  style="width: {d.score}%"
                ></div>
              {/if}
            </div>
            <span class="domain-score">{d.score === null ? '未測' : `${d.score}`}</span>
          </div>
        {/each}
      </div>

      <div class="actions">
        <button class="btn-finish" onclick={handleFinish}>查看評估結果</button>
      </div>
    </div>

  {:else}
    <div class="empty-state">
      <p>目前沒有適用的問卷題目。</p>
      <button class="btn-finish" onclick={handleFinish}>繼續下一步</button>
    </div>
  {/if}
</div>

<style>
  .questionnaire {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--space-6);
  }

  .progress-bar-wrap { margin-bottom: var(--space-6); }

  .progress-bar-track {
    height: 6px;
    background: color-mix(in srgb, var(--bg), var(--text) 5%);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: var(--space-2);
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .domain-badge {
    display: inline-block;
    padding: var(--space-1) var(--space-3);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    color: var(--accent);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    margin-bottom: var(--space-4);
  }

  .question-text {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    line-height: var(--lh-xl);
    margin-bottom: var(--space-6);
    color: var(--text);
  }

  .feedback-banner {
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    color: var(--accent);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-align: center;
    margin-bottom: var(--space-4);
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .option-btn {
    width: 100%;
    min-height: 64px;
    padding: var(--space-4) var(--space-5);
    background: var(--surface);
    border: 2px solid var(--line);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    line-height: var(--lh-base);
  }

  .option-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--bg);
  }

  .option-btn.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    color: var(--accent);
  }

  .option-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .summary { text-align: center; }
  .summary-icon { margin-bottom: var(--space-4); }
  .summary-title { font-size: var(--text-2xl); margin-bottom: var(--space-2); }

  .summary-desc {
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    font-size: var(--text-sm);
    margin-bottom: var(--space-7);
  }

  .domain-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-8);
    text-align: left;
  }

  .domain-row {
    display: grid;
    grid-template-columns: 88px 1fr 48px;
    align-items: center;
    gap: var(--space-3);
  }

  .domain-name {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    white-space: nowrap;
  }

  .bar-track {
    height: 16px;
    background: color-mix(in srgb, var(--bg), var(--text) 5%);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.6s ease;
  }

  .bar-fill.bar-high { background: var(--color-risk-normal, var(--accent)); }
  .bar-fill.bar-mid { background: var(--color-risk-advisory, var(--warn)); }
  .bar-fill.bar-low { background: var(--color-risk-warning, var(--danger)); }

  .domain-score {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
    text-align: right;
    white-space: nowrap;
  }

  .btn-finish {
    width: 100%;
    padding: var(--space-4);
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    cursor: pointer;
    min-height: 56px;
  }

  .btn-finish:hover { background: color-mix(in srgb, var(--accent) 85%, black); }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }

  .empty-state p { margin-bottom: var(--space-6); }
</style>
