/**
 * @deprecated S1: not wired, S2 verbal fluency entry-point.
 *             Adult voice analysis 需重寫（早期音域 80-600Hz → 成人 prosody / verbal fluency）。
 */
export interface VoiceMetrics {
  pitchMean: number | null;
  pitchStd: number | null;
  intensityMean: number | null;
  intensityStd: number | null;
  speechRate: number | null;
  fluencyPauseCount: number;
  voiceLatencyMean: number | null;
  voiceDurationTotal: number;
  speechRatio: number;
  mfccMean: number[] | null;       // 13 MFCC coefficients mean
  spectralCentroid: number | null;
}

/**
 * Analyze audio blob using Web Audio API + Meyda.
 * Extracts pitch (via autocorrelation), intensity, MFCC, spectral features.
 */
export async function analyzeAudioBlob(audioBlob: Blob): Promise<Partial<VoiceMetrics>> {
  // Decode audio via Web Audio API (browser-only)
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0); // mono
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Dynamic import Meyda to avoid SSG issues
  const Meyda = (await import('meyda')).default;

  // Configure Meyda for offline extraction
  const frameSize = 2048;
  const hopSize = 512;
  const frames = Math.floor((channelData.length - frameSize) / hopSize);

  Meyda.bufferSize = frameSize;
  Meyda.sampleRate = sampleRate;
  Meyda.numberOfMFCCCoefficients = 13;

  const energies: number[] = [];
  const pitches: number[] = [];
  const mfccs: number[][] = [];
  const centroids: number[] = [];

  for (let i = 0; i < frames; i++) {
    const start = i * hopSize;
    const frame = channelData.slice(start, start + frameSize);

    // Use Meyda to extract features from this frame
    const features = Meyda.extract(
      ['rms', 'mfcc', 'spectralCentroid'],
      frame,
    );

    if (features) {
      // Energy / intensity (RMS)
      const rms = features.rms as number | undefined;
      if (typeof rms === 'number' && rms > 0) {
        energies.push(rms);
      }

      // MFCC
      const mfcc = features.mfcc as number[] | undefined;
      if (Array.isArray(mfcc)) {
        mfccs.push(mfcc);
      }

      // Spectral centroid
      const centroid = features.spectralCentroid as number | undefined;
      if (typeof centroid === 'number' && isFinite(centroid)) {
        centroids.push(centroid);
      }
    }

    // Pitch detection via autocorrelation (YIN-like)
    const pitch = detectPitch(frame, sampleRate);
    if (pitch !== null && pitch > 80 && pitch < 600) {
      pitches.push(pitch);
    }
  }

  await audioContext.close();

  // Compute aggregate metrics
  const mean = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const std = (arr: number[], m: number) =>
    arr.length > 1
      ? Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
      : 0;

  const pitchMean = pitches.length > 0 ? mean(pitches) : null;
  const pitchStd = pitches.length > 1 ? std(pitches, pitchMean!) : null;

  const intensityMean = energies.length > 0 ? mean(energies) : null;
  const intensityStd = energies.length > 1 ? std(energies, intensityMean!) : null;

  // MFCC mean: average each coefficient across frames
  let mfccMean: number[] | null = null;
  if (mfccs.length > 0) {
    const numCoeffs = mfccs[0].length;
    mfccMean = Array.from({ length: numCoeffs }, (_, j) =>
      mfccs.reduce((s, m) => s + (m[j] ?? 0), 0) / mfccs.length,
    );
  }

  const spectralCentroid = centroids.length > 0 ? mean(centroids) : null;

  // Voice Activity Detection: frames with energy above threshold
  const energyThreshold = intensityMean !== null ? intensityMean * 0.3 : 0.01;
  const voiceFrames = energies.filter(e => e > energyThreshold).length;
  const speechRatio = energies.length > 0 ? voiceFrames / energies.length : 0;

  // Pause detection: consecutive silent frames
  let pauseCount = 0;
  let inSilence = false;
  for (const e of energies) {
    if (e <= energyThreshold) {
      if (!inSilence) {
        pauseCount++;
        inSilence = true;
      }
    } else {
      inSilence = false;
    }
  }

  return {
    pitchMean,
    pitchStd,
    intensityMean,
    intensityStd,
    mfccMean,
    spectralCentroid,
    speechRatio,
    fluencyPauseCount: pauseCount,
    voiceDurationTotal: duration,
  };
}

/**
 * Simple pitch detection using autocorrelation (YIN-inspired).
 * Returns fundamental frequency in Hz, or null if no clear pitch detected.
 */
