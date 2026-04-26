#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Recorder } from '../core/recorder.js';
import { VideoProcessor } from '../core/video-processor.js';
import { DemoScriptRunner } from '../core/demo-runner.js';
import { WindowDetector } from '../core/window-detector.js';
import { ScreenCapture } from '../core/screen-capture.js';
import { readFile, writeFile, access } from 'fs/promises';
import { join, basename } from 'path';

const program = new Command();

program
  .name('demo-studio')
  .description('AI-powered software demo video recorder')
  .version('0.1.0');

program
  .command('check')
  .description('Check system dependencies')
  .action(async () => {
    console.log(chalk.blue('Checking system dependencies...\n'));
    
    const recorder = new Recorder();
    const deps = await recorder.checkDependencies();
    
    console.log(`FFmpeg:  ${deps.ffmpeg ? chalk.green('✓ installed') : chalk.red('✗ not found')}`);
    console.log(`FFprobe: ${deps.ffprobe ? chalk.green('✓ installed') : chalk.red('✗ not found')}`);
    
    if (!deps.ffmpeg || !deps.ffprobe) {
      console.log(chalk.yellow('\nInstall FFmpeg:'));
      console.log('  macOS:   brew install ffmpeg');
      console.log('  Ubuntu:  sudo apt install ffmpeg');
      console.log('  Windows: choco install ffmpeg');
    }
    
    const processor = new VideoProcessor();
    
    console.log(`\nPlatform: ${process.platform}`);
    console.log(`Node.js:  ${process.version}`);
  });

