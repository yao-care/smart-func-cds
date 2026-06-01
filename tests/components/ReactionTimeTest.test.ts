import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import ReactionTimeTest from '../../src/components/assess/ReactionTimeTest.svelte';

// performance.now() may not be available in jsdom; polyfill it.
if (typeof performance === 'undefined') {
  (globalThis as Record<string, unknown>).performance = { now: () => Date.now() };
}

describe('ReactionTimeTest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── 1. Intro screen ──────────────────────────────────────────────────────

  it('renders intro screen with 開始 button', () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { onComplete } });

    expect(screen.getByText('反應時間測驗')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '開始' })).toBeInTheDocument();
  });

  it('shows trial count in intro description', () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 20, warmupTrials: 5, onComplete } });

    const desc = document.querySelector('.rt-desc');
    expect(desc?.textContent).toContain('20');
    expect(desc?.textContent).toContain('5');
  });

  // ── 2. Clicking 開始 transitions out of intro ────────────────────────────

  it('clicking 開始 hides the start button and enters waiting phase', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { onComplete } });

    const startBtn = screen.getByRole('button', { name: '開始' });
    await fireEvent.click(startBtn);

    // Start button should be gone
    expect(screen.queryByRole('button', { name: '開始' })).toBeNull();

    // "準備…" text should appear (waiting phase)
    expect(document.querySelector('.rt-wait-msg')).toBeInTheDocument();
  });

  // ── 3. Stimulus appears after delay ─────────────────────────────────────

  it('green stimulus appears after the pre-stimulus delay', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    // Before delay fires: no go-circle
    expect(document.querySelector('.rt-go-circle')).toBeNull();

    // Advance timers past max delay (2500 ms) then flush Svelte reactive updates
    vi.advanceTimersByTime(3000);
    flushSync();

    // Go-circle should now be visible
    expect(document.querySelector('.rt-go-circle')).toBeInTheDocument();
  });

  // ── 4. Anticipation guard ────────────────────────────────────────────────

  it('clicking before stimulus shows 太快了 and does NOT advance recorded count', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    // Click while still in waiting phase (before 3000 ms elapses)
    const stage = document.querySelector('.rt-stage') as HTMLElement;
    await fireEvent.click(stage);

    expect(document.querySelector('.rt-tofast')).toBeInTheDocument();

    // Progress should still show 0 recorded
    const progressText = document.querySelector('.rt-progress-text');
    expect(progressText?.textContent?.trim()).toMatch(/^0\s*\/\s*\d+$/);
  });

  // ── 5. Full single-trial completion ─────────────────────────────────────

  it('with trials=1, warmupTrials=0: one full trial calls onComplete with length 1', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 1, warmupTrials: 0, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    // Advance past max wait delay, then flush Svelte reactive updates
    vi.advanceTimersByTime(3000);
    flushSync();

    // Stimulus is now showing; click to respond
    const stage = document.querySelector('.rt-stage') as HTMLElement;
    await fireEvent.click(stage);

    // Feedback shown; advance past 600 ms feedback timer → done, then flush
    vi.advanceTimersByTime(700);
    flushSync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: number[] = onComplete.mock.calls[0][0];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('number');
    expect(result[0]).toBeGreaterThanOrEqual(0);
  });

  // ── 6. Multi-trial: records warmup + real trials ─────────────────────────

  it('with trials=3, warmupTrials=1: runs all 3 trials then calls onComplete with length 3', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 3, warmupTrials: 1, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    for (let i = 0; i < 3; i++) {
      // Advance past max wait delay for this trial, flush DOM
      vi.advanceTimersByTime(3000);
      flushSync();

      const stage = document.querySelector('.rt-stage') as HTMLElement;
      await fireEvent.click(stage);

      // Advance past feedback timer (600 ms), flush DOM
      vi.advanceTimersByTime(700);
      flushSync();
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: number[] = onComplete.mock.calls[0][0];
    expect(result).toHaveLength(3);
  });

  // ── 7. Progress bar updates ───────────────────────────────────────────────

  it('progress bar aria-valuenow increases as trials are completed', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 2, warmupTrials: 1, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const progressBar = () => document.querySelector('.rt-progress-bar');

    expect(progressBar()?.getAttribute('aria-valuenow')).toBe('0');

    // Complete first trial
    vi.advanceTimersByTime(3000);
    flushSync();
    await fireEvent.click(document.querySelector('.rt-stage') as HTMLElement);
    vi.advanceTimersByTime(700);
    flushSync();

    // After 1 of 2 trials: 50%
    expect(progressBar()?.getAttribute('aria-valuenow')).toBe('50');
  });

  // ── 8. Trial labels (warmup vs formal) ───────────────────────────────────

  it('labels first trial as 練習 and labels post-warmup trials as 正式', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 3, warmupTrials: 1, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    // Before first response: warmup label
    expect(document.querySelector('.rt-trial-label')?.textContent).toContain('練習');

    // Complete warmup trial
    vi.advanceTimersByTime(3000);
    flushSync();
    await fireEvent.click(document.querySelector('.rt-stage') as HTMLElement);
    vi.advanceTimersByTime(700);
    flushSync();

    // Now on first formal trial
    expect(document.querySelector('.rt-trial-label')?.textContent).toContain('正式');
  });

  // ── 9. Done screen ────────────────────────────────────────────────────────

  it('shows 測驗完成 after last trial feedback timer', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 1, warmupTrials: 0, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    vi.advanceTimersByTime(3000);
    flushSync();
    await fireEvent.click(document.querySelector('.rt-stage') as HTMLElement);
    vi.advanceTimersByTime(700);
    flushSync();

    expect(document.querySelector('.rt-done-msg')).toBeInTheDocument();
    expect(document.querySelector('.rt-done-msg')?.textContent).toContain('測驗完成');
  });

  // ── 10. Keyboard Space responds to stimulus ───────────────────────────────

  it('Space key press during stimulus records a trial', async () => {
    const onComplete = vi.fn();
    render(ReactionTimeTest, { props: { trials: 1, warmupTrials: 0, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));

    // Advance to stimulus, flush DOM
    vi.advanceTimersByTime(3000);
    flushSync();

    // Press Space
    await fireEvent.keyDown(window, { code: 'Space' });

    vi.advanceTimersByTime(700);
    flushSync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toHaveLength(1);
  });
});