function detectPitch(frame: Float32Array, sampleRate: number): number | null {
  const minPeriod = Math.floor(sampleRate / 600); // max 600 Hz
  const maxPeriod = Math.floor(sampleRate / 80);  // min 80 Hz

  if (frame.length < maxPeriod * 2) return null;

  // Compute normalized autocorrelation to find best period
  let bestCorr = -1;
  let bestPeriod = 0;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < frame.length - period; i++) {
      sum += frame[i] * frame[i + period];
      count++;
    }
    const corr = count > 0 ? sum / count : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = period;
    }
  }

  // Require minimum correlation strength for a reliable pitch estimate
  if (bestCorr < 0.2 || bestPeriod === 0) return null;

  return sampleRate / bestPeriod;
}

/**
 * Analyze voice from recorded audio blobs + event metadata.
 * Combines Meyda-based audio analysis with event-based metrics.
 */
export async function analyzeVoiceFull(
  audioBlobs: Blob[],
  voiceEvents: Array<{ eventType: string; data: Record<string, unknown> }>,
): Promise<VoiceMetrics> {
  // Analyze all audio blobs and merge results
  let combinedMetrics: Partial<VoiceMetrics> = {};

  for (const blob of audioBlobs) {
    try {
      const metrics = await analyzeAudioBlob(blob);
      // Use first valid result for scalar fields; accumulate counts/durations
      combinedMetrics = {
        pitchMean: combinedMetrics.pitchMean ?? metrics.pitchMean,
        pitchStd: combinedMetrics.pitchStd ?? metrics.pitchStd,
        intensityMean: combinedMetrics.intensityMean ?? metrics.intensityMean,
        intensityStd: combinedMetrics.intensityStd ?? metrics.intensityStd,
        mfccMean: combinedMetrics.mfccMean ?? metrics.mfccMean,
        spectralCentroid: combinedMetrics.spectralCentroid ?? metrics.spectralCentroid,
        speechRatio: metrics.speechRatio ?? combinedMetrics.speechRatio ?? 0,
        fluencyPauseCount:
          (combinedMetrics.fluencyPauseCount ?? 0) + (metrics.fluencyPauseCount ?? 0),
        voiceDurationTotal:
          (combinedMetrics.voiceDurationTotal ?? 0) + (metrics.voiceDurationTotal ?? 0),
      };
    } catch {
      // Skip blobs that fail to decode (unsupported format, corrupted, etc.)
    }
  }

  // Fall back to event-based metrics where audio analysis produced nothing
  const skipCount = voiceEvents.filter(e => e.eventType === 'voice_skip').length;
  const endEvents = voiceEvents.filter(e => e.eventType === 'voice_end');
  const eventDurations = endEvents
    .map(e => e.data.duration as number)
    .filter((v): v is number => typeof v === 'number');

  return {
    pitchMean: combinedMetrics.pitchMean ?? null,
    pitchStd: combinedMetrics.pitchStd ?? null,
    intensityMean: combinedMetrics.intensityMean ?? null,
    intensityStd: combinedMetrics.intensityStd ?? null,
    speechRate: null, // Would need syllable detection
    fluencyPauseCount: combinedMetrics.fluencyPauseCount ?? skipCount,
    voiceLatencyMean: null, // Would need TTS-end to voice-start timing
    voiceDurationTotal:
      combinedMetrics.voiceDurationTotal ?? eventDurations.reduce((s, d) => s + d, 0),
    speechRatio: combinedMetrics.speechRatio ?? (combinedMetrics.voiceDurationTotal ? 0.6 : 0),
    mfccMean: combinedMetrics.mfccMean ?? null,
    spectralCentroid: combinedMetrics.spectralCentroid ?? null,
  };
}

/**
 * Analyze voice metrics from recorded audio events only (no audio data).
 * Kept for backward compatibility when audio blobs are not available.
 */
export function analyzeVoiceFromEvents(
  voiceEvents: Array<{ eventType: string; data: Record<string, unknown> }>,
): VoiceMetrics {
  const endEvents = voiceEvents.filter(e => e.eventType === 'voice_end');

  const durations = endEvents
    .map(e => e.data.duration as number)
    .filter((v): v is number => typeof v === 'number');

  const totalDuration = durations.reduce((s, d) => s + d, 0);
  const pauseCount = voiceEvents.filter(e => e.eventType === 'voice_skip').length;

  return {
    pitchMean: null,
    pitchStd: null,
    intensityMean: null,
    intensityStd: null,
    speechRate: null,
    fluencyPauseCount: pauseCount,
    voiceLatencyMean: null,
    voiceDurationTotal: totalDuration,
    speechRatio: totalDuration > 0 ? 0.6 : 0,
    mfccMean: null,
    spectralCentroid: null,
  };
}
