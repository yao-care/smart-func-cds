# GCM 收案點整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 受測者在結果頁自選收案點（醫院 / GCM），把成人 IC 評估結果以標準 SMART on FHIR 上傳；新增 GCM（`https://gcm.fhir.yao.care`）並順手修好既有 404 的醫院 callback。

**Architecture:** 兩個入口都導向統一的 `/launch/` 返回頁，上傳一律在返回頁完成（避免跨頁 in-memory 狀態遺失）。跨 redirect 在 `sessionStorage` 存 `assessmentId`＋PKCE 狀態為單一真相源；返回頁從 IndexedDB 重建 FHIR 資源。GCM 用原生 `fetch`+`crypto.subtle`（要帶自訂 `login_hint`/`nickname`），醫院沿用 fhirclient。

**Tech Stack:** Astro 5 SSG + Svelte 5 runes、TypeScript strict、Vitest（jsdom + fake-indexeddb）、fhirclient.js、Dexie。

**Spec:** `docs/superpowers/specs/2026-05-31-gcm-intake-integration-design.md`

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `src/lib/fhir/gcm-submit.ts`（新） | GCM PKCE/動態註冊/授權發起/token＋transaction 上傳；`GcmFlowState` |
| `src/lib/fhir/collection-points.ts`（新） | 收案點 typed 常數（`hospital` / `gcm`） |
| `src/lib/fhir/launch-return.ts`（新） | 純函式 `decideReturnMode()`：依 URL params + sessionStorage 決定分流（可單元測試） |
| `src/components/assess/CollectionPointPicker.svelte`（新） | 結果頁選單；GCM 暱稱/email/電話表單 |
| `src/components/fhir/LaunchReturn.svelte`（新） | `/launch/` island：執行分流＋上傳＋顯示結果 |
| `src/pages/launch.astro`（新） | 承載 `LaunchReturn`（`client:load`） |
| `src/components/assess/ResultView.svelte`（改） | 上傳鈕換成 `CollectionPointPicker` |
| `scripts/gcm-conformance.mjs`（新） | 對線上 `gcm.fhir.yao.care` 端到端自檢 |
| `package.json`（改） | 加 `"conformance"` script |

測試（`tests/**/*.test.ts`）：`tests/lib/fhir/gcm-submit.test.ts`、`tests/lib/fhir/collection-points.test.ts`、`tests/lib/fhir/launch-return.test.ts`。

---

## Task 1: gcm-submit.ts — PKCE 與註冊基礎工具

**Files:**
- Create: `src/lib/fhir/gcm-submit.ts`
- Test: `tests/lib/fhir/gcm-submit.test.ts`

- [ ] **Step 1: 寫失敗測試（b64url / makePkce）**

```ts
// tests/lib/fhir/gcm-submit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { b64url, makePkce, GCM } from '../../../src/lib/fhir/gcm-submit';

describe('b64url', () => {
  it('encodes bytes url-safe with no padding', () => {
    const out = b64url(new Uint8Array([251, 255, 191]));
    expect(out).not.toMatch(/[+/=]/);
    expect(out).toBe('-_-_'.slice(0, out.length)); // sanity: only -_ and alnum
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: FAIL（找不到模組 / 未匯出 `b64url`）

- [ ] **Step 3: 寫最小實作（常數＋helpers）**

```ts
// src/lib/fhir/gcm-submit.ts
export const GCM = {
  base: 'https://gcm.fhir.yao.care',
  intakeUrl: 'https://gcm.org.tw/fhir/Questionnaire/gcm-intake',
  scopes:
    'launch/patient patient/Observation.c patient/DiagnosticReport.c patient/QuestionnaireResponse.c patient/Patient.u offline_access',
} as const;

