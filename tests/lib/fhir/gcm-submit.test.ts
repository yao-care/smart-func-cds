import { describe, it, expect, beforeEach, vi } from 'vitest';
import { b64url, makePkce, GCM, startGcmUpload, type GcmFlowState } from '../../../src/lib/fhir/gcm-submit';

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

describe('startGcmUpload', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('gcm.clientId', 'cid-123'); // 跳過 register
  });

  it('空暱稱直接 throw、不發起授權', async () => {
    const assign = vi.fn();
    await expect(
      startGcmUpload('https://app/launch/', { assessmentId: 'a1', nickname: '   ' }, assign),
    ).rejects.toThrow(/暱稱/);
    expect(assign).not.toHaveBeenCalled();
  });

  it('持久化完整 GcmFlowState 並導向 /authorize', async () => {
    const assign = vi.fn();
    await startGcmUpload('https://app/launch/', { assessmentId: 'a1', nickname: 'Amy', email: 'a@b.c' }, assign);
    const flow = JSON.parse(sessionStorage.getItem('gcm.flow')!) as GcmFlowState;
    expect(flow).toMatchObject({
      clientId: 'cid-123', redirectUri: 'https://app/launch/', assessmentId: 'a1', nickname: 'Amy', email: 'a@b.c',
    });
    expect(flow.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(flow.state).toBeTruthy();
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://gcm.fhir.yao.care/authorize');
    expect(url.searchParams.get('aud')).toBe('https://gcm.fhir.yao.care');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/launch/');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nickname')).toBe('Amy');
    expect(url.searchParams.get('login_hint')).toBeTruthy();
  });
});
