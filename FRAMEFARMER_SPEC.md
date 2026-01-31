# FrameFarmer — Complete Technical Specification

> **Version:** 1.0
> **Last Updated:** 2025-01-31
> **Purpose:** This document provides all information needed to implement FrameFarmer from scratch. A developer (human or AI) should be able to build the complete application using only this specification.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Data Models & Persistence](#4-data-models--persistence)
5. [Feature Specifications](#5-feature-specifications)
6. [UI/UX Design](#6-uiux-design)
7. [ComfyUI Integration](#7-comfyui-integration)
8. [FFmpeg Integration](#8-ffmpeg-integration)
9. [Frame Analysis Algorithms](#9-frame-analysis-algorithms)
10. [Keyboard Shortcuts](#10-keyboard-shortcuts)
11. [Configuration & Settings](#11-configuration--settings)
12. [File & Folder Structure](#12-file--folder-structure)
13. [Implementation Phases](#13-implementation-phases)
14. [Error Handling](#14-error-handling)
15. [Testing Considerations](#15-testing-considerations)

---

## 1. Project Overview

### 1.1 What is FrameFarmer?

FrameFarmer is a desktop application for reviewing videos and extracting selected frames. It is designed primarily for AI video generation workflows where users need to:

1. Review AI-generated videos (often from ComfyUI)
2. Extract specific frames as still images
3. Send those frames back to ComfyUI as inputs for further generation (img2vid, style transfer, etc.)

### 1.2 Core Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TYPICAL USER WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ComfyUI generates a video                                               │
│                    ↓                                                        │
│  2. FrameFarmer detects new video (watch folder) or user loads manually     │
│                    ↓                                                        │
│  3. FrameFarmer extracts preview frames and displays them                   │
│                    ↓                                                        │
│  4. User reviews frames, steps through video frame-by-frame if needed       │
│                    ↓                                                        │
│  5. User selects desired frames (filtering out duplicates/blurry frames)    │
│                    ↓                                                        │
│  6. User either:                                                            │
│     a) Saves selected frames to disk                                        │
│     b) Sends frames directly to ComfyUI workflow                            │
│     c) Exports as GIF/MP4                                                   │
│                    ↓                                                        │
│  7. Cycle repeats with new generated video                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Target User

- Users running ComfyUI locally for AI video generation
- Working on Windows (primary target)
- Have FFmpeg installed locally
- Comfortable with technical tools
- Often use ultrawide monitors

### 1.4 Key Design Principles

1. **Speed:** Loading and navigation must be fast. Background processing should not block UI.
2. **Keyboard-Driven:** Power users should be able to do everything without touching the mouse.
3. **Non-Destructive:** Original videos are never modified. Frame selection state is always recoverable.
4. **Explicit Failures:** No silent fallbacks. If something fails, show a clear error message.

---

## 2. Tech Stack

### 2.1 Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Desktop Shell | Electron | ^28.0.0 | Native desktop app wrapper |
| Frontend Framework | React | ^18.2.0 | UI components |
| Language | TypeScript | ^5.3.0 | Type safety |
| Build Tool | Vite | ^5.0.0 | Fast development builds |
| Electron Builder | electron-builder | ^24.0.0 | Packaging and distribution |
| State Management | Zustand | ^4.4.0 | Lightweight, simple state |
| Styling | Tailwind CSS | ^3.4.0 | Utility-first CSS |
| Database | better-sqlite3 | ^9.0.0 | Local SQLite for persistence |
| Video Processing | fluent-ffmpeg | ^2.1.0 | FFmpeg wrapper for Node.js |
| File Watching | chokidar | ^3.5.0 | Cross-platform file watcher |
| UUID Generation | uuid | ^9.0.0 | Unique identifiers |
| Image Hashing | imghash | ^1.0.0 | Perceptual hashing for similarity |
| Image Analysis | sharp | ^0.33.0 | Image processing (blur detection) |

### 2.2 External Dependencies

| Dependency | Required | Purpose |
|------------|----------|---------|
| FFmpeg | Yes | Frame extraction, video info |
| FFprobe | Yes (comes with FFmpeg) | Video metadata extraction |
| ComfyUI | No (optional) | Target for frame sending |

### 2.3 Supported Platforms

- **Primary:** Windows 10/11 (x64)
- **Secondary:** macOS, Linux (should work but not primary focus)

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELECTRON APP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         RENDERER PROCESS                             │   │
│  │                         (React + TypeScript)                         │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │   Video      │ │   Frame      │ │   ComfyUI    │ │  Settings   │ │   │
│  │  │   Player     │ │   Grid       │ │   Panel      │ │  Panel      │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    ZUSTAND STATE STORE                        │   │   │
│  │  │  - currentVideo    - selectedFrames    - workflowTemplates   │   │   │
│  │  │  - videoQueue      - analysisResults   - settings            │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ IPC (Inter-Process Communication)      │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          MAIN PROCESS                                │   │
│  │                          (Node.js)                                   │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │   FFmpeg     │ │   File       │ │   SQLite     │ │  ComfyUI    │ │   │
│  │  │   Service    │ │   Watcher    │ │   Database   │ │  Client     │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │   │
│  │  │   Frame      │ │   Blur       │ │   Workflow   │                 │   │
│  │  │   Analyzer   │ │   Detector   │ │   Parser     │                 │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
                    ┌───────────────────────────────┐
                    │        EXTERNAL SYSTEMS        │
                    ├───────────────────────────────┤
                    │  • File System (videos, frames)│
                    │  • FFmpeg/FFprobe binaries     │
                    │  • ComfyUI API (localhost)     │
                    │  • SQLite database file        │
                    └───────────────────────────────┘
```

### 3.2 Process Responsibilities

#### Main Process (Node.js)
- File system operations (read/write)
- FFmpeg process spawning
- SQLite database operations
- Watch folder monitoring
- ComfyUI API communication
- Frame analysis (blur detection, similarity hashing)
- Native dialogs (file picker, notifications)

#### Renderer Process (React)
- All UI rendering
- User interaction handling
- Video playback (HTML5 video element)
- State management
- IPC calls to main process

### 3.3 IPC Channel Definitions

All communication between renderer and main processes uses Electron's IPC system.

```typescript
// IPC Channels (defined in shared types)

// Video Operations
'video:load'              // Load a video file, extract metadata
'video:extract-frames'    // Extract N frames at specified timestamps
'video:extract-single'    // Extract single frame at timestamp
'video:get-info'          // Get video metadata (duration, resolution, fps)

// Frame Operations
'frame:save'              // Save frame(s) to disk
'frame:analyze-blur'      // Analyze frame for blur score
'frame:analyze-similarity'// Calculate perceptual hash for similarity

// File System
'fs:select-file'          // Open file picker dialog
'fs:select-folder'        // Open folder picker dialog
'fs:list-videos'          // List video files in a directory
'fs:watch-folder'         // Start watching a folder for new videos
'fs:unwatch-folder'       // Stop watching a folder

// Database
'db:get-video-state'      // Get saved state for a video
'db:save-video-state'     // Save state for a video
'db:get-settings'         // Get app settings
'db:save-settings'        // Save app settings
'db:get-workflow-templates' // Get all workflow templates
'db:save-workflow-template' // Save a workflow template

// ComfyUI
'comfyui:test-connection' // Test if ComfyUI is reachable
'comfyui:queue-prompt'    // Queue a prompt with images
'comfyui:get-queue'       // Get current queue status
'comfyui:parse-workflow'  // Parse workflow JSON for LoadImage nodes

// App
'app:get-version'         // Get app version
'app:show-notification'   // Show system notification
'app:open-folder'         // Open folder in Explorer/Finder
```

---

## 4. Data Models & Persistence

### 4.1 SQLite Database Schema

Database file location: `%APPDATA%/FrameFarmer/framefarmer.db` (Windows)

```sql
-- Application settings (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Workflow templates
CREATE TABLE workflow_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    input_nodes TEXT NOT NULL,  -- JSON array of {nodeId, nodeName} objects
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Video state (remembers selections per video)
CREATE TABLE video_states (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT,  -- For detecting if file changed
    selected_frames TEXT NOT NULL DEFAULT '[]',  -- JSON array of frame numbers
    timeline_markers TEXT NOT NULL DEFAULT '[]', -- JSON array of {time, label} objects
    last_position REAL NOT NULL DEFAULT 0,  -- Last playhead position in seconds
    last_opened_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Analysis cache (blur scores, similarity hashes)
CREATE TABLE frame_analysis (
    id TEXT PRIMARY KEY,
    video_path TEXT NOT NULL,
    frame_number INTEGER NOT NULL,
    timestamp REAL NOT NULL,
    blur_score REAL,  -- Higher = more blurry
    perceptual_hash TEXT,  -- For similarity comparison
    analyzed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(video_path, frame_number)
);

-- Video queue
CREATE TABLE video_queue (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed
    processed_at INTEGER
);

-- Indexes for performance
CREATE INDEX idx_video_states_file_path ON video_states(file_path);
CREATE INDEX idx_frame_analysis_video ON frame_analysis(video_path);
CREATE INDEX idx_video_queue_status ON video_queue(status);
```

### 4.2 TypeScript Type Definitions

```typescript
// src/shared/types.ts

// ============ Core Types ============

export interface VideoInfo {
  filePath: string;
  fileName: string;
  directory: string;
  duration: number;        // seconds
  frameRate: number;       // fps
  width: number;
  height: number;
  fileSize: number;        // bytes
  modifiedAt: Date;
  totalFrames: number;     // duration * frameRate
}

export interface ExtractedFrame {
  frameNumber: number;
  timestamp: number;       // seconds
  thumbnailPath: string;   // path to cached thumbnail
  fullResPath?: string;    // path to full-res extraction (if saved)
}

export interface FrameAnalysis {
  frameNumber: number;
  timestamp: number;
  blurScore: number | null;      // 0-100, higher = more blurry
  perceptualHash: string | null; // hex string
  isDuplicate: boolean;          // based on similarity threshold
  isBlurry: boolean;             // based on blur threshold
}

export interface TimelineMarker {
  id: string;
  timestamp: number;       // seconds
  label: string;
  color?: string;          // hex color
}

export interface VideoState {
  id: string;
  filePath: string;
  selectedFrames: number[];      // array of frame numbers
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
  nodeName: string;        // title from the workflow JSON
  nodeType: string;        // typically "LoadImage"
}

export interface ComfyUIQueueItem {
  promptId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;       // 0-100
  error?: string;
}

// ============ Settings Types ============

export interface AppSettings {
  // ComfyUI
  comfyuiBaseUrl: string;              // default: "http://192.168.86.31:8188"

  // Watch Folder
  watchFolderPath: string | null;
  watchFolderEnabled: boolean;

  // Frame Extraction
  defaultFrameCount: number;           // default: 15
  thumbnailSize: 'small' | 'medium' | 'large';

  // Analysis Thresholds
  blurThreshold: number;               // default: 50 (0-100 scale)
  similarityThreshold: number;         // default: 90 (percentage match)

  // Output
  outputFolderBase: string | null;     // null = same folder as video

  // UI
  darkMode: boolean;                   // default: true
  windowBounds: { x: number; y: number; width: number; height: number } | null;
}

// ============ UI State Types ============

export interface FrameGridItem {
  frame: ExtractedFrame;
  analysis: FrameAnalysis | null;
  isSelected: boolean;
  isFiltered: boolean;     // hidden due to filter settings
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
```

### 4.3 Zustand Store Structure

```typescript
// src/renderer/store/index.ts

import { create } from 'zustand';

interface FrameFarmerStore {
  // Current Video
  currentVideo: VideoInfo | null;
  setCurrentVideo: (video: VideoInfo | null) => void;

  // Extracted Frames
  frames: ExtractedFrame[];
  setFrames: (frames: ExtractedFrame[]) => void;

  // Frame Analysis Results
  analysisResults: Map<number, FrameAnalysis>;
  setAnalysisResult: (frameNumber: number, analysis: FrameAnalysis) => void;
  analysisProgress: number; // 0-100
  setAnalysisProgress: (progress: number) => void;

  // Selection
  selectedFrames: Set<number>;
  toggleFrameSelection: (frameNumber: number) => void;
  selectFrame: (frameNumber: number) => void;
  deselectFrame: (frameNumber: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  invertSelection: () => void;
  selectRange: (start: number, end: number) => void;

  // Playback
  currentTimestamp: number;
  setCurrentTimestamp: (timestamp: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  // Timeline Markers
  timelineMarkers: TimelineMarker[];
  addTimelineMarker: (marker: TimelineMarker) => void;
  removeTimelineMarker: (id: string) => void;

  // Video Queue
  videoQueue: VideoQueueItem[];
  addToQueue: (item: VideoQueueItem) => void;
  removeFromQueue: (id: string) => void;
  processNextInQueue: () => void;

  // Videos in Directory
  videosInDirectory: VideoInfo[];
  currentVideoIndex: number;
  setVideosInDirectory: (videos: VideoInfo[]) => void;
  goToNextVideo: () => void;
  goToPreviousVideo: () => void;

  // Filter & View
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  thumbnailSize: 'small' | 'medium' | 'large';
  setThumbnailSize: (size: 'small' | 'medium' | 'large') => void;
  showBlurryFrames: boolean;
  setShowBlurryFrames: (show: boolean) => void;
  showDuplicateFrames: boolean;
  setShowDuplicateFrames: (show: boolean) => void;

  // ComfyUI
  workflowTemplates: WorkflowTemplate[];
  setWorkflowTemplates: (templates: WorkflowTemplate[]) => void;
  selectedWorkflow: WorkflowTemplate | null;
  setSelectedWorkflow: (workflow: WorkflowTemplate | null) => void;
  comfyuiInputSlots: Map<string, number | null>; // nodeId -> frameNumber
  setInputSlot: (nodeId: string, frameNumber: number | null) => void;
  clearInputSlots: () => void;
  comfyuiQueue: ComfyUIQueueItem[];
  setComfyuiQueue: (queue: ComfyUIQueueItem[]) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
}
```

---

## 5. Feature Specifications

### 5.1 Phase 1 Features (Core)

#### 5.1.1 Frame Selection Mode

**Description:** Users can select/deselect frames by clicking on them. Selected frames are visually highlighted.

**Behavior:**
- Click on a frame thumbnail to toggle selection (selected ↔ unselected)
- Selected frames show a visible checkmark overlay and a colored border (e.g., blue)
- Selection state is persisted to database when video is closed or app exits
- Selection state is restored when video is reopened

**Implementation Notes:**
- Store selection as array of frame numbers in Zustand store
- Persist to `video_states.selected_frames` as JSON array
- Use CSS classes for visual selection state

---

#### 5.1.2 Keep Selected / Delete Rest

**Description:** Save selected frames to disk and optionally delete the non-selected frames (if any were previously saved).

**Behavior:**
- User clicks "Save Selected" button
- File dialog allows choosing action:
  - "Save Selected Only" — saves selected frames to output folder
  - "Save Selected & Delete Others" — saves selected, deletes previously-saved non-selected frames
- Output folder structure: `{video_directory}/{video_name}_{date}/`
- Filename pattern: `{video_name}_frame_{frameNumber}_{timestamp}.png`
  - Example: `myanimation_frame_00042_2025-01-31_143052.png`
- Date format in folder: `YYYY-MM-DD`
- Timestamp in filename: `YYYY-MM-DD_HHmmss`

**Implementation Notes:**
- Use FFmpeg to extract frames at full resolution
- Create output directory if it doesn't exist
- Show progress dialog during extraction
- After save, offer to open output folder in Explorer

---

#### 5.1.3 ComfyUI Direct Send

**Description:** Send selected frames directly to ComfyUI to be queued with a specified workflow.

**Behavior (Single-Input Workflow):**
1. User selects one or more frames
2. User selects a workflow template from dropdown
3. User clicks "Send to ComfyUI"
4. Each selected frame is queued as a separate job
5. Progress/status shown in ComfyUI panel

**Behavior (Multi-Input Workflow):**
1. User selects a multi-input workflow template
2. "ComfyUI Inputs" panel appears showing labeled slots
3. User drags frames into slots (or clicks slot, then clicks frame)
4. When all slots filled, "Send to ComfyUI" button activates
5. Single job queued with all inputs

**API Integration:**
- POST to `{comfyuiBaseUrl}/prompt` with workflow JSON
- Replace `LoadImage` node values with base64-encoded images or file paths
- Poll `{comfyuiBaseUrl}/queue` for status updates

---

#### 5.1.4 Watch Folder

**Description:** Monitor a folder for new video files. When detected, show notification and add to queue.

**Behavior:**
- User configures watch folder path in settings
- App monitors folder using chokidar
- When new video file detected (mp4, avi, mov, mkv, webm):
  - Show system notification: "New video detected: {filename}"
  - Add video to queue
  - Do NOT auto-load (user must click to load)
- Watch continues in background even when processing other videos

**Implementation Notes:**
- Use chokidar with `awaitWriteFinish` option to avoid partial file detection
- Store watch folder path in settings
- Show indicator in UI when watch is active
- Allow enabling/disabling watch without clearing the path

---

#### 5.1.5 Custom Frame Count

**Description:** User can choose how many preview frames to extract (not just fixed 15).

**Behavior:**
- Dropdown or slider in toolbar: 5, 10, 15, 20, 30, 60, 100 frames
- Default: 15
- Changing frame count re-extracts frames for current video
- Setting is persisted and applies to newly loaded videos

**Implementation Notes:**
- Frames are evenly distributed across video duration
- First frame is always at 0.1 seconds (avoid black intro frames)
- Last frame is at `duration - 0.1` seconds (avoid black outro frames)

---

#### 5.1.6 Frame Scrubber

**Description:** Seek through video with precision using a scrubber control.

**Behavior:**
- Horizontal scrubber bar below video player
- Drag scrubber to seek to any timestamp
- Current timestamp displayed as `MM:SS.ms`
- Video thumbnail updates in real-time while scrubbing
- Click anywhere on scrubber bar to jump to that position

**Implementation Notes:**
- Use HTML5 video `currentTime` property for seeking
- Debounce rapid seeks to avoid performance issues
- Show frame number alongside timestamp

---

#### 5.1.7 Batch Video Queue

**Description:** Queue multiple videos for sequential processing.

**Behavior:**
- Drag-and-drop multiple videos onto app window to add to queue
- Or use "Add to Queue" button in file picker
- Queue panel shows list of pending videos with:
  - Filename
  - Thumbnail (first frame)
  - Added timestamp
  - Status (pending/processing/completed)
- Click on queued video to load it
- "Process Next" button loads next pending video
- Completed videos can be removed or cleared

**Implementation Notes:**
- Store queue in database for persistence across restarts
- Queue is separate from "videos in current directory" navigation

---

#### 5.1.8 Smart Frame Selection (Scene Detection)

**Description:** Automatically detect scene changes and suggest "interesting" frames.

**Behavior:**
- "Analyze" button triggers scene detection
- Analysis runs in background with progress indicator
- Frames at scene boundaries are marked with special indicator (e.g., orange dot)
- User can filter to show only scene-change frames
- Does NOT auto-select; just highlights suggestions

**Implementation Notes:**
- Use FFmpeg's `select='gt(scene,0.3)'` filter for scene detection
- Store scene scores in frame_analysis table
- Threshold configurable in settings (default 0.3)

---

#### 5.1.9 Frame Similarity Detection

**Description:** Detect near-duplicate frames using perceptual hashing.

**Behavior:**
- Analysis runs automatically after frames are extracted
- Or triggered manually via "Analyze" button
- Similar frames are grouped; only first in group shown by default
- "Show Duplicates" toggle reveals hidden duplicates
- Duplicate frames show link icon or chain indicator
- Similarity threshold configurable (default: 90% match)

**Implementation Notes:**
- Use perceptual hashing (pHash) via sharp or jimp
- Calculate hamming distance between hashes
- Frames with distance < threshold are considered duplicates
- Group duplicates by finding connected components

---

#### 5.1.10 Blur/Quality Scoring

**Description:** Detect blurry frames (often caused by motion blur in AI videos).

**Behavior:**
- Analysis runs automatically after frames are extracted
- Blurry frames show blur indicator (e.g., water drop icon)
- "Hide Blurry" toggle filters out frames above blur threshold
- Blur threshold configurable (default: 50 on 0-100 scale)
- Hover on frame shows blur score

**Implementation Notes:**
- Use Laplacian variance method for blur detection:
  1. Convert to grayscale
  2. Apply Laplacian filter
  3. Calculate variance of result
  4. Lower variance = more blurry
- Normalize scores to 0-100 scale
- Use sharp library for image processing

---

#### 5.1.11 Workflow Templates

**Description:** Save and manage ComfyUI workflow configurations.

**Behavior:**
- "Manage Templates" opens template management dialog
- "Add Template" lets user browse to workflow JSON file
- App parses JSON and detects LoadImage nodes automatically
- Template saved with:
  - User-friendly name
  - File path to JSON
  - List of input nodes (nodeId, nodeName)
- Templates appear in dropdown when selecting workflow
- "Edit" allows renaming; "Delete" removes template
- "Refresh" re-parses JSON to detect changes

**Workflow Parsing Logic:**
```typescript
// Pseudocode for parsing ComfyUI workflow JSON
function parseWorkflow(jsonPath: string): WorkflowInputNode[] {
  const workflow = JSON.parse(readFile(jsonPath));
  const inputNodes: WorkflowInputNode[] = [];

  for (const [nodeId, node] of Object.entries(workflow)) {
    if (node.class_type === 'LoadImage') {
      inputNodes.push({
        nodeId: nodeId,
        nodeName: node._meta?.title || node.class_type,
        nodeType: node.class_type
      });
    }
  }

  return inputNodes;
}
```

---

#### 5.1.12 Frame Stepping

**Description:** Step through video one frame at a time.

**Keyboard Shortcuts:**
- `←` (Left Arrow): Step backward one frame
- `→` (Right Arrow): Step forward one frame

**Behavior:**
- Each press moves exactly one frame (based on video frame rate)
- Frame number and timestamp update in display
- Works regardless of which UI element has focus
- If at first frame, left arrow does nothing (no wrap)
- If at last frame, right arrow does nothing (no wrap)

**Implementation Notes:**
- Calculate frame duration: `1 / frameRate`
- Seek to: `currentTime ± frameDuration`
- Clamp to valid range: `[0, duration]`

---

#### 5.1.13 Video Navigation

**Keyboard Shortcuts:**
- `↑` (Up Arrow): Go to previous video in directory (older)
- `↓` (Down Arrow): Go to next video in directory (newer)

**Behavior:**
- Videos in directory sorted by date modified (newest first)
- Navigation wraps: at newest → up goes to oldest; at oldest → down goes to newest
- Current video's selection state saved before navigating
- Show brief toast notification with new video name

---

#### 5.1.14 Extract at Playhead

**Description:** Extract the exact frame at current playhead position (not limited to pre-extracted thumbnails).

**Behavior:**
- "Grab Frame" button (or `G` hotkey) extracts current frame
- Extracted frame added to selection
- If frame number already exists in grid, it gets selected
- If frame number is between grid frames, it's added as a new entry
- Frame is immediately saved to thumbnail cache

**Implementation Notes:**
- Use FFmpeg to extract single frame at exact timestamp
- Calculate frame number from timestamp and frame rate
- Insert into frames array at correct position (sorted by frame number)

---

#### 5.1.15 Thumbnail Grid Density

**Description:** Adjust thumbnail size to show more or fewer frames at once.

**Options:**
- **Small:** ~100px thumbnails, shows 30+ frames
- **Medium:** ~200px thumbnails, shows 15-20 frames (default)
- **Large:** ~350px thumbnails, shows 6-10 frames

**Behavior:**
- Toggle button or dropdown in toolbar
- Setting persisted across sessions
- Grid reflows responsively based on window size

---

#### 5.1.16 Timeline Markers

**Description:** Drop persistent markers at specific timestamps for quick navigation.

**Behavior:**
- `M` hotkey drops marker at current position
- Markers shown as colored flags on scrubber timeline
- Click marker to jump to that timestamp
- Right-click marker to delete or edit label
- Markers persisted per video in database
- Default label is timestamp; user can rename

**Implementation Notes:**
- Store in `video_states.timeline_markers` as JSON
- Render markers as absolute-positioned elements on scrubber
- Support at least 20 markers per video

---

#### 5.1.17 GIF/Video from Selection

**Description:** Export selected frames as animated GIF or MP4 video.

**Behavior:**
- "Export Animation" button opens export dialog
- Options:
  - Format: GIF or MP4
  - Frame rate: same as source (default), or custom
  - Loop: none (default), or specify count
  - Quality: same as source
- Frames exported in selection order (by frame number)
- Output saved to same location as frame saves

**Implementation Notes:**
- Use FFmpeg to create GIF: `ffmpeg -framerate {fps} -i frame_%04d.png output.gif`
- Use FFmpeg to create MP4: `ffmpeg -framerate {fps} -i frame_%04d.png -c:v libx264 output.mp4`
- For GIF, consider palette generation for better quality

---

#### 5.1.18 Range Selection

**Description:** Select all frames between two clicked frames.

**Behavior:**
- Click first frame to select it
- Shift+click second frame to select all frames in between (inclusive)
- Works with any two frames, regardless of order clicked
- If frames between are filtered/hidden, they are NOT selected

**Implementation Notes:**
- Track last-clicked frame number
- On shift+click, select range `[min, max]` of the two frame numbers
- Only select frames that are currently visible (not filtered)

---

#### 5.1.19 Prompt Metadata Extraction

**Description:** Extract and display ComfyUI generation parameters from video metadata.

**Behavior:**
- If video contains ComfyUI workflow metadata, show "View Prompt" button
- Clicking opens modal with:
  - Full workflow JSON (collapsible)
  - Extracted key parameters (model, sampler, steps, etc.)
  - Copy button for prompt text
- If no metadata found, button is hidden/disabled

**Implementation Notes:**
- ComfyUI embeds metadata in PNG files; check if it does for videos
- May need to check for sidecar JSON files (same name as video, .json extension)
- Use FFprobe to check for embedded metadata streams

---

### 5.2 Phase 2 Features (Power User)

These features are lower priority and should be implemented after Phase 1 is stable.

#### 5.2.1 Comparison View
Load two videos side-by-side with synchronized playback for frame-by-frame comparison.

#### 5.2.2 Contact Sheet Export
Export all selected frames as a single grid image with customizable rows/columns.

#### 5.2.3 Frame Tagging
Assign color-coded labels/tags to frames. Filter view by tag.

#### 5.2.4 Export Presets
Save named combinations of output settings (format, quality, folder, naming pattern).

#### 5.2.5 Playback Speed Control
Buttons for 0.25x, 0.5x, 1x, 2x playback speed.

---

### 5.3 Phase 3 Features (Advanced)

These are future features to consider after Phase 2.

#### 5.3.1 Motion Heatmap Overlay
Visualize motion intensity across frames as a color overlay.

#### 5.3.2 CLI / Headless Mode
Command-line interface for scripted batch processing.

#### 5.3.3 Visual Similarity Clustering
Group frames by visual similarity with interactive cluster view.

#### 5.3.4 Plugin Architecture
Allow custom JavaScript extensions to hook into extraction pipeline.

#### 5.3.5 Session History
Track processed videos, saved frames, and settings over time.

---

## 6. UI/UX Design

### 6.1 Main Window Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  FrameFarmer                                                        [─] [□] [×]    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              TOOLBAR                                         │   │
│  │  [Open] [Save Selected] [Export GIF] │ Frames: [15 ▼] │ Size: [M] │ [⚙]    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │                                 │  │                                         │  │
│  │                                 │  │              FRAME GRID                 │  │
│  │         VIDEO PLAYER            │  │                                         │  │
│  │                                 │  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │  │
│  │                                 │  │   │  1  │ │  2  │ │  3  │ │  4  │      │  │
│  │                                 │  │   │ ✓   │ │     │ │ ✓   │ │  ⚠  │      │  │
│  │    ┌─────────────────────┐     │  │   └─────┘ └─────┘ └─────┘ └─────┘      │  │
│  │    │      [VIDEO]        │     │  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │  │
│  │    │                     │     │  │   │  5  │ │  6  │ │  7  │ │  8  │      │  │
│  │    │                     │     │  │   │     │ │ 🔗  │ │     │ │     │      │  │
│  │    └─────────────────────┘     │  │   └─────┘ └─────┘ └─────┘ └─────┘      │  │
│  │                                 │  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │  │
│  │    [|◀] [▶||] [▶] [◀|] 1.0x   │  │   │  9  │ │ 10  │ │ 11  │ │ 12  │      │  │
│  │    ├────────────●──────────┤   │  │   │     │ │     │ │ ✓   │ │     │      │  │
│  │    00:00:42.15  ▲  03:24.00   │  │   └─────┘ └─────┘ └─────┘ └─────┘      │  │
│  │               markers          │  │                                         │  │
│  │                                 │  │   Filter: [All ▼] │ [☐ Blur] [☐ Dupe]  │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                     │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │         VIDEO INFO              │  │           COMFYUI PANEL                 │  │
│  │  myanimation_v3.mp4             │  │  Workflow: [FLF2V Template     ▼]       │  │
│  │  1920x1080 @ 24fps              │  │                                         │  │
│  │  Duration: 03:24                │  │  ┌─────────────┐  ┌─────────────┐       │  │
│  │  Size: 245.3 MB                 │  │  │ first_frame │  │ last_frame  │       │  │
│  │  Modified: 2025-01-31 14:30     │  │  │   [img]     │  │   [img]     │       │  │
│  │                                 │  │  │   Drop here │  │   Drop here │       │  │
│  │  Selected: 4 frames             │  │  └─────────────┘  └─────────────┘       │  │
│  │  Queue: 3 videos pending        │  │                                         │  │
│  │                                 │  │  [Send to ComfyUI]    Status: Ready     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  QUEUE: [vid1.mp4 ✓] [vid2.mp4 ⟳] [vid3.mp4 ○] [vid4.mp4 ○]    [Clear]     │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ◀ 1/24 videos │ Status: Analyzing frames... 45%                    │ Watch: ON   │
└─────────────────────────────────────────────────────────────────────────────────────┘

LEGEND:
  ✓  = Selected frame
  ⚠  = Blurry frame indicator
  🔗 = Duplicate frame indicator
  ●  = Timeline marker
  ○  = Pending in queue
  ⟳  = Currently processing
```

### 6.2 Component Breakdown

#### Toolbar
- **Open:** File picker for video
- **Save Selected:** Save selected frames to disk
- **Export GIF:** Export animation from selection
- **Frames dropdown:** 5/10/15/20/30/60/100
- **Size toggle:** S/M/L thumbnails
- **Settings cog:** Open settings dialog

#### Video Player Panel
- HTML5 video element
- Custom controls below video:
  - Frame step buttons: `|◀` (first) `◀` (prev frame) `▶` (next frame) `▶|` (last)
  - Play/pause button
  - Playback speed indicator
- Scrubber/timeline with:
  - Current position indicator
  - Timeline markers (colored flags)
  - Draggable scrubber thumb
- Timestamp display: current / total
- Frame number display

#### Frame Grid Panel
- Scrollable grid of frame thumbnails
- Each thumbnail shows:
  - Frame number (top-left corner)
  - Selection checkbox (top-right corner, visible on hover or if selected)
  - Blur indicator (if applicable)
  - Duplicate indicator (if applicable)
- Filter bar at bottom:
  - Filter dropdown: All / Selected / Unselected
  - Blur toggle: Show/hide blurry frames
  - Duplicate toggle: Show/hide duplicate frames

#### Video Info Panel
- Filename
- Resolution and frame rate
- Duration
- File size
- Modified date
- Selection count
- Queue count

#### ComfyUI Panel
- Workflow template dropdown
- Input slots (for multi-input workflows)
- Send button
- Connection status indicator

#### Queue Bar (bottom)
- Horizontal list of queued videos
- Status icons for each
- Clear button

#### Status Bar (bottom)
- Current video index / total in directory
- Analysis progress
- Watch folder status

### 6.3 Color Scheme (Dark Mode)

```css
/* Primary colors */
--bg-primary: #1a1a1a;
--bg-secondary: #242424;
--bg-tertiary: #2d2d2d;
--text-primary: #e0e0e0;
--text-secondary: #a0a0a0;
--accent: #3b82f6;        /* Blue for selection */
--accent-hover: #60a5fa;
--success: #22c55e;       /* Green for completed */
--warning: #f59e0b;       /* Orange for blur/scene */
--error: #ef4444;         /* Red for errors */
--border: #404040;

/* Frame states */
--frame-selected: #3b82f6;
--frame-hover: #404040;
--frame-blurry: #f59e0b;
--frame-duplicate: #8b5cf6;  /* Purple for duplicates */
```

### 6.4 Responsive Behavior

- **Minimum window size:** 1200 x 800 pixels
- **Panels resize proportionally** when window resizes
- **Frame grid reflows** based on thumbnail size and panel width
- **Collapsible panels:** Video info and ComfyUI panels can collapse to give more space
- **Remember window position/size** across sessions

---

## 7. ComfyUI Integration

### 7.1 API Endpoints

Base URL (configurable): `http://192.168.86.31:8188`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check |
| `/prompt` | POST | Queue a new prompt |
| `/queue` | GET | Get queue status |
| `/history` | GET | Get generation history |
| `/upload/image` | POST | Upload image to ComfyUI |
| `/view` | GET | View generated image |

### 7.2 Workflow JSON Structure

ComfyUI workflows are JSON objects where keys are node IDs:

```json
{
  "3": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "example.png",
      "upload": "image"
    },
    "_meta": {
      "title": "first_frame"
    }
  },
  "4": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "example.png",
      "upload": "image"
    },
    "_meta": {
      "title": "last_frame"
    }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 12345,
      "steps": 20,
      ...
    }
  }
}
```

### 7.3 Sending Frames to ComfyUI

**Option A: Upload Image First (Recommended)**

1. POST image to `/upload/image` as multipart form data
2. Receive filename in response
3. Modify workflow JSON to reference uploaded filename
4. POST workflow to `/prompt`

```typescript
async function sendFrameToComfyUI(
  imagePath: string,
  workflow: object,
  nodeId: string,
  comfyuiUrl: string
): Promise<string> {
  // 1. Upload image
  const formData = new FormData();
  formData.append('image', fs.createReadStream(imagePath));

  const uploadResponse = await fetch(`${comfyuiUrl}/upload/image`, {
    method: 'POST',
    body: formData
  });
  const { name: uploadedFilename } = await uploadResponse.json();

  // 2. Modify workflow to use uploaded image
  const modifiedWorkflow = JSON.parse(JSON.stringify(workflow));
  modifiedWorkflow[nodeId].inputs.image = uploadedFilename;

  // 3. Queue prompt
  const promptResponse = await fetch(`${comfyuiUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: modifiedWorkflow })
  });

  const { prompt_id } = await promptResponse.json();
  return prompt_id;
}
```

### 7.4 Queue Monitoring

Poll `/queue` endpoint to get status:

```json
{
  "queue_running": [
    ["prompt_id_1", 0, { ... }, { ... }]
  ],
  "queue_pending": [
    ["prompt_id_2", 1, { ... }, { ... }]
  ]
}
```

Implementation:
- Poll every 2 seconds while jobs are queued
- Update UI with current status
- Stop polling when queue is empty

---

## 8. FFmpeg Integration

### 8.1 Finding FFmpeg

Check these locations in order:

1. `process.env.FFMPEG_PATH` (environment variable)
2. App's `resources` folder (for bundled FFmpeg)
3. `C:\ffmpeg\bin\ffmpeg.exe` (Windows common location)
4. `PATH` environment variable (run `ffmpeg -version` to test)

If not found, show error directing user to install FFmpeg.

### 8.2 Common Commands

#### Get Video Info
```bash
ffprobe -v quiet -print_format json -show_format -show_streams "video.mp4"
```

Parse JSON output for:
- `streams[0].width`, `streams[0].height` — resolution
- `streams[0].r_frame_rate` — frame rate (e.g., "24000/1001")
- `format.duration` — duration in seconds
- `format.size` — file size in bytes

#### Extract Single Frame
```bash
ffmpeg -ss {timestamp} -i "video.mp4" -vframes 1 -q:v 2 "output.png"
```

- `-ss` before `-i` for fast seeking
- `-vframes 1` extracts exactly one frame
- `-q:v 2` sets quality (1-31, lower = better)

#### Extract Multiple Frames at Specific Times
```bash
ffmpeg -i "video.mp4" -vf "select='eq(n,42)+eq(n,100)+eq(n,150)',setpts=N/FRAME_RATE/TB" -vsync vfr "frame_%03d.png"
```

For many frames, it's often faster to extract individually in parallel.

#### Extract Frames for Thumbnails (Reduced Size)
```bash
ffmpeg -ss {timestamp} -i "video.mp4" -vframes 1 -vf "scale=320:-1" "thumb.jpg"
```

- `-vf "scale=320:-1"` scales to 320px width, maintains aspect ratio

#### Scene Detection
```bash
ffmpeg -i "video.mp4" -vf "select='gt(scene,0.3)',showinfo" -vsync vfr "scene_%03d.png" 2>&1 | grep showinfo
```

Parse output for `pts_time` values to get scene change timestamps.

#### Create GIF from Frames
```bash
# Generate palette first for better quality
ffmpeg -framerate {fps} -i "frame_%04d.png" -vf "palettegen" "palette.png"

# Create GIF using palette
ffmpeg -framerate {fps} -i "frame_%04d.png" -i "palette.png" -lavfi "paletteuse" "output.gif"
```

#### Create MP4 from Frames
```bash
ffmpeg -framerate {fps} -i "frame_%04d.png" -c:v libx264 -pix_fmt yuv420p "output.mp4"
```

### 8.3 FFmpeg Service Implementation

```typescript
// src/main/services/ffmpeg.ts

import { spawn } from 'child_process';
import path from 'path';

class FFmpegService {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    this.ffmpegPath = this.findFFmpeg();
    this.ffprobePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe');
  }

  private findFFmpeg(): string {
    // Implementation as described in 8.1
  }

  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let output = '';
      proc.stdout.on('data', (data) => output += data);
      proc.on('close', (code) => {
        if (code === 0) {
          const parsed = JSON.parse(output);
          resolve(this.parseVideoInfo(parsed, videoPath));
        } else {
          reject(new Error(`FFprobe exited with code ${code}`));
        }
      });
    });
  }

  async extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    options?: { width?: number }
  ): Promise<void> {
    const args = [
      '-ss', timestamp.toFixed(3),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2'
    ];

    if (options?.width) {
      args.push('-vf', `scale=${options.width}:-1`);
    }

    args.push('-y', outputPath);

    return this.runFFmpeg(args);
  }

  async extractMultipleFrames(
    videoPath: string,
    timestamps: number[],
    outputDir: string,
    options?: { width?: number }
  ): Promise<string[]> {
    // Extract frames in parallel (max 4 concurrent)
    const results: string[] = [];
    const batchSize = 4;

    for (let i = 0; i < timestamps.length; i += batchSize) {
      const batch = timestamps.slice(i, i + batchSize);
      const promises = batch.map((ts, idx) => {
        const outputPath = path.join(outputDir, `frame_${String(i + idx).padStart(5, '0')}.png`);
        return this.extractFrame(videoPath, ts, outputPath, options)
          .then(() => outputPath);
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args);

      let stderr = '';
      proc.stderr.on('data', (data) => stderr += data);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg error: ${stderr}`));
        }
      });
    });
  }
}

export const ffmpegService = new FFmpegService();
```

---

## 9. Frame Analysis Algorithms

### 9.1 Blur Detection

Use Laplacian variance method:

```typescript
// src/main/services/analyzer.ts

import sharp from 'sharp';

async function calculateBlurScore(imagePath: string): Promise<number> {
  // Load image and convert to grayscale
  const { data, info } = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  // Apply Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -4 * data[idx] +
        data[idx - 1] +
        data[idx + 1] +
        data[idx - width] +
        data[idx + width];

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / count;
  const variance = (sumSq / count) - (mean * mean);

  // Normalize to 0-100 scale (higher = more blurry)
  // Typical variance ranges from 0 (very blurry) to 2000+ (very sharp)
  const normalizedScore = Math.max(0, Math.min(100, 100 - (variance / 20)));

  return normalizedScore;
}
```

**Interpretation:**
- Score 0-30: Sharp image
- Score 30-50: Slightly soft
- Score 50-70: Noticeably blurry
- Score 70-100: Very blurry

### 9.2 Perceptual Hashing (Similarity Detection)

Use difference hash (dHash) for speed:

```typescript
async function calculatePerceptualHash(imagePath: string): Promise<string> {
  // Resize to 9x8 (to get 8x8 differences)
  const { data } = await sharp(imagePath)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate horizontal gradient
  let hash = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      hash += left < right ? '1' : '0';
    }
  }

  // Convert binary string to hex
  return BigInt('0b' + hash).toString(16).padStart(16, '0');
}

function hammingDistance(hash1: string, hash2: string): number {
  const bin1 = BigInt('0x' + hash1);
  const bin2 = BigInt('0x' + hash2);
  const xor = bin1 ^ bin2;
  return xor.toString(2).split('1').length - 1;
}

function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  // 64 bits total, so max distance is 64
  return ((64 - distance) / 64) * 100;
}
```

**Usage:**
- Two frames with similarity >= 90% are considered duplicates (threshold configurable)
- Group duplicates by finding connected components where each pair exceeds threshold

### 9.3 Analysis Pipeline

```typescript
interface AnalysisResult {
  frameNumber: number;
  timestamp: number;
  blurScore: number;
  perceptualHash: string;
}

async function analyzeFrames(
  framePaths: Array<{ path: string; frameNumber: number; timestamp: number }>,
  onProgress: (progress: number) => void
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (let i = 0; i < framePaths.length; i++) {
    const { path, frameNumber, timestamp } = framePaths[i];

    const [blurScore, perceptualHash] = await Promise.all([
      calculateBlurScore(path),
      calculatePerceptualHash(path)
    ]);

    results.push({ frameNumber, timestamp, blurScore, perceptualHash });
    onProgress(((i + 1) / framePaths.length) * 100);
  }

  return results;
}
```

---

## 10. Keyboard Shortcuts

### 10.1 Global Shortcuts (work regardless of focus)

| Key | Action |
|-----|--------|
| `←` | Step backward one frame |
| `→` | Step forward one frame |
| `↑` | Previous video in directory |
| `↓` | Next video in directory |
| `Space` | Play/pause video |
| `Home` | Go to first frame |
| `End` | Go to last frame |
| `G` | Grab frame at current position |
| `M` | Add timeline marker at current position |
| `Delete` | Delete selected timeline marker |

### 10.2 Selection Shortcuts

| Key | Action |
|-----|--------|
| `A` | Select all visible frames |
| `N` | Select none (clear selection) |
| `I` | Invert selection |
| `1-9` | Toggle selection on frame 1-9 |
| `Shift+Click` | Range select (from last clicked to current) |
| `Ctrl+Click` | Toggle single frame without affecting others |

### 10.3 View Shortcuts

| Key | Action |
|-----|--------|
| `[` | Decrease thumbnail size |
| `]` | Increase thumbnail size |
| `F` | Toggle fullscreen video |
| `B` | Toggle blur filter |
| `D` | Toggle duplicate filter |

### 10.4 Action Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save selected frames |
| `Ctrl+E` | Export animation (GIF/MP4) |
| `Ctrl+O` | Open file picker |
| `Ctrl+,` | Open settings |
| `Ctrl+Q` | Quit application |

### 10.5 Implementation

Use Electron's global shortcuts and React key event handlers:

```typescript
// src/renderer/hooks/useKeyboardShortcuts.ts

import { useEffect } from 'react';
import { useStore } from '../store';

export function useKeyboardShortcuts() {
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          store.stepFrameBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          store.stepFrameForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          store.goToPreviousVideo();
          break;
        case 'ArrowDown':
          e.preventDefault();
          store.goToNextVideo();
          break;
        case ' ':
          e.preventDefault();
          store.togglePlayPause();
          break;
        case 'a':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            store.selectAll();
          }
          break;
        // ... etc
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);
}
```

---

## 11. Configuration & Settings

### 11.1 Settings Schema

```typescript
interface AppSettings {
  // ComfyUI Connection
  comfyuiBaseUrl: string;           // Default: "http://192.168.86.31:8188"
  comfyuiTimeout: number;           // Default: 30000 (ms)

  // Watch Folder
  watchFolderPath: string | null;   // Default: null
  watchFolderEnabled: boolean;      // Default: false

  // Frame Extraction
  defaultFrameCount: number;        // Default: 15
  thumbnailWidth: number;           // Default: 320 (pixels)

  // Analysis
  blurThreshold: number;            // Default: 50 (0-100, higher = more tolerant)
  similarityThreshold: number;      // Default: 90 (percentage)
  autoAnalyze: boolean;             // Default: true

  // Output
  outputFolderBase: string | null;  // Default: null (same as video folder)
  filenamePattern: string;          // Default: "{video}_frame_{frame}_{datetime}"
  outputFormat: 'png' | 'jpg';      // Default: 'png'
  jpgQuality: number;               // Default: 95 (1-100)

  // Export
  gifFrameRate: number;             // Default: 0 (use source fps)
  gifLoop: boolean;                 // Default: false

  // UI
  darkMode: boolean;                // Default: true
  thumbnailSize: 'small' | 'medium' | 'large';  // Default: 'medium'
  showFrameNumbers: boolean;        // Default: true

  // Window
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;                         // Default: null (use defaults)

  // FFmpeg
  ffmpegPath: string | null;        // Default: null (auto-detect)
}
```

### 11.2 Settings Dialog Layout

```
┌──────────────────────────────────────────────────────────┐
│  Settings                                          [×]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ ComfyUI ─────────────────────────────────────────┐  │
│  │  Server URL: [http://192.168.86.31:8188    ]      │  │
│  │  Timeout:    [30    ] seconds                     │  │
│  │              [Test Connection]  ● Connected       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Watch Folder ────────────────────────────────────┐  │
│  │  [☑] Enable watch folder                          │  │
│  │  Path: [C:\ComfyUI\output              ] [Browse] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Frame Extraction ────────────────────────────────┐  │
│  │  Default frame count: [15 ▼]                      │  │
│  │  [☑] Auto-analyze frames after extraction         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Analysis Thresholds ─────────────────────────────┐  │
│  │  Blur threshold:       [====●=====] 50            │  │
│  │  Similarity threshold: [========●=] 90%           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Output ──────────────────────────────────────────┐  │
│  │  Output folder: [Same as video folder      ] [..] │  │
│  │  Format: (●) PNG  ( ) JPG  Quality: [95]          │  │
│  │  Filename pattern: [{video}_frame_{frame}_{date}] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ FFmpeg ──────────────────────────────────────────┐  │
│  │  Path: [Auto-detect                      ] [...]  │  │
│  │  Status: ✓ Found at C:\ffmpeg\bin\ffmpeg.exe      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│                              [Cancel]  [Save Settings]   │
└──────────────────────────────────────────────────────────┘
```

### 11.3 Filename Pattern Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `{video}` | Video filename without extension | `myanimation_v3` |
| `{frame}` | Frame number (5 digits, zero-padded) | `00042` |
| `{time}` | Frame timestamp as MM-SS-mmm | `01-23-456` |
| `{date}` | Current date as YYYY-MM-DD | `2025-01-31` |
| `{datetime}` | Current datetime as YYYY-MM-DD_HHmmss | `2025-01-31_143052` |

---

## 12. File & Folder Structure

### 12.1 Project Structure

```
framefarmer/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── .eslintrc.js
├── .prettierrc
│
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Main entry point
│   │   ├── preload.ts             # Preload script for IPC
│   │   ├── ipc/                   # IPC handlers
│   │   │   ├── video.ts
│   │   │   ├── frame.ts
│   │   │   ├── filesystem.ts
│   │   │   ├── database.ts
│   │   │   └── comfyui.ts
│   │   ├── services/              # Business logic
│   │   │   ├── ffmpeg.ts
│   │   │   ├── analyzer.ts
│   │   │   ├── watcher.ts
│   │   │   └── database.ts
│   │   └── utils/
│   │       └── paths.ts
│   │
│   ├── renderer/                  # React frontend
│   │   ├── index.html
│   │   ├── main.tsx               # React entry point
│   │   ├── App.tsx                # Root component
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   ├── StatusBar.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── video/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── VideoControls.tsx
│   │   │   │   ├── Scrubber.tsx
│   │   │   │   └── TimelineMarkers.tsx
│   │   │   ├── frames/
│   │   │   │   ├── FrameGrid.tsx
│   │   │   │   ├── FrameThumbnail.tsx
│   │   │   │   ├── FrameFilters.tsx
│   │   │   │   └── FrameAnalysisBadge.tsx
│   │   │   ├── comfyui/
│   │   │   │   ├── ComfyUIPanel.tsx
│   │   │   │   ├── WorkflowSelector.tsx
│   │   │   │   ├── InputSlots.tsx
│   │   │   │   └── QueueStatus.tsx
│   │   │   ├── queue/
│   │   │   │   ├── VideoQueue.tsx
│   │   │   │   └── QueueItem.tsx
│   │   │   ├── dialogs/
│   │   │   │   ├── SettingsDialog.tsx
│   │   │   │   ├── ExportDialog.tsx
│   │   │   │   ├── WorkflowManager.tsx
│   │   │   │   └── ConfirmDialog.tsx
│   │   │   └── common/
│   │   │       ├── Button.tsx
│   │   │       ├── Dropdown.tsx
│   │   │       ├── Slider.tsx
│   │   │       ├── Toggle.tsx
│   │   │       └── Toast.tsx
│   │   ├── hooks/
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useVideoPlayer.ts
│   │   │   ├── useFrameSelection.ts
│   │   │   └── useIPC.ts
│   │   ├── store/
│   │   │   ├── index.ts           # Zustand store
│   │   │   └── slices/
│   │   │       ├── videoSlice.ts
│   │   │       ├── framesSlice.ts
│   │   │       ├── comfyuiSlice.ts
│   │   │       └── settingsSlice.ts
│   │   ├── styles/
│   │   │   └── globals.css        # Tailwind imports
│   │   └── utils/
│   │       ├── formatters.ts
│   │       └── validators.ts
│   │
│   └── shared/                    # Shared between main and renderer
│       └── types.ts               # TypeScript type definitions
│
├── resources/                     # Static assets for packaging
│   └── icon.ico
│
└── dist/                          # Build output (gitignored)
    ├── main/
    └── renderer/
```

### 12.2 App Data Locations

| Platform | Location |
|----------|----------|
| Windows | `%APPDATA%\FrameFarmer\` |
| macOS | `~/Library/Application Support/FrameFarmer/` |
| Linux | `~/.config/FrameFarmer/` |

Contents:
```
FrameFarmer/
├── framefarmer.db          # SQLite database
├── cache/                  # Thumbnail cache
│   └── {cache_key}/        # Per-video cache folder (cache_key = md5(filePath + mtimeMs).substring(0,16))
│       ├── thumb_00001.jpg
│       ├── thumb_00002.jpg
│       └── ...
└── logs/                   # Application logs
    └── framefarmer.log
```

**Note on Cache Key:** The cache key is computed as `md5(filePath + mtimeMs).substring(0, 16)` rather than hashing the video file content. This is instant to compute regardless of file size and still invalidates the cache when the video file is modified.

### 12.3 Output Folder Structure

When saving selected frames:

```
{video_directory}/
└── {video_name}_{date}/
    ├── myanimation_frame_00042_2025-01-31_143052.png
    ├── myanimation_frame_00087_2025-01-31_143052.png
    ├── myanimation_frame_00123_2025-01-31_143052.png
    └── ...
```

---

## 13. Implementation Phases

### Phase 1: Core Features (This Document's Focus)

**Priority Order for Implementation:**

1. **Project Setup**
   - Initialize Electron + React + Vite project
   - Set up TypeScript, Tailwind, ESLint
   - Create basic window with IPC structure
   - Implement FFmpeg service

2. **Video Loading & Display**
   - File picker dialog
   - Video metadata extraction
   - HTML5 video player component
   - Basic playback controls (play/pause/seek)

3. **Frame Extraction & Grid**
   - Extract N frames from video
   - Thumbnail caching
   - Frame grid component
   - Thumbnail size toggle

4. **Frame Selection**
   - Click to select/deselect
   - Selection persistence (database)
   - Keyboard selection shortcuts
   - Range selection (shift+click)

5. **Frame Stepping & Navigation**
   - Arrow key frame stepping
   - Arrow key video navigation
   - Videos-in-directory listing
   - Extract at playhead

6. **Frame Analysis**
   - Blur detection
   - Perceptual hashing
   - Similarity detection
   - Filter toggles (blur/duplicate)

7. **Save & Export**
   - Save selected frames to disk
   - Output folder structure
   - Filename pattern
   - GIF/MP4 export

8. **Timeline Features**
   - Scrubber/seek bar
   - Timeline markers
   - Marker persistence

9. **Watch Folder & Queue**
   - File watcher service
   - Video queue UI
   - Queue persistence

10. **ComfyUI Integration**
    - Workflow JSON parsing
    - Workflow template management
    - Single-input workflow sending
    - Multi-input workflow UI
    - Queue status display

11. **Settings & Polish**
    - Settings dialog
    - All configuration options
    - Window state persistence
    - Error handling & notifications

### Phase 2: Power User Features

- Comparison view (side-by-side videos)
- Contact sheet export
- Frame tagging system
- Export presets
- Playback speed control

### Phase 3: Advanced Features

- Motion heatmap overlay
- CLI/headless mode
- Visual similarity clustering
- Plugin architecture
- Session history

---

## 14. Error Handling

### 14.1 Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| **FFmpeg Missing** | FFmpeg not installed | Show setup dialog with install instructions |
| **File Access** | Video deleted, permissions denied | Show error toast, offer to remove from queue |
| **ComfyUI Connection** | Server unreachable, timeout | Show connection error in panel, allow retry |
| **Analysis Failure** | Corrupt frame, out of memory | Skip frame, log warning, continue with others |
| **Database Error** | Disk full, corruption | Show error dialog, offer to reset database |

### 14.2 Error Display

- **Toast notifications** for recoverable errors (auto-dismiss after 5 seconds)
- **Modal dialogs** for critical errors requiring user action
- **Inline indicators** for per-item errors (e.g., failed frame extraction)

### 14.3 Logging

Use electron-log or similar:

```typescript
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

// Usage
log.info('Video loaded:', videoPath);
log.warn('Frame extraction failed, skipping:', frameNumber);
log.error('FFmpeg error:', error);
```

---

## 15. Testing Considerations

### 15.1 Test Categories

| Category | Focus Areas |
|----------|-------------|
| **Unit Tests** | FFmpeg command builders, analysis algorithms, filename pattern parsing |
| **Integration Tests** | IPC communication, database operations, ComfyUI API |
| **E2E Tests** | Full user workflows, keyboard shortcuts, drag-and-drop |

### 15.2 Test Data

Create a test fixtures folder with:
- Short test videos (various formats, frame rates, resolutions)
- Sample ComfyUI workflow JSON files
- Pre-calculated analysis results for comparison

### 15.3 Manual Testing Checklist

- [ ] Load video via file picker
- [ ] Load video via drag-and-drop
- [ ] Frame extraction completes without error
- [ ] Frame selection persists across app restart
- [ ] Arrow keys navigate frames/videos correctly
- [ ] Blur detection identifies blurry frames
- [ ] Duplicate detection groups similar frames
- [ ] Filters hide/show frames correctly
- [ ] Save selected creates correct folder/files
- [ ] GIF export produces valid GIF
- [ ] ComfyUI connection test works
- [ ] Workflow parsing identifies LoadImage nodes
- [ ] Single-input send queues correctly
- [ ] Multi-input slots accept dropped frames
- [ ] Watch folder detects new videos
- [ ] Queue processes videos in order
- [ ] Settings persist across restart
- [ ] Window position/size persists

---

## Appendix A: Sample ComfyUI Workflow (FLF2V)

```json
{
  "1": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "first_frame.png",
      "upload": "image"
    },
    "_meta": {
      "title": "First Frame"
    }
  },
  "2": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "last_frame.png",
      "upload": "image"
    },
    "_meta": {
      "title": "Last Frame"
    }
  },
  "3": {
    "class_type": "ImageInterpolation",
    "inputs": {
      "image_a": ["1", 0],
      "image_b": ["2", 0],
      "frames": 24,
      "model": "film"
    }
  },
  "4": {
    "class_type": "SaveAnimatedWEBP",
    "inputs": {
      "images": ["3", 0],
      "filename_prefix": "interpolated"
    }
  }
}
```

---

## Appendix B: Supported Video Formats

| Extension | Container | Notes |
|-----------|-----------|-------|
| `.mp4` | MPEG-4 | Most common, well supported |
| `.avi` | AVI | Legacy format |
| `.mov` | QuickTime | Common on macOS |
| `.mkv` | Matroska | Good for high quality |
| `.webm` | WebM | Common for web/AI output |
| `.wmv` | Windows Media | Legacy Windows format |

---

## Appendix C: Development Commands

```bash
# Install dependencies
npm install

# Start development (main + renderer with hot reload)
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package

# Run tests
npm run test

# Lint code
npm run lint

# Type check
npm run typecheck
```

---

## Appendix D: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-31 | Initial specification |

---

*End of Specification*
