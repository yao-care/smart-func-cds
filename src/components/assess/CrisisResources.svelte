<script lang="ts">
  interface Props {
    visible?: boolean;
  }
  let { visible = false }: Props = $props();

  const RESOURCES = [
    { label: '安心專線（24 小時）', tel: '1925' },
    { label: '生命線', tel: '1995' },
    { label: '緊急救護', tel: '119' },
  ];
</script>

{#if visible}
  <div class="crisis" role="region" aria-label="危機求助資源" aria-live="assertive">
    <p class="crisis-title">如果您正經歷自我傷害的念頭，您並不孤單</p>
    <p class="crisis-desc">請立即尋求協助，這些專線全年無休、保密且免費：</p>
    <ul class="crisis-list">
      {#each RESOURCES as r (r.tel)}
        <li>
          <span class="crisis-label">{r.label}</span>
          <a class="crisis-tel" href="tel:{r.tel}" aria-label="撥打 {r.label}：{r.tel}">{r.tel}</a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .crisis {
    border: 2px solid var(--danger);
    background: color-mix(in srgb, var(--danger) 8%, var(--bg));
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin: var(--space-4) 0;
  }
  .crisis-title {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--danger);
    margin-bottom: var(--space-2);
  }
  .crisis-desc {
    font-size: var(--text-sm);
    color: var(--text);
    margin-bottom: var(--space-4);
  }
  .crisis-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .crisis-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }
  .crisis-label { font-size: var(--text-base); color: var(--text); }
  .crisis-tel {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--danger);
    text-decoration: none;
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 var(--space-3);
  }
</style>
