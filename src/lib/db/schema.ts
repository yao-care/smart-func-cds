import Dexie, { type Table } from 'dexie';
import type { RiskLevel } from '../utils/risk-levels';
import type { TriageResult } from '../../engine/func/triage';
import type { AgeGroupAdult } from '../utils/age-groups';

export type { RiskLevel };
export type AlertStatus = 'open' | 'acknowledged' | 'false_positive' | 'resolved';

export interface Patient {
  id: string;              // FHIR Patient ID
  name?: string;
  birthDate: string;
  gender: 'male' | 'female';
  ageGroup: 'infant' | 'toddler' | 'preschool';
  currentRiskLevel: RiskLevel;
  lastSyncedAt: Date;
}

export interface Observation {
  id: string;              // FHIR Observation ID
  patientId: string;
  indicator: string;       // LOINC code
  value: number;
  unit: string;
  effectiveDateTime: Date;
  syncedAt: Date;
}

export interface Alert {
  id: string;              // local UUID
  patientId: string;
  riskLevel: RiskLevel;
  status: AlertStatus;
  indicators: string[];    // triggered indicators
  rationale: string;
  ruleVersion: string;
  modelVersion?: string;
  inputSnapshot: object;   // complete decision trace
  fhirRiskAssessmentId?: string;
  educationRecommended?: string[];
  educationTriggeredAt?: Date;
  acknowledgedBy?: string;
  notes?: string;
  parentAlertId?: string;
  createdAt: Date;
  closedAt?: Date;
}

export interface Baseline {
  patientId: string;
  indicator: string;
  mean: number;
  std: number;
  sampleCount: number;
  updatedAt: Date;
}

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update';
  resourceType: string;
  payload: object;
  createdAt: Date;
  retryCount: number;
}

export interface ServerConfig {
  id: string;
  name: string;
  fhirBaseUrl: string;
  clientId: string;
  scopes: string;
  lastUsedAt: Date;
}

export interface EducationInteraction {
  id: string;
  contentSlug: string;
  action: 'view' | 'complete' | 'questionnaire_submit';
  durationSeconds?: number;
  questionnaireAnswers?: object;
  createdAt: Date;
}

export interface RuleVersion {
  id: string;
  yamlContent: string;
  changedBy: string;
  changeReason: string;
  createdAt: Date;
}

export interface WebhookHistoryEntry {
  id: string;
  webhookId: string;
  alertId: string;
  url: string;
  status: 'success' | 'failed';
  statusCode?: number;
  createdAt: Date;
}

export type AssessmentStatus = 'started' | 'paused' | 'resumed' | 'completed' | 'incomplete';

/** The adult subject of a functional-health assessment. (Was `Child` in the
 *  pediatric CDSA; renamed to the neutral `AssessmentPatient` to avoid
 *  colliding with the FHIR-monitoring `Patient` interface above.) */
export interface AssessmentPatient {
  id: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  nickName?: string;
  createdAt: Date;
}

