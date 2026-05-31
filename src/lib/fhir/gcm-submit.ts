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
