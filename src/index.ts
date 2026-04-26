export { Recorder, RecordingConfigSchema, type RecordingConfig } from './core/recorder.js';
export { ZoomEngine, ZoomConfigSchema, type ZoomConfig, type ZoomRegion, type ZoomKeyframe } from './effects/zoom.js';
export { CursorEngine, CursorConfigSchema, type CursorConfig, type CursorPosition, type ClickEvent, type SmoothedPosition } from './effects/cursor.js';
export { TTSEngine, TTSEngineConfigSchema, type TTSEngineConfig, type VoiceoverSegment, type TTSResult } from './tts/index.js';
export { TimelineEditor, TimelineClipSchema, TimelineTrackSchema, type TimelineClip, type TimelineTrack, type TimelineState } from './timeline/editor.js';
export { Renderer, RenderConfigSchema, type RenderConfig } from './renderer/index.js';
