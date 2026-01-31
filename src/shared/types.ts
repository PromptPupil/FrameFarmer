// ============ Core Types ============

export interface VideoInfo {
  filePath: string;
  fileName: string;
  directory: string;
  duration: number; // seconds
  frameRate: number; // fps
  width: number;
  height: number;
  fileSize: number; // bytes
  modifiedAt: Date;
  totalFrames: number; // duration * frameRate
}

export interface ExtractedFrame {
  frameNumber: number;
  timestamp: number; // seconds
  thumbnailPath: string; // path to cached thumbnail
  fullResPath?: string; // path to full-res extraction (if saved)
}

export interface FrameAnalysis {
  frameNumber: number;
  timestamp: number;
  blurScore: number | null; // 0-100, higher = more blurry
  perceptualHash: string | null; // hex string
  isDuplicate: boolean; // based on similarity threshold
  isBlurry: boolean; // based on blur threshold
}

export interface TimelineMarker {
  id: string;
  timestamp: number; // seconds
  label: string;
  color?: string; // hex color
}

export interface VideoState {
  id: string;
  filePath: string;
  fileHash?: string; // cache key for the video
  selectedFrames: number[]; // array of frame numbers
  timelineMarkers: TimelineMarker[];
  lastPosition: number;
  lastOpenedAt: Date;
}

// ============ ComfyUI Types ============

export interface WorkflowTemplate {
  id: string;
  name: string;
  filePath: string;
  inputNodes: WorkflowInputNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowInputNode {
  nodeId: string;
  nodeName: string; // title from the workflow JSON
  nodeType: string; // typically "LoadImage"
}

export interface ComfyUIQueueItem {
  promptId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number; // 0-100
  error?: string;
}

// ============ Settings Types ============

export interface AppSettings {
  // ComfyUI
  comfyuiBaseUrl: string; // default: "http://192.168.86.31:8188"
  comfyuiTimeout: number; // default: 30000 (ms)

  // Watch Folder
  watchFolderPath: string | null;
  watchFolderEnabled: boolean;

  // Frame Extraction
  defaultFrameCount: number; // default: 15
  thumbnailWidth: number; // default: 320

  // Analysis Thresholds
  blurThreshold: number; // default: 50 (0-100 scale)
  similarityThreshold: number; // default: 90 (percentage match)
  autoAnalyze: boolean; // default: true

  // Output
  outputFolderBase: string | null; // null = same folder as video
  filenamePattern: string; // default: "{video}_frame_{frame}_{datetime}"
  outputFormat: 'png' | 'jpg'; // default: 'png'
  jpgQuality: number; // default: 95 (1-100)

  // Export
  gifFrameRate: number; // default: 0 (use source fps)
  gifLoop: boolean; // default: false

  // UI
  darkMode: boolean; // default: true
  thumbnailSize: 'small' | 'medium' | 'large'; // default: 'medium'
  showFrameNumbers: boolean; // default: true

  // Window
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  // FFmpeg
  ffmpegPath: string | null; // null = auto-detect
}

export const DEFAULT_SETTINGS: AppSettings = {
  comfyuiBaseUrl: 'http://192.168.86.31:8188',
  comfyuiTimeout: 30000,
  watchFolderPath: null,
  watchFolderEnabled: false,
  defaultFrameCount: 15,
  thumbnailWidth: 320,
  blurThreshold: 50,
  similarityThreshold: 90,
  autoAnalyze: true,
  outputFolderBase: null,
  filenamePattern: '{video}_frame_{frame}_{datetime}',
  outputFormat: 'png',
  jpgQuality: 95,
  gifFrameRate: 0,
  gifLoop: false,
  darkMode: true,
  thumbnailSize: 'medium',
  showFrameNumbers: true,
  windowBounds: null,
  ffmpegPath: null,
};

// ============ UI State Types ============

export interface FrameGridItem {
  frame: ExtractedFrame;
  analysis: FrameAnalysis | null;
  isSelected: boolean;
  isFiltered: boolean; // hidden due to filter settings
}

export type ViewMode = 'grid' | 'single' | 'compare';

export type FilterMode = 'all' | 'selected' | 'unselected' | 'duplicates' | 'blurry';

// ============ Queue Types ============

export interface VideoQueueItem {
  id: string;
  filePath: string;
  fileName: string;
  addedAt: Date;
  status: 'pending' | 'processing' | 'completed';
  processedAt?: Date;
}

// ============ FFmpeg Types ============

export interface FFmpegStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
}

// ============ Toast/Notification Types ============

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number; // ms, 0 = no auto-dismiss
  playSound?: boolean;
}
