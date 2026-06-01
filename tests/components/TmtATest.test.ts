import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import TmtATest from '../../src/components/assess/TmtATest.svelte';

// performance.now() may not be available in jsdom; polyfill it.
if (typeof performance === 'undefined') {
  (globalThis as Record<string, unknown>).performance = { now: () => Date.now() };
}

describe('TmtATest', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── 1. Intro screen ──────────────────────────────────────────────────────

  it('renders intro screen with 開始 button', () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { onComplete } });

    expect(screen.getByRole('button', { name: '開始' })).toBeInTheDocument();
  });

  it('intro shows target count in instructions', () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    const desc = document.querySelector('.tmt-desc');
    expect(desc?.textContent).toContain('4');
  });

  // ── 2. After 開始: all N nodes render ────────────────────────────────────

  it('after clicking 開始, all N nodes render with aria-label 數字 n', async () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    flushSync();

    for (let n = 1; n <= 4; n++) {
      expect(screen.getByRole('button', { name: `數字 ${n}` })).toBeInTheDocument();
    }
  });

  it('intro is gone after clicking 開始', async () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    flushSync();

    expect(screen.queryByRole('button', { name: '開始' })).toBeNull();
  });

  // ── 3. Clicking nodes in order calls onComplete once with [elapsedSec] ──

  it('clicking nodes 1..N in order calls onComplete once with [number >= 0]', async () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    flushSync();

    for (let n = 1; n <= 4; n++) {
      await fireEvent.click(screen.getByRole('button', { name: `數字 ${n}` }));
      flushSync();
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: number[] = onComplete.mock.calls[0][0];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('number');
    expect(result[0]).toBeGreaterThanOrEqual(0);
  });

  // ── 4. Wrong-order click does NOT advance, does NOT call onComplete early ─

  it('wrong-order click does not advance nextExpected', async () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    flushSync();

    // Click 1 correctly, then click 3 (wrong)
    await fireEvent.click(screen.getByRole('button', { name: '數字 1' }));
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: '數字 3' }));
    flushSync();

    // onComplete not yet called
    expect(onComplete).not.toHaveBeenCalled();

    // Still expecting 2: clicking 2, then 3, then 4 should complete
    await fireEvent.click(screen.getByRole('button', { name: '數字 2' }));
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: '數字 3' }));
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: '數字 4' }));
    flushSync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: number[] = onComplete.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0]).toBeGreaterThanOrEqual(0);
  });

  it('wrong-order clicks before any correct click do not call onComplete', async () => {
    const onComplete = vi.fn();
    render(TmtATest, { props: { targetCount: 4, onComplete } });

    await fireEvent.click(screen.getByRole('button', { name: '開始' }));
    flushSync();

    // Click 2, 3, 4 out of order — none should advance
    await fireEvent.click(screen.getByRole('button', { name: '數字 2' }));
    await fireEvent.click(screen.getByRole('button', { name: '數字 3' }));
    await fireEvent.click(screen.getByRole('button', { name: '數字 4' }));
    flushSync();

    expect(onComplete).not.toHaveBeenCalled();
  });
});
