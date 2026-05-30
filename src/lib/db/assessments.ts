import { db, type Assessment, type AssessmentStatus, type AssessmentPatient } from './schema';

// ---- AssessmentPatient DAO ----
export async function createPatient(patient: AssessmentPatient): Promise<string> {
  await db.assessmentPatients.put(patient);
  return patient.id;
}

export async function getPatient(id: string): Promise<AssessmentPatient | undefined> {
  return db.assessmentPatients.get(id);
}

export async function getAllPatients(): Promise<AssessmentPatient[]> {
  return db.assessmentPatients.orderBy('createdAt').reverse().toArray();
}

// ---- Assessment DAO ----
export async function createAssessment(patientId: string, language = 'zh-TW'): Promise<Assessment> {
  const now = new Date();
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    patientId,
    status: 'started',
    language,
    currentStep: 0,
    startedAt: now,
    fhirSubmitted: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.assessments.put(assessment);
  return assessment;
}

export async function getAssessment(id: string): Promise<Assessment | undefined> {
  return db.assessments.get(id);
}

export async function getAssessmentsForPatient(patientId: string): Promise<Assessment[]> {
  return db.assessments.where('patientId').equals(patientId).reverse().sortBy('createdAt');
}

export async function updateAssessmentStatus(id: string, status: AssessmentStatus): Promise<void> {
  const update: Partial<Assessment> = { status, updatedAt: new Date() };
  if (status === 'completed') update.completedAt = new Date();
  if (status === 'paused') update.pausedAt = new Date();
  await db.assessments.update(id, update);
}

export async function updateAssessmentStep(id: string, step: number): Promise<void> {
  await db.assessments.update(id, { currentStep: step, updatedAt: new Date() });
}

export async function setTriageResult(id: string, result: Assessment['triageResult']): Promise<void> {
  await db.assessments.update(id, { triageResult: result, updatedAt: new Date() });
}

export async function markFhirSubmitted(id: string, fhirDiagnosticReportId: string): Promise<void> {
  await db.assessments.update(id, {
    fhirSubmitted: true,
    fhirDiagnosticReportId,
    updatedAt: new Date(),
  });
}

export async function getIncompleteAssessments(): Promise<Assessment[]> {
  return db.assessments.where('status').anyOf(['started', 'paused', 'resumed']).reverse().sortBy('createdAt');
}

export async function updateAssessmentForceFull(id: string, value: boolean): Promise<void> {
  await db.assessments.update(id, { forceFullAssessment: value, updatedAt: new Date() });
}
