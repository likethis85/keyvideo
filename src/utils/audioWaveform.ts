/**
 * Audio Waveform Extraction & Peak Cache Utility
 * Decodes audio via Web Audio API and generates normalized peak samples
 * for rich timeline waveform rendering.
 */

const waveformMemoryCache = new Map<string, number[]>();

export async function extractAudioWaveform(
  audioSrc: string,
  samplesPerSecond = 40
): Promise<number[]> {
  if (!audioSrc) return [];

  // 1. Check in-memory cache
  const cacheKey = `${audioSrc}_${samplesPerSecond}`;
  if (waveformMemoryCache.has(cacheKey)) {
    return waveformMemoryCache.get(cacheKey)!;
  }

  try {
    // 2. Fetch audio ArrayBuffer
    const response = await fetch(audioSrc);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching audio`);
    const arrayBuffer = await response.arrayBuffer();

    // 3. Decode audio with Web Audio API
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) throw new Error('AudioContext not supported in this browser');
    const audioCtx = new AudioCtxClass();

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const totalSamples = Math.max(20, Math.floor(duration * samplesPerSecond));

    // Get raw PCM samples from channel 0 (mono or left channel)
    const rawChannelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawChannelData.length / totalSamples);
    const peaks: number[] = new Array(totalSamples);

    let maxPeak = 0;
    for (let i = 0; i < totalSamples; i++) {
      const start = i * blockSize;
      let sum = 0;
      let count = 0;
      for (let j = 0; j < blockSize && start + j < rawChannelData.length; j += 4) {
        const val = Math.abs(rawChannelData[start + j]);
        sum += val * val;
        count++;
      }
      // Calculate RMS (Root-Mean-Square) for smooth acoustic visualization
      const rms = count > 0 ? Math.sqrt(sum / count) : 0;
      peaks[i] = rms;
      if (rms > maxPeak) maxPeak = rms;
    }

    // Close AudioContext to release hardware audio resources
    await audioCtx.close().catch(() => {});

    // 4. Normalize to [0.08, 1.0]
    const normalized = peaks.map(p => {
      if (maxPeak === 0) return 0.15;
      const ratio = p / maxPeak;
      // Boost subtle quiet parts and clamp
      return Math.min(1.0, Math.max(0.08, Math.pow(ratio, 0.75)));
    });

    waveformMemoryCache.set(cacheKey, normalized);
    return normalized;
  } catch (err) {
    console.warn('[Waveform] Fallback generation for audio:', audioSrc, err);
    // Fallback: Generate an aesthetically pleasing pseudo-rhythmic waveform pattern
    const fallbackCount = Math.max(60, samplesPerSecond * 15);
    const fallback: number[] = [];
    for (let i = 0; i < fallbackCount; i++) {
      const beat = Math.sin(i * 0.3) * 0.35 + Math.cos(i * 0.15) * 0.25;
      const noise = (Math.random() - 0.5) * 0.15;
      fallback.push(Math.min(1.0, Math.max(0.12, Math.abs(beat + 0.45 + noise))));
    }
    waveformMemoryCache.set(cacheKey, fallback);
    return fallback;
  }
}