program
  .command('record')
  .description('Start screen recording')
  .option('-o, --output <path>', 'Output file path', 'demo.mp4')
  .option('-f, --fps <number>', 'Frames per second', '30')
  .option('--audio', 'Enable audio capture')
  .option('--region <x,y,w,h>', 'Capture region')
  .action(async (options) => {
    let region: { x: number; y: number; width: number; height: number } | undefined;
    
    if (options.region) {
      const [x, y, w, h] = options.region.split(',').map(Number);
      region = { x, y, width: w, height: h };
      console.log(chalk.gray(`Recording region: ${x},${y} ${w}x${h}`));
    }

    const recorder = new Recorder({
      output: options.output,
      fps: parseInt(options.fps),
      captureAudio: options.audio || false,
      region
    });

    recorder.on('started', () => {
      console.log(chalk.green('✓ Recording started'));
      console.log(chalk.gray(`Output: ${options.output}`));
      console.log(chalk.yellow('\nPress Ctrl+C to stop'));
    });

    recorder.on('stopped', (data: any) => {
      console.log(chalk.green(`\n✓ Recording saved`));
      console.log(chalk.gray(`Duration: ${(data.duration / 1000).toFixed(2)}s`));
    });

    recorder.on('error', (data: any) => {
      console.error(chalk.red(`\nError: ${data.error}`));
    });

    try {
      await recorder.startRecording();
      
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nStopping recording...'));
        try {
          await recorder.stopRecording();
        } catch (e) {
          console.error(chalk.red('Failed to stop recording'));
        }
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('info <video>')
  .description('Get video information')
  .action(async (video) => {
    const processor = new VideoProcessor();
    
    try {
      const info = await processor.getVideoInfo(video);
      console.log(chalk.bold('\nVideo Information:\n'));
      console.log(`  Duration: ${info.duration.toFixed(2)}s`);
      console.log(`  Resolution: ${info.width}x${info.height}`);
      console.log(`  FPS: ${info.fps.toFixed(2)}`);
      console.log(`  Codec: ${info.codec}`);
      console.log(`  Bitrate: ${(info.bitrate / 1000).toFixed(0)} kbps`);
      console.log(`  Audio: ${info.hasAudio ? 'Yes' : 'No'}`);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('process <input>')
  .description('Process a video file')
  .option('-o, --output <path>', 'Output file path')
  .option('-s, --start <seconds>', 'Start time', parseFloat)
  .option('-e, --end <seconds>', 'End time', parseFloat)
  .option('-r, --resolution <WxH>', 'Output resolution')
  .option('-f, --fps <number>', 'Output FPS', parseInt)
  .option('-q, --quality <level>', 'Quality (draft/standard/high/production)', 'high')
  .option('--mute', 'Remove audio')
  .action(async (input, options) => {
    const processor = new VideoProcessor();
    
    const output = options.output || `processed-${basename(input)}`;
    
    console.log(chalk.blue(`Processing ${input}...`));
    
    let resolution: { width: number; height: number } | undefined;
    if (options.resolution) {
      const [w, h] = options.resolution.split('x').map(Number);
      resolution = { width: w, height: h };
    }

    try {
      await processor.process({
        input,
        output,
        startTime: options.start,
        endTime: options.end,
        resolution,
        fps: options.fps,
        quality: options.quality,
        mute: options.mute
      });
      
      console.log(chalk.green(`\n✓ Saved to ${output}`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('gif <input>')
  .description('Convert video to GIF')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --fps <number>', 'FPS', parseInt, 10)
  .option('-w, --width <pixels>', 'Width', parseInt, 480)
  .action(async (input, options) => {
    const processor = new VideoProcessor();
    const output = options.output || input.replace(/\.\w+$/, '.gif');
    
    console.log(chalk.blue(`Converting to GIF...`));
    
    try {
      await processor.convertToGif(input, output, options.fps, options.width);
      console.log(chalk.green(`\n✓ Saved to ${output}`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('thumbnail <input>')
  .description('Create video thumbnail')
  .option('-o, --output <path>', 'Output file path')
  .option('-t, --time <seconds>', 'Timestamp', parseFloat, 0)
  .action(async (input, options) => {
    const processor = new VideoProcessor();
    const output = options.output || input.replace(/\.\w+$/, '-thumb.jpg');
    
    try {
      await processor.createThumbnail(input, output, options.time);
      console.log(chalk.green(`✓ Thumbnail saved to ${output}`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('windows')
  .description('List all available windows')
  .option('-f, --filter <pattern>', 'Filter windows by name')
  .action(async (options) => {
    if (process.platform !== 'darwin') {
      console.error(chalk.red('Window detection is only available on macOS'));
      process.exit(1);
    }

    const detector = new WindowDetector();
    
    console.log(chalk.blue('Detecting windows...\n'));
    
    try {
      const windows = await detector.listWindows({
        filter: options.filter ? { name: options.filter } : undefined
      });

      if (windows.length === 0) {
        console.log(chalk.yellow('No windows found'));
        return;
      }

      console.log(chalk.bold('Available windows:\n'));
      
      for (const win of windows) {
        console.log(`  ${chalk.cyan(win.id)}`);
        console.log(`    Name:   ${chalk.white(win.name)}`);
        console.log(`    Owner:  ${chalk.gray(win.owner)}`);
        console.log(`    Size:   ${win.bounds.width}x${win.bounds.height}`);
        console.log();
      }

      console.log(chalk.gray(`Total: ${windows.length} window(s)`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('screenshot')
  .description('Capture a screenshot')
  .option('-o, --output <path>', 'Output file path', 'screenshot.png')
  .option('--region <x,y,w,h>', 'Capture region')
  .option('-f, --format <format>', 'Output format (png, jpg)', 'png')
  .action(async (options) => {
    const capture = new ScreenCapture();
    
    try {
      let buffer: Buffer;
      
      if (options.region) {
        const [x, y, w, h] = options.region.split(',').map(Number);
        buffer = await capture.captureRegion(x, y, w, h, options.format);
      } else {
        buffer = await capture.captureScreenshot({ format: options.format });
      }

      await writeFile(options.output, buffer);
      console.log(chalk.green(`✓ Screenshot saved to ${options.output}`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('run <script>')
  .description('Run a demo script')
  .option('-o, --output <path>', 'Output file path')
  .option('--dry-run', 'Validate script without executing')
  .action(async (script, options) => {
    console.log(chalk.blue(`Loading demo script: ${script}`));

    try {
      const runner = await DemoScriptRunner.fromFile(script);
      
      if (options.dryRun) {
        console.log(chalk.green('✓ Script is valid'));
        console.log(chalk.gray(`Name: ${runner['config'].name}`));
        console.log(chalk.gray(`Steps: ${runner['config'].steps.length}`));
        return;
      }

      console.log(chalk.blue('\nExecuting demo script...\n'));

      await runner.initialize(join(process.cwd(), 'demo-output'));

      await runner.run((step, total, action) => {
        process.stdout.write(`\r${chalk.gray(`[${step}/${total}]`)} ${chalk.white(action)}   `);
      });

      console.log(chalk.green('\n\n✓ Demo script executed'));
      console.log(chalk.gray(`Total duration: ${runner.getTotalDuration().toFixed(2)}s`));

      if (options.output) {
        console.log(chalk.blue('\nRendering video...'));
        await runner.export(options.output);
        console.log(chalk.green(`✓ Video saved to ${options.output}`));
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('create <name>')
  .description('Create a new demo script template')
  .option('-o, --output <path>', 'Output directory', '.')
  .action(async (name, options) => {
    const template = {
      name,
      version: '1.0.0',
      output: {
        path: `${name.toLowerCase().replace(/\s+/g, '-')}.mp4`,
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        quality: 'high'
      },
      recording: {
        captureAudio: false
      },
      steps: [
        { type: 'record', duration: 3 },
        { type: 'text', text: 'Welcome to the demo', duration: 2 },
        { type: 'click', x: 960, y: 540, duration: 1, zoom: { scale: 1.5 } },
        { type: 'keystroke', keys: 'Cmd+K', duration: 2 }
      ]
    };

    const outputPath = join(options.output, `${name.toLowerCase().replace(/\s+/g, '-')}.json`);
    await writeFile(outputPath, JSON.stringify(template, null, 2));
    
    console.log(chalk.green(`✓ Demo script created: ${outputPath}`));
    console.log(chalk.gray('\nEdit the script and run with:'));
    console.log(chalk.cyan(`  demo-studio run ${outputPath}`));
  });

program
  .command('mcp')
  .description('Start MCP server for AI agent control')
  .action(() => {
    console.log(chalk.blue('Starting MCP server...'));
    console.log(chalk.gray('Connect via stdio transport\n'));
    import('../mcp/server.js');
  });

program.parse();
