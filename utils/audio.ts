import { Blob } from '@google/genai';

// Convert Float32Array (from AudioContext) to Int16Array (PCM)
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

// Convert Int16 PCM bytes to Float32 AudioBuffer
export function int16ToAudioBuffer(
  int16Data: Int16Array,
  ctx: AudioContext,
  sampleRate: number
): AudioBuffer {
  const buffer = ctx.createBuffer(1, int16Data.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < int16Data.length; i++) {
    channelData[i] = int16Data[i] / 32768.0;
  }
  return buffer;
}

// Custom base64 encode for Uint8Array (to avoid depending on external libs)
export function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Custom base64 decode to Uint8Array
export function base64Decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Create a Blob object compatible with GoogleGenAI Live API
export function createPcmBlob(data: Float32Array): Blob {
  const int16 = float32ToInt16(data);
  return {
    data: base64Encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function decodeAudioData(
    base64String: string,
    ctx: AudioContext,
    sampleRate: number = 24000
): Promise<AudioBuffer> {
    const bytes = base64Decode(base64String);
    const int16 = new Int16Array(bytes.buffer);
    return int16ToAudioBuffer(int16, ctx, sampleRate);
}
