import { create } from 'zustand';
import type {
  VideoInfo,
  ExtractedFrame,
  FrameAnalysis,
  TimelineMarker,
  VideoQueueItem,
  WorkflowTemplate,
  AppSettings,
  FilterMode,
  ViewMode,
  ToastMessage,
  FFmpegStatus,
} from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

interface VideoSlice {
  currentVideo: VideoInfo | null;
  setCurrentVideo: (video: VideoInfo | null) => void;

  videosInDirectory: VideoInfo[];
  currentVideoIndex: number;
  setVideosInDirectory: (videos: VideoInfo[]) => void;
  setCurrentVideoIndex: (index: number) => void;
  goToNextVideo: () => void;
  goToPreviousVideo: () => void;
}

interface PlaybackSlice {
  currentTimestamp: number;
  setCurrentTimestamp: (ts: number) => void;
  isSeeking: boolean;
  setIsSeeking: (seeking: boolean) => void;
  seekTo: (ts: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
}

interface FramesSlice {
  frames: ExtractedFrame[];
  setFrames: (frames: ExtractedFrame[]) => void;
  addFrame: (frame: ExtractedFrame) => void;
  clearFrames: () => void;

  selectedFrames: Set<number>;
  toggleFrameSelection: (frameNumber: number) => void;
  selectFrame: (frameNumber: number) => void;
  deselectFrame: (frameNumber: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  invertSelection: () => void;
  selectRange: (start: number, end: number) => void;
  setSelectedFrames: (frameNumbers: number[]) => void;
  lastClickedFrame: number | null;
  setLastClickedFrame: (frameNumber: number | null) => void;
  hoveredFrame: ExtractedFrame | null;
  setHoveredFrame: (frame: ExtractedFrame | null) => void;
  pinnedPreviewFrame: ExtractedFrame | null;
  setPinnedPreviewFrame: (frame: ExtractedFrame | null) => void;

  analysisResults: Map<number, FrameAnalysis>;
  setAnalysisResult: (frameNumber: number, analysis: FrameAnalysis) => void;
  setAllAnalysisResults: (results: FrameAnalysis[]) => void;
  clearAnalysisResults: () => void;
  analysisProgress: number;
  setAnalysisProgress: (progress: number) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;

  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  showBlurryFrames: boolean;
  setShowBlurryFrames: (show: boolean) => void;
  showDuplicateFrames: boolean;
  setShowDuplicateFrames: (show: boolean) => void;

  framesSavedForCurrentVideo: boolean;
  setFramesSavedForCurrentVideo: (saved: boolean) => void;
}

interface TimelineSlice {
  timelineMarkers: TimelineMarker[];
  setTimelineMarkers: (markers: TimelineMarker[]) => void;
  addTimelineMarker: (marker: TimelineMarker) => void;
  removeTimelineMarker: (id: string) => void;
  updateTimelineMarker: (id: string, updates: Partial<TimelineMarker>) => void;
}

interface QueueSlice {
  videoQueue: VideoQueueItem[];
  setVideoQueue: (queue: VideoQueueItem[]) => void;
  addToQueue: (item: VideoQueueItem) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<VideoQueueItem>) => void;
  clearQueue: () => void;
}

interface ComfyUISlice {
  workflowTemplates: WorkflowTemplate[];
  setWorkflowTemplates: (templates: WorkflowTemplate[]) => void;
  addWorkflowTemplate: (template: WorkflowTemplate) => void;
  removeWorkflowTemplate: (id: string) => void;
  selectedWorkflow: WorkflowTemplate | null;
  setSelectedWorkflow: (workflow: WorkflowTemplate | null) => void;
  comfyuiInputSlots: Map<string, number | null>;
  setInputSlot: (nodeId: string, frameNumber: number | null) => void;
  clearInputSlots: () => void;
  comfyuiConnected: boolean;
  setComfyuiConnected: (connected: boolean) => void;
}

interface SettingsSlice {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

interface UISlice {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  thumbnailSize: 'small' | 'medium' | 'large';
  setThumbnailSize: (size: 'small' | 'medium' | 'large') => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Dialog states
  settingsDialogOpen: boolean;
  setSettingsDialogOpen: (open: boolean) => void;
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  workflowManagerOpen: boolean;
  setWorkflowManagerOpen: (open: boolean) => void;

  // Toast notifications
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // FFmpeg status
  ffmpegStatus: FFmpegStatus;
  setFfmpegStatus: (status: FFmpegStatus) => void;

