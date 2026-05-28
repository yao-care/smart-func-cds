export const AGE_GROUPS_CDSA = [
  '2-6m', '7-12m', '13-24m', '25-36m', '37-48m', '49-60m', '61-72m',
] as const;
export type AgeGroupCDSA = typeof AGE_GROUPS_CDSA[number];

export const AGE_GROUP_LABELS: Record<AgeGroupCDSA, string> = {
  '2-6m': '2-6 個月',
  '7-12m': '7-12 個月',
  '13-24m': '13-24 個月',
  '25-36m': '25-36 個月',
  '37-48m': '37-48 個月',
  '49-60m': '49-60 個月',
  '61-72m': '61-72 個月',
};

/** Calculate age in months from birth date */
export function ageInMonths(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const dayAdjust = now.getDate() < birth.getDate() ? -1 : 0;
  return Math.max(0, months + dayAdjust);
}

/** Determine CDSA age group from birth date */
export function ageGroupCDSA(birthDate: string | Date): AgeGroupCDSA {
  const months = ageInMonths(birthDate);
  if (months <= 6) return '2-6m';
  if (months <= 12) return '7-12m';
  if (months <= 24) return '13-24m';
  if (months <= 36) return '25-36m';
  if (months <= 48) return '37-48m';
  if (months <= 60) return '49-60m';
  return '61-72m';
}

/** Check if child is within CDSA target range (0-72 months) */
export function isEligible(birthDate: string | Date): boolean {
  const months = ageInMonths(birthDate);
  return months >= 0 && months <= 72;
}

/** Get instruction complexity level for an age group */
export function instructionLevel(ageGroup: AgeGroupCDSA): 'none' | 'single_verb' | 'verb_object' | 'verb_adj_object' | 'compound' {
  switch (ageGroup) {
    case '2-6m':
    case '7-12m': return 'none';
    case '13-24m': return 'single_verb';
    case '25-36m': return 'verb_object';
    case '37-48m': return 'verb_adj_object';
    case '49-60m':
    case '61-72m': return 'compound';
  }
}

// --- Adult age groups (smart-func-cds) ---
export const ADULT_AGE_MIN = 18 as const;
export const AGE_GROUPS_ADULT = ['18-39', '40-54', '55-64'] as const;
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];

export function ageInYears(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return Math.max(0, years);
}

export function isAdult(birthDate: string | Date): boolean {
  return ageInYears(birthDate) >= ADULT_AGE_MIN;
}

export function ageGroupAdult(birthDate: string | Date): AgeGroupAdult {
  const y = ageInYears(birthDate);
  if (y < 18) throw new Error(`Below adult age: ${y}`);
  if (y <= 39) return '18-39';
  if (y <= 54) return '40-54';
  // 55+ 全歸 55-64（charter §0.1 + spec §1.2: 65+ 仍可填，但結果頁 advisory）
  return '55-64';
}

export function isWithinValidatedRange(birthDate: string | Date): boolean {
  const y = ageInYears(birthDate);
  return y >= 18 && y <= 64;
}
