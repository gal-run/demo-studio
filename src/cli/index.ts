#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Recorder } from '../core/recorder.js';
import { DemoScriptRunner } from '../core/demo-runner.js';
import { WindowDetector } from '../core/window-detector.js';
import { ScreenCapture } from '../core/screen-capture.js';
import { ZoomEngine } from '../effects/zoom.js';
import { CursorEngine } from '../effects/cursor.js';
import { TTSEngine } from '../tts/index.js';
import { TimelineEditor } from '../timeline/editor.js';
import { Renderer } from '../renderer/index.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const program = new Command();

program
  .name('demo-studio')
  .description('AI-powered software demo video recorder')
  .version('0.1.0');

program
  .command('record')
  .description('Start screen recording')
  .option('-o, --output <path>', 'Output file path', 'demo.mp4')
  .option('-f, --fps <number>', 'Frames per second', '30')
  .option('--no-audio', 'Disable audio capture')
  .option('--region <x,y,w,h>', 'Capture region')
  .option('--window <name>', 'Window name to capture')
  .action(async (options) => {
    let region: { x: number; y: number; width: number; height: number } | undefined;
    
    if (options.window) {
      const detector = new WindowDetector();
      const window = await detector.findWindow(options.window);
      if (!window) {
        console.error(chalk.red(`Window not found: ${options.window}`));
        process.exit(1);
      }
      region = window.bounds;
      console.log(chalk.gray(`Capturing window: ${window.name}`));
    }

    if (options.region) {
      const [x, y, w, h] = options.region.split(',').map(Number);
      region = { x, y, width: w, height: h };
    }

    const recorder = new Recorder({
      output: options.output,
      fps: parseInt(options.fps),
      captureAudio: options.audio,
      region
    });

    recorder.on('started', () => {
      console.log(chalk.green('✓ Recording started'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
    });

    recorder.on('stopped', (data: any) => {
      console.log(chalk.green(`✓ Recording saved to ${data.outputPath}`));
      console.log(chalk.gray(`Duration: ${(data.duration / 1000).toFixed(2)}s`));
    });

    try {
      await recorder.startRecording();
      
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\nStopping recording...'));
        await recorder.stopRecording();
        process.exit(0);
      });

      await new Promise(() => {});
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('windows')
  .description('List all available windows for capture')
  .option('-f, --filter <pattern>', 'Filter windows by name')
  .action(async (options) => {
    const detector = new WindowDetector();
    
    console.log(chalk.blue('Detecting windows...\n'));
    
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
  });

program
  .command('screenshot')
  .description('Capture a screenshot')
  .option('-o, --output <path>', 'Output file path', 'screenshot.png')
  .option('--region <x,y,w,h>', 'Capture region')
  .option('--window <name>', 'Window name to capture')
  .option('-f, --format <format>', 'Output format (png, jpg, webp)', 'png')
  .action(async (options) => {
    const capture = new ScreenCapture();
    
    try {
      let buffer: Buffer;
      
      if (options.window) {
        const detector = new WindowDetector();
        const window = await detector.findWindow(options.window);
        if (!window) {
          console.error(chalk.red(`Window not found: ${options.window}`));
          process.exit(1);
        }
        buffer = await capture.captureWindow(window.id, options.format);
      } else if (options.region) {
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
        process.stdout.write(`\r${chalk.gray(`[${step}/${total}]`)} ${chalk.white(action)}`);
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
  .command('edit <input>')
  .description('Edit a recorded video with effects')
  .option('-o, --output <path>', 'Output file path', 'edited.mp4')
  .option('--zoom <x,y,scale>', 'Apply zoom effect')
  .option('--cursor-smooth', 'Apply cursor smoothing')
  .action(async (input, options) => {
    console.log(chalk.blue(`Editing ${input}...`));
    
    const zoomEngine = new ZoomEngine();
    const cursorEngine = new CursorEngine();
    const timeline = new TimelineEditor();

    if (options.zoom) {
      const [x, y, scale] = options.zoom.split(',').map(Number);
      zoomEngine.addZoomRegion({ x, y, scale, duration: 0.5, easing: 'ease-out' }, 0, 5);
      console.log(chalk.gray(`Applied zoom: x=${x}, y=${y}, scale=${scale}`));
    }

    if (options.cursorSmooth) {
      cursorEngine.setConfig({ smoothness: 0.8 });
      console.log(chalk.gray('Applied cursor smoothing'));
    }

    timeline.addTrack('Main', 'video');
    timeline.addClip({
      type: 'video',
      source: input,
      startTime: 0,
      endTime: 30,
      track: 0
    });

    console.log(chalk.green(`✓ Video edited, saved to ${options.output}`));
  });

program
  .command('render <script>')
  .description('Render a demo from script file')
  .option('-o, --output <path>', 'Output file path', 'demo.mp4')
  .option('-q, --quality <level>', 'Quality level', 'high')
  .action(async (script, options) => {
    console.log(chalk.blue(`Rendering demo from ${script}...`));

    try {
      const scriptContent = await readFile(script, 'utf-8');
      const demo = JSON.parse(scriptContent);

      const zoomEngine = new ZoomEngine();
      const cursorEngine = new CursorEngine();
      const timeline = new TimelineEditor();
      const ttsEngine = new TTSEngine();

      timeline.addTrack('Video', 'video');
      timeline.addTrack('Audio', 'audio');

      let currentTime = 0;

      for (const step of demo.steps || []) {
        switch (step.type) {
          case 'zoom':
            zoomEngine.addZoomRegion(
              { x: step.x, y: step.y, scale: step.scale, duration: step.duration || 0.5, easing: 'ease-out' },
              currentTime,
              currentTime + (step.duration || 2)
            );
            break;

          case 'click':
            cursorEngine.addClick(step.x, step.y, currentTime, step.duration || 0.3);
            if (step.zoom) {
              zoomEngine.addZoomRegion(
                { x: step.x / 1920, y: step.y / 1080, scale: step.zoom.scale || 1.5, duration: 0.5, easing: 'ease-out' },
                currentTime,
                currentTime + (step.duration || 1)
              );
            }
            break;

          case 'keystroke':
            timeline.addClip({
              type: 'text',
              source: step.keys,
              startTime: currentTime,
              endTime: currentTime + (step.duration || 2),
              track: 0
            });
            break;

          case 'voiceover':
            ttsEngine.addSegment(step.text, currentTime);
            break;
        }

        if (step.duration) {
          currentTime += step.duration;
        }
      }

      const renderer = new Renderer(
        { output: options.output, quality: options.quality },
        timeline,
        zoomEngine,
        cursorEngine
      );

      await renderer.render((progress) => {
        process.stdout.write(`\r${chalk.gray('Rendering...')} ${Math.round(progress * 100)}%`);
      });

      console.log(`\n${chalk.green('✓ Demo rendered to')} ${options.output}`);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('mcp')
  .description('Start MCP server for AI agent control')
  .action(() => {
    console.log(chalk.blue('Starting MCP server...'));
    console.log(chalk.gray('Connect via stdio transport'));
    import('../mcp/server.js');
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
        captureAudio: true
      },
      steps: [
        { type: 'record', duration: 3 },
        { type: 'text', text: 'Welcome to the demo', duration: 2 },
        { type: 'click', x: 960, y: 540, duration: 1, zoom: { scale: 1.5 } },
        { type: 'keystroke', keys: 'Cmd+K', duration: 2 },
        { type: 'voiceover', text: 'This is a sample voiceover', duration: 3 }
      ]
    };

    const outputPath = join(options.output, `${name.toLowerCase().replace(/\s+/g, '-')}.json`);
    await writeFile(outputPath, JSON.stringify(template, null, 2));
    
    console.log(chalk.green(`✓ Demo script created: ${outputPath}`));
    console.log(chalk.gray('\nEdit the script and run with:'));
    console.log(chalk.cyan(`  demo-studio run ${outputPath}`));
  });

program.parse();
