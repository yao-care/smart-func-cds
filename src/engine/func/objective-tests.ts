// Runtime measurement helpers for objective cognition tests (reaction-time, TMT-A).
// Pure timing/recording state machines; scoring is done by scorer.ts.

export interface ReactionTimeRunnerOpts {
  trials: number;
  warmupTrials: number;
}

export function createReactionTimeRunner(opts: ReactionTimeRunnerOpts) {
  const records: number[] = [];
  return {
    recordTrial(ms: number) {
      records.push(ms);
    },
    getTrials(): number[] {
      return [...records];
    },
    isComplete(): boolean {
      return records.length >= opts.trials;
    },
    reset() {
      records.length = 0;
    },
  };
}

export function createTmtARunner() {
  let startMs: number | null = null;
  let endMs: number | null = null;
  return {
    start(now: number = Date.now()) {
      startMs = now;
      endMs = null;
    },
    finish(now: number = Date.now()) {
      if (startMs === null) throw new Error('TmtA not started');
      endMs = now;
    },
    getElapsedSec(): number {
      if (startMs === null || endMs === null) throw new Error('TmtA incomplete');
      return (endMs - startMs) / 1000;
    },
    reset() {
      startMs = null;
      endMs = null;
    },
  };
}