  // Extraction progress
  extractionProgress: { current: number; total: number } | null;
  setExtractionProgress: (progress: { current: number; total: number } | null) => void;
}

type FrameFarmerStore = VideoSlice &
  PlaybackSlice &
  FramesSlice &
  TimelineSlice &
  QueueSlice &
  ComfyUISlice &
  SettingsSlice &
  UISlice;

let toastIdCounter = 0;

export const useStore = create<FrameFarmerStore>()((set, get) => ({
    // ============ Video Slice ============
    currentVideo: null,
    setCurrentVideo: (video) => set({ currentVideo: video }),

    videosInDirectory: [],
    currentVideoIndex: -1,
    setVideosInDirectory: (videos) => set({ videosInDirectory: videos }),
    setCurrentVideoIndex: (index) => set({ currentVideoIndex: index }),
    goToNextVideo: () => {
      const { videosInDirectory, currentVideoIndex } = get();
      if (videosInDirectory.length === 0) return;
      const nextIndex = (currentVideoIndex + 1) % videosInDirectory.length;
      set({ currentVideoIndex: nextIndex });
    },
    goToPreviousVideo: () => {
      const { videosInDirectory, currentVideoIndex } = get();
      if (videosInDirectory.length === 0) return;
      const prevIndex =
        currentVideoIndex <= 0 ? videosInDirectory.length - 1 : currentVideoIndex - 1;
      set({ currentVideoIndex: prevIndex });
    },

    // ============ Playback Slice ============
    currentTimestamp: 0,
    setCurrentTimestamp: (ts) => set({ currentTimestamp: ts }),
    isSeeking: false,
    setIsSeeking: (seeking) => set({ isSeeking: seeking }),
    seekTo: (ts) => set({ isSeeking: true, currentTimestamp: ts }),
    isPlaying: false,
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
    playbackSpeed: 1,
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    volume: 1,
    setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    isMuted: false,
    setIsMuted: (muted) => set({ isMuted: muted }),
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

    // ============ Frames Slice ============
    frames: [],
    setFrames: (frames) => set({ frames }),
    addFrame: (frame) =>
      set((state) => {
        const newFrames = [...state.frames, frame].sort(
          (a, b) => a.frameNumber - b.frameNumber
        );
        return { frames: newFrames };
      }),
    clearFrames: () => set({ frames: [] }),

    selectedFrames: new Set<number>(),
    toggleFrameSelection: (frameNumber) =>
      set((state) => {
        const newSet = new Set(state.selectedFrames);
        if (newSet.has(frameNumber)) {
          newSet.delete(frameNumber);
        } else {
          newSet.add(frameNumber);
        }
        return { selectedFrames: newSet, lastClickedFrame: frameNumber, framesSavedForCurrentVideo: false };
      }),
    selectFrame: (frameNumber) =>
      set((state) => {
        const newSet = new Set(state.selectedFrames);
        newSet.add(frameNumber);
        return { selectedFrames: newSet, framesSavedForCurrentVideo: false };
      }),
    deselectFrame: (frameNumber) =>
      set((state) => {
        const newSet = new Set(state.selectedFrames);
        newSet.delete(frameNumber);
        return { selectedFrames: newSet, framesSavedForCurrentVideo: false };
      }),
    selectAll: () =>
      set((state) => {
        const allFrameNumbers = state.frames.map((f) => f.frameNumber);
        return { selectedFrames: new Set(allFrameNumbers), framesSavedForCurrentVideo: false };
      }),
    selectNone: () => set({ selectedFrames: new Set(), framesSavedForCurrentVideo: false }),
    invertSelection: () =>
      set((state) => {
        const inverted = new Set<number>();
        for (const frame of state.frames) {
          if (!state.selectedFrames.has(frame.frameNumber)) {
            inverted.add(frame.frameNumber);
          }
        }
        return { selectedFrames: inverted, framesSavedForCurrentVideo: false };
      }),
    selectRange: (start, end) =>
      set((state) => {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        const newSet = new Set(state.selectedFrames);
        for (const frame of state.frames) {
          if (frame.frameNumber >= min && frame.frameNumber <= max) {
            newSet.add(frame.frameNumber);
          }
        }
        return { selectedFrames: newSet, framesSavedForCurrentVideo: false };
      }),
    setSelectedFrames: (frameNumbers) => set({ selectedFrames: new Set(frameNumbers), framesSavedForCurrentVideo: false }),
    lastClickedFrame: null,
    setLastClickedFrame: (frameNumber) => set({ lastClickedFrame: frameNumber }),
    hoveredFrame: null,
    setHoveredFrame: (frame) => set({ hoveredFrame: frame }),
    pinnedPreviewFrame: null,
    setPinnedPreviewFrame: (frame) => set({ pinnedPreviewFrame: frame }),

    analysisResults: new Map(),
    setAnalysisResult: (frameNumber, analysis) =>
      set((state) => {
        const newMap = new Map(state.analysisResults);
        newMap.set(frameNumber, analysis);
        return { analysisResults: newMap };
      }),
    setAllAnalysisResults: (results) =>
      set(() => {
        const newMap = new Map<number, FrameAnalysis>();
        for (const r of results) {
          newMap.set(r.frameNumber, r);
        }
        return { analysisResults: newMap };
      }),
    clearAnalysisResults: () => set({ analysisResults: new Map() }),
    analysisProgress: 0,
    setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
    isAnalyzing: false,
    setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

    filterMode: 'all',
    setFilterMode: (mode) => set({ filterMode: mode }),
    showBlurryFrames: true,
    setShowBlurryFrames: (show) => set({ showBlurryFrames: show }),
    showDuplicateFrames: true,
    setShowDuplicateFrames: (show) => set({ showDuplicateFrames: show }),

    framesSavedForCurrentVideo: false,
    setFramesSavedForCurrentVideo: (saved) => set({ framesSavedForCurrentVideo: saved }),

    // ============ Timeline Slice ============
    timelineMarkers: [],
    setTimelineMarkers: (markers) => set({ timelineMarkers: markers }),
    addTimelineMarker: (marker) =>
      set((state) => ({
        timelineMarkers: [...state.timelineMarkers, marker],
      })),
    removeTimelineMarker: (id) =>
      set((state) => ({
        timelineMarkers: state.timelineMarkers.filter((m) => m.id !== id),
      })),
    updateTimelineMarker: (id, updates) =>
      set((state) => ({
        timelineMarkers: state.timelineMarkers.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      })),

    // ============ Queue Slice ============
    videoQueue: [],
    setVideoQueue: (queue) => set({ videoQueue: queue }),
    addToQueue: (item) =>
      set((state) => ({
        videoQueue: [...state.videoQueue, item],
      })),
    removeFromQueue: (id) =>
      set((state) => ({
        videoQueue: state.videoQueue.filter((v) => v.id !== id),
      })),
    updateQueueItem: (id, updates) =>
      set((state) => ({
        videoQueue: state.videoQueue.map((v) => (v.id === id ? { ...v, ...updates } : v)),
      })),
    clearQueue: () => set({ videoQueue: [] }),

    // ============ ComfyUI Slice ============
    workflowTemplates: [],
    setWorkflowTemplates: (templates) => set({ workflowTemplates: templates }),
    addWorkflowTemplate: (template) =>
      set((state) => ({
        workflowTemplates: [...state.workflowTemplates, template],
      })),
    removeWorkflowTemplate: (id) =>
      set((state) => ({
        workflowTemplates: state.workflowTemplates.filter((t) => t.id !== id),
      })),
    selectedWorkflow: null,
    setSelectedWorkflow: (workflow) => set({ selectedWorkflow: workflow }),
    comfyuiInputSlots: new Map(),
    setInputSlot: (nodeId, frameNumber) =>
      set((state) => {
        const newMap = new Map(state.comfyuiInputSlots);
        newMap.set(nodeId, frameNumber);
        return { comfyuiInputSlots: newMap };
      }),
    clearInputSlots: () => set({ comfyuiInputSlots: new Map() }),
    comfyuiConnected: false,
    setComfyuiConnected: (connected) => set({ comfyuiConnected: connected }),

    // ============ Settings Slice ============
    settings: DEFAULT_SETTINGS,
    setSettings: (settings) => set({ settings }),
    updateSetting: (key, value) =>
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      })),

