<script lang="ts">
  import { decideReturnMode } from '$lib/fhir/launch-return';
  import {
    completeGcmUpload, startGcmUpload, clearClientId, InvalidClientError,
    type GcmFlowState,
  } from '$lib/fhir/gcm-submit';
  import { handleCallback } from '$lib/fhir/launch';
  import { submitAssessmentToFhir } from '$lib/fhir/cdsa-submit';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getAssessment, getPatient } from '$lib/db/assessments';
  import type { TriageResult } from '../../engine/func/triage';

  type Status = 'working' | 'gcm-done' | 'hospital-done' | 'error';
  let status = $state<Status>('working');
  let caseId = $state<string | null>(null);
  let message = $state('處理中…');
  let started = false;

  $effect(() => {
    if (started) return;
    started = true;
    run();
  });

  async function run() {
    const params = new URLSearchParams(location.search);
    const hasGcmFlow = !!sessionStorage.getItem('gcm.flow');
    const mode = decideReturnMode(params, hasGcmFlow);

    try {
      if (mode === 'gcm-reregister') {
        await reregisterAndRestart();
        return;
      }
      if (mode === 'gcm') {
        message = '上傳中…';
        try {
          const out = await completeGcmUpload(params);
          caseId = out.caseId;
          sessionStorage.removeItem('gcm.reregistered');
          status = 'gcm-done';
        } catch (e) {
          if (e instanceof InvalidClientError) {
            await reregisterAndRestart();
            return;
          }
          throw e;
        }
        return;
      }
      if (mode === 'hospital') {
        message = '完成醫院授權並上傳中…';
        await runHospital();
        return;
      }
      message = '沒有待處理的上傳。';
      status = 'error';
    } catch (e) {
      message = e instanceof Error ? e.message : '處理失敗，請返回結果頁重試';
      status = 'error';
    }
  }

  // /authorize 或 /token 回 invalid_client：清快取後以同一 flow 重啟一次
  // （一次性旗標 gcm.reregistered 防無限迴圈）
  async function reregisterAndRestart() {
    if (sessionStorage.getItem('gcm.reregistered')) {
      message = 'GCM 註冊失敗，請稍後再試';
      status = 'error';
      return;
    }
    const raw = sessionStorage.getItem('gcm.flow');
    if (!raw) {
      message = '流程狀態遺失，請返回重試';
      status = 'error';
      return;
    }
    const flow = JSON.parse(raw) as GcmFlowState;
    sessionStorage.removeItem('gcm.flow'); // 由 startGcmUpload 重新寫入
    sessionStorage.setItem('gcm.reregistered', '1');
    clearClientId();
    message = '重新註冊後再次授權…';
    await startGcmUpload(flow.redirectUri, {
      assessmentId: flow.assessmentId,
      nickname: flow.nickname,
      email: flow.email,
      phone: flow.phone,
    });
  }

  async function runHospital() {
    const raw = sessionStorage.getItem('fhir.flow');
    const cb = await handleCallback(); // fhirclient ready()
    // submitAssessmentToFhir 依賴 authStore.fhirBaseUrl + getAccessToken()
    const baseUrl = (cb.client.state as { serverUrl: string }).serverUrl;
    authStore.setAuth(cb.accessToken, baseUrl, cb.fhirUser, cb.scopes);

    if (!raw) {
      message = '已連線醫院，但找不到待上傳評估';
      status = 'error';
      return;
    }
    const { assessmentId } = JSON.parse(raw) as { assessmentId: string };
    const assessment = await getAssessment(assessmentId);
    if (!assessment?.triageResult) {
      message = '找不到評估資料';
      status = 'error';
      return;
    }
    const patient = await getPatient(assessment.patientId);
    const subjectId = patient?.id ?? assessment.patientId;
    const res = await submitAssessmentToFhir(assessment, subjectId, assessment.triageResult as TriageResult);
    sessionStorage.removeItem('fhir.flow');
    if (!res.success) {
      message = res.error ?? '上傳失敗';
      status = 'error';
      return;
    }
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
  .return {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }
  .return h1 {
    font-size: var(--text-2xl);
  }
  .working {
    font-size: var(--text-base);
    color: var(--text);
  }
  .hint {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }
  .err {
    color: var(--danger);
    font-size: var(--text-base);
  }
  .home {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: var(--space-3) var(--space-7);
    background: var(--accent);
    color: white;
    border-radius: var(--radius-md);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
</style>