export function browserCode(): string {
  let c = localStorage.getItem('gcm.browserCode');
  if (!c) {
    c = crypto.randomUUID();
    localStorage.setItem('gcm.browserCode', c);
  }
  return c;
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

export function clearClientId(): void {
  localStorage.removeItem('gcm.clientId');
}

export async function getClientId(redirectUri: string): Promise<string> {
  const cached = localStorage.getItem('gcm.clientId');
  if (cached) return cached;
  const r = await fetch(`${GCM.base}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' }),
  });
  if (!r.ok) throw new Error(`GCM 動態註冊失敗（${r.status}）`);
  const j = (await r.json()) as { client_id: string };
  localStorage.setItem('gcm.clientId', j.client_id);
  return j.client_id;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: PASS（3 個 describe 全綠）

- [ ] **Step 5: Commit**

```bash
git add src/lib/fhir/gcm-submit.ts tests/lib/fhir/gcm-submit.test.ts
git commit -m "feat(fhir): GCM PKCE/註冊基礎工具 + 常數"
```

---

## Task 2: gcm-submit.ts — startGcmUpload 與 GcmFlowState

**Files:**
- Modify: `src/lib/fhir/gcm-submit.ts`
- Test: `tests/lib/fhir/gcm-submit.test.ts`

- [ ] **Step 1: 寫失敗測試（空暱稱擋下、flow 持久化、授權 URL）**

加到測試檔尾：

```ts
import { startGcmUpload, type GcmFlowState } from '../../../src/lib/fhir/gcm-submit';
import { vi } from 'vitest';

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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: FAIL（未匯出 `startGcmUpload`）

- [ ] **Step 3: 實作（注入 `assign` 以利測試，預設用 `location.assign`）**

加到 `gcm-submit.ts`：

```ts
export interface GcmFlowState {
  verifier: string;
  state: string;
  clientId: string;
  redirectUri: string;
  assessmentId: string;
  nickname: string;
  email?: string;
  phone?: string;
}

export interface GcmUploadInput {
  assessmentId: string;
  nickname: string;
  email?: string;
  phone?: string;
}

/** 預設導向器；測試可注入 spy。 */
type Navigate = (url: string) => void;
const defaultNavigate: Navigate = (url) => location.assign(url);

export async function startGcmUpload(
  redirectUri: string,
  input: GcmUploadInput,
  navigate: Navigate = defaultNavigate,
): Promise<void> {
  const nickname = input.nickname.trim();
  if (!nickname) throw new Error('請先輸入暱稱再上傳');

  const clientId = await getClientId(redirectUri);
  const { verifier, challenge } = await makePkce();
  const state = crypto.randomUUID();

  const flow: GcmFlowState = {
    verifier, state, clientId, redirectUri,
    assessmentId: input.assessmentId,
    nickname,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
  };
  sessionStorage.setItem('gcm.flow', JSON.stringify(flow));

  const q = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
    scope: GCM.scopes, state, aud: GCM.base,
    code_challenge: challenge, code_challenge_method: 'S256',
    login_hint: browserCode(), nickname,
  });
  navigate(`${GCM.base}/authorize?${q.toString()}`);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fhir/gcm-submit.ts tests/lib/fhir/gcm-submit.test.ts
git commit -m "feat(fhir): startGcmUpload 持久化完整 flow + 擋空暱稱"
```

---

## Task 3: gcm-submit.ts — completeGcmUpload 與 intakeResponse

**Files:**
- Modify: `src/lib/fhir/gcm-submit.ts`
- Test: `tests/lib/fhir/gcm-submit.test.ts`

- [ ] **Step 1: 寫失敗測試（intakeResponse 結構 + 端到端上傳，含 fetch/IndexedDB mock）**

加到測試檔尾：

```ts
import { completeGcmUpload, intakeResponse, InvalidClientError } from '../../../src/lib/fhir/gcm-submit';
import { db } from '../../../src/lib/db/schema';
import type { GcmFlowState as FS } from '../../../src/lib/fhir/gcm-submit';

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
    // 種一筆已完成評估（含 triageResult）+ patient
    const patient = { id: 'p1', birthDate: '1980-01-01', gender: 'female' as const };
    await db.patients.add(patient);
    const triageResult = {
      category: 'observe' as const, confidence: 0.8, summary: 's',
      flaggedDomains: [], domainScores: [{ domain: 'vitality', score: 55, band: 'moderate' as const }],
    };
    await db.assessments.add({
      id: 'a1', patientId: 'p1', status: 'completed', currentStep: 99,
      startedAt: new Date(), updatedAt: new Date(), completedAt: new Date(),
      language: 'zh-TW', triageResult,
    } as never);
    const flow: FS = {
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
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: FAIL（未匯出 `completeGcmUpload`/`intakeResponse`/`InvalidClientError`）

- [ ] **Step 3: 實作**

加到 `gcm-submit.ts`（頂部 import）：

```ts
import { getAssessment, getPatient } from '../db/assessments';
import { buildAssessmentObservations, buildTriageDiagnosticReport } from './cdsa-resources';
import type { TriageResult } from '../../engine/func/triage';
```

加到模組尾：

```ts
/** /token 或 /authorize 回 invalid_client 時拋出，供返回頁自癒重啟。 */
export class InvalidClientError extends Error {
  constructor() {
    super('GCM client_id 失效，需重新註冊');
    this.name = 'InvalidClientError';
  }
}

export function intakeResponse(email?: string, phone?: string): object {
  const item: object[] = [];
  if (email) {
    item.push({ linkId: 'email', item: [
      { linkId: 'email-system', answer: [{ valueString: 'email' }] },
      { linkId: 'email-value', answer: [{ valueString: email }] },
    ]});
  }
  if (phone) {
    item.push({ linkId: 'phone', item: [
      { linkId: 'phone-system', answer: [{ valueString: 'phone' }] },
      { linkId: 'phone-value', answer: [{ valueString: phone }] },
    ]});
  }
  return { resourceType: 'QuestionnaireResponse', status: 'completed', questionnaire: GCM.intakeUrl, item };
}

export interface GcmUploadResult {
  caseId: string;
  result: unknown;
}

export async function completeGcmUpload(params: URLSearchParams): Promise<GcmUploadResult> {
  const raw = sessionStorage.getItem('gcm.flow');
  if (!raw) throw new Error('找不到 GCM 上傳流程狀態');
  const flow = JSON.parse(raw) as GcmFlowState;

  if (params.get('state') !== flow.state) throw new Error('state 不符（CSRF），請重試');
  const code = params.get('code');
  if (!code) throw new Error(params.get('error_description') ?? params.get('error') ?? '授權未取得 code');

  // 1. 換 token
  const tok = await fetch(`${GCM.base}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code,
      redirect_uri: flow.redirectUri, code_verifier: flow.verifier, client_id: flow.clientId,
    }).toString(),
  });
  if (!tok.ok) {
    const errBody = await tok.json().catch(() => ({}));
    if ((errBody as { error?: string }).error === 'invalid_client') {
      clearClientId();
      throw new InvalidClientError();
    }
    throw new Error(`GCM 取得 token 失敗（${tok.status}）`);
  }
  const t = (await tok.json()) as { access_token: string; patient: string };
  const accessToken = t.access_token;
  const caseId = t.patient;

  // 2. 從 IndexedDB 重建資源（單一真相源；subject 任意，server 覆寫）
  const assessment = await getAssessment(flow.assessmentId);
  if (!assessment) throw new Error('找不到評估資料，無法上傳');
  const triage = assessment.triageResult as TriageResult | undefined;
  if (!triage) throw new Error('評估尚未完成，無法上傳');
  const patient = await getPatient(assessment.patientId);
  const subjectId = patient?.id ?? assessment.patientId;

  const observations = buildAssessmentObservations(assessment, subjectId, triage);
  const report = buildTriageDiagnosticReport(assessment, subjectId, triage, []);

  // 3. 組 transaction Bundle（intake QR 先、再 Observations、再 DiagnosticReport）
  const entry: object[] = [];
  if (flow.email || flow.phone) entry.push({ resource: intakeResponse(flow.email, flow.phone) });
  for (const o of observations) entry.push({ resource: o });
  entry.push({ resource: report });

  // 4. 上傳
  const up = await fetch(`${GCM.base}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/fhir+json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ resourceType: 'Bundle', type: 'transaction', entry }),
  });
  if (!up.ok) throw new Error(`GCM 上傳失敗（${up.status}）`);
  const result = await up.json();

  // 5. 清狀態 + 記收案編號
  sessionStorage.removeItem('gcm.flow');
  localStorage.setItem(`gcm.case.${browserCode()}.${flow.nickname}`, caseId);
  return { caseId, result };
}
```

> 注意：`buildTriageDiagnosticReport` 第 4 參數 `observationIds` 在 transaction 內無法預知 server 指派的 id，傳空陣列；`result` 連結交給 server `$extract` 補（符合契約：app 不必算 subject/引用）。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/lib/fhir/gcm-submit.test.ts`
Expected: PASS（全部 describe 綠）

