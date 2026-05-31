import { describe, it, expect } from 'vitest';
import { COLLECTION_POINTS, GCM_POINT } from '../../../src/lib/fhir/collection-points';

describe('collection points', () => {
  it('含 hospital 與 gcm 兩個收案點', () => {
    expect(COLLECTION_POINTS.map((p) => p.id).sort()).toEqual(['gcm', 'hospital']);
  });
  it('gcm 條目符合契約且不含 OIDC scope', () => {
    expect(GCM_POINT.fhirBaseUrl).toBe('https://gcm.fhir.yao.care');
    expect(GCM_POINT.intakeQuestionnaireUrl).toBe('https://gcm.org.tw/fhir/Questionnaire/gcm-intake');
    expect(GCM_POINT.requiredScopes).not.toContain('openid');
    expect(GCM_POINT.requiredScopes).not.toContain('fhirUser');
  });
});
