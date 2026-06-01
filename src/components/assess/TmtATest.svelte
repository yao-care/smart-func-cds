<script lang="ts">
  import { untrack } from 'svelte';
  import { createTmtARunner } from '../../engine/func/objective-tests';

  interface Props {
    targetCount?: number;
    onComplete: (result: number[]) => void;
  }

  let { targetCount = 25, onComplete }: Props = $props();

  // Capture targetCount once so layout is fixed for the life of this component.
  const N: number = untrack(() => targetCount);

  // ─── Types ────────────────────────────────────────────────────────────────
  type Phase = 'intro' | 'active' | 'done';

  interface NodePos {
    xPct: number; // left% of the board (centre of circle)
    yPct: number; // top%
  }

  // ─── Deterministic layout ─────────────────────────────────────────────────
  // Produce N pseudo-scattered positions using a seeded LCG so layout is
  // stable across renders while still looking irregular.  Nodes are kept at
  // least MIN_GAP_PCT apart (centre-to-centre, in percent units) so they
  // never visually overlap given a 44 px / 360 px ≈ 12 % radius.
  //
  // Board dimensions used for collision avoidance:
  //   width  ≈ 360 px (horizontal container max-width)
  //   height ≈ 360 px (board height)
  // Node diameter = 48 px → 13.3 % of 360 px.
  // We keep centres inside [8 %, 92 %] so circles stay inside the board.
  const MARGIN_PCT = 8;        // % from any edge to circle centre
  const MIN_GAP_PCT = 15;      // minimum centre-to-centre distance in %

  function buildLayout(count: number): NodePos[] {
    // LCG parameters (same as Numerical Recipes)
    let seed = 0x4a1e_f3b9;
    function rand(): number {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 0xffff_ffff;
    }

    const positions: NodePos[] = [];
    const range = 100 - MARGIN_PCT * 2; // usable range in each axis

    let attempts = 0;
    while (positions.length < count && attempts < 10000) {
      attempts++;
      const x = MARGIN_PCT + rand() * range;
      const y = MARGIN_PCT + rand() * range;

      // Reject if too close to any existing node
      const ok = positions.every(
        (p) => Math.hypot(p.xPct - x, p.yPct - y) >= MIN_GAP_PCT,
      );
      if (ok) positions.push({ xPct: x, yPct: y });
    }
    return positions;
  }

  const LAYOUT: NodePos[] = buildLayout(N);

  // ─── Runner ───────────────────────────────────────────────────────────────
  const runner = createTmtARunner();

  // ─── State ────────────────────────────────────────────────────────────────
  let phase = $state<Phase>('intro');
  let nextExpected = $state(1);         // 1-based; which number to click next
  let done = $state<boolean[]>(Array(N + 1).fill(false)); // 1-indexed (index 0 unused)
  let errorNode = $state(0);            // node number that just had a wrong click (0 = none)
  let timerStarted = $state(false);     // runner.start() called on first correct click
  let errorCount = $state(0);

  // Live-region message for a11y
  let liveMsg = $state('');

  // ─── Helpers ─────────────────────────────────────────────────────────────
  let errorFlashTimer: ReturnType<typeof setTimeout> | null = null;

  function clearErrorFlash() {
    if (errorFlashTimer !== null) {
      clearTimeout(errorFlashTimer);
      errorFlashTimer = null;
    }
    errorNode = 0;
  }

  function handleNodeClick(n: number) {
    if (phase !== 'active') return;

    if (n === nextExpected) {
      // Correct click
      clearErrorFlash();

      if (!timerStarted) {
        // Timer starts on the FIRST correct click (node 1)
        runner.start(performance.now());
        timerStarted = true;
      }

      // Mark node done (reassign array so Svelte 5 detects the change)
      const updated = [...done];
      updated[n] = true;
      done = updated;

      nextExpected += 1;
      liveMsg = n < N ? `${n} 完成，請點 ${n + 1}` : '';

      if (n === N) {
        // Last node → finish
        runner.finish(performance.now());
        phase = 'done';
        liveMsg = '測驗完成！';
        onComplete([runner.getElapsedSec()]);
      }
    } else {
      // Wrong click → flash error, do NOT advance
      errorCount += 1;
      errorNode = n;
      liveMsg = `錯誤，請點 ${nextExpected}`;
      clearErrorFlash();
      errorFlashTimer = setTimeout(() => {
        errorNode = 0;
      }, 600);
    }
  }

  function startTest() {
    runner.reset();
    nextExpected = 1;
    done = Array(N + 1).fill(false);
    errorCount = 0;
    timerStarted = false;
    errorNode = 0;
    liveMsg = '請點擊數字 1 開始計時';
    phase = 'active';
  }
</script>

