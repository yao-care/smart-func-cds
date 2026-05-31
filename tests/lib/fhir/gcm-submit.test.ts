import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  b64url, makePkce, GCM, startGcmUpload, completeGcmUpload, intakeResponse, InvalidClientError,
  type GcmFlowState,
} from '../../../src/lib/fhir/gcm-submit';
import { db } from '../../../src/lib/db/schema';

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

describe('intakeResponse', () => {
  it('無 email/phone 時 item 為空', () => {
    const qr = intakeResponse() as { item: unknown[]; questionnaire: string };
    expect(qr.item).toEqual([]);
    expect(qr.questionnaire).toBe(GCM.intakeUrl);
  });
  it('帶 email 時 nested linkId 結構正確', () => {
    const qr = intakeResponse('a@b.c') as { item: { linkId: string }[] };
    expect(qr.item[0].linkId).toBe('email');
  });
});

describe('completeGcmUpload', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.delete();
    await db.open();
    const patient = { id: 'p1', birthDate: '1980-01-01', gender: 'female' as const };
    await db.patients.add(patient as never);
    const triageResult = {
      category: 'observe' as const, confidence: 0.8, summary: 's',
      flaggedDomains: [], domainScores: [{ domain: 'vitality', score: 55, band: 'moderate' as const }],
    };
    await db.assessments.add({
      id: 'a1', patientId: 'p1', status: 'completed', currentStep: 99,
      startedAt: new Date(), updatedAt: new Date(), completedAt: new Date(),
      language: 'zh-TW', fhirSubmitted: false, triageResult,
    } as never);
    const flow: GcmFlowState = {
      verifier: 'v', state: 'st', clientId: 'cid', redirectUri: 'https://app/launch/',
      assessmentId: 'a1', nickname: 'Amy', email: 'a@b.c',
    };
    sessionStorage.setItem('gcm.flow', JSON.stringify(flow));
  });

  it('換 token → 重建資源 → POST transaction → 回 caseId 並清 flow', async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
      calls.push({ url: String(url), body: String(opts.body) });
      if (String(url).endsWith('/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', patient: 'GCM-0001' }) } as Response;
      }
      return { ok: true, json: async () => ({ resourceType: 'Bundle', type: 'transaction-response' }) } as Response;
    }));

    const out = await completeGcmUpload(new URLSearchParams('code=abc&state=st'));
    expect(out.caseId).toBe('GCM-0001');
    expect(sessionStorage.getItem('gcm.flow')).toBeNull();
    expect(localStorage.getItem('gcm.case.' + localStorage.getItem('gcm.browserCode') + '.Amy')).toBe('GCM-0001');

    const bundleCall = calls.find((c) => c.url === 'https://gcm.fhir.yao.care/');
    const bundle = JSON.parse(bundleCall!.body) as { entry: { resource: { resourceType: string } }[] };
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types[0]).toBe('QuestionnaireResponse'); // email 存在 → 排第一
    expect(types).toContain('Observation');
    expect(types).toContain('DiagnosticReport');
    vi.unstubAllGlobals();
  });

  it('state 不符 → throw CSRF', async () => {
    await expect(completeGcmUpload(new URLSearchParams('code=abc&state=WRONG'))).rejects.toThrow(/CSRF|state/);
  });

  it('token 回 invalid_client → 清 clientId 並拋 InvalidClientError', async () => {
    localStorage.setItem('gcm.clientId', 'stale');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).endsWith('/token')) {
        return { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));
    await expect(completeGcmUpload(new URLSearchParams('code=abc&state=st'))).rejects.toBeInstanceOf(InvalidClientError);
    expect(localStorage.getItem('gcm.clientId')).toBeNull();
    vi.unstubAllGlobals();
  });
});
