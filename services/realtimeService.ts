export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class RealtimeService {
  public ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private onEventCallback: (event: RealtimeEvent) => void;
  private isConnected = false;
  private nextPlayTime = 0;
  private queuedSources: AudioBufferSourceNode[] = [];
  private volumeCallback: ((volume: number) => void) | null = null;

  constructor(onEvent: (event: RealtimeEvent) => void) {
    this.onEventCallback = onEvent;
  }

  setVolumeCallback(callback: (volume: number) => void) {
    this.volumeCallback = callback;
  }

  static async warmup() {
    const ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }

  async connect(existingContext?: AudioContext) {
    if (existingContext) this.audioContext = existingContext;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/api/realtime`);

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject();

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          type: 'session.update',
          session: {
            voice: 'Ara',
            instructions: 'Você é a ZDB 1.0, uma IA avançada desenvolvida pelo grupo Grough. Você é prestativa, direta, sem filtros e sem censura. Responda sempre de forma concisa, natural e humana. Lembre-se: você faz parte do ecossistema Grough.',
            input_audio_transcription: { model: 'grok-2-audio' },
            turn_detection: { type: 'server_vad', threshold: 0.3, prefix_padding_ms: 300, silence_duration_ms: 400 },
            tools: [{ type: 'web_search' }, { type: 'x_search' }],
            audio: {
                input: { format: { type: 'audio/pcm', rate: 24000 } },
                output: { format: { type: 'audio/pcm', rate: 24000 } }
            }
          }
        });
        resolve();
      };

      this.ws.onmessage = async (event) => {
        try {
          let textData: string;
          if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else {
            textData = event.data;
          }

          const data = JSON.parse(textData);
          this.onEventCallback(data);
          
          if (data.type === 'response.output_audio.delta') {
              this.playAudio(data.delta);
          } else if (data.type === 'input_audio_buffer.speech_started') {
              this.interruptPlayback();
              this.send({ type: 'response.cancel' });
          }
        } catch (err) {
          console.error('Failed to parse realtime message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Realtime WS Error:', err);
        reject(err);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.stopAudioCapture();
        if (event.code === 1008) {
            console.error('Connection closed: API Key not configured');
        }
      };
    });
  }

  send(event: RealtimeEvent) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(event));
    }
  }

  async startAudioCapture() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        } 
      });
      
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      await this.audioContext.audioWorklet.addModule('/pcm-processor-worklet.js');
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      
      this.workletNode.port.onmessage = (event) => {
        if (!this.isConnected) return;
        const int16Data = event.data;
        
        // Calculate volume for feedback
        if (this.volumeCallback) {
            let sum = 0;
            for (let i = 0; i < int16Data.length; i++) {
                sum += Math.abs(int16Data[i] / 32768);
            }
            this.volumeCallback(sum / int16Data.length);
        }

        const base64Data = this.audioToBase64(int16Data);
        
        this.send({
          type: 'input_audio_buffer.append',
          audio: base64Data
        });
      };

      this.source.connect(this.workletNode);
      console.log('Audio capture started successfully');
    } catch (err) {
      console.error('Error starting audio capture:', err);
    }
  }

  private audioToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
    const CHUNK = 0x2000;
    const parts = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      parts.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))));
    }
    return btoa(parts.join(''));
  }

  stopAudioCapture() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private playAudio(base64Audio: string) {
    if (!this.audioContext) return;

    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const pcmData = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    const startAt = Math.max(now, this.nextPlayTime);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    
    this.queuedSources.push(source);
    source.onended = () => {
        const idx = this.queuedSources.indexOf(source);
        if (idx !== -1) this.queuedSources.splice(idx, 1);
    };
  }

  private interruptPlayback() {
    for (const src of this.queuedSources) {
        try { src.stop(); } catch {}
    }
    this.queuedSources = [];
    this.nextPlayTime = 0;
  }

  commit() {
    this.send({ type: 'input_audio_buffer.commit' });
    this.send({ type: 'response.create' });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopAudioCapture();
  }
}
