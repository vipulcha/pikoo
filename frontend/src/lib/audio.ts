// ============================================
// Pikoo - Audio Utilities (Web Audio API)
// ============================================

// Audio context singleton
let audioContext: AudioContext | null = null;
let noiseNode: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Generate noise buffer
function generateNoiseBuffer(type: "white" | "brown" | "pink", duration: number = 2): AudioBuffer {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "white") {
    // White noise: random values
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === "brown") {
    // Brown noise: integrated white noise (random walk)
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Boost volume
    }
  } else if (type === "pink") {
    // Pink noise: using Paul Kellet's refined method
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // Normalize
      b6 = white * 0.115926;
    }
  }

  return buffer;
}

// Start playing noise
export function startNoise(type: "white" | "brown" | "pink", volume: number = 0.5): void {
  stopNoise(); // Stop any existing noise
  
  const ctx = getAudioContext();
  
  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  
  const buffer = generateNoiseBuffer(type);
  
  noiseNode = ctx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;
  
  gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  
  noiseNode.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  noiseNode.start();
}

// Stop playing noise
export function stopNoise(): void {
  if (noiseNode) {
    try {
      noiseNode.stop();
      noiseNode.disconnect();
    } catch (e) {
      // Ignore errors if already stopped
    }
    noiseNode = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}

// Set noise volume
export function setNoiseVolume(volume: number): void {
  if (gainNode) {
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}

// Check if noise is playing
export function isNoisePlaying(): boolean {
  return noiseNode !== null;
}

// Sound types configuration
export const SOUND_OPTIONS = [
  { id: "off", label: "Off", icon: "🔇", type: "none" },
  { id: "white", label: "White Noise", icon: "📻", type: "noise" },
  { id: "brown", label: "Brown Noise", icon: "🟤", type: "noise" },
  { id: "pink", label: "Pink Noise", icon: "🩷", type: "noise" },
  { id: "rain", label: "Rain", icon: "🌧️", type: "file" },
  { id: "cafe", label: "Café", icon: "☕", type: "file" },
  { id: "lofi", label: "Lo-fi", icon: "🎵", type: "file" },
] as const;

export type SoundId = typeof SOUND_OPTIONS[number]["id"];

// Get sound file URL
export function getSoundFileUrl(soundId: string): string {
  return `/sounds/${soundId}.mp3`;
}

