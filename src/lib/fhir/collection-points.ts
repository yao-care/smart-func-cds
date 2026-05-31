import { GCM } from './gcm-submit';

/** 收案點清單。目前兩個：醫院（既有 fhirclient 手動連線）與 GCM。 */
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
