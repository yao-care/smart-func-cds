import { describe, it, expect } from 'vitest';
import { scoreAssessment } from '../../../src/engine/func/scorer';
import { computeTriage } from '../../../src/engine/func/triage';
import { buildRadarData } from '../../../src/engine/func/radar-scoring';
import { indicatorSchema, type Indicator } from '../../../src/engine/func/questionnaire';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const yamlPath = path.join(process.cwd(), 'src/data/questionnaire/indicators.yaml');
const raw = yaml.load(fs.readFileSync(yamlPath, 'utf8')) as Record<string, unknown[]>;

const indicators: Indicator[] = [];
for (const list of Object.values(raw)) {
  for (const ind of list as unknown[]) {
    indicators.push(indicatorSchema.parse(ind));
  }
}

describe('end-to-end IC assessment', () => {
  it('loads + validates all 20 indicators from indicators.yaml', () => {
    expect(indicators.length).toBe(20);
    const domains = new Set(indicators.map(i => i.domain));
    expect([...domains].sort()).toEqual(['cognition', 'locomotion', 'psychological', 'sensory', 'vitality']);
  });

  it('healthy adult: best Likert answers → normal/observe triage + 5-axis radar', () => {
    const answers: Record<string, number> = {};
    for (const ind of indicators) {
      if (ind.kind !== 'likert') continue;
      const minS = ind.minScore ?? 0;
      const maxS = ind.maxScore;
      for (const q of ind.questions) {
        // higher_is_better → answer best (max); higher_is_worse → answer best (min)
        answers[q.id] = ind.direction === 'higher_is_better' ? maxS : minS;
      }
    }

    const scored = scoreAssessment({ indicators, answers, objectiveResults: {}, ageGroup: '18-39' });

    const triage = computeTriage({
      indicatorScores: scored.indicatorScores,
      domainScores: scored.domainScores,
      applicableWeights: scored.applicableWeights,
      ageGroup: '18-39',
      assessmentDate: '2026-05-30',
    });

    expect(triage.completedDomains).toBeGreaterThanOrEqual(3);
    expect(['normal', 'observe']).toContain(triage.category);

    const radar = buildRadarData(triage, scored.indicatorScores);
    expect(radar.axes).toHaveLength(5);
    expect(radar.meta.totalDomains).toBe(5);
  });

  it('worst Likert answers → consult triage', () => {
    const answers: Record<string, number> = {};
    for (const ind of indicators) {
      if (ind.kind !== 'likert') continue;
      const minS = ind.minScore ?? 0;
      const maxS = ind.maxScore;
      for (const q of ind.questions) {
        // worst answer: higher_is_better → min; higher_is_worse → max
        answers[q.id] = ind.direction === 'higher_is_better' ? minS : maxS;
      }
    }

    const scored = scoreAssessment({ indicators, answers, objectiveResults: {}, ageGroup: '18-39' });
    const triage = computeTriage({
      indicatorScores: scored.indicatorScores,
      domainScores: scored.domainScores,
      applicableWeights: scored.applicableWeights,
      ageGroup: '18-39',
      assessmentDate: '2026-05-30',
    });

    expect(triage.category).toBe('consult');
    expect(triage.flaggedDomains.length).toBeGreaterThan(0);
  });
});
