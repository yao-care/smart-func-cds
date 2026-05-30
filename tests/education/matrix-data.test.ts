import { describe, it, expect } from 'vitest';
import { buildMatrixData, IC_DOMAINS, AGE_GROUPS_ADULT } from '$lib/education/matrix-data';

const triggers = {
  'func.domain.cognition.low.18-39':     { videoIds: ['abc1234abcde'], inapplicable: false, educationSlug: 'cognition-care' },
  'func.domain.cognition.low.40-54':     { videoIds: [],               inapplicable: true  },
  'func.domain.locomotion.low.18-39':    { videoIds: [],               inapplicable: false },
  // article-only cell (educationSlug, no videos) must still surface in the matrix
  'func.domain.vitality.low.18-39':      { videoIds: [],               inapplicable: false, educationSlug: 'vitality-tips' },
  // func.triage.* (incl. their educationSlug) must be ignored by the matrix
  'func.triage.consult.18-39':           { videoIds: ['xyz'],          inapplicable: false, educationSlug: 'triage-note' },
};

describe('buildMatrixData', () => {
  it('initialises all domain×age combinations', () => {
    const data = buildMatrixData({});
    for (const domain of IC_DOMAINS) {
      for (const age of AGE_GROUPS_ADULT) {
        expect(data[`${domain}:${age}`]).toBeDefined();
      }
    }
  });

  it('marks inapplicable cells', () => {
    const data = buildMatrixData(triggers);
    expect(data['cognition:40-54'].inapplicable).toBe(true);
  });

  it('populates videoIds for applicable cells', () => {
    const data = buildMatrixData(triggers);
    expect(data['cognition:18-39'].videoIds).toEqual(['abc1234abcde']);
  });

  it('attaches article via the cell educationSlug', () => {
    const data = buildMatrixData(triggers);
    expect(data['cognition:18-39'].articleSlugs).toContain('cognition-care');
  });

  it('surfaces article-only cells (educationSlug without any video)', () => {
    const data = buildMatrixData(triggers);
    expect(data['vitality:18-39'].articleSlugs).toEqual(['vitality-tips']);
    expect(data['vitality:18-39'].videoIds).toEqual([]);
    expect(data['vitality:18-39'].inapplicable).toBe(false);
  });

  it('ignores func.triage educationSlugs', () => {
    const data = buildMatrixData(triggers);
    for (const domain of IC_DOMAINS) {
      for (const age of AGE_GROUPS_ADULT) {
        expect(data[`${domain}:${age}`].articleSlugs).not.toContain('triage-note');
      }
    }
  });

  it('applicable cell with no resources has inapplicable=false', () => {
    const data = buildMatrixData(triggers);
    expect(data['locomotion:18-39'].inapplicable).toBe(false);
    expect(data['locomotion:18-39'].videoIds).toEqual([]);
    expect(data['locomotion:18-39'].articleSlugs).toEqual([]);
  });

  it('treats cells with no trigger entry as applicable (contributable)', () => {
    const data = buildMatrixData(triggers);
    expect(data['sensory:55-64'].inapplicable).toBe(false);
    expect(data['sensory:55-64'].videoIds).toEqual([]);
    expect(data['sensory:55-64'].articleSlugs).toEqual([]);
  });

  it('marks only explicitly-flagged combos as inapplicable', () => {
    const data = buildMatrixData(triggers);
    let inapplicableCount = 0;
    for (const domain of IC_DOMAINS) {
      for (const age of AGE_GROUPS_ADULT) {
        if (data[`${domain}:${age}`].inapplicable) inapplicableCount++;
      }
    }
    // fixture has exactly one inapplicable trigger (cognition.low.40-54)
    expect(inapplicableCount).toBe(1);
  });
});
