// scripts/gcm-conformance.mjs — 對線上 GCM 實例做端到端自檢
// （register → intake → PKCE authorize → token → transaction）
// 用法：node scripts/gcm-conformance.mjs [base]
const BASE = process.argv[2] || 'https://gcm.fhir.yao.care';
const REDIRECT = 'https://smart-func-cds.yao.care/launch/';
const SCOPES =
  'launch/patient patient/Observation.c patient/DiagnosticReport.c patient/QuestionnaireResponse.c patient/Patient.u offline_access';
const CODE_SYSTEM = 'https://smart-func-cds.yao.care/code';
const INTAKE = 'https://gcm.org.tw/fhir/Questionnaire/gcm-intake';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
};

const browserCode = crypto.randomUUID();
const nickname = `conformance-${browserCode.slice(0, 8)}`;

// 1. register
const reg = await fetch(`${BASE}/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }),
});
check(reg.ok, `POST /register → ${reg.status}`);
const { client_id } = await reg.json();
check(!!client_id, `client_id 取得: ${client_id}`);

// 2. intake questionnaire
const q = await fetch(`${BASE}/Questionnaire?url=${encodeURIComponent(INTAKE)}`);
check(q.ok, `GET /Questionnaire?url=gcm-intake → ${q.status}`);

// 3. authorize（login_hint + nickname → 直接 302 回 code）
const { verifier, challenge } = await pkce();
const state = crypto.randomUUID();
const authUrl =
  `${BASE}/authorize?` +
  new URLSearchParams({
    response_type: 'code', client_id, redirect_uri: REDIRECT, scope: SCOPES, state, aud: BASE,
    code_challenge: challenge, code_challenge_method: 'S256', login_hint: browserCode, nickname,
  });
const authRes = await fetch(authUrl, { redirect: 'manual' });
check(authRes.status >= 300 && authRes.status < 400, `GET /authorize → ${authRes.status}（期望 3xx）`);
const loc = authRes.headers.get('location') || '';
const code = new URL(loc, BASE).searchParams.get('code');
check(!!code, `授權 code 取得`);

// 4. token
const tok = await fetch(`${BASE}/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier, client_id,
  }),
});
check(tok.ok, `POST /token → ${tok.status}`);
const t = await tok.json();
const accessToken = t.access_token;
const caseId = t.patient;
check(!!accessToken, `access_token 取得`);
check(!!caseId && /^GCM-/.test(caseId), `病例唯一碼: ${caseId}`);

// 5. transaction（application/fhir+json 回 200）
const bundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      resource: {
        resourceType: 'QuestionnaireResponse', status: 'completed', questionnaire: INTAKE,
        item: [{ linkId: 'email', item: [
          { linkId: 'email-system', answer: [{ valueString: 'email' }] },
          { linkId: 'email-value', answer: [{ valueString: 'conformance@example.org' }] },
        ] }],
      },
    },
    {
      resource: {
        resourceType: 'Observation', status: 'final',
        code: { coding: [{ system: CODE_SYSTEM, code: 'func-vitality', display: 'Func IC vitality' }] },
        subject: { reference: 'Patient/placeholder' },
        valueQuantity: { value: 55, unit: 'score' },
      },
    },
    {
      resource: {
        resourceType: 'DiagnosticReport', status: 'final',
        code: { coding: [{ system: CODE_SYSTEM, code: 'func-assessment' }] },
        subject: { reference: 'Patient/placeholder' },
      },
    },
  ],
};
const up = await fetch(`${BASE}/`, {
  method: 'POST',
  headers: { 'content-type': 'application/fhir+json', authorization: `Bearer ${accessToken}` },
  body: JSON.stringify(bundle),
});
check(up.status === 200, `POST / (application/fhir+json) → ${up.status}（期望 200）`);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
