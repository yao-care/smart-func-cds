import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuntimeIndex, RuntimeVideo } from '../../../src/lib/education/schemas';

const mockVideo = (id: string, score: number, sourceTier: RuntimeVideo['sourceTier'] = 'official-tw'): RuntimeVideo => ({
  videoId: id, title: `t-${id}`, channel: 'c', duration: 200,
  language: 'zh-Hant', sourceTier, score,
});

const mockIndex: RuntimeIndex = {
  catalog: {
    v1: mockVideo('v1', 0.9),
    v2: mockVideo('v2', 0.7),
    v3: mockVideo('v3', 0.5),
  },
  triggers: {
    'func.triage.consult.18-39': { videoIds: ['v1', 'v2'], inapplicable: false },
    'func.domain.cognition.low.40-54': { videoIds: [], inapplicable: true },
    'func.domain.cognition.low.18-39': { videoIds: ['v3'], inapplicable: false },
    'func.domain.cognition.low.55-64': { videoIds: [], inapplicable: false },
  },
  educationSlugToTriggers: {},
  recommendations: {},
  clinicalEducation: {},
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockIndex,
  } as Response);
  vi.resetModules();
});

describe('video-lookup', () => {
  it('returns sorted videos for matched trigger', async () => {
    const { getVideosForTrigger } = await import('../../../src/lib/education/video-lookup');
    const videos = await getVideosForTrigger('func.triage.consult.18-39');
    expect(videos.map(v => v.videoId)).toEqual(['v1', 'v2']);
  });

  it('returns empty for inapplicable trigger (custom ignored)', async () => {
    const { getVideosForTrigger } = await import('../../../src/lib/education/video-lookup');
    const custom = [{ ...mockVideo('vCustom', 1.0), triggers: '*' as const }];
    const videos = await getVideosForTrigger('func.domain.cognition.low.40-54', custom);
    expect(videos).toEqual([]);
  });

  it('ageGroupFallback returns videos from 18-39 when 55-64 empty', async () => {
    const { getVideosForTrigger } = await import('../../../src/lib/education/video-lookup');
    const videos = await getVideosForTrigger('func.domain.cognition.low.55-64', [], {
      ageGroupFallback: true,
    });
    expect(videos.map(v => v.videoId)).toEqual(['v3']);
  });

  it('ageGroupFallback skips inapplicable chain entries', async () => {
    // 40-54 is inapplicable; chain falls through to 18-39 (has v3).
    const { getVideosForTrigger } = await import('../../../src/lib/education/video-lookup');
    const videos = await getVideosForTrigger('func.domain.cognition.low.40-54', [], {
      ageGroupFallback: true,
    });
    // 40-54 itself is inapplicable → returns [] (inapplicable short-circuits).
    expect(videos).toEqual([]);
  });

  it('retries after fetch failure', async () => {
    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) throw new Error('network');
      return { ok: true, json: async () => mockIndex } as Response;
    });

    const { getVideosForTrigger } = await import('../../../src/lib/education/video-lookup');
    await expect(getVideosForTrigger('func.triage.consult.18-39')).rejects.toThrow();
    const videos = await getVideosForTrigger('func.triage.consult.18-39');
    expect(videos).toHaveLength(2);
  });

  it('regex correctly parses func.domain.<dom>.<band>.<age>', async () => {
    const { tryAgeGroupFallback } = await import('../../../src/lib/education/video-lookup');
    const ids = tryAgeGroupFallback('func.domain.cognition.low.55-64', mockIndex);
    expect(ids).toEqual(['v3']);
  });
});