    // ============ UI Slice ============
    isLoading: false,
    setIsLoading: (loading) => set({ isLoading: loading }),
    loadingMessage: '',
    setLoadingMessage: (message) => set({ loadingMessage: message }),

    thumbnailSize: 'medium',
    setThumbnailSize: (size) => set({ thumbnailSize: size }),
    viewMode: 'grid',
    setViewMode: (mode) => set({ viewMode: mode }),

    settingsDialogOpen: false,
    setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
    exportDialogOpen: false,
    setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
    workflowManagerOpen: false,
    setWorkflowManagerOpen: (open) => set({ workflowManagerOpen: open }),

    toasts: [],
    addToast: (toast) =>
      set((state) => ({
        toasts: [
          ...state.toasts,
          { ...toast, id: `toast-${++toastIdCounter}` },
        ],
      })),
    removeToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),

    ffmpegStatus: {
      available: false,
      ffmpegPath: null,
      ffprobePath: null,
      version: null,
    },
    setFfmpegStatus: (status) => set({ ffmpegStatus: status }),

    extractionProgress: null,
    setExtractionProgress: (progress) => set({ extractionProgress: progress }),
  }));

// Selector helpers
export const useCurrentVideo = () => useStore((state) => state.currentVideo);
export const useFrames = () => useStore((state) => state.frames);
export const useSelectedFrames = () => useStore((state) => state.selectedFrames);
export const useSettings = () => useStore((state) => state.settings);
export const useToasts = () => useStore((state) => state.toasts);