- [ ] **Step 5: Commit**

```bash
git add src/lib/fhir/gcm-submit.ts tests/lib/fhir/gcm-submit.test.ts
git commit -m "feat(fhir): completeGcmUpload 重建資源+transaction 上傳"
```

---

## Task 4: collection-points.ts — 收案點 typed 常數

**Files:**
- Create: `src/lib/fhir/collection-points.ts`
- Test: `tests/lib/fhir/collection-points.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// tests/lib/fhir/collection-points.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/lib/fhir/collection-points.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/fhir/collection-points.ts
import { GCM } from './gcm-submit';

export type CollectionPointId = 'hospital' | 'gcm';

export interface CollectionPoint {
  id: CollectionPointId;
  name: string;
  /** 'fhirclient' = 既有醫院手動連線；'gcm' = 原生 PKCE 流程 */
  flow: 'fhirclient' | 'gcm';
  fhirBaseUrl?: string;
  intakeQuestionnaireUrl?: string;
  requiredScopes?: string;
}

export const HOSPITAL_POINT: CollectionPoint = {
  id: 'hospital',
  name: '醫院 FHIR Server',
  flow: 'fhirclient',
};

export const GCM_POINT: CollectionPoint = {
  id: 'gcm',
  name: 'GCM 預防醫學發展協會',
  flow: 'gcm',
  fhirBaseUrl: GCM.base,
  intakeQuestionnaireUrl: GCM.intakeUrl,
  requiredScopes: GCM.scopes,
};

export const COLLECTION_POINTS: CollectionPoint[] = [HOSPITAL_POINT, GCM_POINT];
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/lib/fhir/collection-points.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fhir/collection-points.ts tests/lib/fhir/collection-points.test.ts
git commit -m "feat(fhir): 收案點 typed 常數（hospital/gcm）"
```

