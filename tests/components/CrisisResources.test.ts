import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CrisisResources from '../../src/components/assess/CrisisResources.svelte';

describe('CrisisResources', () => {
  it('visible=true：顯示具名危機區域與三條求助專線 tel 連結', () => {
    const { container } = render(CrisisResources, { props: { visible: true } });
    const region = container.querySelector('[role="region"][aria-label="危機求助資源"]');
    expect(region).toBeTruthy();
    expect(container.querySelector('a[href="tel:1925"]')).toBeTruthy();
    expect(container.querySelector('a[href="tel:1995"]')).toBeTruthy();
    expect(container.querySelector('a[href="tel:119"]')).toBeTruthy();
  });

  it('每條 tel 連結帶可讀 aria-label（含服務名與號碼）', () => {
    const { container } = render(CrisisResources, { props: { visible: true } });
    const link = container.querySelector('a[href="tel:1925"]');
    expect(link?.getAttribute('aria-label')).toMatch(/1925/);
    expect(link?.getAttribute('aria-label')).toMatch(/安心專線/);
  });

  it('visible=false：不渲染危機區域', () => {
    const { container } = render(CrisisResources, { props: { visible: false } });
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('預設 props（未傳 visible）：不渲染（安全預設）', () => {
    const { container } = render(CrisisResources, {});
    expect(container.querySelector('[role="region"]')).toBeNull();
  });
});
