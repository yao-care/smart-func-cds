import { describe, it, expect, beforeEach, vi } from 'vitest';
import { b64url, makePkce, GCM } from '../../../src/lib/fhir/gcm-submit';

describe('b64url', () => {
  it('encodes bytes url-safe with no padding', () => {
    const out = b64url(new Uint8Array([251, 255, 191]));
    expect(out).not.toMatch(/[+/=]/);
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('makePkce', () => {
  it('challenge is base64url SHA-256 of verifier', async () => {
    const { verifier, challenge } = await makePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    expect(challenge).toBe(b64url(new Uint8Array(digest)));
  });
});

describe('GCM constants', () => {
  it('scopes exclude OIDC scopes', () => {
    expect(GCM.scopes).not.toContain('openid');
    expect(GCM.scopes).not.toContain('fhirUser');
    expect(GCM.base).toBe('https://gcm.fhir.yao.care');
  });
});