---

## Task 5: launch-return.ts — 返回頁分流純函式

**Files:**
- Create: `src/lib/fhir/launch-return.ts`
- Test: `tests/lib/fhir/launch-return.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// tests/lib/fhir/launch-return.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm vitest run tests/lib/fhir/launch-return.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/fhir/launch-return.ts
export type ReturnMode = 'gcm-reregister' | 'gcm' | 'hospital' | 'idle';

/**
 * 決定 /launch/ 返回頁的分流。GCM 優先短路，避免 fhirclient 誤接。
 * @param params  URL query params
 * @param hasGcmFlow  sessionStorage['gcm.flow'] 是否存在
 */
export function decideReturnMode(params: URLSearchParams, hasGcmFlow: boolean): ReturnMode {
  if (hasGcmFlow && params.get('error') === 'invalid_client') return 'gcm-reregister';
  if (hasGcmFlow) return 'gcm';
  if (params.has('code')) return 'hospital';
  return 'idle';
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm vitest run tests/lib/fhir/launch-return.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fhir/launch-return.ts tests/lib/fhir/launch-return.test.ts
git commit -m "feat(fhir): 返回頁分流純函式 decideReturnMode"
```

---

## Task 6: CollectionPointPicker.svelte + ResultView 接線

**Files:**
- Create: `src/components/assess/CollectionPointPicker.svelte`
- Modify: `src/components/assess/ResultView.svelte`

- [ ] **Step 1: 建立 CollectionPointPicker.svelte**