export interface Assessment {
  id: string;
  patientId: string;
  status: AssessmentStatus;
  language: string;
  currentStep: number;
  startedAt: Date;
  completedAt?: Date;
  pausedAt?: Date;
  /** Full IC triage result from src/engine/func/triage. Optional: present once
   *  the result step has computed it. Older records may omit it. */
  triageResult?: TriageResult;
  fhirSubmitted: boolean;
  fhirDiagnosticReportId?: string;
  physicianNote?: string | null;
  physicianNoteUpdatedAt?: Date | null;
  /** Origin of the record. Undefined / 'idb' = produced on this device.
   *  'fhir-cache' = pulled from FHIR server by the cross-device resolver and cached locally. */
  _source?: 'idb' | 'fhir-cache';
  /** v5: when true, run all modules regardless of questionnaire score; default false. */
  forceFullAssessment?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentEvent {
  id: string;
  assessmentId: string;
  patientId: string;
  moduleType: 'questionnaire' | 'objective';
  eventType: string;
  timestamp: Date;
  data: Record<string, unknown>;
  qualityFlags?: {
    isComplete: boolean;
    isAnomaly: boolean;
    anomalyType?: string;
  };
}

export interface MediaFile {
  id: string;
  assessmentId: string;
  patientId: string;
  fileType: 'voice' | 'video' | 'drawing';
  blob: Blob;
  mimeType: string;
  fileSize: number;
  duration?: number;
  processed: boolean;
  createdAt: Date;
}

export interface NormThreshold {
  id: string;
  ageGroup: AgeGroupAdult;
  metric: string;
  mean: number;
  std: number;
  source: string;
  updatedAt: Date;
}

export interface CustomEducation {
  id: string;
  tenantId: string;         // derived from FHIR base URL
  title: string;
  summary: string;
  category: string;
  ageGroup: string[];       // ['infant', 'toddler', 'preschool']
  format: 'article' | 'video';
  content: string;          // Markdown content for articles
  videoUrl?: string;        // YouTube URL for videos
  triggerIndicators: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  id: string;               // tenantId
  tenantId: string;
  displayName: string;
  pollingInterval: number;
  advisoryBatchInterval: number;
  browserNotifications: boolean;
  soundEnabled: boolean;
  alertAfterHours: number;
  customRulesYaml?: string;  // tenant-specific YAML rules override
  updatedAt: Date;
}

/** Triage category × domain recommendation overlay (one row per cell). */
export type RecommendationCategory = 'normal' | 'observe' | 'consult' | 'incomplete';
export type RecommendationSource = 'internal' | 'custom' | 'external';

export interface RecommendationItem {
  source: RecommendationSource;
  /** For source: 'internal' — slug under /education/{slug}/ */
  slug?: string;
  /** For source: 'custom' — id of a CustomEducation row */
  customId?: string;
  /** For source: 'external' — full URL (e.g. YouTube, hospital page) */
  url?: string;
  /** Display title; required for external, optional for internal/custom (falls back to source content) */
  title?: string;
  /** Display summary (one-liner) */
  summary?: string;
}

export interface RecommendationOverlay {
  /** Composite id: `${tenantId}::${category}::${domain}` */
  id: string;
  tenantId: string;
  category: RecommendationCategory;
  domain: string;
  items: RecommendationItem[];
  /** When true, items are appended to the default list; when false, items replace the default. */
  mergeWithDefault: boolean;
  updatedAt: Date;
}

export class CdssDatabase extends Dexie {
  patients!: Table<Patient>;
  observations!: Table<Observation>;
  alerts!: Table<Alert>;
  baselines!: Table<Baseline>;
  syncQueue!: Table<SyncQueueItem>;
  serverConfigs!: Table<ServerConfig>;
  educationInteractions!: Table<EducationInteraction>;
  ruleVersions!: Table<RuleVersion>;
  webhookHistory!: Table<WebhookHistoryEntry>;
  assessmentPatients!: Table<AssessmentPatient>;
  assessments!: Table<Assessment>;
  assessmentEvents!: Table<AssessmentEvent>;
  mediaFiles!: Table<MediaFile>;
  normThresholds!: Table<NormThreshold>;
  customEducation!: Table<CustomEducation>;
  tenantSettings!: Table<TenantSettings>;
  recommendationOverlays!: Table<RecommendationOverlay>;

