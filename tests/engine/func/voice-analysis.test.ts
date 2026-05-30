import { describe, it, expect } from 'vitest';
import { analyzeVoiceFromEvents } from '../../src/engine/cdsa/voice-analysis';

/**
 * `analyzeVoiceFromEvents` is the event-only fallback used when no audio
 * Blob is available (e.g. browser denied mic, or analyzer ran on cached
 * events). It returns aggregates over voice_end and voice_skip events.
 *
 * The audio-Blob path (`analyzeAudioBlob`, `analyzeVoiceFull`) is not
 * covered here — it requires AudioContext which jsdom does not provide.
 * That path is exercised in the browser-side flow only.
 */
describe('analyzeVoiceFromEvents', () => {
  it('returns zeroed metrics when given no events', () => {
    const m = analyzeVoiceFromEvents([]);
    expect(m.voiceDurationTotal).toBe(0);
    expect(m.fluencyPauseCount).toBe(0);
    expect(m.speechRatio).toBe(0);
    // Audio-only fields stay null in the event-only fallback
    expect(m.pitchMean).toBeNull();
    expect(m.mfccMean).toBeNull();
  });

  it('sums voice_end durations into voiceDurationTotal', () => {
    const m = analyzeVoiceFromEvents([
      { eventType: 'voice_end', data: { duration: 2.3 } },
      { eventType: 'voice_end', data: { duration: 1.5 } },
      { eventType: 'voice_end', data: { duration: 0.7 } },
    ]);
    expect(m.voiceDurationTotal).toBeCloseTo(4.5, 5);
  });

  it('counts voice_skip events as pauses, regardless of duration data', () => {
    const m = analyzeVoiceFromEvents([
      { eventType: 'voice_skip', data: {} },
      { eventType: 'voice_skip', data: {} },
      { eventType: 'voice_end', data: { duration: 1.0 } },
    ]);
    expect(m.fluencyPauseCount).toBe(2);
    expect(m.voiceDurationTotal).toBe(1.0);
  });

  it('ignores non-numeric duration values defensively', () => {
    const m = analyzeVoiceFromEvents([
      { eventType: 'voice_end', data: { duration: 1.2 } },
      { eventType: 'voice_end', data: { duration: 'broken' } }, // type pollution
      { eventType: 'voice_end', data: { duration: null } },
      { eventType: 'voice_end', data: {} }, // missing
      { eventType: 'voice_end', data: { duration: 0.8 } },
    ]);
    expect(m.voiceDurationTotal).toBeCloseTo(2.0, 5);
  });

  it('sets speechRatio to 0.6 when there is any voiced duration, else 0', () => {
    expect(analyzeVoiceFromEvents([]).speechRatio).toBe(0);
    expect(analyzeVoiceFromEvents([
      { eventType: 'voice_end', data: { duration: 0.1 } },
    ]).speechRatio).toBe(0.6);
  });

  it('ignores events of unrelated types', () => {
    const m = analyzeVoiceFromEvents([
      { eventType: 'voice_start', data: {} },
      { eventType: 'mic_permission_granted', data: {} },
      { eventType: 'voice_end', data: { duration: 2.0 } },
    ]);
    expect(m.voiceDurationTotal).toBe(2.0);
    expect(m.fluencyPauseCount).toBe(0);
  });
});
