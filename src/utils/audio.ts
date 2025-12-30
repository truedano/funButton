// Simple synthesized click sound to mimic a mechanical switch
let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
};

/**
 * Ensures the AudioContext is running. Must be called after a user gesture.
 */
export const ensureAudioContextStarted = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
};

export const playClickSound = async () => {
    try {
        await ensureAudioContextStarted();
        const ctx = getAudioContext();
        const t = ctx.currentTime;

        // Oscillator for the "click" tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // High frequency "click"
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

        // Envelope: sharp attack, fast decay
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.start(t);
        osc.stop(t + 0.05);

        // Optional: Add a second lower oscillator for "body" (thock)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(200, t);
        osc2.frequency.exponentialRampToValueAtTime(50, t + 0.05);

        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.1, t + 0.001);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc2.start(t);
        osc2.stop(t + 0.05);

    } catch (e) {
        console.error("Audio context error:", e);
    }
};

export const playKeyboardSound = async () => {
    try {
        await ensureAudioContextStarted();
        const ctx = getAudioContext();
        const t = ctx.currentTime;

        // Part 1: High-frequency click (shorter, sharper)
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'sine';
        clickOsc.frequency.setValueAtTime(1500, t);
        clickOsc.frequency.exponentialRampToValueAtTime(800, t + 0.01);
        clickGain.gain.setValueAtTime(0.2, t);
        clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01);
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(t);
        clickOsc.stop(t + 0.01);

        // Part 2: Mid-frequency "clack"
        const clackOsc = ctx.createOscillator();
        const clackGain = ctx.createGain();
        clackOsc.type = 'triangle';
        clackOsc.frequency.setValueAtTime(400, t);
        clackOsc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
        clackGain.gain.setValueAtTime(0.15, t);
        clackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        clackOsc.connect(clackGain);
        clackGain.connect(ctx.destination);
        clackOsc.start(t);
        clackOsc.stop(t + 0.04);

        // Part 3: Noise for mechanical friction feel
        const noiseLength = ctx.sampleRate * 0.04;
        const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.setValueAtTime(2000, t);

        noiseSource.connect(lpFilter);
        lpFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noiseGain.gain.setValueAtTime(0.04, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

        noiseSource.start(t);
        noiseSource.stop(t + 0.04);

    } catch (e) {
        console.error("Audio context error:", e);
    }
};

/**
 * Plays an AudioBuffer with low latency and overlapping support.
 */
export const playBuffer = async (buffer: AudioBuffer, volume: number = 1) => {
    await ensureAudioContextStarted();
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0);
    return source;
};

/**
 * Decodes an arrayBuffer into an AudioBuffer.
 */
export const decodeAudio = async (arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
    const ctx = getAudioContext();
    return await ctx.decodeAudioData(arrayBuffer);
};

/**
 * Trims silence from start and end and normalizes the volume.
 */
export const trimAndNormalize = (buffer: AudioBuffer, threshold: number = 0.01): AudioBuffer => {
    const channelData = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        channelData.push(buffer.getChannelData(c));
    }

    let start = buffer.length;
    let end = 0;

    // Find first and last samples above threshold across all channels
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = channelData[c];
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) > threshold) {
                if (i < start) start = i;
                break;
            }
        }
        for (let i = data.length - 1; i >= 0; i--) {
            if (Math.abs(data[i]) > threshold) {
                if (i > end) end = i;
                break;
            }
        }
    }

    // Edge case: entire buffer is silent
    if (start >= end) return buffer;

    // Pad slightly (0.05s) to avoid clicks or chopping off transients
    const pad = Math.floor(buffer.sampleRate * 0.05);
    start = Math.max(0, start - pad);
    end = Math.min(buffer.length - 1, end + pad);

    const newLength = end - start + 1;
    const ctx = getAudioContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

    // Copy data and find peak for normalization
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const source = channelData[c].subarray(start, end + 1);
        const destination = newBuffer.getChannelData(c);
        destination.set(source);
        for (let i = 0; i < source.length; i++) {
            const val = Math.abs(source[i]);
            if (val > peak) peak = val;
        }
    }

    // Normalize if needed
    if (peak > 0 && peak < 0.95) {
        const factor = 0.95 / peak;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = newBuffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) {
                data[i] *= factor;
            }
        }
    }

    return newBuffer;
};

/**
 * Simple WAV encoder for AudioBuffer.
 */
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = buffer.getChannelData(channel)[i];
            const clamped = Math.max(-1, Math.min(1, sample));
            const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
            view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
};
