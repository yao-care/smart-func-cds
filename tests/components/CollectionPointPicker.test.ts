import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { TriageResult } from '../../src/engine/func/triage';

// Mock 上傳發起與持久化，攔截呼叫順序與引數（vi.hoisted 供 hoisted 的 vi.mock 取用）
const { setTriageResult, startGcmUpload } = vi.hoisted(() => ({
  setTriageResult: vi.fn(async () => {}),
  startGcmUpload: vi.fn(async () => {}),
}));
vi.mock('$lib/db/assessments', () => ({ setTriageResult }));
vi.mock('$lib/fhir/gcm-submit', () => ({ startGcmUpload }));

import CollectionPointPicker from '../../src/components/assess/CollectionPointPicker.svelte';

const triageResult = {
  category: 'observe',
  confidence: 0.8,
  summary: 's',
  flaggedDomains: [],
  domainScores: [{ domain: 'vitality', score: 55, band: 'moderate' }],
} as unknown as TriageResult;

describe('CollectionPointPicker', () => {
  beforeEach(() => {
    setTriageResult.mockClear();
    startGcmUpload.mockClear();
    sessionStorage.clear();
  });

  it('GCM 全空白暱稱：guard 擋下，不持久化也不發起上傳', async () => {
    render(CollectionPointPicker, { assessmentId: 'a1', triageResult });
    await fireEvent.click(screen.getByText('GCM 預防醫學發展協會'));
    // 全空白可通過 input 的 required，但被元件的 trim() guard 擋下
    await fireEvent.input(screen.getByLabelText(/暱稱/), { target: { value: '   ' } });
    await fireEvent.click(screen.getByRole('button', { name: '上傳到 GCM' }));
    expect(screen.getByText('請輸入暱稱')).toBeTruthy();
    expect(startGcmUpload).not.toHaveBeenCalled();
    expect(setTriageResult).not.toHaveBeenCalled();
  });

  it('GCM 有暱稱：先持久化 triageResult 再發起上傳', async () => {
    render(CollectionPointPicker, { assessmentId: 'a1', triageResult });
    await fireEvent.click(screen.getByText('GCM 預防醫學發展協會'));
    await fireEvent.input(screen.getByLabelText(/暱稱/), { target: { value: 'Amy' } });
    await fireEvent.click(screen.getByRole('button', { name: '上傳到 GCM' }));
    expect(setTriageResult).toHaveBeenCalledWith('a1', expect.objectContaining({ category: 'observe' }));
    expect(startGcmUpload).toHaveBeenCalledTimes(1);
    const [redirectUri, input] = startGcmUpload.mock.calls[0] as [string, { nickname: string }];
    expect(redirectUri).toMatch(/\/launch\/$/);
    expect(input.nickname).toBe('Amy');
  });

  it('醫院：持久化後寫入 fhir.flow 並切換到 StandaloneLaunch', async () => {
    render(CollectionPointPicker, { assessmentId: 'a1', triageResult });
    await fireEvent.click(screen.getByText('醫院 FHIR Server'));
    expect(setTriageResult).toHaveBeenCalledWith('a1', expect.objectContaining({ category: 'observe' }));
    const flow = JSON.parse(sessionStorage.getItem('fhir.flow')!);
    expect(flow.assessmentId).toBe('a1');
  });
});
