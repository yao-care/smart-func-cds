/**
 * GCM 收案點上傳模組。受測者本地完成評估後，可選 GCM 為收案點，把結果以標準
 * SMART on FHIR 上傳到 https://gcm.fhir.yao.care。
 *
 * 用原生 fetch + crypto.subtle 自做 PKCE（不用 fhirclient），因為要帶自訂的
 * login_hint（瀏覽器碼）/ nickname 由 server 以 (瀏覽器碼, 暱稱) match-or-create
 * 病例 context。身分＝瀏覽器碼＋暱稱＋初診 QuestionnaireResponse，app 不自組 Patient。
 */
import { getAssessment, getPatient } from '../db/assessments';
import { buildAssessmentObservations, buildTriageDiagnosticReport } from './cdsa-resources';
import type { TriageResult } from '../../engine/func/triage';

export const GCM = {
  base: 'https://gcm.fhir.yao.care',
  intakeUrl: 'https://gcm.org.tw/fhir/Questionnaire/gcm-intake',
  // 注意：勿帶 openid/fhirUser，GCM 不支援 OIDC。
  scopes:
    'launch/patient patient/Observation.c patient/DiagnosticReport.c patient/QuestionnaireResponse.c patient/Patient.u offline_access',
} as const;

/** 取/建穩定的瀏覽器唯一碼，作為 server match-or-create 的 login_hint。 */
export function browserCode(): string {
  let c = localStorage.getItem('gcm.browserCode');
  if (!c) {
    c = crypto.randomUUID();
    localStorage.setItem('gcm.browserCode', c);
  }
  return c;
}

/** base64url 編碼（無 padding，url-safe）。 */
export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 產生 PKCE verifier 與 S256 challenge。 */
export async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

/** 清除快取的 client_id（client_id 自癒用）。 */
export function clearClientId(): void {
  localStorage.removeItem('gcm.clientId');
}

/** 取得 client_id：快取於 localStorage，無則 RFC 7591 動態註冊（public client）。 */
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

/** 跨 redirect 持久化於 sessionStorage['gcm.flow']。 */
export interface GcmFlowState {
  verifier: string; // PKCE，/token 需要
  state: string; // CSRF
  clientId: string;
  redirectUri: string; // 與 /register、/authorize 逐字一致
  assessmentId: string; // 返回頁據此從 IndexedDB 重建資源
  nickname: string; // 必填非空
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

/**
 * Step 1：使用者選 GCM、填暱稱/email/電話後呼叫，導向授權。
 * 空暱稱直接 throw —— 否則 server /authorize 會退回 HTML 同意表單，打斷 SPA。
 */
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
    verifier,
    state,
    clientId,
    redirectUri,
    assessmentId: input.assessmentId,
    nickname,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
  };
  sessionStorage.setItem('gcm.flow', JSON.stringify(flow));

  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GCM.scopes,
    state,
    aud: GCM.base,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    login_hint: browserCode(),
    nickname,
  });
  navigate(`${GCM.base}/authorize?${q.toString()}`);
}

/** /token 或 /authorize 回 invalid_client 時拋出，供返回頁自癒重啟。 */
export class InvalidClientError extends Error {
  constructor() {
    super('GCM client_id 失效，需重新註冊');
    this.name = 'InvalidClientError';
  }
}

/**
 * 初診表單回應（SDC）：email/電話以 QuestionnaireResponse 帶上，server $extract
 * 寫進 Patient.telecom（不經 app 的 Patient 資源）。
 */
export function intakeResponse(email?: string, phone?: string): object {
  const item: object[] = [];
  if (email) {
    item.push({
      linkId: 'email',
      item: [
        { linkId: 'email-system', answer: [{ valueString: 'email' }] },
        { linkId: 'email-value', answer: [{ valueString: email }] },
      ],
    });
  }
  if (phone) {
    item.push({
      linkId: 'phone',
      item: [
        { linkId: 'phone-system', answer: [{ valueString: 'phone' }] },
        { linkId: 'phone-value', answer: [{ valueString: phone }] },
      ],
    });
  }
  return { resourceType: 'QuestionnaireResponse', status: 'completed', questionnaire: GCM.intakeUrl, item };
}

export interface GcmUploadResult {
  caseId: string;
  result: unknown;
}

/**
 * Step 2：callback 頁偵測到 gcm.flow 時呼叫。換 token → 由 assessmentId 從
 * IndexedDB 重建資源（subject 任意，server 覆寫）→ 組 transaction Bundle → 上傳。
 */
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
      grant_type: 'authorization_code',
      code,
      redirect_uri: flow.redirectUri,
      code_verifier: flow.verifier,
      client_id: flow.clientId,
    }).toString(),
  });
  if (!tok.ok) {
    const errBody = (await tok.json().catch(() => ({}))) as { error?: string };
    if (errBody.error === 'invalid_client') {
      clearClientId();
      throw new InvalidClientError();
    }
    throw new Error(`GCM 取得 token 失敗（${tok.status}）`);
  }
  const t = (await tok.json()) as { access_token: string; patient: string };
  const accessToken = t.access_token;
  const caseId = t.patient; // = 病例唯一碼 GCM-XXXX

  // 2. 從 IndexedDB 重建資源（單一真相源；subject 任意，server 覆寫）
  const assessment = await getAssessment(flow.assessmentId);
  if (!assessment) throw new Error('找不到評估資料，無法上傳');
  const triage = assessment.triageResult as TriageResult | undefined;
  if (!triage) throw new Error('評估尚未完成，無法上傳');
  const patient = await getPatient(assessment.patientId);
  const subjectId = patient?.id ?? assessment.patientId;

  const observations = buildAssessmentObservations(assessment, subjectId, triage);
  // transaction 內無法預知 server 指派的 Observation id，result 連結交給 server $extract 補
  const report = buildTriageDiagnosticReport(assessment, subjectId, triage, []);

  // 3. 組 transaction Bundle（intake QR 先、再 Observations、再 DiagnosticReport）
  const entry: object[] = [];
  if (flow.email || flow.phone) entry.push({ resource: intakeResponse(flow.email, flow.phone) });
  for (const o of observations) entry.push({ resource: o });
  entry.push({ resource: report });

  // 4. 上傳（server 已支援 application/fhir+json content-type parser）
  const up = await fetch(`${GCM.base}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/fhir+json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ resourceType: 'Bundle', type: 'transaction', entry }),
  });
  if (!up.ok) throw new Error(`GCM 上傳失敗（${up.status}）`);
  const result = await up.json();

  // 5. 清狀態 + 記收案編號（複診以同 (browserCode,nickname) 回同編號）
  sessionStorage.removeItem('gcm.flow');
  localStorage.setItem(`gcm.case.${browserCode()}.${flow.nickname}`, caseId);
  return { caseId, result };
}
