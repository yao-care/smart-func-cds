import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RadarChart from '../../src/components/assess/RadarChart.svelte';

describe('RadarChart', () => {
  it('renders default title and legend', () => {
    render(RadarChart, { data: [{ domain: 'cognition', score: 80, band: 'high' }] });
    expect(screen.getByText('五大內在能力面向')).toBeTruthy();
    expect(screen.getByText(/100 = 功能良好/)).toBeTruthy();
  });

  it('renders custom title', () => {
    render(RadarChart, {
      data: [{ domain: 'cognition', score: 80, band: 'high' }],
      title: '自訂標題',
    });
    expect(screen.getByText('自訂標題')).toBeTruthy();
  });

  it('hides legend when showLegend=false', () => {
    render(RadarChart, {
      data: [{ domain: 'cognition', score: 80, band: 'high' }],
      showLegend: false,
    });
    expect(screen.queryByText(/100 = 功能良好/)).toBeNull();
  });

  it('renders all 5 IC domain labels and their scores', () => {
    render(RadarChart, {
      data: [
        { domain: 'vitality', score: 90, band: 'high' },
        { domain: 'locomotion', score: 60, band: 'moderate' },
        { domain: 'cognition', score: 100, band: 'high' },
        { domain: 'psychological', score: 30, band: 'low' },
        { domain: 'sensory', score: 75, band: 'high' },
      ],
    });
    expect(screen.getByText('身體活力')).toBeTruthy();
    expect(screen.getByText('行動功能')).toBeTruthy();
    expect(screen.getByText('認知功能')).toBeTruthy();
    expect(screen.getByText('心理功能')).toBeTruthy();
    expect(screen.getByText('感官功能')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('shows 未測 for an unmeasured (null-score) domain', () => {
    render(RadarChart, {
      data: [
        { domain: 'vitality', score: 90, band: 'high' },
        { domain: 'cognition', score: null, band: null },
      ],
    });
    expect(screen.getByText('未測')).toBeTruthy();
  });
});
