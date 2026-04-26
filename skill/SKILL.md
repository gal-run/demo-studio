# Demo Studio - AI-Powered Demo Video Recording

Create polished software demo videos with AI agent control.

## When to Use This Skill

Use when you need to:
- Record a software demo video
- Add zoom effects to highlight UI elements
- Create cursor smoothing and click indicators
- Generate voiceover narration
- Export polished demo videos

## Available Actions

### Recording

```
/demo-studio record --output demo.mp4
```

Starts screen recording with configurable FPS and region.

### Zoom Effects

```
/demo-studio zoom --x 0.5 --y 0.5 --scale 1.5 --duration 2
```

Adds zoom effect centered at position (0.5, 0.5) with 1.5x scale.

### Click Markers

```
/demo-studio click --x 400 --y 300 --time 5
```

Adds animated click indicator at pixel position (400, 300) at 5 seconds.

### Voiceover

```
/demo-studio voiceover --text "Click here to start" --time 0
```

Generates TTS voiceover at specified time.

### Export

```
/demo-studio export --output final.mp4 --quality high
```

Renders final video with all effects applied.

## MCP Tools

| Tool | Description |
|------|-------------|
| `start_recording` | Begin screen recording |
| `stop_recording` | End recording and save |
| `add_zoom_region` | Add zoom effect region |
| `add_click_marker` | Add click animation |
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
    { "type": "click", "x": 400, "y": 300, "duration": 1 },
    { "type": "keystroke", "keys": "Cmd+K", "duration": 2 },
    { "type": "voiceover", "text": "Click the button to start" }
  ]
}
```

## Example Workflows

### Quick Demo Recording

```bash
# Start MCP server
demo-studio mcp

# Via MCP tools:
1. start_recording -> record demo
2. stop_recording -> save raw video
3. add_zoom_region -> highlight key areas
4. export_video -> render final
```

### Automated Demo from Script

```bash
# Create demo-script.json
demo-studio render demo-script.json --output demo.mp4
```

### AI-Agent Driven Demo

The MCP server enables AI agents to:
1. Control recording programmatically
2. Add effects at precise timestamps
3. Generate voiceover from context
4. Export polished demos automatically

## Installation

```bash
npm install -g @scheduler-systems/demo-studio
```

## Requirements

- Node.js 18+
- FFmpeg (auto-installed)
- macOS 10.15+ (Windows support planned)

## Output Quality

| Level | CRF | Preset | Use Case |
|-------|-----|--------|----------|
| draft | 28 | ultrafast | Quick previews |
| standard | 23 | fast | Internal demos |
| high | 18 | medium | Published content |
| production | 12 | slow | Final releases |
