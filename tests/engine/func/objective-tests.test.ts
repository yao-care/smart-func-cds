import { describe, it, expect } from 'vitest';
import { createReactionTimeRunner, createTmtARunner } from '../../../src/engine/func/objective-tests';

describe('createReactionTimeRunner', () => {
  it('records trials and returns array', () => {
    const r = createReactionTimeRunner({ trials: 5, warmupTrials: 2 });
    r.recordTrial(450);
    r.recordTrial(380);
    r.recordTrial(420);
    r.recordTrial(390);
    r.recordTrial(410);
    expect(r.getTrials()).toEqual([450, 380, 420, 390, 410]);
    expect(r.isComplete()).toBe(true);
  });

  it('isComplete only after all trials', () => {
    const r = createReactionTimeRunner({ trials: 3, warmupTrials: 1 });
    r.recordTrial(400);
    r.recordTrial(400);
    expect(r.isComplete()).toBe(false);
    r.recordTrial(400);
    expect(r.isComplete()).toBe(true);
  });
});

describe('createTmtARunner', () => {
  it('records total time on completion', () => {
    const r = createTmtARunner();
    const t0 = 1000;
    const t1 = 38500;
    r.start(t0);
    r.finish(t1);
    expect(r.getElapsedSec()).toBe(37.5);
  });
});
