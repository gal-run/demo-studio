# Demo Studio

AI-powered software demo video recorder. Create polished demo videos with zoom effects, cursor smoothing, and voiceover - controllable by AI agents via MCP.

## Features

- **Screen Recording**: High-quality capture with configurable FPS and resolution
- **Smart Zoom**: Auto-zoom on clicks, configurable zoom regions
- **Cursor Smoothing**: Smooth cursor movements between clicks
- **Keystroke Overlay**: Display keyboard shortcuts on screen
- **TTS Voiceover**: Auto-generate narration from script
- **Timeline Editor**: Visual editor for trimming and arranging clips
- **MCP Integration**: Control recording from AI agents
- **Scriptable Demos**: Define demo flows in JSON/YAML

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Record a demo
npm start record --output demo.mp4

# Start MCP server for AI control
npm run mcp
```

## CLI Commands

```bash
# Record screen
demo-studio record --output demo.mp4 --fps 30

# Edit with effects
demo-studio edit recording.mp4 --zoom 0.5,0.5,1.5 --cursor-smooth

# Render from script
demo-studio render demo-script.json --output final.mp4

# Start MCP server
demo-studio mcp
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `start_recording` | Begin screen recording |
| `stop_recording` | End recording and save |
| `add_zoom_region` | Define zoom focus area |
| `add_click_marker` | Add animated click indicator |
| `add_keystroke_overlay` | Show keyboard shortcut |
| `add_text_overlay` | Add text annotation |
| `set_cursor_style` | Configure cursor appearance |
| `add_voiceover` | Add TTS narration |
| `export_video` | Render final video |
| `run_demo_script` | Execute demo script |

## Demo Script Format

```json
{
  "name": "Feature Demo",
  "steps": [
    { "type": "record", "duration": 5 },
    { "type": "zoom", "x": 0.5, "y": 0.5, "scale": 1.5, "duration": 2 },
    { "type": "click", "x": 400, "y": 300, "duration": 1, "zoom": { "scale": 2 } },
    { "type": "keystroke", "keys": "Cmd+K", "duration": 2 },
    { "type": "voiceover", "text": "Click here to start" }
  ]
}
```

## Examples

See `examples/` directory for complete demo scripts:

- `login-flow.json` - Login flow with zoom and voiceover
- `feature-walkthrough.json` - Multi-feature tour with effects

## Architecture

```
demo-studio/
├── src/
│   ├── core/recorder.ts      # Screen recording engine
│   ├── effects/
│   │   ├── zoom.ts           # Zoom effect processor
│   │   └── cursor.ts         # Cursor smoothing
│   ├── timeline/editor.ts    # Visual timeline editor
│   ├── renderer/index.ts     # Video rendering
│   ├── tts/index.ts          # Text-to-speech
│   └── mcp/server.ts         # MCP server for AI
├── cli/                      # Command-line interface
├── skill/SKILL.md            # GAL skill definition
└── examples/                 # Demo script examples
```

## Output Quality

| Level | CRF | Preset | Use Case |
|-------|-----|--------|----------|
| draft | 28 | ultrafast | Quick previews |
| standard | 23 | fast | Internal demos |
| high | 18 | medium | Published content |
| production | 12 | slow | Final releases |

## Requirements

- Node.js 18+
- FFmpeg (auto-installed via npm)
- macOS 10.15+ (Windows support planned)

## Environment Variables

```bash
# For TTS voiceover
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
```

## License

MIT