  constructor() {
    super('smart-func-cds');
    this.version(1).stores({
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
    });
    this.version(2).stores({
      // Repeat ALL v1 stores exactly as they are
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
      // New v2 stores
      children: 'id, createdAt',
      assessments: 'id, childId, status, createdAt, [childId+status]',
      assessmentEvents: 'id, assessmentId, childId, moduleType, timestamp, [assessmentId+moduleType]',
      mediaFiles: 'id, assessmentId, childId, fileType, createdAt, [assessmentId+fileType]',
      normThresholds: 'id, ageGroup, metric, [ageGroup+metric]',
    });
    this.version(3).stores({
      // Repeat ALL v2 stores exactly as they are
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
      children: 'id, createdAt',
      assessments: 'id, childId, status, createdAt, [childId+status]',
      assessmentEvents: 'id, assessmentId, childId, moduleType, timestamp, [assessmentId+moduleType]',
      mediaFiles: 'id, assessmentId, childId, fileType, createdAt, [assessmentId+fileType]',
      normThresholds: 'id, ageGroup, metric, [ageGroup+metric]',
      // New v3 stores
      customEducation: 'id, tenantId, category, isActive, [tenantId+isActive]',
      tenantSettings: 'id, tenantId',
    });
    this.version(4).stores({
      // Repeat ALL v3 stores exactly as they are
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
      children: 'id, createdAt',
      assessments: 'id, childId, status, createdAt, [childId+status]',
      assessmentEvents: 'id, assessmentId, childId, moduleType, timestamp, [assessmentId+moduleType]',
      mediaFiles: 'id, assessmentId, childId, fileType, createdAt, [assessmentId+fileType]',
      normThresholds: 'id, ageGroup, metric, [ageGroup+metric]',
      customEducation: 'id, tenantId, category, isActive, [tenantId+isActive]',
      tenantSettings: 'id, tenantId',
      // New v4 store
      recommendationOverlays: 'id, tenantId, category, domain, [tenantId+category+domain]',
    });
    this.version(5).stores({
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
      children: 'id, createdAt',
      assessments: 'id, childId, status, createdAt, [childId+status]',
      assessmentEvents: 'id, assessmentId, childId, moduleType, timestamp, [assessmentId+moduleType]',
      mediaFiles: 'id, assessmentId, childId, fileType, createdAt, [assessmentId+fileType]',
      normThresholds: 'id, ageGroup, metric, [ageGroup+metric]',
      customEducation: 'id, tenantId, category, isActive, [tenantId+isActive]',
      tenantSettings: 'id, tenantId',
      recommendationOverlays: 'id, tenantId, category, domain, [tenantId+category+domain]',
    }).upgrade(async tx => {
      await tx.table('assessments').toCollection().modify(a => {
        a.forceFullAssessment = false;
      });
    });
    // v6: pediatric → adult functional-health. Rename children→assessmentPatients
    // and childId→patientId on assessment-scoped tables. The DB name itself
    // changed (cdss-pediatric → smart-func-cds), so in practice this is a fresh
    // store for all users; the migration steps exist only for completeness.
    this.version(6).stores({
      patients: 'id, ageGroup, currentRiskLevel, lastSyncedAt',
      observations: 'id, patientId, indicator, effectiveDateTime, [patientId+indicator]',
      alerts: 'id, patientId, riskLevel, status, createdAt, [patientId+status]',
      baselines: '[patientId+indicator], patientId, updatedAt',
      syncQueue: 'id, createdAt',
      serverConfigs: 'id, lastUsedAt',
      educationInteractions: 'id, contentSlug, createdAt',
      ruleVersions: 'id, createdAt',
      webhookHistory: 'id, webhookId, alertId, createdAt',
      children: null,
      assessmentPatients: 'id, createdAt',
      assessments: 'id, patientId, status, createdAt, [patientId+status]',
      assessmentEvents: 'id, assessmentId, patientId, moduleType, timestamp, [assessmentId+moduleType]',
      mediaFiles: 'id, assessmentId, patientId, fileType, createdAt, [assessmentId+fileType]',
      normThresholds: 'id, ageGroup, metric, [ageGroup+metric]',
      customEducation: 'id, tenantId, category, isActive, [tenantId+isActive]',
      tenantSettings: 'id, tenantId',
      recommendationOverlays: 'id, tenantId, category, domain, [tenantId+category+domain]',
    });
  }
}

export const db = new CdssDatabase();
