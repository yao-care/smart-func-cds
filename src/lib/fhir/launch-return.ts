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