```svelte
<!-- src/components/assess/CollectionPointPicker.svelte -->
<script lang="ts">
  import { startGcmUpload } from '$lib/fhir/gcm-submit';
  import StandaloneLaunch from '../fhir/StandaloneLaunch.svelte';

  let { assessmentId }: { assessmentId: string } = $props();

  let choice = $state<'none' | 'hospital' | 'gcm'>('none');
  let nickname = $state('');
  let email = $state('');
  let phone = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  function chooseHospital() {
    // 醫院流程：StandaloneLaunch redirect 前先記 assessmentId 供返回頁重建
    sessionStorage.setItem('fhir.flow', JSON.stringify({ assessmentId }));
    choice = 'hospital';
  }

  async function submitGcm() {
    error = null;
    if (!nickname.trim()) { error = '請輸入暱稱'; return; }
    busy = true;
    try {
      await startGcmUpload(`${location.origin}/launch/`, {
        assessmentId, nickname, email: email || undefined, phone: phone || undefined,
      });
      // 瀏覽器 redirect — 不會返回
    } catch (e) {
      error = e instanceof Error ? e.message : '無法發起上傳，請稍後重試';
      busy = false;
    }
  }
</script>

<section class="picker" aria-label="選擇收案點">
  <h3>上傳評估結果至收案點</h3>

  {#if choice === 'none'}
    <div class="options">
      <button class="point" onclick={chooseHospital}>
        <span class="name">醫院 FHIR Server</span>
        <span class="desc">已知院方 Server URL 與 Client ID 時使用</span>
      </button>
      <button class="point" onclick={() => (choice = 'gcm')}>
        <span class="name">GCM 預防醫學發展協會</span>
        <span class="desc">填暱稱即可上傳，免事先設定</span>
      </button>
    </div>
  {:else if choice === 'hospital'}
    <StandaloneLaunch />
    <button class="back" onclick={() => (choice = 'none')}>← 改選其他收案點</button>
  {:else}
    <form class="gcm-form" onsubmit={(e) => { e.preventDefault(); submitGcm(); }}>
      <label>暱稱（必填）
        <input type="text" bind:value={nickname} required autocomplete="nickname" />
      </label>
      <label>Email（選填）
        <input type="email" bind:value={email} autocomplete="email" />
      </label>
      <label>電話（選填）
        <input type="tel" bind:value={phone} autocomplete="tel" />
      </label>
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <div class="actions">
        <button type="submit" class="submit" disabled={busy}>{busy ? '前往授權…' : '上傳到 GCM'}</button>
        <button type="button" class="back" onclick={() => (choice = 'none')}>← 改選其他收案點</button>
      </div>
    </form>
  {/if}
</section>

<style>
  .picker { display: flex; flex-direction: column; gap: var(--space-4); }
  .picker h3 { font-size: var(--text-lg); }
  .options { display: flex; flex-direction: column; gap: var(--space-3); }
  .point {
    display: flex; flex-direction: column; gap: var(--space-1);
    padding: var(--space-4); min-height: 44px; text-align: left; cursor: pointer;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md);
  }
  .point:hover { border-color: var(--accent); }
  .point .name { font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text); }
  .point .desc { font-size: var(--text-sm); color: color-mix(in srgb, var(--text), var(--bg) 30%); }
  .gcm-form { display: flex; flex-direction: column; gap: var(--space-3); }
  .gcm-form label { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-sm); }
  .gcm-form input {
    min-height: 44px; padding: var(--space-2) var(--space-3); font-size: var(--text-base);
    border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg); color: var(--text);
  }
  .actions { display: flex; flex-direction: column; gap: var(--space-2); }
  .submit {
    min-height: 48px; padding: var(--space-3) var(--space-7); cursor: pointer;
    background: var(--accent); color: white; border: none; border-radius: var(--radius-md);
    font-size: var(--text-sm); font-weight: var(--font-medium);
  }
  .submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .back { background: none; border: none; color: var(--accent); font-size: var(--text-sm); cursor: pointer; align-self: flex-start; }
  .err { color: var(--danger); font-size: var(--text-sm); }
</style>
```

- [ ] **Step 2: 改 ResultView — 移除舊 submitToFhir，改用 picker**

在 `src/components/assess/ResultView.svelte`：

刪除 import（第 5 行）：`import { submitAssessmentToFhir } from '../../lib/fhir/cdsa-submit';`
新增 import：`import CollectionPointPicker from './CollectionPointPicker.svelte';`

刪除 state（第 14–16 行）`fhirSubmitting/fhirSubmitted/fhirError` 與函式 `submitToFhir`（第 83–98 行）。
刪除 `import { authStore } ...`（若已無其他使用，第 3 行）。

把 result-actions 內的 FHIR 區塊（第 148–158 行）：

```svelte
    {#if authStore.isAuthenticated && !fhirSubmitted}
      <button class="btn-fhir" onclick={submitToFhir} disabled={fhirSubmitting}>
        {fhirSubmitting ? '傳送中…' : '傳送結果至醫院'}
      </button>
    {:else if fhirSubmitted}
      <p class="fhir-success">已傳送至醫院 FHIR Server</p>
    {/if}

    {#if fhirError}
      <p class="fhir-error">{fhirError}</p>
    {/if}
```

換成：

```svelte
    {#if assessmentStore.assessment}
      <CollectionPointPicker assessmentId={assessmentStore.assessment.id} />
    {/if}
```

（保留 `.btn-fhir`/`.fhir-success`/`.fhir-error` CSS 移除，避免 unused；其餘 PDF/history/home 按鈕不動。）

- [ ] **Step 3: 型別檢查**

Run: `pnpm check`
Expected: 無 error（若 `authStore` 仍被其他處用到則保留該 import）

- [ ] **Step 4: Commit**

