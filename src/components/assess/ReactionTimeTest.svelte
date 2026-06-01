<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { createReactionTimeRunner } from '../../engine/func/objective-tests';

  interface Props {
    trials?: number;
    warmupTrials?: number;
    onComplete: (trialsMs: number[]) => void;
  }

  let { trials = 20, warmupTrials = 5, onComplete }: Props = $props();

  // Capture initial prop values via untrack() so Svelte 5 doesn't warn about
  // reading reactive props outside a reactive context. These are intentionally
  // fixed configuration values for the lifetime of the component.
  const trialsCount: number = untrack(() => trials);
  const warmupCount: number = untrack(() => warmupTrials);

  // ─── State machine ────────────────────────────────────────────────────────
  // 'intro'    → user reading instructions
  // 'waiting'  → random-delay before stimulus appears
  // 'stimulus' → green circle shown, waiting for response
  // 'feedback' → brief flash showing reaction time
  // 'done'     → all trials complete
  type Phase = 'intro' | 'waiting' | 'stimulus' | 'feedback' | 'done';

  let phase = $state<Phase>('intro');
  let feedbackMs = $state(0);
  let tooFast = $state(false); // anticipation-guard message

  const runner = createReactionTimeRunner({ trials: trialsCount, warmupTrials: warmupCount });

  // Number of trials recorded so far (including warmup)
  let recorded = $state(0);

  // ─── Trial identity ───────────────────────────────────────────────────────
  let stimulusShownAt = $state(0); // performance.now() when stimulus appeared

  // ─── Timer handles ────────────────────────────────────────────────────────
  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Derived labels ───────────────────────────────────────────────────────
  let isWarmup = $derived(recorded < warmupCount);
  let trialLabel = $derived(
    isWarmup
      ? `練習 ${recorded + 1} / ${warmupCount}`
      : `正式 ${recorded - warmupCount + 1} / ${trialsCount - warmupCount}`,
  );
  let progressPct = $derived(Math.round((recorded / trialsCount) * 100));

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function randomDelay(): number {
    // 800 – 2500 ms
    return 800 + Math.random() * 1700;
  }

  function clearTimers() {
    if (waitTimer !== null) { clearTimeout(waitTimer); waitTimer = null; }
    if (feedbackTimer !== null) { clearTimeout(feedbackTimer); feedbackTimer = null; }
  }

  // ─── Flow ─────────────────────────────────────────────────────────────────
  function startTest() {
    runner.reset();
    recorded = 0;
    tooFast = false;
    beginWait();
  }

  function beginWait() {
    phase = 'waiting';
    tooFast = false;
    waitTimer = setTimeout(() => {
      stimulusShownAt = performance.now();
      phase = 'stimulus';
    }, randomDelay());
  }

  function respond() {
    if (phase === 'waiting') {
      // Anticipation guard: response before stimulus
      clearTimers();
      tooFast = true;
      // Repeat the trial after a short pause
      waitTimer = setTimeout(() => {
        tooFast = false;
        beginWait();
      }, 1200);
      return;
    }

    if (phase !== 'stimulus') return;

    const ms = Math.round(performance.now() - stimulusShownAt);
    clearTimers();

    runner.recordTrial(ms);
    recorded += 1;
    feedbackMs = ms;
    phase = 'feedback';

    if (runner.isComplete()) {
      feedbackTimer = setTimeout(() => {
        phase = 'done';
        onComplete(runner.getTrials());
      }, 600);
    } else {
      feedbackTimer = setTimeout(() => {
        beginWait();
      }, 600);
    }
  }

  // ─── Keyboard handler ─────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault();
      respond();
    }
  }

  $effect(() => {
    if (phase !== 'intro' && phase !== 'done') {
      window.addEventListener('keydown', handleKeydown);
      return () => window.removeEventListener('keydown', handleKeydown);
    }
    return undefined;
  });

  onDestroy(() => {
    clearTimers();
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div
  class="rt-container"
  role="main"
  aria-label="反應時間測驗"
>
  {#if phase === 'intro'}
    <!-- ── Intro ── -->
    <div class="rt-intro">
      <h2 class="rt-title">反應時間測驗</h2>
      <p class="rt-desc">
        準備好後，畫面會出現一個<strong>綠色圓圈</strong>。<br />
        看到綠燈就盡快點擊圓圈，或按下<kbd>空白鍵</kbd>。<br />
        共 {trialsCount} 次（含 {warmupCount} 次練習），請專注作答。
      </p>
      <button class="rt-start-btn" onclick={startTest}>開始</button>
    </div>

  {:else if phase === 'waiting' || phase === 'stimulus' || phase === 'feedback'}
    <!-- ── Active trial ── -->
    <div class="rt-trial" aria-live="polite">
      <!-- Progress -->
      <div class="rt-progress-row">
        <span class="rt-trial-label">{trialLabel}</span>
        <span class="rt-progress-text">{recorded} / {trialsCount}</span>
      </div>
      <div class="rt-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div class="rt-progress-fill" style="width: {progressPct}%"></div>
      </div>

      <!-- Stimulus area -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="rt-stage"
        onclick={respond}
        aria-label={phase === 'stimulus' ? '點擊！' : '等待綠燈'}
      >
        {#if tooFast}
          <div class="rt-tofast" aria-live="assertive">太快了，請等綠燈</div>
        {:else if phase === 'waiting'}
          <div class="rt-wait-msg">準備…</div>
        {:else if phase === 'stimulus'}
          <div class="rt-go-circle" aria-label="綠燈！請點擊"></div>
        {:else if phase === 'feedback'}
          <div class="rt-feedback">{feedbackMs} ms</div>
        {/if}
      </div>

      {#if isWarmup && phase !== 'feedback'}
        <p class="rt-hint">這是練習回合，不計入最終結果</p>
      {/if}
    </div>

  {:else if phase === 'done'}
    <!-- ── Done ── -->
    <div class="rt-done" aria-live="polite">
      <p class="rt-done-msg">測驗完成！</p>
    </div>
  {/if}
</div>

<style>
  .rt-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-7);
    background: var(--bg);
    min-height: 320px;
  }

  /* ── Intro ── */
  .rt-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    max-width: 480px;
    text-align: center;
  }

  .rt-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text);
    margin: 0;
  }

  .rt-desc {
    font-size: var(--text-sm);
    line-height: var(--lh-sm);
    color: var(--text);
    margin: 0;
  }

  .rt-desc strong { color: var(--accent); }

  kbd {
    display: inline-block;
    padding: 2px var(--space-2);
    font-size: var(--text-xs);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }

  .rt-start-btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    color: var(--bg);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    box-shadow: var(--shadow-sm);
    transition: opacity 0.15s;
  }

  .rt-start-btn:hover { opacity: 0.88; }
  .rt-start-btn:active { opacity: 0.75; }

  /* ── Trial ── */
  .rt-trial {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    width: 100%;
    max-width: 480px;
  }

  .rt-progress-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: var(--text-xs);
    color: var(--text);
  }

  .rt-trial-label { font-weight: var(--font-medium); }
  .rt-progress-text { color: color-mix(in srgb, var(--text) 60%, var(--bg)); }

  .rt-progress-bar {
    width: 100%;
    height: 8px;
    background: var(--surface);
    border-radius: var(--radius-full);
    overflow: hidden;
    border: 1px solid var(--line);
  }

  .rt-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-full);
    transition: width 0.2s ease;
  }

  /* ── Stage ── */
  .rt-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 300px;
    height: 300px;
    border-radius: var(--radius-xl);
    background: var(--surface);
    border: 2px solid var(--line);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Wait message */
  .rt-wait-msg {
    font-size: var(--text-lg);
    color: color-mix(in srgb, var(--text) 50%, var(--bg));
  }

  /* Go stimulus — big green circle */
  .rt-go-circle {
    width: 160px;
    height: 160px;
    border-radius: var(--radius-full);
    /* Hex fallback, then OKLCH */
    background: #2d9e52;
    box-shadow: 0 0 32px 8px rgba(45, 158, 82, 0.45);
  }

  @supports (color: oklch(0 0 0)) {
    .rt-go-circle {
      background: oklch(0.58 0.18 145);
      box-shadow: 0 0 32px 8px oklch(0.58 0.18 145 / 0.45);
    }
  }

  /* Feedback number */
  .rt-feedback {
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
    color: var(--accent);
  }

  /* Too-fast warning */
  .rt-tofast {
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    color: var(--warn);
    text-align: center;
    padding: var(--space-4);
  }

  /* Hint */
  .rt-hint {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--text) 55%, var(--bg));
    margin: 0;
  }

  /* ── Done ── */
  .rt-done {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }

  .rt-done-msg {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--accent);
    margin: 0;
  }
</style>
