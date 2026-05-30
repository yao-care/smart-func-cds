<script lang="ts">
  import { isAdult, isWithinValidatedRange, ageGroupAdult, type AgeGroupAdult } from '../../lib/utils/age-groups';

  let { onComplete }: {
    onComplete: (profile: { name: string; gender: 'male' | 'female' | 'other'; birthDate: string; ageGroup: AgeGroupAdult }) => void
  } = $props();

  let name = $state('');
  let gender = $state<'male' | 'female' | 'other'>('other');
  let birthDate = $state('');

  let nameError = $derived(name.trim().length === 0 ? '請輸入姓名' : '');
  let birthError = $derived(
    birthDate === '' ? '請輸入出生日期'
    : !isAdult(birthDate) ? '本系統適用於 18 歲以上'
    : ''
  );
  let canSubmit = $derived(nameError === '' && birthError === '');
  let ageAdvisory = $derived(
    birthDate !== '' && isAdult(birthDate) && !isWithinValidatedRange(birthDate)
      ? '本系統採用的篩檢工具——WHO-5 / BAT-12 / PHQ-2 / GAD-2 / PSS-4 / PROMIS Fatigue / 反應時間 / TMT-A——主要在 18-64 工作人口校準/驗證；65+ 結果僅供參考，建議使用專為高齡設計的評估（如 ICOPE / GDS-15）並向醫療人員諮詢。'
      : ''
  );

  function submit() {
    if (!canSubmit) return;
    const profile = {
      name: name.trim(),
      gender,
      birthDate,
      ageGroup: ageGroupAdult(birthDate),
    };
    onComplete(profile);
  }
</script>

<section class="patient-profile">
  <h2>受測者基本資料</h2>

  <label>
    姓名
    <input type="text" bind:value={name} />
    {#if nameError}<span class="error">{nameError}</span>{/if}
  </label>

  <label>
    性別
    <select bind:value={gender}>
      <option value="other">不便回答</option>
      <option value="female">女</option>
      <option value="male">男</option>
    </select>
  </label>

  <label>
    出生日期
    <input type="date" bind:value={birthDate} />
    {#if birthError}<span class="error">{birthError}</span>{/if}
  </label>

  {#if ageAdvisory}
    <p class="advisory">{ageAdvisory}</p>
  {/if}

  <button type="button" disabled={!canSubmit} onclick={submit}>開始評估</button>
</section>

<style>
  .patient-profile { display: flex; flex-direction: column; gap: 1rem; max-width: 480px; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-base); }
  input, select, button {
    font-size: var(--text-base);
    min-height: 44px;
    padding: 0.5rem;
  }
  .error { color: var(--color-risk-critical, oklch(60% 0.15 25)); font-size: var(--text-sm); }
  .advisory {
    padding: 0.75rem;
    background: var(--color-risk-advisory-bg, oklch(95% 0.05 80));
    border-left: 4px solid var(--color-risk-advisory, oklch(70% 0.15 60));
    font-size: var(--text-sm);
  }
</style>