```bash
git add src/components/assess/CollectionPointPicker.svelte src/components/assess/ResultView.svelte
git commit -m "feat(assess): 結果頁收案點選單（醫院/GCM）"
```

---

## Task 7: launch.astro + LaunchReturn.svelte

**Files:**
- Create: `src/pages/launch.astro`
- Create: `src/components/fhir/LaunchReturn.svelte`

- [ ] **Step 1: 建立 launch.astro**

```astro
---
// src/pages/launch.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import LaunchReturn from '../components/fhir/LaunchReturn.svelte';
---
<BaseLayout title="處理上傳" description="收案點授權返回處理">
  <main class="launch-main">
    <LaunchReturn client:load />
  </main>
</BaseLayout>

<style>
  .launch-main { max-width: 640px; margin: 0 auto; padding: var(--space-7) var(--space-4); }
</style>
```

> 先確認 `src/layouts/` 內實際佈局檔名（`ls src/layouts/`）。若非 `BaseLayout.astro`，改用實際存在者，並對照其 props（title/description）。

- [ ] **Step 2: 建立 LaunchReturn.svelte**

```svelte
<!-- src/components/fhir/LaunchReturn.svelte -->
<script lang="ts">
  import { decideReturnMode } from '$lib/fhir/launch-return';
  import { completeGcmUpload, startGcmUpload, clearClientId, InvalidClientError, type GcmFlowState } from '$lib/fhir/gcm-submit';
  import { handleCallback } from '$lib/fhir/launch';
  import { submitAssessmentToFhir } from '$lib/fhir/cdsa-submit';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getAssessment, getPatient } from '$lib/db/assessments';
  import type { TriageResult } from '../../engine/func/triage';

  type Status = 'working' | 'gcm-done' | 'hospital-done' | 'error';
  let status = $state<Status>('working');
  let caseId = $state<string | null>(null);
  let message = $state('處理中…');

  $effect(() => { run(); });

  async function run() {
    const params = new URLSearchParams(location.search);
    const hasGcmFlow = !!sessionStorage.getItem('gcm.flow');
    const mode = decideReturnMode(params, hasGcmFlow);

    try {
      if (mode === 'gcm-reregister') {
        // /authorize 回 invalid_client：清快取後以同一 flow 重啟一次
        await reregisterAndRestart();
        return;
      }
      if (mode === 'gcm') {
        message = '上傳中…';
        try {
          const out = await completeGcmUpload(params);
          caseId = out.caseId;
          status = 'gcm-done';
        } catch (e) {
          if (e instanceof InvalidClientError) { await reregisterAndRestart(); return; }
          throw e;
        }
        return;
      }
      if (mode === 'hospital') {
        message = '完成醫院授權並上傳中…';
        await runHospital();
        return;
      }
      // idle：非授權返回，引導回首頁
      message = '沒有待處理的上傳。';
      status = 'error';
    } catch (e) {
      message = e instanceof Error ? e.message : '處理失敗，請返回結果頁重試';
      status = 'error';
    }
  }

  async function reregisterAndRestart() {
    const raw = sessionStorage.getItem('gcm.flow');
    if (!raw) { message = '流程狀態遺失，請返回重試'; status = 'error'; return; }
    const flow = JSON.parse(raw) as GcmFlowState;
    sessionStorage.removeItem('gcm.flow'); // 由 startGcmUpload 重新寫入
    clearClientId();
    message = '重新註冊後再次授權…';
    await startGcmUpload(flow.redirectUri, {
      assessmentId: flow.assessmentId, nickname: flow.nickname, email: flow.email, phone: flow.phone,
    });
  }

  async function runHospital() {
    const raw = sessionStorage.getItem('fhir.flow');
    const cb = await handleCallback(); // fhirclient ready()
    // submitAssessmentToFhir 依賴 authStore.fhirBaseUrl + getAccessToken()
    const baseUrl = (cb.client.state as { serverUrl: string }).serverUrl;
    authStore.setAuth(cb.accessToken, baseUrl, cb.fhirUser, cb.scopes);

    if (!raw) { message = '已連線醫院，但找不到待上傳評估'; status = 'error'; return; }
    const { assessmentId } = JSON.parse(raw) as { assessmentId: string };
    const assessment = await getAssessment(assessmentId);
    if (!assessment?.triageResult) { message = '找不到評估資料'; status = 'error'; return; }
    const patient = await getPatient(assessment.patientId);
    const subjectId = patient?.id ?? assessment.patientId;
    const res = await submitAssessmentToFhir(assessment, subjectId, assessment.triageResult as TriageResult);
    sessionStorage.removeItem('fhir.flow');
    if (!res.success) { message = res.error ?? '上傳失敗'; status = 'error'; return; }
    status = 'hospital-done';
  }
</script>

<div class="return">
  {#if status === 'working'}
    <p class="working">{message}</p>
  {:else if status === 'gcm-done'}
    <h1>上傳完成</h1>
    <p>收案編號：<strong>{caseId}</strong></p>
    <p class="hint">請記下收案編號；複診以相同暱稱上傳會回到同一編號。</p>
    <a class="home" href="/history/">查看評估紀錄</a>
  {:else if status === 'hospital-done'}
    <h1>已傳送至醫院 FHIR Server</h1>
    <a class="home" href="/history/">查看評估紀錄</a>
  {:else}
    <h1>無法完成上傳</h1>
    <p class="err" role="alert">{message}</p>
    <a class="home" href="/result/">返回結果頁</a>
  {/if}
</div>

<style>
  .return { display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start; }
  .return h1 { font-size: var(--text-2xl); }
  .working { font-size: var(--text-base); color: var(--text); }
  .hint { font-size: var(--text-sm); color: color-mix(in srgb, var(--text), var(--bg) 30%); }
  .err { color: var(--danger); font-size: var(--text-base); }
  .home {
    display: inline-flex; align-items: center; min-height: 48px; padding: var(--space-3) var(--space-7);
    background: var(--accent); color: white; border-radius: var(--radius-md); text-decoration: none;
    font-size: var(--text-sm); font-weight: var(--font-medium);
  }
</style>
```

