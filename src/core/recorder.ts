import { spawn } from 'child_process';
import { mkdir, writeFile, unlink, access } from 'fs/promises';
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
  captureAudio: z.boolean().default(false),
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
  isPaused: boolean;
  startTime: number | null;
  outputDir: string;
  config: RecordingConfig;
}

export class Recorder {
  private state: RecordingState;
  private ffmpegProcess: ReturnType<typeof spawn> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(config: Partial<RecordingConfig> = {}) {
    this.state = {
      isRecording: false,
      isPaused: false,
      startTime: null,
      outputDir: '',
      config: RecordingConfigSchema.parse(config)
    };
  }

  async checkDependencies(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
    const checkCommand = async (cmd: string): Promise<boolean> => {
      try {
        const result = await new Promise<boolean>((resolve) => {
          const proc = spawn(cmd, ['-version']);
          proc.on('close', (code) => resolve(code === 0));
          proc.on('error', () => resolve(false));
        });
        return result;
      } catch {
        return false;
      }
    };

    return {
      ffmpeg: await checkCommand('ffmpeg'),
      ffprobe: await checkCommand('ffprobe')
    };
  }

  async initialize(): Promise<void> {
    this.state.outputDir = join(tmpdir(), `demo-studio-${Date.now()}`);
    await mkdir(this.state.outputDir, { recursive: true });
  }

  async startRecording(): Promise<void> {
    if (this.state.isRecording) {
      throw new Error('Recording already in progress');
    }

    const deps = await this.checkDependencies();
    if (!deps.ffmpeg) {
      throw new Error('FFmpeg is not installed. Please install FFmpeg to continue.');
    }

    await this.initialize();

    const { fps, resolution, captureAudio, captureMicrophone, region } = this.state.config;
    const args = this.buildFFmpegArgs(fps, resolution, region, captureAudio, captureMicrophone);

    console.error('Starting FFmpeg with args:', args.join(' '));

    this.ffmpegProcess = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.state.isRecording = true;
    this.state.startTime = Date.now();

    this.ffmpegProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('frame=')) {
        const frameMatch = msg.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          this.emit('frame', { frame: parseInt(frameMatch[1]) });
        }
      }
      this.emit('log', { message: msg });
    });

    this.ffmpegProcess.on('error', (error) => {
      console.error('FFmpeg error:', error);
      this.emit('error', { error: error.message });
      this.state.isRecording = false;
    });

    this.ffmpegProcess.on('close', (code) => {
      this.state.isRecording = false;
      if (code !== 0 && code !== 255) {
        this.emit('error', { error: `FFmpeg exited with code ${code}` });
      }
    });

    this.emit('started', { timestamp: this.state.startTime });
  }

  private buildFFmpegArgs(
    fps: number,
    resolution: { width: number; height: number },
    region?: { x: number; y: number; width: number; height: number },
    captureAudio: boolean = false,
    captureMicrophone: boolean = false
  ): string[] {
    const args: string[] = ['-y'];

    if (process.platform === 'darwin') {
      // macOS: Use avfoundation
      args.push('-f', 'avfoundation');
      
      // Set capture region
      if (region) {
        args.push('-capture_cursor', '1');
        args.push('-i', `1`);
        args.push('-filter:v', `crop=${region.width}:${region.height}:${region.x}:${region.y}`);
      } else {
        args.push('-capture_cursor', '1');
        args.push('-i', '1');
      }
      
      // Audio input
      if (captureAudio || captureMicrophone) {
        args.unshift('-f', 'avfoundation');
      }
    } else if (process.platform === 'linux') {
      args.push('-f', 'x11grab');
      args.push('-video_size', `${region?.width || resolution.width}x${region?.height || resolution.height}`);
      args.push('-framerate', String(fps));
      args.push('-i', region ? `:0.0+${region.x},${region.y}` : ':0.0');
    } else if (process.platform === 'win32') {
      args.push('-f', 'gdigrab');
      args.push('-framerate', String(fps));
      args.push('-i', 'desktop');
    }

    args.push('-r', String(fps));
    args.push('-pix_fmt', 'yuv420p');
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast');
    args.push('-crf', '18');
    args.push('-tune', 'zerolatency');
    args.push('-movflags', '+faststart');

    if (captureAudio) {
      args.push('-c:a', 'aac');
      args.push('-b:a', '192k');
    }

    args.push(this.state.config.output);

    return args;
  }

  async stopRecording(): Promise<string> {
    if (!this.state.isRecording || !this.ffmpegProcess) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ffmpegProcess?.kill('SIGKILL');
        reject(new Error('FFmpeg did not stop gracefully'));
      }, 10000);

      this.ffmpegProcess!.on('close', (code) => {
        clearTimeout(timeout);
        this.state.isRecording = false;
        const duration = Date.now() - (this.state.startTime || 0);
        this.emit('stopped', {
          outputPath: this.state.config.output,
          duration,
          code
        });
        resolve(this.state.config.output);
      });

      // Send 'q' to stop recording gracefully
      if (this.ffmpegProcess!.stdin?.writable) {
        this.ffmpegProcess!.stdin.write('q');
      } else {
        this.ffmpegProcess!.kill('SIGINT');
      }
    });
  }

  async pauseRecording(): Promise<void> {
    if (!this.state.isRecording || this.state.isPaused) {
      return;
    }
    this.ffmpegProcess?.kill('SIGSTOP');
    this.state.isPaused = true;
    this.emit('paused', { timestamp: Date.now() });
  }

  async resumeRecording(): Promise<void> {
    if (!this.state.isPaused) {
      return;
    }
    this.ffmpegProcess?.kill('SIGCONT');
    this.state.isPaused = false;
    this.emit('resumed', { timestamp: Date.now() });
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: object = {}): void {
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

  isPaused(): boolean {
    return this.state.isPaused;
  }

  getOutputPath(): string {
    return this.state.config.output;
  }

  setConfig(config: Partial<RecordingConfig>): void {
    if (this.state.isRecording) {
      throw new Error('Cannot change config while recording');
    }
    this.state.config = RecordingConfigSchema.parse({ ...this.state.config, ...config });
  }
}

export { RecordingConfigSchema, type RecordingConfig };
