<script lang="ts">
  import { startGcmUpload } from '$lib/fhir/gcm-submit';
  import { setTriageResult } from '$lib/db/assessments';
  import type { TriageResult } from '../../engine/func/triage';
  import StandaloneLaunch from '../fhir/StandaloneLaunch.svelte';

  let { assessmentId, triageResult }: { assessmentId: string; triageResult: TriageResult } = $props();

  // 上傳路徑靠返回頁從 IndexedDB 重建資源，因此發起任一上傳前先保證 triageResult
  // 已落庫（結果頁的 $effect 持久化可能因競態未完成）。
  async function ensurePersisted() {
    // $state.snapshot 解包 proxy → 純物件，否則 IndexedDB 結構化複製會 DataCloneError
    await setTriageResult(assessmentId, $state.snapshot(triageResult));
  }

  let choice = $state<'none' | 'hospital' | 'gcm'>('none');
  let nickname = $state('');
  let email = $state('');
  let phone = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function chooseHospital() {
    // 醫院流程：StandaloneLaunch redirect 前先記 assessmentId 供返回頁重建
    await ensurePersisted();
    sessionStorage.setItem('fhir.flow', JSON.stringify({ assessmentId }));
    choice = 'hospital';
  }

  async function submitGcm() {
    error = null;
    if (!nickname.trim()) {
      error = '請輸入暱稱';
      return;
    }
    busy = true;
    try {
      await ensurePersisted();
      await startGcmUpload(`${location.origin}/launch/`, {
        assessmentId,
        nickname,
        email: email || undefined,
        phone: phone || undefined,
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
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .picker h3 {
    font-size: var(--text-lg);
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .point {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    min-height: 44px;
    text-align: left;
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
  }
  .point:hover {
    border-color: var(--accent);
  }
  .point .name {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text);
  }
  .point .desc {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--text), var(--bg) 30%);
  }
  .gcm-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .gcm-form label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .gcm-form input {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-base);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .submit {
    min-height: 48px;
    padding: var(--space-3) var(--space-7);
    cursor: pointer;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  .submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .back {
    background: none;
    border: none;
    color: var(--accent);
    font-size: var(--text-sm);
    cursor: pointer;
    align-self: flex-start;
  }
  .err {
    color: var(--danger);
    font-size: var(--text-sm);
  }
</style>
