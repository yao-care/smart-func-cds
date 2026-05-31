/**
 * GCM 收案點上傳模組。受測者本地完成評估後，可選 GCM 為收案點，把結果以標準
 * SMART on FHIR 上傳到 https://gcm.fhir.yao.care。
 *
 * 用原生 fetch + crypto.subtle 自做 PKCE（不用 fhirclient），因為要帶自訂的
 * login_hint（瀏覽器碼）/ nickname 由 server 以 (瀏覽器碼, 暱稱) match-or-create
 * 病例 context。身分＝瀏覽器碼＋暱稱＋初診 QuestionnaireResponse，app 不自組 Patient。
 */
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
