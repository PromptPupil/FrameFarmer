import type {
  VideoInfo,
  ExtractedFrame,
  FrameAnalysis,
  VideoState,
  AppSettings,
  WorkflowTemplate,
  WorkflowInputNode,
  FFmpegStatus,
} from './types';

// ============ IPC Channel Definitions ============
// Request/Response pairs for each IPC channel

export interface IpcChannels {
  // Video Operations
  'video:load': {
    request: { filePath: string };
    response: VideoInfo;
  };
  'video:extract-frames': {
    request: {
      videoPath: string;
      frameCount: number;
      thumbnailWidth: number;
    };
    response: ExtractedFrame[];
  };
  'video:extract-single': {
    request: {
      videoPath: string;
      timestamp: number;
      outputPath: string;
      fullRes: boolean;
    };
    response: ExtractedFrame;
  };
  'video:get-info': {
    request: { filePath: string };
    response: VideoInfo;
  };

  // Frame Operations
  'frame:save': {
    request: {
      videoPath: string;
      frames: Array<{ frameNumber: number; timestamp: number }>;
      outputDir: string;
      filenamePattern: string;
      format: 'png' | 'jpg';
      jpgQuality?: number;
    };
    response: { savedPaths: string[] };
  };
  'frame:analyze-blur': {
    request: { imagePath: string };
    response: { blurScore: number };
  };
  'frame:analyze-batch': {
    request: {
      imagePaths: Array<{ path: string; frameNumber: number; timestamp: number }>;
    };
    response: FrameAnalysis[];
  };
  'frame:export-animation': {
    request: {
      framePaths: string[];
      outputPath: string;
      format: 'gif' | 'mp4';
      fps: number;
    };
    response: { success: boolean; outputPath: string };
  };

  // File System
  'fs:select-file': {
    request: {
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    };
    response: { filePath: string | null };
  };
  'fs:select-folder': {
    request: { title?: string };
    response: { folderPath: string | null };
  };
  'fs:list-videos': {
    request: { directory: string };
    response: VideoInfo[];
  };
  'fs:watch-folder': {
    request: { folderPath: string };
    response: { success: boolean };
  };
  'fs:unwatch-folder': {
    request: Record<string, never>;
    response: { success: boolean };
  };
  'fs:open-folder': {
    request: { folderPath: string };
    response: { success: boolean };
  };
  'fs:file-exists': {
    request: { filePath: string };
    response: boolean;
  };

  // Database
  'db:get-video-state': {
    request: { filePath: string };
    response: VideoState | null;
  };
  'db:save-video-state': {
    request: VideoState;
    response: { success: boolean };
  };
  'db:get-last-video': {
    request: Record<string, never>;
    response: VideoState | null;
  };
  'db:get-settings': {
    request: Record<string, never>;
    response: AppSettings;
  };
  'db:save-settings': {
    request: Partial<AppSettings>;
    response: { success: boolean };
  };
  'db:get-workflow-templates': {
    request: Record<string, never>;
    response: WorkflowTemplate[];
  };
  'db:save-workflow-template': {
    request: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>;
    response: WorkflowTemplate;
  };
  'db:delete-workflow-template': {
    request: { id: string };
    response: { success: boolean };
  };
  'db:get-queue': {
    request: Record<string, never>;
    response: Array<{
      id: string;
      filePath: string;
      status: string;
      addedAt: number;
    }>;
  };
  'db:add-to-queue': {
    request: { filePath: string };
    response: { id: string };
  };
  'db:remove-from-queue': {
    request: { id: string };
    response: { success: boolean };
  };
  'db:clear-queue': {
    request: Record<string, never>;
    response: { success: boolean };
  };
  'db:get-analysis-cache': {
    request: { videoHash: string };
    response: FrameAnalysis[];
  };
  'db:save-analysis-cache': {
    request: { videoHash: string; analyses: FrameAnalysis[] };
    response: { success: boolean };
  };

  // ComfyUI
  'comfyui:test-connection': {
    request: { baseUrl: string };
    response: { connected: boolean; error?: string };
  };
  'comfyui:upload-image': {
    request: { baseUrl: string; imagePath: string };
    response: { filename: string };
  };
  'comfyui:queue-prompt': {
    request: {
      baseUrl: string;
      workflow: object;
      imageInputs: Array<{ nodeId: string; imagePath: string }>;
    };
    response: { promptId: string };
  };
  'comfyui:get-queue': {
    request: { baseUrl: string };
    response: { running: string[]; pending: string[] };
  };
  'comfyui:parse-workflow': {
    request: { filePath: string };
    response: { inputNodes: WorkflowInputNode[] };
  };
  'comfyui:load-workflow': {
    request: { filePath: string };
    response: { workflow: object };
  };

  // App
  'app:get-version': {
    request: Record<string, never>;
    response: { version: string };
  };
  'app:get-ffmpeg-status': {
    request: Record<string, never>;
    response: FFmpegStatus;
  };
  'app:play-notification-sound': {
    request: Record<string, never>;
    response: { success: boolean };
  };
}

// ============ Event Channels (main -> renderer) ============
// These are one-way events, no response expected

export interface IpcEvents {
  'watch:new-video': { filePath: string; fileName: string };
  'analysis:progress': { current: number; total: number; frameNumber: number };
  'comfyui:queue-update': { promptId: string; status: string };
  'extraction:progress': { current: number; total: number };
}

// ============ Type Helpers ============

export type IpcChannelName = keyof IpcChannels;
export type IpcEventName = keyof IpcEvents;

export type IpcRequest<T extends IpcChannelName> = IpcChannels[T]['request'];
export type IpcResponse<T extends IpcChannelName> = IpcChannels[T]['response'];
export type IpcEventData<T extends IpcEventName> = IpcEvents[T];
