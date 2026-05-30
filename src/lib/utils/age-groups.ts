// Adult age groups (smart-func-cds 成人功能健康評估)
export const ADULT_AGE_MIN = 18 as const;
export const AGE_GROUPS_ADULT = ['18-39', '40-54', '55-64'] as const;
export type AgeGroupAdult = typeof AGE_GROUPS_ADULT[number];

export const AGE_GROUP_LABELS: Record<AgeGroupAdult, string> = {
  '18-39': '18-39 歲',
  '40-54': '40-54 歲',
  '55-64': '55-64 歲',
};

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
