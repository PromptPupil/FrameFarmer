// Thumbnail sizes in pixels
export const THUMBNAIL_SIZES = {
  small: 100,
  medium: 180,
  large: 280,
} as const;

// Frame count options
export const FRAME_COUNT_OPTIONS = [5, 10, 15, 20, 30, 60, 100] as const;

// Playback speed options
export const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2] as const;

// Supported video extensions
export const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'] as const;

// Analysis thresholds
export const DEFAULT_BLUR_THRESHOLD = 50;
export const DEFAULT_SIMILARITY_THRESHOLD = 90;

// UI timing
export const TOAST_DURATION_SHORT = 2000;
export const TOAST_DURATION_MEDIUM = 3000;
export const TOAST_DURATION_LONG = 5000;

// Scrubber debounce
export const SCRUBBER_DEBOUNCE_MS = 50;
