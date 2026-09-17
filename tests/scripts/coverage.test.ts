import { describe, it, expect } from 'vitest';
import {
  expectedTriggerKeys,
  unreachableTriggerKeys,
  coverageReport,
  ratchet,
} from '../../scripts/curate/lib/coverage';
import { deriveFuncTriggers } from '../../src/lib/education/trigger-derivation';
import { AGE_GROUPS_ADULT } from '../../src/lib/utils/age-groups';
import { IC_DOMAIN_NAMES } from '../../src/lib/education/schemas';
import type { TriageResult } from '../../src/engine/func/triage';

describe('expectedTriggerKeys', () => {
  it('涵蓋 5 域 × 2 band × 3 年齡組 ＋ 3 分流類別 × 3 年齡組', () => {
    expect(expectedTriggerKeys()).toHaveLength(5 * 2 * 3 + 3 * 3);
  });

  it('不含 normal 分流（trigger-derivation 明確跳過）', () => {
    expect(expectedTriggerKeys().some(k => k.startsWith('func.triage.normal.'))).toBe(false);
    expect(unreachableTriggerKeys()).toContain('func.triage.normal.18-39');
  });

  it('與 deriveFuncTriggers 真正派生出來的 key 一致（分母不靠 yaml）', () => {
    const expected = new Set(expectedTriggerKeys());
    const derived = new Set<string>();
    for (const ageGroup of AGE_GROUPS_ADULT) {
      for (const category of ['observe', 'consult', 'incomplete', 'normal'] as const) {
        for (const band of ['low', 'moderate', 'high'] as const) {
          const triage = {
            category,
            domainScores: IC_DOMAIN_NAMES.map(domain => ({ domain, band })),
          } as unknown as TriageResult;
          for (const k of deriveFuncTriggers(triage, ageGroup)) derived.add(k);
        }
      }
    }
    expect([...derived].sort()).toEqual([...expected].sort());
  });
});

describe('coverageReport', () => {
  const full = Object.fromEntries(
    expectedTriggerKeys().map(k => [k, { videoIds: ['v1'], inapplicable: false, articleSlugs: ['a'] }]),
  );

  it('全覆蓋時三類缺口皆空', () => {
    const r = coverageReport(full);
    expect(r.missing).toEqual([]);
    expect(r.empty).toEqual([]);
    expect(r.videoGaps).toEqual([]);
  });

  it('缺鍵記 missing、空內容記 empty、只缺影片記 videoGaps', () => {
    const triggers = { ...full };
    delete triggers['func.domain.vitality.low.18-39'];
    triggers['func.domain.cognition.moderate.40-54'] = { videoIds: [], inapplicable: false, articleSlugs: [] };
    triggers['func.domain.sensory.low.55-64'] = { videoIds: [], inapplicable: false, articleSlugs: ['a'] };

    const r = coverageReport(triggers);
    expect(r.missing).toEqual(['func.domain.vitality.low.18-39']);
    expect(r.empty).toEqual(['func.domain.cognition.moderate.40-54']);
    expect(r.videoGaps).toEqual(['func.domain.sensory.low.55-64']);
  });

  it('點出殘留的不可達 key', () => {
    const r = coverageReport({ ...full, 'func.triage.normal.18-39': { videoIds: [], inapplicable: false, articleSlugs: [] } });
    expect(r.unreachablePresent).toEqual(['func.triage.normal.18-39']);
  });
});

describe('ratchet', () => {
  it('baseline 內的舊缺口不算退步', () => {
    expect(ratchet(['a', 'b'], ['a', 'b']).regressions).toEqual([]);
  });

  it('新缺口算退步', () => {
    expect(ratchet(['a', 'c'], ['a']).regressions).toEqual(['c']);
  });

  it('已補齊卻留在 baseline 的要報出來，避免門檻悄悄鬆掉', () => {
    expect(ratchet(['a'], ['a', 'b']).staleBaseline).toEqual(['b']);
  });
});
