import { describe, it, expect } from 'vitest';
import { decideReturnMode } from '../../../src/lib/fhir/launch-return';

describe('decideReturnMode', () => {
  it('error=invalid_client 且有 gcm.flow → gcm-reregister', () => {
    expect(decideReturnMode(new URLSearchParams('error=invalid_client'), true)).toBe('gcm-reregister');
  });
  it('有 gcm.flow → gcm', () => {
    expect(decideReturnMode(new URLSearchParams('code=x&state=y'), true)).toBe('gcm');
  });
  it('無 gcm.flow 但有 code → hospital', () => {
    expect(decideReturnMode(new URLSearchParams('code=x'), false)).toBe('hospital');
  });
  it('無 flow 無 code → idle', () => {
    expect(decideReturnMode(new URLSearchParams(''), false)).toBe('idle');
  });
});
