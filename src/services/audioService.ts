/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import lamejsUrl from 'lamejs/lame.min.js?url';

/**
 * Service to extract and compress audio from video files purely in the browser.
 * This helps avoid "Out of Memory" errors by sending small audio files to Gemini instead of large video files.
 */

async function ensureLameLoaded(): Promise<void> {
  if ((window as any).lamejs) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = lamejsUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load lamejs"));
    document.head.appendChild(script);
  });
}

export async function extractAudio(file: File): Promise<Blob> {
  await ensureLameLoaded();
  const lamejs = (window as any).lamejs;
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        // Decode the audio from the video file
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Downsample to 22kHz mono — tốt hơn 16kHz cho timestamp accuracy
        const targetSampleRate = 22050;
        const offlineContext = new OfflineAudioContext(
          1, // mono
          Math.ceil(audioBuffer.duration * targetSampleRate),
          targetSampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        const renderedBuffer = await offlineContext.startRendering();
        
        // Encode as MP3
        const mp3Blob = bufferToMp3(renderedBuffer, lamejs);
        resolve(mp3Blob);
      } catch (error) {
        reject(error);
      }
    };
    fileReader.onerror = () => reject(new Error("Failed to read file"));
    fileReader.readAsArrayBuffer(file);
  });
}

function bufferToMp3(buffer: AudioBuffer, lamejs: any): Blob {
  const channels = 1; // Mono
  const sampleRate = buffer.sampleRate;
  const kbps = 128; // Standard quality for speech
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Int8Array[] = [];

  const rawData = buffer.getChannelData(0);
  const samples = new Int16Array(rawData.length);
  
  // Convert float samples to 16-bit PCM
  for (let i = 0; i < rawData.length; i++) {
    const s = Math.max(-1, Math.min(1, rawData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const sampleBlockSize = 1152; // Lame block size
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const finalMp3buf = mp3encoder.flush();
  if (finalMp3buf.length > 0) {
    mp3Data.push(finalMp3buf);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}