- [ ] **Step 3: 型別檢查 + 建置**

Run: `pnpm check && pnpm build`
Expected: 無 error；`dist/launch/index.html` 產生（`ls dist/launch/`）

- [ ] **Step 4: Commit**

```bash
git add src/pages/launch.astro src/components/fhir/LaunchReturn.svelte
git commit -m "feat(fhir): 統一 /launch/ 返回頁（GCM 優先＋修醫院 callback）"
```

---

## Task 8: 全套驗證

**Files:** 無（驗證）

- [ ] **Step 1: 全測試**

Run: `pnpm test`
Expected: 全綠（含新增 3 個測試檔）

- [ ] **Step 2: check + lint**

Run: `pnpm check && pnpm lint`
Expected: 無 error

- [ ] **Step 3: build**

Run: `pnpm build`
Expected: 成功；確認 `dist/launch/index.html` 存在

- [ ] **Step 4: Commit（若有 lint 修正）**

```bash
git add -A && git commit -m "chore: GCM 整合 lint/check 修正" || echo "無待提交"
```

---

## Task 9: conformance script（對線上實例）

**Files:**
- Create: `scripts/gcm-conformance.mjs`
- Modify: `package.json`

- [ ] **Step 1: 建立 scripts/gcm-conformance.mjs**

```js
// scripts/gcm-conformance.mjs — 對線上 GCM 實例做端到端自檢（register→intake→PKCE→token→transaction）
const BASE = process.argv[2] || 'https://gcm.fhir.yao.care';
const REDIRECT = 'https://smart-func-cds.yao.care/launch/';
const SCOPES = 'launch/patient patient/Observation.c patient/DiagnosticReport.c patient/QuestionnaireResponse.c patient/Patient.u offline_access';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}
const log = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
let failures = 0;
const check = (ok, msg) => { log(ok, msg); if (!ok) failures++; };

const browserCode = crypto.randomUUID();
const nickname = `conformance-${browserCode.slice(0, 8)}`;

// 1. register
const reg = await fetch(`${BASE}/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }),
});
check(reg.ok, `POST /register → ${reg.status}`);
const { client_id } = await reg.json();
check(!!client_id, `client_id 取得: ${client_id}`);

// 2. intake questionnaire
const q = await fetch(`${BASE}/Questionnaire?url=https://gcm.org.tw/fhir/Questionnaire/gcm-intake`);
check(q.ok, `GET /Questionnaire?url=gcm-intake → ${q.status}`);

