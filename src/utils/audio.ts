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
