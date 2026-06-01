// src/engine/func/recommendations.ts
import type { ICDomain } from '../../lib/education/schemas';
import type { DomainScore, IndicatorScore } from './scorer';
import type { Recommendation, TriageCategory, TriageResult } from './triage';

export function recommendationsFor(
  category: TriageCategory,
  domainScores: DomainScore[],
  indicatorScores: IndicatorScore[],
  cutoffs: TriageResult['clinicalCutoffs'],
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const ds of domainScores) {
    if (ds.band === 'high') continue;
    const r = perDomainRec(ds.domain, ds.band);
    if (r) recs.push(r);
  }

  // 完整量表嚴重度（consult）已涵蓋的指標——其螢檢 advisory 建議重複且較弱，去重。
  const fullCutoffIndicators = new Set(
    cutoffs
      .filter(c => c.flagLabel === 'phq8-moderate-depression' || c.flagLabel === 'gad7-moderate-anxiety')
      .map(c => c.indicatorId)
  );

  for (const c of cutoffs) {
    // 安全：任何 self_harm 旗標（不論 severity）都升級為緊急建議，故在 advisory 判斷前攔截
    if (c.indicatorId === 'psychological.self_harm') {
      recs.push({
        domain: 'psychological',
        type: 'consult-medical',
        message: '篩檢顯示自我傷害意念，請立即尋求專業協助（安心專線 1925 / 生命線 1995）。',
        suggestedSpecialties: ['身心科', '精神科'],
        triggerIndicators: ['psychological.self_harm'],
      });
      continue;
    }
    // 完整量表嚴重度（PHQ-8≥10 / GAD-7≥10，consult）→ 明確的就醫建議
    const fr = fullCutoffRec(c.flagLabel);
    if (fr) { recs.push(fr); continue; }
    if (c.severity === 'advisory') {
      if (fullCutoffIndicators.has(c.indicatorId)) continue; // 完整量表已給更強建議，去重
      const r = advisoryCutoffRec(c.indicatorId);
      if (r) recs.push(r);
    }
  }

  for (const ind of indicatorScores.filter(i => i.domain === 'sensory')) {
    const r = sensoryIndicatorRec(ind.indicatorId);
    if (r) recs.push(r);
  }

  return recs;
}

function perDomainRec(domain: ICDomain, band: 'moderate' | 'low'): Recommendation | null {
  const table: Record<ICDomain, { mod: Recommendation; low: Recommendation }> = {
    vitality: {
      mod: { domain: 'vitality', type: 'self-care', message: '建議調整睡眠、營養與作息。' },
      low: { domain: 'vitality', type: 'consult-medical', message: '建議找家庭醫學科或營養師討論。',
             suggestedSpecialties: ['家庭醫學科', '營養師'] },
    },
    locomotion: {
      mod: { domain: 'locomotion', type: 'self-care', message: '建議增加每週身體活動量。' },
      low: { domain: 'locomotion', type: 'consult-medical', message: '建議找復健科或家醫科評估。',
             suggestedSpecialties: ['復健科', '家庭醫學科'] },
    },
    cognition: {
      mod: { domain: 'cognition', type: 'in-depth-assessment', message: '建議進一步認知功能評估。' },
      low: { domain: 'cognition', type: 'consult-medical', message: '建議找神經內科或精神科評估。',
             suggestedSpecialties: ['神經內科', '精神科'] },
    },
    psychological: {
      mod: { domain: 'psychological', type: 'self-care', message: '建議壓力管理與情緒照顧。' },
      low: { domain: 'psychological', type: 'consult-medical', message: '建議找身心科或心理諮商。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'] },
    },
    sensory: {
      mod: { domain: 'sensory', type: 'self-care', message: '建議減少螢幕使用、定期視聽檢查。' },
      low: { domain: 'sensory', type: 'consult-medical', message: '建議找眼科或耳鼻喉科評估。',
             suggestedSpecialties: ['眼科', '耳鼻喉科'] },
    },
  };
  return band === 'low' ? table[domain].low : table[domain].mod;
}

function fullCutoffRec(flagLabel: string): Recommendation | null {
  if (flagLabel === 'phq8-moderate-depression') {
    return { domain: 'psychological', type: 'consult-medical',
             message: 'PHQ-8 顯示中度以上憂鬱，建議盡快尋求身心科或心理諮商協助。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: ['psychological.depression'] };
  }
  if (flagLabel === 'gad7-moderate-anxiety') {
    return { domain: 'psychological', type: 'consult-medical',
             message: 'GAD-7 顯示中度以上焦慮，建議盡快尋求身心科或心理諮商協助。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: ['psychological.anxiety'] };
  }
  return null;
}

function advisoryCutoffRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'psychological.depression') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'PHQ-8 顯示憂鬱症狀，建議找身心科或心理諮商進一步評估。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.anxiety') {
    return { domain: 'psychological', type: 'in-depth-assessment',
             message: 'GAD-7 顯示焦慮症狀，建議找身心科或心理諮商進一步評估。',
             suggestedSpecialties: ['身心科', '精神科', '心理諮商'],
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.stress') {
    return { domain: 'psychological', type: 'self-care',
             message: 'PSS-4 顯示高壓力，建議壓力管理與情緒照顧。',
             triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'psychological.wellbeing') {
    return { domain: 'psychological', type: 'consult-medical',
             message: 'WHO-5 wellbeing 偏低，建議找身心科討論。',
             suggestedSpecialties: ['身心科', '精神科'],
             triggerIndicators: [indicatorId] };
  }
  return null;
}

function sensoryIndicatorRec(indicatorId: string): Recommendation | null {
  if (indicatorId === 'sensory.vision_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找眼科檢查。',
             suggestedSpecialties: ['眼科'], triggerIndicators: [indicatorId] };
  }
  if (indicatorId === 'sensory.hearing_impact') {
    return { domain: 'sensory', type: 'consult-medical', message: '建議找耳鼻喉科檢查。',
             suggestedSpecialties: ['耳鼻喉科'], triggerIndicators: [indicatorId] };
  }
  return null;
}