// 3. authorize（login_hint + nickname → 直接 302 回 code）
const { verifier, challenge } = await pkce();
const state = crypto.randomUUID();
const authUrl = `${BASE}/authorize?` + new URLSearchParams({
  response_type: 'code', client_id, redirect_uri: REDIRECT, scope: SCOPES, state, aud: BASE,
  code_challenge: challenge, code_challenge_method: 'S256', login_hint: browserCode, nickname,
});
const authRes = await fetch(authUrl, { redirect: 'manual' });
check(authRes.status >= 300 && authRes.status < 400, `GET /authorize → ${authRes.status}（期望 302）`);
const loc = authRes.headers.get('location') || '';
const code = new URL(loc, BASE).searchParams.get('code');
check(!!code, `授權 code 取得`);

// 4. token
const tok = await fetch(`${BASE}/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier, client_id }),
});
check(tok.ok, `POST /token → ${tok.status}`);
const t = await tok.json();
const accessToken = t.access_token, caseId = t.patient;
check(!!accessToken, `access_token 取得`);
check(!!caseId && /^GCM-/.test(caseId), `病例唯一碼: ${caseId}`);

// 5. transaction（application/fhir+json 回 200）
const bundle = {
  resourceType: 'Bundle', type: 'transaction',
  entry: [
    { resource: { resourceType: 'QuestionnaireResponse', status: 'completed',
      questionnaire: 'https://gcm.org.tw/fhir/Questionnaire/gcm-intake',
      item: [{ linkId: 'email', item: [
        { linkId: 'email-system', answer: [{ valueString: 'email' }] },
        { linkId: 'email-value', answer: [{ valueString: 'conformance@example.org' }] }] }] } },
    { resource: { resourceType: 'Observation', status: 'final',
      code: { coding: [{ system: 'https://smart-func-cds.yao.care/code', code: 'func-vitality', display: 'Func IC vitality' }] },
      subject: { reference: 'Patient/placeholder' },
      valueQuantity: { value: 55, unit: 'score' } } },
    { resource: { resourceType: 'DiagnosticReport', status: 'final',
      code: { coding: [{ system: 'https://smart-func-cds.yao.care/code', code: 'func-assessment' }] },
      subject: { reference: 'Patient/placeholder' } } },
  ],
};
const up = await fetch(`${BASE}/`, {
  method: 'POST', headers: { 'content-type': 'application/fhir+json', authorization: `Bearer ${accessToken}` },
  body: JSON.stringify(bundle),
});
check(up.status === 200, `POST / (application/fhir+json) → ${up.status}（期望 200）`);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: 加 package.json script**

在 `package.json` 的 `scripts` 加：

```json
"conformance": "node scripts/gcm-conformance.mjs"
```

- [ ] **Step 3: 對線上跑**

Run: `pnpm conformance https://gcm.fhir.yao.care`
Expected: `ALL PASS`，含 `POST / (application/fhir+json) → 200`

- [ ] **Step 4: Commit**

```bash
git add scripts/gcm-conformance.mjs package.json
git commit -m "test(fhir): GCM 線上 conformance 自檢腳本"
```

---

## Task 10: 部署、截圖、線上實送

**Files:** 無（操作）

- [ ] **Step 1: 推送觸發部署**

```bash
git push origin main
```

監看：`gh run watch $(gh run list --workflow=deploy.yml -L1 --json databaseId -q '.[0].databaseId')`
Expected: deploy.yml 綠燈

- [ ] **Step 2: 驗站（避開本機假 IP）**

```bash
curl -sS --resolve smart-func-cds.yao.care:443:185.199.108.153 https://smart-func-cds.yao.care/launch/ -o /dev/null -w '%{http_code}\n'
```
Expected: `200`（`/launch/` 頁已上線，不再 404）

- [ ] **Step 3: 螢幕截圖（結果頁選單 + /launch/ 完成頁）**

用 Playwright MCP：開 `/assess/` 跑完一份最短評估 → 結果頁截 `CollectionPointPicker`；選 GCM 填暱稱送出 → `/launch/` 完成頁截 `GCM-XXXX`。
（截圖存 `docs/superpowers/artifacts/` 或回報路徑。）

- [ ] **Step 4: 線上實送驗證**

於線上站實際選 GCM 上傳一筆，確認返回頁顯示 `GCM-XXXX`；並用 token 對 `gcm.fhir.yao.care` 確認資源已建立（或再跑一次 `pnpm conformance` 佐證 transaction 路徑 200）。

- [ ] **Step 5: 更新 memory**

把「GCM 收案點上線、/launch/ 返回頁、conformance script」記入 `deployment-go-live-status.md`。
