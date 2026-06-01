import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CrisisResources from '../../src/components/assess/CrisisResources.svelte';

describe('CrisisResources', () => {
  it('顯示台灣危機求助資源電話', () => {
    const { getByText, container } = render(CrisisResources, { props: { visible: true } });
    expect(getByText(/1925/)).toBeTruthy();
    expect(getByText(/1995/)).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('visible=false 時不渲染內容', () => {
    const { container } = render(CrisisResources, { props: { visible: false } });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
