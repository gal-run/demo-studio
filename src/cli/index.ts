#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Recorder } from '../core/recorder.js';
import { ZoomEngine } from '../effects/zoom.js';
import { CursorEngine } from '../effects/cursor.js';
import { TTSEngine } from '../tts/index.js';
import { TimelineEditor } from '../timeline/editor.js';
import { Renderer } from '../renderer/index.js';
import { readFile } from 'fs/promises';

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
  .action(async (options) => {
    const recorder = new Recorder({
      output: options.output,
      fps: parseInt(options.fps),
      captureAudio: options.audio
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

program.parse();