<div class="tmt-container" role="main" aria-label="數字連線測驗 A">
  {#if phase === 'intro'}
    <!-- ── Intro ── -->
    <div class="tmt-intro">
      <h2 class="tmt-title">數字連線測驗 A</h2>
      <p class="tmt-desc">
        依序點擊 1 → 2 → 3 …直到 {N}，越快越好。<br />
        點到正確數字後會自動繼續，點錯了請馬上點正確的數字。
      </p>
      <button class="tmt-start-btn" onclick={startTest}>開始</button>
    </div>

  {:else if phase === 'active'}
    <!-- ── Active board ── -->
    <div class="tmt-header">
      <span class="tmt-progress-label">進度 {nextExpected - 1} / {N}</span>
      {#if errorCount > 0}
        <span class="tmt-error-count">錯誤 {errorCount} 次</span>
      {/if}
    </div>

    <!-- Live region for screen readers -->
    <div aria-live="polite" aria-atomic="true" class="tmt-live-region">{liveMsg}</div>

    <!-- Board -->
    <div class="tmt-board" aria-label="測驗板">
      <!-- SVG connection lines layer (drawn BELOW buttons) -->
      <svg class="tmt-lines" aria-hidden="true">
        {#each { length: nextExpected - 2 } as _, i}
          {@const from = LAYOUT[i]}
          {@const to = LAYOUT[i + 1]}
          <line
            x1="{from.xPct}%"
            y1="{from.yPct}%"
            x2="{to.xPct}%"
            y2="{to.yPct}%"
            class="tmt-line"
          />
        {/each}
      </svg>

      {#each { length: N } as _, i}
        {@const n = i + 1}
        {@const pos = LAYOUT[i]}
        <button
          class="tmt-node"
          class:tmt-node--done={done[n]}
          class:tmt-node--next={n === nextExpected && !done[n]}
          class:tmt-node--error={errorNode === n}
          style="left: {pos.xPct}%; top: {pos.yPct}%;"
          onclick={() => handleNodeClick(n)}
          aria-label="數字 {n}"
          aria-pressed={done[n]}
          disabled={done[n]}
        >
          {n}
        </button>
      {/each}
    </div>

  {:else if phase === 'done'}
    <!-- ── Done ── -->
    <div class="tmt-done" aria-live="polite">
      <p class="tmt-done-msg">測驗完成！</p>
    </div>
  {/if}
</div>

<style>
  .tmt-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-5);
    background: var(--bg);
    min-height: 400px;
  }

  /* ── Intro ── */
  .tmt-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    max-width: 480px;
    text-align: center;
  }

  .tmt-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text);
    margin: 0;
  }

  .tmt-desc {
    font-size: var(--text-sm);
    line-height: var(--lh-sm);
    color: var(--text);
    margin: 0;
  }

  .tmt-start-btn {
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

  .tmt-start-btn:hover { opacity: 0.88; }
  .tmt-start-btn:active { opacity: 0.75; }

  /* ── Header bar ── */
  .tmt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 360px;
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text);
  }

  .tmt-progress-label { font-weight: var(--font-medium); }

  .tmt-error-count {
    color: var(--danger);
    font-weight: var(--font-medium);
  }

  /* Screen-reader-only live region */
  .tmt-live-region {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* ── Board ── */
  .tmt-board {
    position: relative;
    width: 360px;
    height: 360px;
    background: var(--surface);
    border: 2px solid var(--line);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  /* SVG line overlay */
  .tmt-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .tmt-line {
    stroke: #3d6b54;
    stroke-width: 2.5;
    stroke-linecap: round;
    opacity: 0.55;
  }

  @supports (color: oklch(0 0 0)) {
    .tmt-line { stroke: oklch(0.48 0.08 155); }
  }

  /* ── Nodes ── */
  .tmt-node {
    position: absolute;
    /* Centre the node on its (left, top) position */
    transform: translate(-50%, -50%);

    width: 48px;
    height: 48px;
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius-full);

    font-size: 18px; /* minimum per spec */
    font-weight: var(--font-bold);
    line-height: 1;
    text-align: center;

    cursor: pointer;
    border: 2px solid var(--line);
    background: var(--bg);
    color: var(--text);
    box-shadow: var(--shadow-sm);
    transition: background 0.15s, border-color 0.15s, opacity 0.15s, transform 0.1s;
    user-select: none;
    -webkit-user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Next-to-click: accent highlight */
  .tmt-node--next {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
    box-shadow: var(--shadow-md);
    transform: translate(-50%, -50%) scale(1.1);
  }

  /* Already clicked: dimmed */
  .tmt-node--done {
    background: var(--surface);
    color: color-mix(in srgb, var(--text) 35%, var(--bg));
    border-color: var(--line);
    opacity: 0.55;
    cursor: default;
    transform: translate(-50%, -50%) scale(0.92);
  }

  /* Wrong click: danger flash */
  .tmt-node--error {
    background: var(--danger);
    color: var(--bg);
    border-color: var(--danger);
    transform: translate(-50%, -50%) scale(1.1);
    animation: tmt-error-shake 0.35s ease;
  }

  @keyframes tmt-error-shake {
    0%   { transform: translate(-50%, -50%) scale(1.1) translateX(0); }
    25%  { transform: translate(-50%, -50%) scale(1.1) translateX(-4px); }
    50%  { transform: translate(-50%, -50%) scale(1.1) translateX(4px); }
    75%  { transform: translate(-50%, -50%) scale(1.1) translateX(-3px); }
    100% { transform: translate(-50%, -50%) scale(1.1) translateX(0); }
  }

  /* ── Done ── */
  .tmt-done {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .tmt-done-msg {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--accent);
    margin: 0;
  }
</style>
