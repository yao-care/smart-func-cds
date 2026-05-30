import { AGE_GROUPS_ADULT, type AgeGroupAdult } from '../utils/age-groups';

/** Adult age-band fallback chain: try the nearest age bin first (education
 *  proximity > life-stage identity). Fallback never crosses inapplicable:true
 *  (enforced by tryAgeGroupFallback). */
export const FUNC_FALLBACK_CHAIN: Record<AgeGroupAdult, AgeGroupAdult[]> = {
  '18-39': ['40-54', '55-64'],
  '40-54': ['18-39', '55-64'],
  '55-64': ['40-54', '18-39'],
};

export const AGE_GROUPS = AGE_GROUPS_ADULT;
