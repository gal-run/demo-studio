import { spawn } from 'child_process';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { z } from 'zod';

const RecordingConfigSchema = z.object({
  output: z.string().default('output.mp4'),
  fps: z.number().min(1).max(60).default(30),
  resolution: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080)
  }).default({ width: 1920, height: 1080 }),
  captureAudio: z.boolean().default(true),
  captureMicrophone: z.boolean().default(false),
  region: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional()
});

type RecordingConfig = z.infer<typeof RecordingConfigSchema>;

interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  outputDir: string;
  framesDir: string;
  config: RecordingConfig;
}

export class Recorder {
  private state: RecordingState;
  private ffmpegProcess: ReturnType<typeof spawn> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(config: Partial<RecordingConfig> = {}) {
    this.state = {
      isRecording: false,
      startTime: null,
      outputDir: '',
      framesDir: '',
      config: RecordingConfigSchema.parse(config)
    };
  }

  async initialize(): Promise<void> {
    this.state.outputDir = join(tmpdir(), `demo-studio-${Date.now()}`);
    this.state.framesDir = join(this.state.outputDir, 'frames');
    await mkdir(this.state.framesDir, { recursive: true });
    await mkdir(join(this.state.outputDir, 'audio'), { recursive: true });
  }

  async startRecording(): Promise<void> {
    if (this.state.isRecording) {
      throw new Error('Recording already in progress');
    }

    await this.initialize();
    
    const { fps, resolution, captureAudio, region } = this.state.config;
    const args = this.buildFFmpegArgs(fps, resolution, region, captureAudio);
    
    this.ffmpegProcess = spawn('ffmpeg', args);
    this.state.isRecording = true;
    this.state.startTime = Date.now();
    
    this.emit('started', { timestamp: this.state.startTime });
    
    this.ffmpegProcess.stderr?.on('data', (data) => {
      this.emit('log', { message: data.toString() });
    });

    this.ffmpegProcess.on('error', (error) => {
      this.emit('error', { error });
      this.state.isRecording = false;
    });
  }

  private buildFFmpegArgs(
    fps: number,
    resolution: { width: number; height: number },
    region?: { x: number; y: number; width: number; height: number },
    captureAudio: boolean = true
  ): string[] {
    const args: string[] = ['-y'];
    
    if (process.platform === 'darwin') {
      args.push('-f', 'avfoundation');
      if (region) {
        args.push('-i', `1:${region.x},${region.y}`);
      } else {
        args.push('-i', '1');
      }
    } else if (process.platform === 'linux') {
      args.push('-f', 'x11grab');
      args.push('-video_size', `${resolution.width}x${resolution.height}`);
      args.push('-i', region ? `:0.0+${region.x},${region.y}` : ':0.0');
    }
    
    args.push('-r', String(fps));
    args.push('-pix_fmt', 'yuv420p');
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast');
    args.push('-crf', '18');
    
    if (captureAudio) {
      args.push('-c:a', 'aac');
      args.push('-b:a', '192k');
    }
    
    args.push(this.state.config.output);
    
    return args.map(String);
  }

  async stopRecording(): Promise<string> {
    if (!this.state.isRecording || !this.ffmpegProcess) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      this.ffmpegProcess!.on('close', (code) => {
        this.state.isRecording = false;
        const duration = Date.now() - (this.state.startTime || 0);
        this.emit('stopped', { 
          outputPath: this.state.config.output,
          duration 
        });
        resolve(this.state.config.output);
      });

      this.ffmpegProcess!.stdin?.write('q');
      this.ffmpegProcess!.stdin?.end();
    });
  }

  async pauseRecording(): Promise<void> {
    if (!this.state.isRecording) {
      throw new Error('No recording in progress');
    }
    this.ffmpegProcess?.kill('SIGSTOP');
    this.emit('paused', {});
  }

  async resumeRecording(): Promise<void> {
    this.ffmpegProcess?.kill('SIGCONT');
    this.emit('resumed', {});
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  private emit(event: string, data: object): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(data));
    }
  }

  getState(): RecordingState {
    return { ...this.state };
  }

  isRecording(): boolean {
    return this.state.isRecording;
  }
}

export { RecordingConfigSchema, type RecordingConfig };
